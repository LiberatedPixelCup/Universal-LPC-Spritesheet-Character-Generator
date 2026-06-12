// Palette utilities
import { ok, err, type Result } from "neverthrow";
import { state, getSelectionGroup, type Selections } from "./state.ts";
import {
  getItemLite,
  getPaletteMetadata,
  type ItemLite,
  type LoadError,
  type PaletteMaterialMeta,
  type PaletteMetadata,
  type PaletteRecolor,
} from "./catalog.ts";

/** Local helpers — collapse `Result<T, _>` into `T | null` for ergonomics. */
function liteOrNull(itemId: string): ItemLite | null {
  return getItemLite(itemId).unwrapOr(null);
}
function paletteMetaOrNull(): PaletteMetadata | null {
  return getPaletteMetadata().unwrapOr(null);
}

/**
 * Why `fixMissingRecolor` couldn't produce a recolor. `LoadError` reflects a
 * real fetch failure; the other two are domain outcomes a caller might want
 * to handle differently from a load error.
 */
export type RecolorFixError =
  | LoadError
  | { kind: "no-palette-for-type"; typeName: string | null }
  | { kind: "no-matching-variant"; recolor: string };

/**
 * Ensure the recolor exists in the asset's palette. If not, parse the recolor
 * key (`material.version.color`) and try to match the trailing color against
 * the asset's available variants. Returns err when no compatible variant
 * exists, distinguishing load failure from domain "no match" outcomes.
 */
export function fixMissingRecolor(
  itemId: string,
  recolor: string,
  typeName: string | null = null,
): Result<string, RecolorFixError> {
  const metaResult = getItemLite(itemId);
  if (metaResult.isErr()) return err(metaResult.error);
  const meta = metaResult.value;

  const palette = meta.recolors.find((r) => r.type_name === typeName);
  if (!palette) return err({ kind: "no-palette-for-type", typeName });

  // Recolor exists on this asset?
  if (palette.variants?.includes(recolor)) {
    return ok(recolor);
  }

  // Get material from palette metadata
  const materialMeta = paletteMetaOrNull()?.materials?.[palette.material];
  const [, , parsedRecolor] = parseRecolorKey(recolor, materialMeta);

  // See if recolor is non-standard for the current asset
  for (const variant of palette.variants ?? []) {
    const parts = variant.split(".");
    if (parts.length > 1 && parts.includes(parsedRecolor ?? recolor)) {
      return ok(variant);
    } else if (parsedRecolor === variant) {
      return ok(variant);
    }
  }
  return err({ kind: "no-matching-variant", recolor });
}

/**
 * Build the recolor map for an item across the current selections — keyed by
 * `type_name`, valued by recolor variant. Returns null when no recolors apply.
 */
export function getMultiRecolors(
  itemId: string,
  selections: Selections,
): Record<string, string> | null {
  const meta = liteOrNull(itemId);
  if (!meta) return null;
  const types: string[] = [meta.type_name];
  for (const recolor of meta.recolors) {
    if (recolor.type_name && !types.includes(recolor.type_name)) {
      types.push(recolor.type_name);
    }
  }

  const recolors: Record<string, string> = {};
  for (const [, selection] of Object.entries(selections)) {
    const subMeta = liteOrNull(selection.itemId);
    const typeName =
      (selection.subId !== null && selection.subId !== undefined
        ? subMeta?.recolors?.[selection.subId]?.type_name
        : undefined) ??
      subMeta?.type_name ??
      meta.type_name;
    if (
      !subMeta ||
      !subMeta.type_name ||
      !types.includes(typeName) ||
      !subMeta.recolors.length
    )
      continue;

    const verifiedRecolor = fixMissingRecolor(
      itemId,
      selection.recolor ?? "",
      !selection.subId ? null : typeName,
    ).unwrapOr(null);
    if (verifiedRecolor) {
      if (selection.subId) {
        recolors[typeName] = verifiedRecolor;
      } else if (selection.recolor) {
        recolors[subMeta.type_name] = verifiedRecolor;
      }
    }
  }

  // If body color, force match body color
  if (meta.matchBodyColor && state.matchBodyColorEnabled) {
    const bodyColor = getBodyColor(itemId, selections).unwrapOr(null);
    if (bodyColor) recolors[meta.type_name] = bodyColor;
  }

  return Object.keys(recolors).length > 0 ? recolors : null;
}

