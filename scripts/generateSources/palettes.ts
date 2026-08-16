import path from "node:path";
import type {
  PaletteMap,
  PaletteMaterialMeta,
  PaletteVersionMeta,
} from "../../sources/state/catalog.ts";
import {
  PALETTES_DIR,
  paletteMetadata,
  parseJson,
  readDirTree,
} from "./state.ts";

/** Material records are filled incrementally (stubs, then meta merge, then palette maps). */
type LooseMaterial = Partial<PaletteMaterialMeta> &
  Record<string, unknown> & {
    palettes: PaletteMap;
  };

export type ParsePaletteResult =
  | { name: string; kind: "meta"; fullPath: string }
  | {
      material: string;
      version: string;
      kind: "palette";
      fullPath: string;
    };

function materialsBag(): Record<string, LooseMaterial> {
  return paletteMetadata.materials as Record<string, LooseMaterial>;
}

/**
 * Parses one palette JSON file and merges it into shared palette metadata state.
 */
export function parsePalette(
  filePath: string,
  fileName: string,
): ParsePaletteResult {
  const fullPath = path.join(filePath, fileName);
  const json = parseJson(fullPath) as Record<string, unknown> & {
    type?: string;
  };
  const materials = materialsBag();

  if (fileName.startsWith("meta_")) {
    const name = fileName.replace("meta_", "").replace(".json", "");
    if (json.type === "material") {
      if (!materials[name]) {
        materials[name] = { ...json, palettes: {} } as LooseMaterial;
      } else {
        for (const [key, data] of Object.entries(json)) {
          materials[name][key] = data;
        }
      }
    } else {
      const versions = paletteMetadata.versions ?? {};
      paletteMetadata.versions = versions;
      versions[name] = json as PaletteVersionMeta;
    }
    return { name, kind: "meta", fullPath };
  }

  const [material, version] = fileName.replace(".json", "").split("_");
  if (!materials[material]) {
    materials[material] = { palettes: {} };
  }
  materials[material].palettes[version] = json as Record<string, string[]>;
  return { material, version, kind: "palette", fullPath };
}

/**
 * Walks the palette directory tree and parses all palette definition files.
 */
export function loadPaletteMetadata(
  options: { palettesDir?: string } = {},
): void {
  const { palettesDir = PALETTES_DIR } = options;
  const palettes = readDirTree(palettesDir);

  palettes.forEach((file) => {
    if (file.isDirectory()) {
      return;
    }

    parsePalette(file.parentPath, file.name);
  });
}
