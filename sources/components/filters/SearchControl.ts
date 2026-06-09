// Search control component
import m from "mithril";
import type { CatalogReader } from "../../state/catalog.ts";
import { state } from "../../state/state.ts";

type SearchControlAttrs = {
  catalog: CatalogReader;
};

export const SearchControl: m.Component<SearchControlAttrs> = {
  view(vnode) {
    const liteReady = vnode.attrs.catalog.isLiteReady();
    return m("div.field", [
      m("label.label", "Search:"),
      m("input.input[type=search][placeholder=Search]", {
        value: state.searchQuery,
        disabled: !liteReady,
        title: liteReady ? undefined : "Loading item list…",
        oninput: (e: Event) => {
          state.searchQuery = (e.target as HTMLInputElement).value;
        },
      }),
    ]);
  },
};
