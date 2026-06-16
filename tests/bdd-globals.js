/**
 * After mocha.setup('bdd'), Mocha attaches BDD helpers to the global object.
 * ES module code does not resolve those as free identifiers; import them here.
 */
const g = globalThis;
export const describe = g.describe;
export const it = g.it;
export const before = g.before;
export const after = g.after;
export const beforeEach = g.beforeEach;
export const afterEach = g.afterEach;

// Load i18n translations so components using t() render correctly in tests.
import { loadTranslations, setLanguage } from "../lang/i18n.ts";
import zhTranslations from "../lang/zh.json";
import enTranslations from "../lang/en.json";
loadTranslations("zh", zhTranslations);
loadTranslations("en", enTranslations);
setLanguage("en");
