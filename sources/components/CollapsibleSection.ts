// Reusable CollapsibleSection component
import m from "mithril";

let nextSectionId = 0;

export type CollapsibleSectionAttrs = {
  title: string;
  defaultOpen?: boolean;
  boxClass?: string;
  onToggle?: (isCollapsed: boolean) => void;
  id?: string;
};

type CollapsibleSectionState = {
  isCollapsed: boolean;
  contentId: string;
};

export const CollapsibleSection: m.Component<
  CollapsibleSectionAttrs,
  CollapsibleSectionState
> = {
  oninit(vnode) {
    const { defaultOpen = true, id } = vnode.attrs;
    vnode.state.isCollapsed = !defaultOpen;
    nextSectionId += 1;
    vnode.state.contentId = id
      ? `${id}-content`
      : `lpc-section-content-${nextSectionId}`;
  },
  view(vnode) {
    const { title, boxClass = "box", onToggle, id } = vnode.attrs;
    const { isCollapsed, contentId } = vnode.state;

    const toggleCollapse = () => {
      vnode.state.isCollapsed = !vnode.state.isCollapsed;

      // Call callback if provided
      // The hack to handle the canvas state from within mithril is here:
      if (onToggle) {
        onToggle(vnode.state.isCollapsed);
      }
    };

    return m(`div.${boxClass}`, { id, class: "lpc-panel" }, [
      m("h3.title.is-5.mb-0.collapsible-title.lpc-panel-heading", [
        m(
          "button.collapsible-header.lpc-disclosure-btn",
          {
            type: "button",
            "aria-expanded": String(!isCollapsed),
            "aria-controls": contentId,
            onclick: toggleCollapse,
          },
          [
            m("span", {
              class: isCollapsed
                ? "tree-arrow collapsed"
                : "tree-arrow expanded",
              "aria-hidden": "true",
            }),
            m("span.lpc-panel-heading-text", title),
          ],
        ),
      ]),

      // Collapsible content — only built while open so collapsed sections stay lazy
      !isCollapsed &&
        m(
          "div",
          { id: contentId, class: "collapsible-content" },
          vnode.children,
        ),
    ]);
  },
};
