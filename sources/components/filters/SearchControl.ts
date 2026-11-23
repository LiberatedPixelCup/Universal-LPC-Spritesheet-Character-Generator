// Search control component
import m from "mithril";
import type { SearchControlModel } from "../../models/search-control.ts";

const SEARCH_INPUT_ID = "lpc-search-input";

export const SearchControl: m.Component<{
  createModel: () => SearchControlModel;
}> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    return m("div.field.mb-0", [
      m("label.label.lpc-sr-only", { for: SEARCH_INPUT_ID }, "Search"),
      m("div.control.has-icons-left", [
        m(
          "input.input.is-small.lpc-search-input[type=search][placeholder=Search items (⌘F)...]",
          {
            id: SEARCH_INPUT_ID,
            value: model.value,
            disabled: model.disabled,
            title: model.title,
            oninput: (e: Event) => {
              model.setValue((e.target as HTMLInputElement).value);
            },
          },
        ),
        m("span.icon.is-small.is-left", { "aria-hidden": "true" }, "🔍"),
      ]),
    ]);
  },
};
