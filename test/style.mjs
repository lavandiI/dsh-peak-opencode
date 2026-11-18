// Гигиена файлов без линтера и без зависимостей: переводы строк, финальный
// перевод строки и хвостовые пробелы. Правила совпадают с .editorconfig.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".git", "artifacts"]);
const EXTENSIONS = [".js", ".mjs", ".cjs", ".json", ".yml", ".yaml", ".md"];

function walk(directory, out) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (SKIP.has(entry.name)) continue;
		const full = path.join(directory, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (EXTENSIONS.some((extension) => entry.name.endsWith(extension))) out.push(full);
	}
	return out;
}

const files = walk(root, []);
assert.ok(files.length > 20, "the style scan sees the repository: " + files.length);

for (const file of files) {
	const name = path.relative(root, file).replace(/\\/g, "/");
	const text = fs.readFileSync(file, "utf8");
	assert.ok(!text.includes("\r"), name + " uses LF line endings");
	assert.ok(text.endsWith("\n"), name + " ends with a newline");
	// В markdown два пробела в конце строки — это жёсткий перенос, не мусор.
	if (!name.endsWith(".md")) assert.ok(!/[ \t]+$/m.test(text), name + " has no trailing whitespace");
}

console.log("all style checks passed (" + files.length + " files)");
