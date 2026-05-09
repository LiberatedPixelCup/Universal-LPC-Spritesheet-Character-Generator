// Search control component
import m from "mithril";
import { isLiteReady } from "../../state/catalog.ts";
import { state } from "../../state/state.ts";
import { t } from "../../i18n/index.ts";

export const SearchControl = {
  view: function () {
    const liteReady = isLiteReady();
    return m("div.field", [
      m("label.label", t("filters.search.label")),
      m("input.input[type=search]", {
        placeholder: t("filters.search.placeholder"),
        value: state.searchQuery,
        disabled: !liteReady,
        title: liteReady ? undefined : t("common.loadingItemList"),
        oninput: (e) => {
          state.searchQuery = e.target.value;
        },
      }),
    ]);
  },
};
