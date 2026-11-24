import m from "mithril";
import type { CategoryTreeModel } from "../../models/category-tree.ts";
import { BodyTypeSelector } from "./BodyTypeSelector.ts";
import { TreeNode } from "./TreeNode.ts";

function renderLoadingHost(headerContent?: m.Children, loadError?: string) {
  return m("div.box.category-tree-panel", [
    headerContent,
    m("div.category-tree-loading-host", [
      !loadError &&
        m(
          "div.category-tree-loading-overlay",
          { "aria-busy": "true", "aria-live": "polite" },
          m("span.loading", { "aria-label": "Loading category index" }),
        ),
      m("h3.title.is-5.lpc-subpanel-title", "Available Items"),
      loadError
        ? m("p.lpc-helper-text.is-danger", { role: "alert" }, loadError)
        : m("p.lpc-helper-text", "Loading category index…"),
    ]),
  ]);
}

type RenderedCategory = {
  category: string;
  hasQuery: boolean;
  filtering: boolean;
};
type ScrollArea = { key: "panel" | "list"; element: HTMLElement };
type ScrollPosition = {
  category: string;
  area: ScrollArea["key"];
  offset: number;
};

type CategoryTreeState = {
  desktop: MediaQueryList;
  shortDesktop: MediaQueryList;
  rendered: RenderedCategory | null;
  area: ScrollArea | null;
  restoreScroll: boolean;
  scrollByArea: Record<ScrollArea["key"], Map<string, number>>;
  pendingByArea: Record<ScrollArea["key"], Set<string>>;
  browsedOffsets: Partial<Record<ScrollArea["key"], number>>;
  viewportWidth: number;
  viewportHeight: number;
  observedOffset: number;
  automaticScrollFrame: number | null;
  inputHasQuery: boolean;
  searchHasFiltered: boolean;
  disconnectScroll: () => void;
};

export type CategoryTreeAttrs = {
  createModel: () => CategoryTreeModel;
  headerContent?: m.Children;
};

function getScrollAreaKey(state: CategoryTreeState): ScrollArea["key"] | null {
  if (!state.rendered || !state.desktop.matches) return null;
  return state.shortDesktop.matches ? "panel" : "list";
}

function getScrollArea(
  panel: HTMLElement,
  state: CategoryTreeState,
): ScrollArea | null {
  const key = getScrollAreaKey(state);
  if (!key) return null;
  const list = panel.querySelector<HTMLElement>(
    ":scope > .lpc-tree-scroll-container",
  );
  if (!list) return null;
  return { key, element: key === "panel" ? panel : list };
}

function getRenderedCategory(
  model: CategoryTreeModel,
): RenderedCategory | null {
  if (model.isLoading) return null;
  const queryLength = (model.searchQuery || "").length;
  return {
    category: model.selectedCategory || "body",
    hasQuery: queryLength > 0,
    // Match the query length that filters TreeNode models, including spaces.
    filtering: queryLength >= 2,
  };
}

function isUnfilteredSearch(state: CategoryTreeState): boolean {
  const { rendered, searchHasFiltered } = state;
  return Boolean(
    rendered?.hasQuery && !rendered.filtering && !searchHasFiltered,
  );
}

function viewportChanged(state: CategoryTreeState): boolean {
  return (
    window.innerWidth !== state.viewportWidth ||
    window.innerHeight !== state.viewportHeight
  );
}

function hasPendingScroll(state: CategoryTreeState): boolean {
  const { area, rendered, pendingByArea } = state;
  return Boolean(
    area && rendered && pendingByArea[area.key].has(rendered.category),
  );
}

function stopIgnoringAutomaticScroll(state: CategoryTreeState) {
  if (state.automaticScrollFrame === null) return;
  cancelAnimationFrame(state.automaticScrollFrame);
  state.automaticScrollFrame = null;
}

function ignoreAutomaticScroll(state: CategoryTreeState) {
  if (!state.area) return;
  stopIgnoringAutomaticScroll(state);
  // The browser delivers pending scroll events before the next animation frame.
  state.automaticScrollFrame = requestAnimationFrame(() => {
    state.automaticScrollFrame = null;
    state.observedOffset = state.area?.element.scrollTop ?? 0;
  });
}

