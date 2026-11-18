import assert from "node:assert/strict";
import { apply } from "../lib/index.js";

const payload = {
	data: [
		{
			id: "deepseek-v4.1-flash",
			name: "DeepSeek V4.1 Flash",
			limit: { context: 1000000, output: 384000 },
			cost: {
				text: {
					input: { price: 0.15, cache: { read: 0.003 } },
					output: { price: 0.6 }
				},
				multipliers: [
					{
						when: {
							utc_days: { in: ["mon", "tue", "wed", "thu", "fri"] },
							any: [
								{ all: [{ utc_hours: { gte: "01:00" } }, { utc_hours: { lt: "04:00" } }] },
								{ all: [{ utc_hours: { gte: "06:00" } }, { utc_hours: { lt: "10:00" } }] }
							]
						},
						factor: 2
					}
				]
			}
		},
		{
			id: "glm-5.3",
			name: "GLM-5.3",
			limit: { context: 1000000, output: 131072 },
			cost: { text: { input: { price: 1.4, cache: { read: 0.26 } }, output: { price: 4.4 } } }
		},
		{
			id: "gemini-4-argon",
			name: "Gemini 4 Argon",
			limit: { context: 1048576, output: 65536 },
			cost: {
				text: { input: { price: 2, cache: { read: 0.1 } }, output: { price: 10 } },
				multipliers: [{ when: { date: { gte: "2026-12-01" } }, factor: 2 }]
			}
		}
	]
};

// Считаем обращения к upstream: столько же проверок ниже про ?refresh=1.
let fetchCalls = 0;
let failing = false;
globalThis.fetch = async () => {
	fetchCalls += 1;
	if (failing) return { ok: false, status: 500, json: async () => ({}) };
	return { ok: true, json: async () => payload };
};

const cleanups = [];

function makeCtx() {
	const registry = new Map();
	const ctx = {
		effect(factory) {
			const cleanup = factory();
			if (typeof cleanup === "function") cleanups.push(cleanup);
			return cleanup;
		},
		webServer: {
			register(definition) {
				registry.set(definition.path, definition);
				return () => {};
			}
		}
	};
	return { ctx, registry };
}

function makeResponse() {
	return {
		headers: {},
		statusCode: 0,
		setHeader(name, value) {
			this.headers[name] = value;
		},
		end(body) {
			this.body = body;
		}
	};
}

async function call(route, query = "") {
	const response = makeResponse();
	await route.handler({ url: "/dsh-peak-opencode/models" + query }, response);
	return { response, body: JSON.parse(response.body) };
}

// Время подменяем, чтобы проверить троттлинг ?refresh=1 без ожидания минуты.
const realNow = Date.now;
let now = Date.parse("2026-11-18T12:00:00Z");
Date.now = () => now;

try {
	const first = makeCtx();
	apply(first.ctx);
	assert.equal(first.registry.size, 1, "host registers the catalog route");
	const route = first.registry.get("/dsh-peak-opencode/models");
	assert.ok(route && typeof route.handler === "function", "catalog route has a handler");

	const initial = await call(route);
	const body = initial.body;
	assert.equal(initial.response.headers["content-type"], "application/json; charset=utf-8");
	assert.equal(body.ok, true);
	assert.equal(body.stale, false, "a fresh catalog is not stale");
	assert.equal(body.format, 2, "host announces the catalog format version");
	assert.equal(body.models.length, 3);

	const deepseek = body.models.find((model) => model.id === "deepseek-v4.1-flash");
	assert.ok(deepseek, "DeepSeek model is present");
	assert.deepEqual(deepseek.peak, {
		days: ["mon", "tue", "wed", "thu", "fri"],
		windows: [["01:00", "04:00"], ["06:00", "10:00"]],
		factor: 2
	});
	assert.equal(deepseek.input, 0.15);
	assert.equal(deepseek.outputPrice, 0.6);

	const glm = body.models.find((model) => model.id === "glm-5.3");
	assert.ok(glm, "flat model is present");
	assert.equal(glm.peak, null);
	assert.equal(glm.since, null);

	const gemini = body.models.find((model) => model.id === "gemini-4-argon");
	assert.ok(gemini, "dated model is present");
	assert.equal(gemini.peak, null, "date multiplier is not a peak-hours rule");
	assert.deepEqual(gemini.since, { from: Date.parse("2026-12-01T00:00:00Z"), factor: 2 });

	assert.equal(fetchCalls, 1, "startup fetched the catalog once");

	// ?refresh=1 сразу после загрузки не должен идти в сеть: иначе маршрут
	// превращается в усилитель запросов к opencode.ai.
	const throttled = await call(route, "?refresh=1");
	assert.equal(fetchCalls, 1, "?refresh=1 is throttled within a minute");
	assert.equal(throttled.body.updatedAt, body.updatedAt, "the throttled call returns the same snapshot");

	// Через минуту принудительное обновление снова работает.
	now += 61 * 1000;
	const refreshed = await call(route, "?refresh=1");
	assert.equal(fetchCalls, 2, "a forced refresh works after the throttle window");
	assert.equal(refreshed.body.updatedAt, now, "the forced refresh updates the snapshot time");

	// Упавшее обновление не отменяет пригодный снимок: ok остаётся true,
	// появляется stale и текст ошибки.
	failing = true;
	now += 61 * 1000;
	const stale = await call(route, "?refresh=1");
	assert.equal(stale.body.ok, true, "a failed refresh keeps a usable snapshot");
	assert.equal(stale.body.stale, true, "the snapshot is marked stale");
	assert.equal(stale.body.error, "HTTP 500", "the failure text is reported");
	assert.equal(stale.body.models.length, 3, "models survive a failed refresh");
	assert.equal(stale.body.updatedAt, refreshed.body.updatedAt, "the snapshot time is not overwritten by a failure");

	// Обычный запрос по-прежнему отдаёт данные, просто со stale.
	const again = await call(route);
	assert.equal(again.body.ok, true);
	assert.equal(again.body.stale, true);
	assert.equal(again.body.models.length, 3);

	// Холодный старт без сети: отдавать нечего — ok:false и пустой список,
	// по этому признаку клиент идёт за публичным каталогом сам.
	const cold = makeCtx();
	apply(cold.ctx);
	const coldRoute = cold.registry.get("/dsh-peak-opencode/models");
	const coldBody = (await call(coldRoute)).body;
	assert.equal(coldBody.ok, false, "a cold start without a network has no data");
	assert.equal(coldBody.stale, false, "an empty catalog is not reported as stale");
	assert.equal(coldBody.models.length, 0);
	assert.equal(coldBody.error, "HTTP 500");
} finally {
	Date.now = realNow;
	for (const cleanup of cleanups) cleanup();
}

console.log("all host checks passed");
