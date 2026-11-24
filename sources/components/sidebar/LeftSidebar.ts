import m from "mithril";
import type { State } from "../../state/state.ts";

export type CategoryEntry = {
  key: string;
  label: string;
};

export const TOP_LEVEL_CATEGORIES: readonly CategoryEntry[] = Object.freeze([
  { key: "all", label: "All Items" },
  { key: "arms", label: "Arms" },
  { key: "body", label: "Body" },
  { key: "feet", label: "Feet" },
  { key: "hair", label: "Hair" },
  { key: "head", label: "Head" },
  { key: "headwear", label: "Headwear" },
  { key: "legs", label: "Legs" },
  { key: "tools", label: "Tools" },
  { key: "torso", label: "Torso" },
  { key: "weapons", label: "Weapons" },
]);

export type LeftSidebarAttrs = {
  state: State;
  onClose: () => void;
  onSelectCategory?: (key: string) => void;
};

export const LeftSidebar: m.Component<LeftSidebarAttrs> = {
  view(vnode) {
    const { state, onClose, onSelectCategory } = vnode.attrs;
    const activeKey = state.selectedCategory || "body";

    const selectCategory = (key: string) => {
      if (state.searchQuery.length > 0) {
        state.searchQuery = "";
      }
      state.selectedCategory = key;
      if (key !== "all") {
        state.expandedNodes[key] = true;
      }
      if (onSelectCategory) {
        onSelectCategory(key);
      }
      m.redraw();
    };

    return m(
      "nav.lpc-sidebar",
      {
        id: "lpc-sidebar",
        "aria-label": "Category Navigation",
      },
      [
        m("div.lpc-sidebar-header", [
          m("h2.lpc-sidebar-title", "Categories"),
          m(
            "button.lpc-sidebar-collapse-btn",
            {
              type: "button",
              "aria-label": "Hide Categories sidebar",
              title: "Collapse sidebar",
              onclick: onClose,
            },
            "◀",
          ),
        ]),
        m(
          "ul.lpc-sidebar-list",
          { role: "tablist", "aria-orientation": "vertical" },
          TOP_LEVEL_CATEGORIES.map((cat) => {
            const isSelected = activeKey === cat.key;
            return m(
              "li.lpc-sidebar-item",
              {
                key: cat.key,
                role: "presentation",
              },
              m(
                "button.lpc-sidebar-btn",
                {
                  type: "button",
                  role: "tab",
                  "aria-selected": String(isSelected),
                  class: isSelected ? "is-active lpc-sidebar-active" : "",
                  onclick: () => selectCategory(cat.key),
                },
                [
                  m(
                    "span.lpc-sidebar-indicator",
                    { "aria-hidden": "true" },
                    isSelected ? "●" : "○",
                  ),
                  m("span.lpc-sidebar-label", cat.label),
                ],
              ),
            );
          }),
        ),
      ],
    );
  },
};
