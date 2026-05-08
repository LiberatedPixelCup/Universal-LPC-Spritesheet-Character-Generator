import en from "./locales/en.ts";
import zhCN from "./locales/zh-CN.ts";
import ja from "./locales/ja.ts";

export const SUPPORTED_LOCALES = ["en", "zh-CN", "ja"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationParams = Record<string, string | number>;
export type TranslationDictionary = {
  [key: string]: string | TranslationDictionary;
};

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
  { value: "ja", label: "日本語" },
];

const dictionaries: Record<Locale, TranslationDictionary> = {
  en,
  "zh-CN": zhCN,
  ja,
};

let currentLocale: Locale = DEFAULT_LOCALE;

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(
  value: string | null | undefined,
): Locale | null {
  if (!value) return null;
  const normalized = value.replace("_", "-");
  if (isSupportedLocale(normalized)) return normalized;

  const lower = normalized.toLowerCase();
  if (
    lower === "zh" ||
    lower.startsWith("zh-cn") ||
    lower.startsWith("zh-hans")
  ) {
    return "zh-CN";
  }
  if (lower === "ja" || lower.startsWith("ja-")) {
    return "ja";
  }
  if (lower === "en" || lower.startsWith("en-")) {
    return "en";
  }
  return null;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function t(key: string, params: TranslationParams = {}): string {
  const active = getMessage(dictionaries[currentLocale], key);
  const fallback = getMessage(dictionaries[DEFAULT_LOCALE], key);
  const message = active ?? fallback ?? key;
  return interpolate(message, params);
}

function getMessage(
  dictionary: TranslationDictionary,
  key: string,
): string | null {
  let current: string | TranslationDictionary | undefined = dictionary;
  for (const part of key.split(".")) {
    if (typeof current === "string") return null;
    current = current[part];
    if (current === undefined) return null;
  }
  return typeof current === "string" ? current : null;
}

function interpolate(message: string, params: TranslationParams): string {
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
