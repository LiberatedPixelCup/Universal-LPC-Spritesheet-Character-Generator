// Current selections component
import m from "mithril";
import type { CurrentSelectionsModel } from "../../models/current-selections.ts";

type CurrentSelectionsState = {
  pendingFocusIndex: number | null;
};

function restoreFocusAfterRemoval(
  root: HTMLElement,
  pendingIndex: number,
): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>(
    "button.lpc-chip-remove",
  );
  if (buttons.length > 0) {
    const targetIndex = Math.min(pendingIndex, buttons.length - 1);
    buttons[targetIndex].focus();
    return;
  }
  const heading = root.querySelector<HTMLElement>("h3.lpc-subpanel-title");
  heading?.focus();
}

export const CurrentSelections: m.Component<
  { createModel: () => CurrentSelectionsModel },
  CurrentSelectionsState
> = {
  oninit(vnode) {
    vnode.state.pendingFocusIndex = null;
  },
  onupdate(vnode) {
    if (vnode.state.pendingFocusIndex === null) return;
    const targetIndex = vnode.state.pendingFocusIndex;
    vnode.state.pendingFocusIndex = null;
    restoreFocusAfterRemoval(vnode.dom as HTMLElement, targetIndex);
  },
  view(vnode) {
    // Only called when the node is actually rendered
    // Currently it is shown by default, so it is called in each redraw
    const model = vnode.attrs.createModel();
    const heading = m(
      "h3.title.is-5.lpc-subpanel-title",
      { tabindex: -1 },
      "Current Selections",
    );

    if (model.kind === "loading") {
      return m("div.lpc-selections", [
        heading,
        m("p.lpc-helper-text", "Loading item list…"),
      ]);
    }

    if (model.kind === "empty") {
      return m("div.lpc-selections", [
        heading,
        m("p.lpc-helper-text", "No items selected yet"),
      ]);
    }

    return m("div.lpc-selections", [
      heading,
      m(
        "div.tags.lpc-selections-list",
        model.items.map((item, idx) => {
          return m(
            "span.tag.is-medium.lpc-selection-chip",
            {
              key: item.key,
              class: item.isCompatible ? "is-info" : "is-warning",
              title: item.tooltip,
            },
            [
              m("span.lpc-chip-label", item.name),
              !item.isCompatible
                ? [
                    m("span.ml-1", { "aria-hidden": "true" }, "⚠️"),
                    m("span.lpc-sr-only", ` (${item.tooltip})`),
                  ]
                : null,
              m(
                "button.delete.is-small.lpc-chip-remove",
                {
                  type: "button",
                  "aria-label": `Remove ${item.name}`,
                  onclick: (event: MouseEvent) => {
                    if (document.activeElement === event.currentTarget) {
                      vnode.state.pendingFocusIndex = idx;
                    }
                    item.remove();
                  },
                },
                "×",
              ),
            ],
          );
        }),
      ),
    ]);
  },
};
