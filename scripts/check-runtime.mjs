import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(projectDir, "workbench-server.mjs"), "utf8");
const referenced = [
  ...source.matchAll(/\["\/[^"]+", \["([^"]+)"/g),
  ...source.matchAll(/(?:href|src)="\/([^"?]+)(?:\?[^"]*)?"/g),
].map((match) => match[1]);
const missing = [...new Set(referenced)].filter((file) => !fs.existsSync(path.join(projectDir, file)));
if (missing.length) {
  console.error(`Missing runtime assets:\n${missing.map((file) => `- ${file}`).join("\n")}`);
  process.exit(1);
}
const scripts = [...new Set(referenced.filter((file) => /\.(?:m?js)$/.test(file)))];
for (const script of ["server.mjs", "workbench-server.mjs", ...scripts]) {
  const result = spawnSync(process.execPath, ["--check", path.join(projectDir, script)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Runtime check passed: ${referenced.length} assets and ${scripts.length + 2} scripts.`);
