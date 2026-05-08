import { t } from "./index.ts";
import type { Selection } from "../state/state.ts";
import type { ItemLite } from "../state/catalog.ts";

type RecolorMeta = NonNullable<ItemLite["recolors"]>[number];

function metadataKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function translateKey(key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function translateByLabel(scope: string, label: string): string {
  const key = metadataKey(label);
  if (!key) return label;

  const translated = translateKey(`metadata.${scope}.${key}`, label);
  return translated === label ? translateWords(label) : translated;
}

function translateWords(label: string): string {
  const humanLabel = label.replace(/[_-]+/g, " ");
  let changed = false;
  let untranslatedWord = false;
  const translated = humanLabel.replace(/[A-Za-z][A-Za-z0-9']*/g, (word) => {
    const key = metadataKey(word);
    const translatedWord = translateKey(`metadata.word.${key}`, word);
    if (translatedWord === word) {
      untranslatedWord = true;
      return word;
    }
    changed = true;
    return translatedWord;
  });

  if (!changed) return humanLabel;

  const joinerKey = "metadata.wordJoiner";
  const joiner = t(joinerKey);
  if (
    !untranslatedWord &&
    joiner !== joinerKey &&
    /^[\p{Letter}\p{Number}\s]+$/u.test(translated)
  ) {
    return translated.replace(/\s+/g, joiner);
  }

  return translated;
}

export function translateCategoryLabel(name: string, fallback: string): string {
  const byFallback = translateByLabel("category", fallback);
  if (byFallback !== fallback) return byFallback;
  return translateByLabel("category", name);
}

export function translateItemName(itemId: string, fallback: string): string {
  const itemKey = metadataKey(itemId);
  if (itemKey) {
    const translated = translateKey(`metadata.itemId.${itemKey}`, fallback);
    if (translated !== fallback) return translated;
  }
  return translateByLabel("item", fallback);
}

export function translateVariantLabel(
  variant: string | null | undefined,
  fallbackValue?: string,
): string {
  const fallback = fallbackValue ?? String(variant ?? "").replaceAll("_", " ");
  if (!fallback) return fallback;
  return translateByLabel("variant", fallback);
}

export function translateAnimationLabel(
  animation: string | null | undefined,
  fallbackValue?: string,
): string {
  const value = String(animation ?? "");
  if (!value) return "";

  const key = `animation.${value}`;
  const translated = t(key);
  if (translated !== key) return translated;

  return translateWords(fallbackValue ?? value.replaceAll("_", " "));
}

export function translateAnimationList(animations: string[]): string {
  return animations
    .map((animation) => translateAnimationLabel(animation))
    .join(", ");
}

function selectionBaseName(
  selection: Selection,
  meta: ItemLite | null | undefined,
): string {
  const recolorMeta =
    selection.subId !== null && selection.subId !== undefined
      ? meta?.recolors?.[selection.subId]
      : null;
  if (recolorMeta?.type_name && recolorMeta.label) return recolorMeta.label;
  if (meta?.name) return meta.name;
  return selection.name.split(" (")[0] ?? selection.name;
}

function selectionVariant(selection: Selection): string {
  return selection.variant || selection.recolor || "";
}

export function translateSelectionName(
  selection: Selection,
  meta: ItemLite | null | undefined,
): string {
  const baseName = translateItemName(
    selection.itemId,
    selectionBaseName(selection, meta),
  );
  const variant = selectionVariant(selection);
  if (!variant) return baseName;

  return t("metadata.selectionFormat", {
    name: baseName,
    variant: translateVariantLabel(variant),
  });
}

export function translatePaletteLabel(
  label: string | null | undefined,
): string {
  return translateByLabel("palette", label ?? "");
}

export function translateRecolorOptionLabel(
  opt: RecolorMeta | { label?: string | null; type_name?: string | null },
): string {
  const label = opt.label ?? opt.type_name ?? "";
  return translateByLabel("item", label);
}
