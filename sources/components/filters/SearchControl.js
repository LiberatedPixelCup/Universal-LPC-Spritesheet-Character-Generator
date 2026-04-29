// Search control component
import m from "mithril";
import { isLiteReady } from "../../state/catalog.ts";
import { state } from "../../state/state.ts";

export const SearchControl = {
  view: function () {
    const liteReady = isLiteReady();
    return m("div.field", [
      m("label.label", "Search:"),
      m("input.input[type=search][placeholder=Search]", {
        value: state.searchQuery,
        disabled: !liteReady,
        title: liteReady ? undefined : "Loading item list…",
        oninput: (e) => {
          state.searchQuery = e.target.value;
        },
      }),
    ]);
  },
};
