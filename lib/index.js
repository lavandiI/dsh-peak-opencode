/**
 * dsh-peak-opencode — хостовая половина.
 *
 * При старте DSH забирает публичный каталог моделей OpenCode Go
 * (https://opencode.ai/inference/go/v1/models), кэширует его и отдаёт
 * браузерной половине по /dsh-peak-opencode/models. API-ключ не нужен:
 * эндпоинт открытый и отдаёт те же цены/множители, что и страница тарифов.
 *
 * Браузер использует каталог, чтобы понять, у какой модели есть пиковые
 * часы (DeepSeek), а у какой — единый тариф (синяя полоса). Если сеть
 * недоступна, отдаём последний удачный снимок, а при его отсутствии —
 * пустой список с ошибкой: клиент продолжит работать по встроенным
 * правилам DeepSeek.
 */
export const name = "dsh-peak-opencode";
export const inject = ["webServer"];

const SOURCE = "https://opencode.ai/inference/go/v1/models";
const ROUTE = "/dsh-peak-opencode/models";
// Версия формата каталога: клиент принимает только ответ своей версии и иначе
// идёт за публичным эндпоинтом сам. Так старый хост (без since) не «перетирает»
// новые поля при обновлении клиентской половины без перезапуска DSH.
const FORMAT = 2;
const TTL = 6 * 60 * 60 * 1000;
const TIMEOUT = 15000;

function firstNumber(value) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (value !== null && typeof value === "object") {
		for (const item of Object.values(value)) {
			if (typeof item === "number" && Number.isFinite(item)) return item;
		}
	}
	return null;
}

/** Множитель пика: дни UTC, окна UTC, коэффициент. */
function peakRuleOf(multipliers) {
	if (!Array.isArray(multipliers)) return null;
	for (const multiplier of multipliers) {
		if (!multiplier || !(Number(multiplier.factor) > 1)) continue;
		const days = multiplier.when?.utc_days?.in;
		const clauses = multiplier.when?.any;
		if (!Array.isArray(days) || !Array.isArray(clauses)) continue;
		const windows = [];
		for (const clause of clauses) {
			let start = null;
			let end = null;
			for (const entry of clause?.all ?? []) {
				const hours = entry?.utc_hours;
				if (hours === undefined || hours === null) continue;
				if (hours.gte !== undefined && hours.gte !== null) start = hours.gte;
				if (hours.lt !== undefined && hours.lt !== null) end = hours.lt;
			}
			if (start !== null && end !== null) windows.push([start, end]);
		}
		if (windows.length > 0) return { days, windows, factor: Number(multiplier.factor) };
	}
	return null;
}

/** Множитель, привязанный к дате (а не к часам): у Gemini 4 Argon ×2 с 01.12.2026. */
function dateMultiplierOf(multipliers) {
	if (!Array.isArray(multipliers)) return null;
	for (const multiplier of multipliers) {
		if (!multiplier || !(Number(multiplier.factor) > 1)) continue;
		const gte = multiplier.when?.date?.gte;
		if (typeof gte !== "string") continue;
		const from = Date.parse(gte.length === 10 ? gte + "T00:00:00Z" : gte);
		if (!Number.isFinite(from)) continue;
		return { from, factor: Number(multiplier.factor) };
	}
	return null;
}

/** Сжимаем ответ каталога до полей, нужных полосе. */
function compactModels(payload) {
	const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
	const models = [];
	for (const raw of rows) {
		if (raw === null || typeof raw !== "object" || typeof raw.id !== "string" || raw.id === "") continue;
		const input = raw.cost?.text?.input ?? {};
		const output = raw.cost?.text?.output ?? {};
		models.push({
			id: raw.id,
			name: typeof raw.name === "string" && raw.name !== "" ? raw.name : raw.id,
			context: raw.context ?? raw.limit?.context ?? null,
			output: raw.output ?? raw.limit?.output ?? null,
			input: typeof input.price === "number" ? input.price : null,
			outputPrice: typeof output.price === "number" ? output.price : null,
			cacheRead: typeof input.cache?.read === "number" ? input.cache.read : null,
			cacheWrite: firstNumber(input.cache?.write),
			peak: peakRuleOf(raw.cost?.multipliers),
			since: dateMultiplierOf(raw.cost?.multipliers)
		});
	}
	return models;
}

function createCatalog() {
	let models = [];
	let updatedAt = 0;
	let source = SOURCE;
	let error = null;
	let inflight = null;

	async function download() {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT);
		try {
			const response = await fetch(SOURCE, {
				signal: controller.signal,
				headers: { "user-agent": "dsh-peak-opencode/0.4" }
			});
			if (!response.ok) throw new Error("HTTP " + response.status);
			const payload = await response.json();
			const next = compactModels(payload);
			if (next.length === 0) throw new Error("пустой каталог");
			return next;
		} finally {
			clearTimeout(timer);
		}
	}

	function refresh(force = false) {
		if (inflight !== null) return inflight;
		if (!force && updatedAt > 0 && Date.now() - updatedAt < TTL) return Promise.resolve(snapshot());
		inflight = (async () => {
			try {
				models = await download();
				updatedAt = Date.now();
				source = SOURCE;
				error = null;
			} catch (cause) {
				error = cause instanceof Error ? cause.message : String(cause);
			} finally {
				inflight = null;
			}
			return snapshot();
		})();
		return inflight;
	}

	function snapshot() {
		return { ok: error === null, format: FORMAT, source, updatedAt, models, error };
	}

	return { refresh, snapshot };
}

export function apply(ctx) {
	const catalog = createCatalog();

	// Забираем каталог сразу при старте DSH, не задерживая загрузку плагина.
	catalog.refresh();

	ctx.effect(() => {
		const timer = setInterval(() => catalog.refresh(true), TTL);
		return () => clearInterval(timer);
	}, "dsh-peak-opencode: catalog refresh");

	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: ROUTE,
		handler: async (req, res) => {
			let force = false;
			try {
				force = new URL(req.url ?? ROUTE, "http://dsh.local").searchParams.get("refresh") === "1";
			} catch (_) {}
			const payload = await catalog.refresh(force);
			res.statusCode = 200;
			res.setHeader("content-type", "application/json; charset=utf-8");
			res.setHeader("cache-control", "no-store");
			res.end(JSON.stringify(payload));
		}
	}), "dsh-peak-opencode: models route");
}
