// Search control component
import m from "mithril";
import type { CatalogReader } from "../../state/catalog.ts";
import { state } from "../../state/state.ts";
import { t } from "../../../lang/i18n.ts";

type SearchControlAttrs = {
  catalog: Pick<CatalogReader, "isLiteReady">;
};

export const SearchControl: m.Component<SearchControlAttrs> = {
  view(vnode) {
    const liteReady = vnode.attrs.catalog.isLiteReady();
    return m("div.field", [
      m("label.label", t("filters.search")),
      m("input.input[type=search]", {
        placeholder: t("filters.searchPlaceholder"),
        value: state.searchQuery,
        disabled: !liteReady,
        title: liteReady ? undefined : t("filters.loadingItemList"),
        oninput: (e: Event) => {
          state.searchQuery = (e.target as HTMLInputElement).value;
        },
      }),
    ]);
  },
};