function maxScrollOffset(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function saveScroll(state: CategoryTreeState, target?: EventTarget | null) {
  const { area, rendered, scrollByArea } = state;
  if (!area || !rendered || state.inputHasQuery || viewportChanged(state))
    return;
  if (target !== undefined && target !== area.element) return;
  // CSS can switch the owner before the media-query notification is delivered.
  if (getScrollAreaKey(state) !== area.key) return;
  const previousOffset = state.observedOffset;
  const offset = area.element.scrollTop;
  const moved = offset !== previousOffset;
  state.observedOffset = offset;
  if (state.automaticScrollFrame !== null) return;

  if (!rendered.hasQuery) {
    const pending = state.pendingByArea[area.key];
    if (pending.has(rendered.category)) {
      if (target === undefined || !moved) return;
      const maxOffset = maxScrollOffset(area.element);
      // Collapsing the tree can clamp the offset while restoration is pending.
      if (previousOffset > maxOffset && offset === maxOffset) return;
    }
    pending.delete(rendered.category);
    scrollByArea[area.key].set(rendered.category, offset);
  } else if (target && moved && isUnfilteredSearch(state)) {
    state.browsedOffsets[area.key] = offset;
  }
}

function syncScrollArea(
  panel: HTMLElement,
  state: CategoryTreeState,
  afterDomUpdate = false,
) {
  const { rendered, restoreScroll, scrollByArea } = state;
  const area = getScrollArea(panel, state);
  const areaChanged = state.area?.element !== area?.element;
  const resized = viewportChanged(state);
  state.viewportWidth = window.innerWidth;
  state.viewportHeight = window.innerHeight;
  state.area = area;
  state.restoreScroll = false;
  if (areaChanged) stopIgnoringAutomaticScroll(state);
  if (!area || !rendered) return;

  const browsed = isUnfilteredSearch(state)
    ? state.browsedOffsets[area.key]
    : undefined;
  const pending = state.pendingByArea[area.key];
  const recovering = !rendered.filtering && pending.has(rendered.category);
  const shouldRestore =
    restoreScroll ||
    areaChanged ||
    (resized && (browsed !== undefined || recovering));
  const restorePendingAfterUpdate =
    afterDomUpdate && !rendered.hasQuery && pending.has(rendered.category);
  if (!shouldRestore && !restorePendingAfterUpdate) return;

  const desired = rendered.filtering
    ? 0
    : (browsed ?? scrollByArea[area.key].get(rendered.category) ?? 0);
  const maxScroll = maxScrollOffset(area.element);
  if (!shouldRestore && maxScroll < desired) return;
  if (rendered.hasQuery || recovering) ignoreAutomaticScroll(state);
  area.element.scrollTop = Math.min(desired, maxScroll);
  state.observedOffset = area.element.scrollTop;
  if (recovering && browsed === undefined && desired <= maxScroll) {
    pending.delete(rendered.category);
  }
}

function isSearchInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.type === "search";
}

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

