// Reusable CollapsibleSection component
export const CollapsibleSection = {
  oninit: function(vnode) {
    const { defaultOpen = true } = vnode.attrs;
    vnode.state.isCollapsed = !defaultOpen;
  },
  view: function(vnode) {
    const {
      title,
      boxClass = "box",
      onToggle,
      defaultOpen, // Consume it here so it doesn't leak to the html
      ...additionalAttrs
    } = vnode.attrs;
    const { isCollapsed } = vnode.state;

    const toggleCollapse = () => {
      vnode.state.isCollapsed = !vnode.state.isCollapsed;

      // Call callback if provided
      // The hack to handle the canvas state from within mithril is here:
      if (onToggle) {
        onToggle(vnode.state.isCollapsed);
      }
    };

    return m(`div.${boxClass}`, additionalAttrs, [
      // Collapsible header
      m(
        "div",
        {
          onclick: toggleCollapse,
          class: "collapsible-header"
        },
        [
          m("span", {
            class: isCollapsed ? "tree-arrow collapsed" : "tree-arrow expanded"
          }),
          m("h3.title.is-5.mb-0", { class: "collapsible-title" }, title)
        ]
      ),

      // Collapsible content
      !isCollapsed && m("div", { class: "collapsible-content" }, vnode.children)
    ]);
  }
};
