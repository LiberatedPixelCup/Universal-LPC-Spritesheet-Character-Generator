import type { PaletteMaterialMeta } from "../../sources/state/catalog.ts";
import { ucwords } from "../../sources/utils/helpers.ts";
import debugUtils from "../utils/debug.ts";
import { paletteMetadata } from "./state.ts";

const { debugWarn } = debugUtils;

/** Recolor entry while generating metadata; `palettes` starts as tokens then becomes a map. */
export type GeneratorRecolor = {
  material: string;
  palettes: string[] | Record<string, string[]>;
  type_name?: string | null;
  variants?: string[];
  label?: string;
  default?: string;
  base?: string;
};

export type RecolorSheetDefinition = {
  recolors?: Record<string, unknown>;
};

function collectRecolorEntries(
  definition: RecolorSheetDefinition,
): GeneratorRecolor[] {
  const recolors: GeneratorRecolor[] = [];
  if (definition.recolors === undefined) {
    return recolors;
  }

  for (let n = 1; n < 10; n++) {
    const colorDef = definition.recolors[`color_${n}`];
    if (colorDef) {
      recolors.push(colorDef as GeneratorRecolor);
    } else {
      break;
    }
  }

  if (recolors.length === 0) {
    recolors.push(definition.recolors as GeneratorRecolor);
  }

  return recolors;
}

function resolvePaletteToken(
  paletteToken: string,
  fallbackMaterial: string,
): { material: string; version: string } {
  let [material, version] = paletteToken.split(".");
  if (!version) {
    version = material;
    material = fallbackMaterial;
  }
  return { material, version };
}

function applyRecolorDefaults(
  recolor: GeneratorRecolor,
  materialMeta: PaletteMaterialMeta,
): void {
  recolor.default = materialMeta.default;
  recolor.type_name = recolor.type_name ?? null;
  recolor.label =
    recolor.label ?? materialMeta.label ?? ucwords(recolor.material);

  if (!recolor.base) {
    recolor.base = `${materialMeta.default}.${materialMeta.base}`;
  } else if (!recolor.base.includes(".")) {
    recolor.base = `${materialMeta.default}.${recolor.base}`;
  }
}

function expandRecolorPalettes(recolor: GeneratorRecolor): void {
  const colorPalettes: Record<string, string[]> = {};
  const colorVariants = new Set<string>();
  const paletteTokens = recolor.palettes as string[];

  for (const paletteToken of paletteTokens) {
    const { material, version } = resolvePaletteToken(
      paletteToken,
      recolor.material,
    );

    const keys = Object.keys(
      paletteMetadata.materials[material].palettes[version],
    );
    colorPalettes[`${material}.${version}`] = keys;

    const mappedKeys = keys.map((key) => {
      const matPart = recolor.material !== material ? `${material}.` : "";
      const verPart = recolor.default !== version ? `${version}.` : "";
      return `${matPart}${verPart}${key}`;
    });
    mappedKeys.forEach((key) => colorVariants.add(key));
  }

  recolor.palettes = colorPalettes;
  recolor.variants = Array.from(colorVariants);
}

/**
 * Normalizes recolor definitions and expands palette variants for runtime metadata.
 */
export function normalizeRecolors(
  definition: RecolorSheetDefinition,
): GeneratorRecolor[] {
  const recolors = collectRecolorEntries(definition);

  for (const recolor of recolors) {
    const materialMeta = paletteMetadata.materials[recolor.material];
    if (!materialMeta) {
      debugWarn(`Material metadata not found for ${recolor.material}`);
      continue;
    }

    applyRecolorDefaults(recolor, materialMeta);
    expandRecolorPalettes(recolor);
  }

  return recolors;
}
