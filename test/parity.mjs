// Хост и клиент держат по копии разбора множителей: клиентская половина грузится
// как отдельный модуль и не может импортировать lib/index.js. Тест вытаскивает
// обе реализации прямо из исходников и сверяет их на одном каталоге, чтобы
// копии не разъехались при правке формата.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.join(import.meta.dirname, "..");

function grab(source, name) {
	const start = source.indexOf("function " + name + "(");
	if (start < 0) throw new Error("не найдена функция " + name);
	let depth = 0;
	for (let index = source.indexOf("{", start); index < source.length; index += 1) {
		if (source[index] === "{") depth += 1;
		else if (source[index] === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(start, index + 1);
		}
	}
	throw new Error("не закрыта функция " + name);
}

function scope(file, names) {
	const source = fs.readFileSync(path.join(root, file), "utf8");
	const sandbox = { Number, String, Array, Object, Date, JSON, console };
	vm.createContext(sandbox);
	vm.runInContext(names.map((name) => grab(source, name)).join("\n") + "\nthis.api = {" + names.join(",") + "};", sandbox);
	return sandbox.api;
}

const host = scope("lib/index.js", ["peakRuleOf", "dateMultiplierOf"]);
const client = scope("lib/client.js", ["peakRuleOf", "dateMultiplierOf"]);

const fixtures = [
	{
		id: "deepseek-v4.1-flash",
		cost: {
			multipliers: [{
				when: {
					utc_days: { in: ["mon", "tue", "wed", "thu", "fri"] },
					any: [
						{ all: [{ utc_hours: { gte: "01:00" } }, { utc_hours: { lt: "04:00" } }] },
						{ all: [{ utc_hours: { gte: "06:00" } }, { utc_hours: { lt: "10:00" } }] }
					]
				},
				factor: 2
			}]
		}
	},
	{
		id: "gemini-4-argon",
		cost: { multipliers: [{ when: { date: { gte: "2026-12-01" } }, factor: 2 }] }
	},
	{
		id: "dual",
		cost: {
			multipliers: [
				{ when: { date: { gte: "2026-12-01" } }, factor: 3 },
				{ when: { utc_days: { in: ["mon"] }, any: [{ all: [{ utc_hours: { gte: "22:00" } }, { utc_hours: { lt: "02:00" } }] }] }, factor: 2 }
			]
		}
	},
	{ id: "no-multipliers", cost: { text: { input: { price: 1 } } } },
	{ id: "empty-multipliers", cost: { multipliers: [] } },
	{ id: "factor-one", cost: { multipliers: [{ when: { utc_days: { in: ["mon"] }, any: [{ all: [{ utc_hours: { gte: "01:00" } }, { utc_hours: { lt: "04:00" } }] }] }, factor: 1 }] } },
	{ id: "incomplete", cost: { multipliers: [{ when: { utc_days: { in: ["mon"] } }, factor: 2 }] } }
];

// Значения приходят из разных vm-контекстов, поэтому сравниваем их сериализацию,
// а не прототипы.
function plain(value) {
	return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

for (const fixture of fixtures) {
	assert.deepEqual(
		plain(client.peakRuleOf(fixture)),
		plain(host.peakRuleOf(fixture.cost.multipliers)),
		"peak rule matches the host for " + fixture.id
	);
	assert.deepEqual(
		plain(client.dateMultiplierOf(fixture)),
		plain(host.dateMultiplierOf(fixture.cost.multipliers)),
		"date multiplier matches the host for " + fixture.id
	);
}

console.log("all parity checks passed (" + fixtures.length + " fixtures)");
