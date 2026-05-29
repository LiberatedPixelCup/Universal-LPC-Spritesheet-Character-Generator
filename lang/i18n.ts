// Lightweight i18n system for the project
// Supports simple key-based translations with optional interpolation

type TranslationKey = string;
type TranslationValue = string;
type Translations = Record<TranslationKey, TranslationValue>;

// Current language (default: 'zh' for Chinese)
let currentLang: string = "zh";

// Translation dictionaries
const translations: Record<string, Translations> = {};

/**
 * Load translation dictionary for a language
 */
export function loadTranslations(lang: string, dict: Translations): void {
  translations[lang] = dict;
}

/**
 * Set current language
 */
export function setLanguage(lang: string): void {
  currentLang = lang;
}

/**
 * Get current language
 */
export function getLanguage(): string {
  return currentLang;
}

/**
 * Translate a key with optional interpolation
 * @param key - Translation key (e.g., 'download.title')
 * @param params - Optional parameters for interpolation (e.g., { count: 5 })
 * @returns Translated string
 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): TranslationValue {
  const dict = translations[currentLang] || translations["zh"] || {};
  let text = lookupTranslation(dict, key) ?? key;

  // Simple interpolation: replace {param} with values
  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      text = text.replace(
        new RegExp(`\\{${paramKey}\\}`, "g"),
        String(paramValue),
      );
    });
  }

  return text;
}

function lookupTranslation(
  dict: Translations,
  key: string,
): string | undefined {
  if (dict[key]) return dict[key];
  const lowerKey = key.toLowerCase();
  const matchingKey = Object.keys(dict).find(
    (candidate) => candidate.toLowerCase() === lowerKey,
  );
  return matchingKey ? dict[matchingKey] : undefined;
}

function normalizeTranslationKeySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Get animation display name in current language
 */
export function getAnimationDisplayName(value: string): string {
  const key = `animation.${value}`;
  const translated = t(key);
  // If no translation found (key returned as-is), use original value
  return translated === key
    ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")
    : translated;
}

/**
 * Get item display name in current language
 * Falls back to original name if no translation exists
 */
export function getItemDisplayName(name: string): string {
  const key = `item.${name}`;
  const translated = t(key);
  // If no translation found (key returned as-is), return original name
  return translated === key ? name : translated;
}

/**
 * Get category display name in current language
 * Falls back to original name if no translation exists
 */
export function getCategoryDisplayName(name: string): string {
  const rawKey = `category.${name.toLowerCase()}`;
  const normalizedKey = `category.${normalizeTranslationKeySegment(name)}`;
  const rawTranslated = t(rawKey);
  if (rawTranslated !== rawKey) return rawTranslated;
  const normalizedTranslated = t(normalizedKey);
  return normalizedTranslated === normalizedKey ? name : normalizedTranslated;
}

/**
 * Get body type display name in current language
 */
export function getBodyTypeDisplayName(type: string): string {
  const key = `bodyType.${type}`;
  const translated = t(key);
  // If no translation found, return capitalized type name
  return translated === key
    ? type.charAt(0).toUpperCase() + type.slice(1)
    : translated;
}

function formatFallbackDisplayName(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function translateWithNormalizedKey(
  prefix: string,
  value: string,
): string | null {
  const rawKey = `${prefix}.${value}`;
  const rawTranslated = t(rawKey);
  if (rawTranslated !== rawKey) return rawTranslated;

  const normalizedKey = `${prefix}.${normalizeTranslationKeySegment(value)}`;
  const normalizedTranslated = t(normalizedKey);
  return normalizedTranslated === normalizedKey ? null : normalizedTranslated;
}

function translateVariantByTokens(value: string): string | null {
  const normalized = value.replaceAll("_", " ").trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return null;

  const translatedTokens = tokens.map((token) => {
    const translated = translateWithNormalizedKey("variantToken", token);
    return translated ?? token;
  });

  return translatedTokens.some((part, index) => part !== tokens[index])
    ? translatedTokens.join("")
    : null;
}

export function getVariantDisplayName(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const direct = translateWithNormalizedKey("variant", value);
  if (direct) return direct;
  const tokenized = translateVariantByTokens(value);
  if (tokenized) return tokenized;
  const singleToken = translateWithNormalizedKey("variantToken", value);
  if (singleToken) return singleToken;
  return formatFallbackDisplayName(value);
}

export function getPaletteColorDisplayName(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const parts = value.split(".");
  const colorName = parts[parts.length - 1] ?? value;
  return getVariantDisplayName(colorName);
}

export function getRecolorLabelDisplayName(
  label: string | null | undefined,
): string {
  if (!label) return "";
  return (
    translateWithNormalizedKey("recolor", label) ?? getItemDisplayName(label)
  );
}

export function getPaletteMaterialDisplayName(
  label: string | null | undefined,
): string {
  if (!label) return "";
  return (
    translateWithNormalizedKey("paletteMaterial", label) ??
    getRecolorLabelDisplayName(label)
  );
}

export function getPaletteVersionDisplayName(
  label: string | null | undefined,
): string {
  if (!label) return "";
  return translateWithNormalizedKey("paletteVersion", label) ?? label;
}

export function getSelectionDisplayName(name: string): string {
  const match = /^(.*?) \((.*)\)$/.exec(name);
  if (!match) return getItemDisplayName(name);

  const [, baseName, details] = match;
  const baseDisplay =
    getRecolorLabelDisplayName(baseName) || getItemDisplayName(baseName);
  const detailDisplay = details
    .split(" | ")
    .map((part) => getPaletteColorDisplayName(part.trim()))
    .join(" | ");
  return `${baseDisplay}（${detailDisplay}）`;
}

export function getAnimationListDisplayName(values: readonly string[]): string {
  return values.map((value) => getAnimationDisplayName(value)).join(", ");
}
