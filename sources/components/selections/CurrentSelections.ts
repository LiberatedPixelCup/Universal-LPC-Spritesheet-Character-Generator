// Current selections component
import m from "mithril";
import type { CurrentSelectionsModel } from "../../models/current-selections.ts";

export const CurrentSelections: m.Component<{
  model: () => CurrentSelectionsModel;
}> = {
  view(vnode) {
    const model = vnode.attrs.model();
    if (model.kind === "loading") {
      return m("div", [
        m("h3.title.is-5", "Current Selections"),
        m("p.is-size-7.has-text-grey", "Loading item list…"),
      ]);
    }

    if (model.kind === "empty") {
      return m("div", [
        m("h3.title.is-5", "Current Selections"),
        m("p.has-text-grey", "No items selected yet"),
      ]);
    }

    return m("div", [
      m("h3.title.is-5", "Current Selections"),
      m(
        "div.tags",
        model.items.map((item) => {
          return m(
            "span.tag.is-medium",
            {
              key: item.key,
              class: item.isCompatible ? "is-info" : "is-warning",
              title: item.tooltip,
            },
            [
              m("span", item.name),
              !item.isCompatible ? m("span.ml-1", "⚠️") : null,
              m("button.delete.is-small", {
                onclick: item.remove,
              }),
            ],
          );
        }),
      ),
    ]);
  },
};
