import path from "node:path";
import {
  PALETTES_DIR,
  paletteMetadata,
  parseJson,
  readDirTree,
} from "./state.js";

/**
 * Parses one palette JSON file and merges it into shared palette metadata state.
 * @param {string} filePath Parent directory of the palette file.
 * @param {string} fileName Palette filename to parse.
 * @return {{name?: string, material?: string, version?: string, kind: "meta"|"palette", fullPath: string}} Parsed palette descriptor.
 * @throws {SyntaxError} If the target palette file contains invalid JSON.
 */
export function parsePalette(filePath, fileName) {
  const fullPath = path.join(filePath, fileName);
  const json = parseJson(fullPath);

  if (fileName.startsWith("meta_")) {
    const name = fileName.replace("meta_", "").replace(".json", "");
    if (json.type === "material") {
      if (!paletteMetadata.materials[name]) {
        paletteMetadata.materials[name] = json;
        paletteMetadata.materials[name].palettes = {};
      } else {
        for (const [key, data] of Object.entries(json)) {
          paletteMetadata.materials[name][key] = data;
        }
      }
    } else {
      paletteMetadata.versions[name] = json;
    }
    return { name, kind: "meta", fullPath };
  }

  const [material, version] = fileName.replace(".json", "").split("_");
  if (!paletteMetadata.materials[material]) {
    paletteMetadata.materials[material] = { palettes: {} };
  }
  paletteMetadata.materials[material].palettes[version] = json;
  return { material, version, kind: "palette", fullPath };
}

/**
 * Walks the palette directory tree and parses all palette definition files.
 * @param {{palettesDir?: string}} [options] Optional parser options.
 * @param {string} [options.palettesDir] Root palette definitions directory.
 * @return {void} No return value; mutates context.paletteMetadata.
 * @throws {SyntaxError} Propagates parse errors from parsePalette for invalid palette files.
 */
export function loadPaletteMetadata(options = {}) {
  const { palettesDir = PALETTES_DIR } = options;
  const palettes = readDirTree(palettesDir);

  palettes.forEach((file) => {
    if (file.isDirectory()) {
      return;
    }

    parsePalette(file.parentPath, file.name);
  });
}
