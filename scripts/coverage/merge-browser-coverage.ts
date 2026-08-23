import fs from "node:fs";
import path from "node:path";
import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";
import { markNonExecutableLinesInLcov } from "./mark-non-executable-lines.js";
import { reportPatchMissesFromLcov } from "./report-patch-misses.ts";

const outDir = path.join("coverage", "browser");

if (!fs.existsSync(outDir)) {
  console.error(`No coverage directory at ${outDir}`);
  process.exit(1);
}

const jsonFiles = fs
  .readdirSync(outDir)
  .filter((name) => name.endsWith(".json") && name !== "coverage-final.json")
  .sort();

if (jsonFiles.length === 0) {
  console.error(`No Istanbul JSON reports in ${outDir}`);
  process.exit(1);
}

const map = libCoverage.createCoverageMap({});
for (const name of jsonFiles) {
  const raw = fs.readFileSync(path.join(outDir, name), "utf8");
  map.merge(JSON.parse(raw));
}

fs.writeFileSync(
  path.join(outDir, "coverage-final.json"),
  JSON.stringify(map.toJSON()),
);

const context = libReport.createContext({
  dir: outDir,
  coverageMap: map,
  defaultSummarizer: "nested",
});
reports.create("lcovonly", { file: "lcov.info" }).execute(context);
reports.create("text").execute(context);
reports.create("html").execute(context);
const lcovPath = path.join(outDir, "lcov.info");
markNonExecutableLinesInLcov(lcovPath);
reportPatchMissesFromLcov({
  lcovPath,
  roots: ["sources"],
  failOnMiss: false,
});
