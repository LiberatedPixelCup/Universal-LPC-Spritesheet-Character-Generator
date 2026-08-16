import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeZPositionsFromSheetsSync } from "../../../../scripts/zPositioning/write_z_positions_from_sheets.ts";

test("writeZPositionsFromSheetsSync writes a header and layer rows", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zpos-"));
  const sheetDir = path.join(root, "sheet_definitions");
  fs.mkdirSync(sheetDir, { recursive: true });
  fs.writeFileSync(
    path.join(sheetDir, "sword.json"),
    JSON.stringify({
      layer_1: {
        zPos: 10,
        male: "weapon/sword/male",
        female: "weapon/sword/female",
      },
      layer_2: { zPos: 20, male: "weapon/sword/behind/male" },
    }),
  );

  const writes: { outPath: string; contents: string }[] = [];
  writeZPositionsFromSheetsSync({
    root,
    writeFileSync: (outPath, contents) => {
      writes.push({ outPath, contents });
    },
  });

  assert.equal(writes.length, 1);
  assert.equal(
    writes[0].outPath,
    path.join(root, "scripts", "zPositioning", "z_positions.csv"),
  );
  const lines = writes[0].contents.trimEnd().split("\n");
  assert.equal(lines[0], "json,layer,zPos,images");
  assert.deepEqual(lines.slice(1).sort(), [
    "sword,layer_1,10,weapon/sword/male weapon/sword/female",
    "sword,layer_2,20,weapon/sword/behind/male",
  ]);
});

test("writeZPositionsFromSheetsSync does not write when sheet_definitions is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zpos-missing-"));
  const writes: { outPath: string; contents: string }[] = [];
  writeZPositionsFromSheetsSync({
    root,
    writeFileSync: (outPath, contents) => {
      writes.push({ outPath, contents });
    },
  });
  assert.equal(writes.length, 0);
});
