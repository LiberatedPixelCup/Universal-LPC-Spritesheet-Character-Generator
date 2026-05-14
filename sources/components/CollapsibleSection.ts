// Reusable CollapsibleSection component
import m from "mithril";

export type CollapsibleSectionAttrs = {
  title: string;
  defaultOpen?: boolean;
  boxClass?: string;
  onToggle?: (isCollapsed: boolean) => void;
};

type CollapsibleSectionState = { isCollapsed: boolean };

export const CollapsibleSection: m.Component<
  CollapsibleSectionAttrs,
  CollapsibleSectionState
> = {
  oninit(vnode) {
    const { defaultOpen = true } = vnode.attrs;
    vnode.state.isCollapsed = !defaultOpen;
  },
  view(vnode) {
    const { title, boxClass = "box", onToggle } = vnode.attrs;
    const { isCollapsed } = vnode.state;

    const toggleCollapse = () => {
      vnode.state.isCollapsed = !vnode.state.isCollapsed;

      // Call callback if provided
      // The hack to handle the canvas state from within mithril is here:
      if (onToggle) {
        onToggle(vnode.state.isCollapsed);
      }
    };

    return m(`div.${boxClass}`, [
      // Collapsible header
      m(
        "div",
        {
          onclick: toggleCollapse,
          class: "collapsible-header",
        },
        [
          m("span", {
            class: isCollapsed ? "tree-arrow collapsed" : "tree-arrow expanded",
          }),
          m("h3.title.is-5.mb-0", { class: "collapsible-title" }, title),
        ],
      ),

      // Collapsible content
      !isCollapsed &&
        m("div", { class: "collapsible-content" }, vnode.children),
    ]);
  },
};