export const CategoryTree: m.Component<CategoryTreeAttrs, CategoryTreeState> = {
  oninit({ state }) {
    state.desktop = window.matchMedia("(min-width: 1100px)");
    state.shortDesktop = window.matchMedia("(max-height: 480px)");
    state.rendered = null;
    state.area = null;
    state.restoreScroll = false;
    state.scrollByArea = { panel: new Map(), list: new Map() };
    state.pendingByArea = { panel: new Set(), list: new Set() };
    state.browsedOffsets = {};
    state.viewportWidth = window.innerWidth;
    state.viewportHeight = window.innerHeight;
    state.observedOffset = 0;
    state.automaticScrollFrame = null;
    state.inputHasQuery = false;
    state.searchHasFiltered = false;
  },
  oncreate({ dom, state }) {
    const panel = dom as HTMLElement;
    const onAreaChange = () => syncScrollArea(panel, state);
    const onScroll = (event: Event) => saveScroll(state, event.target);
    const onFocusChange = () => {
      if (isUnfilteredSearch(state) || hasPendingScroll(state)) {
        ignoreAutomaticScroll(state);
      }
    };
    const onScrollGesture = (event: Event) => {
      const { area } = state;
      if (
        !area ||
        (!isUnfilteredSearch(state) &&
          !hasPendingScroll(state) &&
          state.automaticScrollFrame === null) ||
        !(event.target instanceof Element)
      )
        return;
      if (
        !area.element.contains(event.target) ||
        getScrollAreaKey(state) !== area.key
      )
        return;
      if (event instanceof WheelEvent && (event.deltaY === 0 || event.ctrlKey))
        return;
      if (
        event instanceof KeyboardEvent &&
        (event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          !SCROLL_KEYS.has(event.key) ||
          event.target.closest("input, textarea, select, [contenteditable]") ||
          (event.key === " " &&
            event.target.closest("button, [role=button], [role=tab]")))
      )
        return;
      stopIgnoringAutomaticScroll(state);
    };
    let beforeInput: ScrollPosition | null = null;
    const onBeforeInput = (event: Event) => {
      if (!isSearchInput(event.target)) return;
      ignoreAutomaticScroll(state);
      beforeInput = null;
      const { rendered } = state;
      if (!rendered || rendered.hasQuery || event.target.value) return;
      // The browser can scroll the search caret into view before emitting input.
      const area = getScrollArea(panel, state);
      if (area) {
        beforeInput = {
          category: rendered.category,
          area: area.key,
          offset: area.element.scrollTop,
        };
      }
    };
    const onInput = (event: Event) => {
      if (!isSearchInput(event.target)) return;
      ignoreAutomaticScroll(state);
      state.observedOffset = state.area?.element.scrollTop ?? 0;
      const hasQuery = event.target.value.length > 0;
      if (
        hasQuery &&
        beforeInput &&
        beforeInput.category === state.rendered?.category &&
        !state.pendingByArea[beforeInput.area].has(beforeInput.category)
      ) {
        const { category, area, offset } = beforeInput;
        state.scrollByArea[area].set(category, offset);
      }
      state.inputHasQuery = hasQuery;
      beforeInput = null;
    };
    panel.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    panel.addEventListener("beforeinput", onBeforeInput, true);
    panel.addEventListener("input", onInput, true);
    panel.addEventListener("focusin", onFocusChange);
    panel.addEventListener("focusout", onFocusChange);
    panel.addEventListener("wheel", onScrollGesture, { passive: true });
    panel.addEventListener("touchmove", onScrollGesture, { passive: true });
    panel.addEventListener("keydown", onScrollGesture);
    state.desktop.addEventListener("change", onAreaChange);
    state.shortDesktop.addEventListener("change", onAreaChange);
    window.addEventListener("resize", onAreaChange);
    state.disconnectScroll = () => {
      panel.removeEventListener("scroll", onScroll, true);
      panel.removeEventListener("beforeinput", onBeforeInput, true);
      panel.removeEventListener("input", onInput, true);
      panel.removeEventListener("focusin", onFocusChange);
      panel.removeEventListener("focusout", onFocusChange);
      panel.removeEventListener("wheel", onScrollGesture);
      panel.removeEventListener("touchmove", onScrollGesture);
      panel.removeEventListener("keydown", onScrollGesture);
      state.desktop.removeEventListener("change", onAreaChange);
      state.shortDesktop.removeEventListener("change", onAreaChange);
      window.removeEventListener("resize", onAreaChange);
      stopIgnoringAutomaticScroll(state);
    };
    syncScrollArea(panel, state);
  },
  onbeforeupdate(vnode) {
    const { state } = vnode;
    const previous = state.rendered;
    const next = getRenderedCategory(vnode.attrs.createModel());
    const categoryChanged = previous?.category !== next?.category;
    const searchEnded = previous?.hasQuery && next && !next.hasQuery;
    const commitBrowsedOffsets = searchEnded && isUnfilteredSearch(state);
    let restoreBrowsedOffset = false;
    if (previous && commitBrowsedOffsets) {
      for (const key of ["panel", "list"] as const) {
        const browsed = state.browsedOffsets[key];
        if (browsed === undefined) continue;
        state.scrollByArea[key].set(previous.category, browsed);
        state.pendingByArea[key].add(previous.category);
        restoreBrowsedOffset ||= key === getScrollAreaKey(state);
      }
    }
    if (
      previous &&
      next &&
      (categoryChanged ||
        previous.filtering !== next.filtering ||
        (searchEnded && (state.searchHasFiltered || restoreBrowsedOffset)))
    ) {
      if (!commitBrowsedOffsets) {
        // Read the old layout before a shorter category can clamp its scroll offset.
        saveScroll(state);
      }
      state.restoreScroll = true;
    }
    if (categoryChanged || !next?.hasQuery || next.filtering) {
      state.browsedOffsets = {};
      if (previous?.hasQuery) stopIgnoringAutomaticScroll(state);
    }
    state.searchHasFiltered = Boolean(
      next?.filtering ||
      (next?.hasQuery && !categoryChanged && state.searchHasFiltered),
    );
    state.inputHasQuery = false;
  },
  onupdate({ dom, state }) {
    if (
      state.restoreScroll ||
      (state.area?.key ?? null) !== getScrollAreaKey(state) ||
      (state.rendered?.hasQuery === false && hasPendingScroll(state))
    ) {
      syncScrollArea(dom as HTMLElement, state, true);
    }
  },
  onremove({ state }) {
    state.disconnectScroll();
  },
  view(vnode) {
    const model = vnode.attrs.createModel();
    vnode.state.rendered = getRenderedCategory(model);
    if (model.isLoading)
      return renderLoadingHost(vnode.attrs.headerContent, model.loadError);

    const isSearching = (model.searchQuery || "").trim().length >= 2;
    const showBodyOptions =
      isSearching ||
      model.selectedCategory === "body" ||
      model.selectedCategory === "all";

    const hasCategoryRoot = model.roots.some(
      (r) => r.key === model.selectedCategory,
    );
    const displayRoots =
      isSearching || model.selectedCategory === "all" || !hasCategoryRoot
        ? model.roots
        : model.roots.filter((r) => r.key === model.selectedCategory);

    return m("div.box.category-tree-panel", [
      vnode.attrs.headerContent,
      m("div.lpc-tree-header", [
        m("div.lpc-tree-title-row", [
          m("h3.title.is-6.lpc-subpanel-title.mb-0", "Available Items"),
          showBodyOptions &&
            m("div.lpc-match-body-inline", [
              m(
                "label.checkbox.lpc-match-body-label",
                {
                  title:
                    "Auto-update heads, ears, and other items when body color changes",
                },
                [
                  m("input[type=checkbox]#match-body-color-checkbox", {
                    "aria-describedby": "match-body-color-label",
                    checked: model.matchBodyColorEnabled,
                    onchange: (event: Event) => {
                      model.setMatchBodyColor(
                        (event.target as HTMLInputElement).checked,
                      );
                    },
                  }),
                  m("span.ml-1", "Match body color"),
                ],
              ),
              m(
                "span.lpc-sr-only#match-body-color-label",
                "Auto-update heads, ears, and other items when body color changes",
              ),
            ]),
        ]),
        m("div.lpc-tree-toolbar", [
          m("div.lpc-tree-actions-row", [
            m(
              "button.button.is-small.lpc-compact-action-btn",
              { type: "button", onclick: model.collapseAll },
              "Collapse All",
            ),
            m(
              "button.button.is-small.lpc-compact-action-btn",
              {
                type: "button",
                disabled: !model.liteReady,
                title: model.liteReady ? undefined : "Loading item list…",
                onclick: model.expandSelected,
              },
              "Expand Selected",
            ),
            m(
              "button.button.is-small.lpc-compact-action-btn",
              {
                type: "button",
                "aria-pressed": String(model.compactDisplay),
                class: model.compactDisplay ? "is-link lpc-btn-active" : "",
                onclick: model.toggleCompactDisplay,
              },
              "Compact Display",
            ),
            m(
              "button.button.is-danger.is-small.lpc-btn-danger.lpc-compact-action-btn",
              { type: "button", onclick: model.reset },
              "Reset all",
            ),
          ]),
        ]),
      ]),
      m("div.lpc-tree-scroll-container", [
        m("div.lpc-tree-root", [
          showBodyOptions && m(BodyTypeSelector, { model: model.bodyTypes }),
          displayRoots.length === 0
            ? m("div.lpc-category-empty.p-4.has-text-centered", [
                m(
                  "p.has-text-grey",
                  "No items match current filters for this category.",
                ),
              ])
            : displayRoots.map((root) =>
                m(TreeNode, {
                  key: root.key,
                  createModel: root.createModel,
                }),
              ),
        ]),
      ]),
    ]);
  },
};
