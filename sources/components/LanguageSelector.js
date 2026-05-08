import m from "mithril";
import { LOCALE_OPTIONS, t } from "../i18n/index.ts";
import { setAppLocale, state } from "../state/state.ts";

export const LanguageSelector = {
  view: function () {
    return m("div.box.mb-4.has-background-light", [
      m("div.field.is-horizontal.is-align-items-center", [
        m("div.field-label.is-normal", [
          m(
            "label.label.mb-0",
            { for: "language-selector" },
            t("language.label"),
          ),
        ]),
        m("div.field-body", [
          m("div.field.mb-0", [
            m("div.control", [
              m("div.select.is-small", [
                m(
                  "select#language-selector",
                  {
                    value: state.locale,
                    onchange: (e) => setAppLocale(e.target.value),
                  },
                  LOCALE_OPTIONS.map((locale) =>
                    m("option", { value: locale.value }, locale.label),
                  ),
                ),
              ]),
            ]),
          ]),
        ]),
      ]),
    ]);
  },
};
