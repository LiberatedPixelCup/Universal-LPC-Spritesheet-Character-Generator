import m from "mithril";
import { LOCALE_OPTIONS, t } from "../i18n/index.ts";
import { setAppLocale, state } from "../state/state.ts";

export const LanguageSelector = {
  view: function () {
    return m("div.language-selector", [
      m("label.is-sr-only", { for: "language-selector" }, t("language.label")),
      m("div.select.is-small", [
        m(
          "select#language-selector",
          {
            value: state.locale,
            title: t("language.label"),
            onchange: (e) => setAppLocale(e.target.value),
          },
          LOCALE_OPTIONS.map((locale) =>
            m("option", { value: locale.value }, locale.label),
          ),
        ),
      ]),
    ]);
  },
};
