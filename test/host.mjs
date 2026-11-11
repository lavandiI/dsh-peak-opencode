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

globalThis.fetch = async () => ({ ok: true, json: async () => payload });

const routes = new Map();
const cleanups = [];
const ctx = {
	effect(factory) {
		const cleanup = factory();
		if (typeof cleanup === "function") cleanups.push(cleanup);
		return cleanup;
	},
	webServer: {
		register(definition) {
			routes.set(definition.path, definition);
			return () => {};
		}
	}
};

apply(ctx);
assert.equal(routes.size, 1, "host registers the catalog route");
const route = routes.get("/dsh-peak-opencode/models");
assert.ok(route && typeof route.handler === "function", "catalog route has a handler");

const response = {
	headers: {},
	statusCode: 0,
	setHeader(name, value) {
		this.headers[name] = value;
	},
	end(body) {
		this.body = body;
	}
};
await route.handler({ url: "/dsh-peak-opencode/models" }, response);
const body = JSON.parse(response.body);
assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
assert.equal(body.ok, true);
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

for (const cleanup of cleanups) cleanup();
console.log("all host checks passed");
