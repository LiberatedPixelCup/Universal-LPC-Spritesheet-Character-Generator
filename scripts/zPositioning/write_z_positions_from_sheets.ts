import fs from "node:fs";
import path from "node:path";

const possibleBodies = ["male", "female", "muscular", "pregnant", "child"];

export type WriteZPositionsOpts = {
  root?: string;
  writeFileSync?: (
    file: string,
    data: string,
    encoding?: BufferEncoding,
  ) => void;
};

type LayerDefinition = {
  zPos: number;
  [key: string]: unknown;
};

/**
 * Regenerates `scripts/zPositioning/z_positions.csv` from all `sheet_definitions` JSON files
 * (same data as the legacy `parse_zpos` CLI). Paths are resolved from `root` (default `process.cwd()`).
 */
export function writeZPositionsFromSheetsSync(opts: WriteZPositionsOpts = {}) {
  const root = opts.root ?? process.cwd();
  const writeFileSync = opts.writeFileSync ?? fs.writeFileSync;
  const sheetDir = path.join(root, "sheet_definitions");
  if (!fs.existsSync(sheetDir)) {
    return;
  }

  const csvEntries: string[] = [];
  const files = fs
    .readdirSync(sheetDir, {
      recursive: true,
      withFileTypes: true,
    })
    .sort((a, b) => {
      const pa = path.join(a.parentPath, a.name);
      const pb = path.join(b.parentPath, b.name);
      const depthA = pa.split(path.sep).length;
      const depthB = pb.split(path.sep).length;
      if (depthA !== depthB) return depthA - depthB;
      return pa.localeCompare(pb, ["en"]);
    });

  nextFile: for (const file of files) {
    if (!file.name.includes(".json") || file.isDirectory()) {
      continue;
    }
    const fullPath = path.join(file.parentPath, file.name);
    const baseName = file.name.replace(".json", "");
    const definition = JSON.parse(fs.readFileSync(fullPath, "utf8")) as Record<
      string,
      LayerDefinition | undefined
    >;
    for (let jdx = 1; jdx < 10; jdx++) {
      const layerDefinition = definition[`layer_${jdx}`];
      if (layerDefinition === undefined) {
        continue nextFile;
      }
      const layer = `layer_${jdx}`;
      const zPos = layerDefinition.zPos;
      let images = "";
      let bodyIndex = 0;
      let firstImage = true;
      for (const _key in possibleBodies) {
        const body = possibleBodies[bodyIndex];
        const imageRef = layerDefinition[`${body}`];
        if (imageRef !== undefined) {
          if (!firstImage) {
            images += " ";
          }
          images += String(imageRef);
          firstImage = false;
        }
        bodyIndex += 1;
      }
      csvEntries.push(`${baseName},${layer},${zPos},${images}`);
    }
  }

  const outPath = path.join(root, "scripts", "zPositioning", "z_positions.csv");
  const csvToWrite = "json,layer,zPos,images\n" + csvEntries.sort().join("\n");
  writeFileSync(outPath, csvToWrite, "utf8");
  // eslint-disable-next-line no-console -- progress
  console.log("Updated z_positions.csv!");
}
