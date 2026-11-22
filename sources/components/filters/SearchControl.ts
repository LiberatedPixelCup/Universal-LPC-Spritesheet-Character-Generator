// Search control component
import m from "mithril";
import type { SearchControlModel } from "../../models/search-control.ts";

const SEARCH_INPUT_ID = "lpc-search-input";

export const SearchControl: m.Component<{
  createModel: () => SearchControlModel;
}> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    return m("div.field", [
      m("label.label", { for: SEARCH_INPUT_ID }, "Search:"),
      m("input.input.lpc-search-input[type=search][placeholder=Search]", {
        id: SEARCH_INPUT_ID,
        value: model.value,
        disabled: model.disabled,
        title: model.title,
        oninput: (e: Event) => {
          model.setValue((e.target as HTMLInputElement).value);
        },
      }),
    ]);
  },
};
