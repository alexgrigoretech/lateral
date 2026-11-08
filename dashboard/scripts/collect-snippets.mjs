import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboard = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(dashboard, "..");

try {
  const brief = JSON.parse(await readFile(path.join(dashboard, "content", "brief.json"), "utf8"));
  const snippets = new Map();
  for (const subsection of brief.subsections) {
    for (const { file, start, end } of subsection.snippets) {
      const key = `${file}#${start}-${end}`;
      if (snippets.has(key)) continue;
      let source;
      try {
        source = await readFile(path.join(root, file), "utf8");
      } catch (error) {
        throw new Error(`${key}: cannot read source file (${error.message})`);
      }
      const lines = source.split(/\r?\n/);
      if (lines.at(-1) === "") lines.pop();
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lines.length) {
        throw new Error(`${key}: range does not exist, file has ${lines.length} lines`);
      }
      snippets.set(key, { file, start, end, code: lines.slice(start - 1, end).join("\n") });
    }
  }
  const sorted = Object.fromEntries([...snippets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  const target = path.join(dashboard, "content", "snippets.json");
  const generated = `${JSON.stringify(sorted, null, 2)}\n`;
  if (process.argv.includes("--check")) {
    let saved = null;
    try {
      saved = await readFile(target, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const existing = saved === null ? {} : JSON.parse(saved);
    const keys = [...new Set([...Object.keys(existing), ...Object.keys(sorted)])].sort();
    const stale = keys.filter((key) => JSON.stringify(existing[key]) !== JSON.stringify(sorted[key]));
    if (stale.length) throw new Error(`Stale snippet keys: ${stale.join(", ")}. Run npm run snippets.`);
    if (saved !== generated) throw new Error("Snippet formatting or key order is stale in content/snippets.json. Run npm run snippets.");
    console.log(`Checked ${snippets.size} distinct snippets: content/snippets.json is up to date`);
  } else {
    await writeFile(target, generated, "utf8");
    console.log(`Collected ${snippets.size} distinct snippets into content/snippets.json`);
  }
} catch (error) {
  console.error(`Snippet collection failed: ${error.message}`);
  process.exitCode = 1;
}
