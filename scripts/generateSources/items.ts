import path from "node:path";
import debugUtils from "../utils/debug.ts";
import {
  ANIMATION_DEFAULTS,
  BODY_TYPES,
} from "../../sources/state/constants.ts";
import type { Credit, LayerEntry } from "../../sources/state/catalog.ts";
import { writeAliases, type AliasItemMeta } from "./aliases.ts";
import {
  normalizeRecolors,
  type RecolorSheetDefinition,
} from "./item-helper.ts";
import {
  itemMetadata,
  onlyIfTemplate,
  parseJson,
  SHEETS_DIR,
  type GeneratorItem,
} from "./state.ts";

const { debugLog } = debugUtils;

type LayerDefinition = {
  zPos?: number;
  custom_animation?: string;
  [bodyTypeOrField: string]: string | number | null | undefined;
};

export type SheetDefinition = RecolorSheetDefinition & {
  ignore?: boolean;
  name?: string;
  priority?: number | null;
  type_name?: string;
  path?: string[];
  animations?: string[];
  tags?: string[];
  required_tags?: string[];
  excluded_tags?: string[];
  replace_in_path?: Record<string, Record<string, string>>;
  variants?: string[];
  credits?: Array<Partial<Credit>>;
  preview_row?: number;
  preview_column?: number;
  preview_x_offset?: number;
  preview_y_offset?: number;
  match_body_color?: boolean;
  aliases?: Record<string, string>;
  layer_1?: LayerDefinition;
  [layerKey: string]: unknown;
};

/**
 * Computes required body types by checking the first layer entries present in the definition.
 */
export function getRequiredSexes(definition: SheetDefinition): string[] {
  const requiredSexes: string[] = [];
  const layer1 = definition.layer_1 as LayerDefinition;
  for (const sex of BODY_TYPES) {
    if (layer1[sex]) {
      requiredSexes.push(sex);
    }
  }
  return requiredSexes;
}

/**
 * Builds an item path array relative to the active sheets directory.
 */
export function buildTreePath(
  filePath: string,
  itemId: string,
  sheetsDir: string,
): string[] {
  const treePath = path
    .relative(sheetsDir, filePath)
    .split(path.sep)
    .filter(Boolean);
  treePath.push(itemId);
  return treePath;
}

/**
 * Collects contiguous layer definitions from layer_1 through layer_9.
 */
export function collectLayers(
  definition: SheetDefinition,
): Record<string, LayerEntry> {
  const layers: Record<string, LayerEntry> = {};
  for (let i = 1; i < 10; i++) {
    const layerDef = definition[`layer_${i}`] as LayerDefinition | undefined;
    if (layerDef) {
      layers[`layer_${i}`] = layerDef as LayerEntry;
    } else {
      break;
    }
  }
  return layers;
}

/**
 * Parses one sheet definition file and writes normalized item metadata into shared state.
 */
export function parseItem(
  filePath: string,
  fileName: string,
  options: { sheetsDir?: string } = {},
): { itemId: string; definition: SheetDefinition } {
  const { sheetsDir = SHEETS_DIR } = options;
  const fullPath = path.join(filePath, fileName);
  const itemId = fileName.replace(".json", "");
  if (!onlyIfTemplate) debugLog(`Parsing ${fullPath}`);

  const definition = parseJson(fullPath) as SheetDefinition;

  if (definition.ignore) {
    throw Error(`Skipping ignored item: ${itemId}`);
  }

  const requiredSexes = getRequiredSexes(definition);

  const treePath =
    definition.path ?? buildTreePath(filePath, itemId, sheetsDir);

  const layers = collectLayers(definition);

  const recolors = normalizeRecolors(definition);

  const item: GeneratorItem = {
    name: definition.name,
    priority: definition.priority || null,
    type_name: definition.type_name,
    required: requiredSexes,
    animations: definition.animations ?? ANIMATION_DEFAULTS,
    tags: definition.tags ?? [],
    required_tags: definition.required_tags ?? [],
    excluded_tags: definition.excluded_tags ?? [],
    path: treePath ?? ["other"],
    replace_in_path: definition.replace_in_path ?? {},
    variants: definition.variants ?? [],
    layers: layers,
    credits: definition.credits ?? [],
    preview_row: definition.preview_row ?? 2,
    preview_column: definition.preview_column ?? 0,
    preview_x_offset: definition.preview_x_offset ?? 0,
    preview_y_offset: definition.preview_y_offset ?? 0,
    matchBodyColor: definition.match_body_color ?? false,
    recolors: recolors ?? [],
  };

  itemMetadata[itemId] = item;

  if (definition.aliases) {
    writeAliases(definition.aliases, item as AliasItemMeta);
  }

  return {
    itemId,
    definition,
  };
}