/** Why `getBodyColor` couldn't produce a color. */
export type BodyColorError =
  | LoadError
  | { kind: "match-body-color-disabled" }
  | { kind: "no-body-colored-selection" };

/** Find body color from selections when match body color is enabled on an item. */
export function getBodyColor(
  itemId: string,
  selections: Selections,
): Result<string, BodyColorError> {
  const metaResult = getItemLite(itemId);
  if (metaResult.isErr()) return err(metaResult.error);
  const meta = metaResult.value;

  if (!meta.matchBodyColor) return err({ kind: "match-body-color-disabled" });

  for (const [, selection] of Object.entries(selections)) {
    const subMeta = liteOrNull(selection.itemId);
    if (subMeta && subMeta.matchBodyColor && selection.recolor) {
      return ok(selection.recolor);
    }
  }
  return err({ kind: "no-body-colored-selection" });
}

/** Why `getBasePalette` / `getTargetPalette` couldn't produce a palette. */
export type PaletteLookupError =
  | { kind: "material-not-found"; material: string }
  | {
      kind: "colors-not-found";
      material: string;
      version: string | undefined;
      recolor: string;
    };

/**
 * Resolve the base palette colors for a material. Returns `[version, recolor,
 * colors]`, err when the material is unknown (also logs to console).
 */
export function getBasePalette(
  material: string,
  base: string | null = null,
  source: string[] | null = null,
): Result<[string, string, string[]], PaletteLookupError> {
  const materialMeta = paletteMetaOrNull()?.materials?.[material];
  if (!materialMeta) {
    console.error(`Palettes for ${material} not found`);
    return err({ kind: "material-not-found", material });
  }

  // If source provided, use it directly for the color array
  if (source !== null) {
    return ok([materialMeta.default, base ?? materialMeta.base, source]);
  }

  // Determine base variant
  const [version, recolor] = base
    ? base.split(".")
    : [materialMeta.default, materialMeta.base];
  const colors = materialMeta.palettes[version]?.[recolor];
  return ok([version, recolor, colors]);
}

/** Resolve the target color array for a recolor key. */
export function getTargetPalette(
  material: string,
  targetColor: string,
): Result<string[], PaletteLookupError> {
  const paletteMeta = paletteMetaOrNull();
  let materialMeta = paletteMeta?.materials?.[material];
  if (!materialMeta) {
    console.error(`Palettes for ${material} not found`);
    return err({ kind: "material-not-found", material });
  }

  const [newMat, version, recolor] = parseRecolorKey(targetColor, materialMeta);
  if (newMat) {
    const newMaterialMeta = paletteMeta?.materials?.[newMat];
    if (newMaterialMeta) {
      material = newMat;
      materialMeta = newMaterialMeta;
    }
  }

  const colors =
    version !== undefined ? materialMeta.palettes[version]?.[recolor] : null;
  if (!colors) {
    console.error(
      `Palette colors for ${material}.${version}.${recolor} not found`,
    );
    return err({ kind: "colors-not-found", material, version, recolor });
  }
  return ok(colors);
}

export type PaletteForItem = {
  material: string;
  version: string;
  source: string;
  colors: string[];
};

/** Why `getPalettesFromMeta` couldn't build a palette config. */
export type PalettesFromMetaError = { kind: "no-recolors-on-item" };

