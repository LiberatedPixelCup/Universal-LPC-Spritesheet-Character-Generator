// Scrollable container with drag-to-scroll support
import m from "mithril";

type ScrollableContainerAttrs = { classes?: string };
type ScrollableContainerState = {
  isDragging: boolean;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
  stopDragging?: () => void;
};

export const ScrollableContainer: m.Component<
  ScrollableContainerAttrs,
  ScrollableContainerState
> = {
  oninit(vnode) {
    vnode.state.isDragging = false;
    vnode.state.startX = 0;
    vnode.state.startY = 0;
    vnode.state.scrollLeft = 0;
    vnode.state.scrollTop = 0;
  },
  oncreate(vnode) {
    const container = vnode.dom as HTMLElement;

    container.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      vnode.state.isDragging = true;
      vnode.state.startX = e.pageX - container.offsetLeft;
      vnode.state.startY = e.pageY - container.offsetTop;
      vnode.state.scrollLeft = container.scrollLeft;
      vnode.state.scrollTop = container.scrollTop;
      container.style.cursor = "grabbing";
    });

    const stopDragging = () => {
      if (!vnode.state.isDragging) return;
      vnode.state.isDragging = false;
      container.style.cursor = "grab";
    };
    vnode.state.stopDragging = stopDragging;

    container.addEventListener("mouseleave", stopDragging);
    container.addEventListener("mouseup", stopDragging);
    window.addEventListener("mouseup", stopDragging);

    container.addEventListener("mousemove", (e) => {
      if (!vnode.state.isDragging) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = (x - vnode.state.startX) * 1.5;
      const walkY = (y - vnode.state.startY) * 1.5;
      container.scrollLeft = vnode.state.scrollLeft - walkX;
      container.scrollTop = vnode.state.scrollTop - walkY;
    });
  },
  onremove(vnode) {
    if (vnode.state.stopDragging) {
      window.removeEventListener("mouseup", vnode.state.stopDragging);
      vnode.state.stopDragging = undefined;
    }
  },
  view(vnode) {
    const { classes = "" } = vnode.attrs;
    return m(
      "div.scrollable-container.mt-3",
      { class: classes },
      vnode.children,
    );
  },
};
