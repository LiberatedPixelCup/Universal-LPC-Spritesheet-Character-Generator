import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const moduleSpecDir = path.join("tests", "node", "scripts", "generateSources");
const moduleSpecs = fs
  .readdirSync(moduleSpecDir)
  .filter((fileName) => fileName.endsWith("_spec.js"))
  .map((fileName) => path.join(moduleSpecDir, fileName));

const stateSpecDir = path.join("tests", "node", "state");
const stateSpecs = fs.existsSync(stateSpecDir)
  ? fs
      .readdirSync(stateSpecDir)
      .filter((fileName) => fileName.endsWith("_spec.js"))
      .map((fileName) => path.join(stateSpecDir, fileName))
  : [];

const args = [
  "--test",
  "tests/node/scripts/generate_sources_spec.js",
  ...moduleSpecs,
  ...stateSpecs,
];
const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