/** Build the palette configuration from an item's meta, keyed by `type_name`. */
export function getPalettesFromMeta(
  meta: ItemLite | null,
): Result<Record<string, PaletteForItem>, PalettesFromMetaError> {
  if (!meta || !meta.recolors) return err({ kind: "no-recolors-on-item" });

  const sources: Record<string, PaletteForItem> = {};
  for (const palette of meta.recolors) {
    // `getBasePalette` errs when the material is unknown; preserve the legacy
    // crash-on-null destructure rather than silently masking that bug.
    const [version, source, colors] = getBasePalette(
      palette.material,
      palette.base ?? null,
      palette.source ?? null,
    )._unsafeUnwrap();
    sources[palette.type_name ?? meta.type_name] = {
      material: palette.material,
      version: version || (palette.default ?? ""),
      source,
      colors,
    };
  }
  return ok(sources);
}

export type PaletteOption = {
  idx: number;
  label: string | undefined;
  default: string | undefined;
  material: string;
  type_name: string | null;
  matchBodyColor: boolean;
  versions: string[];
  selectionColor: string | null;
  sourceColors: string[] | null;
  colors: string[] | null;
};

export const CUSTOM_KEY: string = "source";
export const CUSTOM_VERSION: string = "custom";

/** Palette options + currently-selected colors for the item's selection group. */
export function getPaletteOptions(
  itemId: string,
  meta: ItemLite,
): [PaletteOption[], Record<string, string>] {
  const selectionGroup = getSelectionGroup(itemId);
  const paletteOptions: PaletteOption[] = [];
  const selectedColors = getMultiRecolors(itemId, state.selections);

  if (meta.recolors && meta.recolors.length > 0) {
    meta.recolors.forEach((color, idx) => {
      const subGroup =
        idx !== 0 ? (color.type_name ?? selectionGroup) : selectionGroup;
      const versions = Object.keys(color.palettes);
      const selectedColor = selectedColors?.[subGroup] ?? null;

      const [material, version, recolor] = parseRecolorKey(
        selectedColor,
        color,
      );

      if (color.source) {
        versions.unshift(`${material}.${CUSTOM_VERSION}`);
      }

      let palette = null;
      if (selectedColor === CUSTOM_KEY || (!selectedColor && color.source)) {
        palette = color.source ?? null;
      } else if (material !== undefined) {
        palette = getTargetPalette(material, `${version}.${recolor}`).unwrapOr(
          null,
        );
      }

      paletteOptions.push({
        idx,
        label: color.label,
        default: color.default,
        material: material ?? color.material,
        type_name: color.type_name ?? null,
        matchBodyColor: color.matchBodyColor ?? false,
        versions,
        selectionColor: selectedColor,
        sourceColors: color.source ?? null,
        colors: palette,
      });
    });
  }
  return [paletteOptions, selectedColors ?? {}];
}

/**
 * Parse a recolor key into `[material, version, recolor]`. Accepts the forms
 * `material.version.recolor`, `material.recolor`, `version.recolor`, or
 * `recolor`; falls back to the supplied palette's `material` / `default` when
 * those segments are absent.
 */
export function parseRecolorKey(
  recolorKey: string | null,
  palette: PaletteRecolor | PaletteMaterialMeta | undefined,
): [string | undefined, string | undefined, string] {
  if (!recolorKey) recolorKey = palette?.base ?? "";
  const [recolor, parsedVersion, parsedMaterial] = recolorKey
    .split(".")
    .reverse() as [string, string | undefined, string | undefined];
  let version = parsedVersion;
  let material = parsedMaterial;

  // Material (e.g. body, metal, cloth)
  if (!material) {
    // Maybe `version` is actually the material name
    if (version && paletteMetaOrNull()?.materials?.[version]) {
      material = version;
      version = undefined;
    } else {
      material = (palette as PaletteRecolor | undefined)?.material;
    }
  }

  // Version (e.g. ulpc, lpcr)
  if (!version) {
    version = palette?.default;
  }
  return [material, version, recolor];
}

/**
 * Compile Palette Key for Recolor Modal
 */
export function compilePaletteKey(
  material: string,
  version: string,
  palette: string,
  opt: PaletteOption,
): string {
  if (version === CUSTOM_VERSION) {
    return CUSTOM_KEY;
  }

  let key = material !== opt.material ? material + "." : "";

  if (version !== opt.default) {
    key += version + ".";
  }

  return key + palette;
}
