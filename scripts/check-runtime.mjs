import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverSource = fs.readFileSync(path.join(projectDir, "workbench-server.mjs"), "utf8");
const runtimeSource = fs.readFileSync(path.join(projectDir, "sous-runtime.js"), "utf8");
const styleSource = fs.readFileSync(path.join(projectDir, "sous-ui.css"), "utf8");
const runtimeBuild = fs.readFileSync(path.join(projectDir, "scripts/build-runtime.mjs"), "utf8");
const styleBuild = fs.readFileSync(path.join(projectDir, "scripts/build-styles.mjs"), "utf8");
const required = ["sous-runtime.js", "sous-ui.css", "sous-mark-v1.png", "sous-loader-v1.png"];
const missing = required.filter((file) => !fs.existsSync(path.join(projectDir, file)));
if (missing.length) throw new Error(`Missing release assets: ${missing.join(", ")}`);
const forbiddenRoutes = ["v31-annotations.js", "v32-duplicate-guard.js", "workbench-v9-feedback.js"];
const exposed = forbiddenRoutes.filter((file) => serverSource.includes(`["/${file}"`));
if (exposed.length) throw new Error(`Legacy patch routes are still public: ${exposed.join(", ")}`);
for (const layer of ["runtime-core.js", "baseline-runtime.js", "release-controller.js"]) {
  if (!runtimeBuild.includes(`"${layer}"`)) throw new Error(`Missing controlled runtime layer: ${layer}`);
}
for (const layer of ["baseline-ui.css", "release-ui.css"]) {
  if (!styleBuild.includes(`"${layer}"`)) throw new Error(`Missing controlled style layer: ${layer}`);
}
const runtimeMarkers = [...runtimeSource.matchAll(/^\/\* ===== (runtime-core\.js|baseline-runtime\.js|release-controller\.js) ===== \*\/$/gm)].map((match) => match[1]);
const styleMarkers = [...styleSource.matchAll(/^\/\* ===== (baseline-ui\.css|release-ui\.css) ===== \*\/$/gm)].map((match) => match[1]);
if (runtimeMarkers.length !== 3) throw new Error(`Expected 3 runtime layers, found ${runtimeMarkers.length}`);
if (styleMarkers.length !== 2) throw new Error(`Expected 2 style layers, found ${styleMarkers.length}`);
for (const script of ["server.mjs", "workbench-server.mjs", "sous-runtime.js"]) {
  const result = spawnSync(process.execPath, ["--check", path.join(projectDir, script)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Release architecture check passed: ${runtimeMarkers.length} runtime layers, ${styleMarkers.length} style layers, no public legacy patches.`);
