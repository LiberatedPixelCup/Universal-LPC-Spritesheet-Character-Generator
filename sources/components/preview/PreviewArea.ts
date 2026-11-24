import m from "mithril";
import type { CatalogReader } from "../../state/catalog.ts";
import type { State } from "../../state/state.ts";
import type { CurrentSelectionsModel } from "../../models/current-selections.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";
import { CurrentSelections } from "../selections/CurrentSelections.ts";
import { AnimationPreview } from "./AnimationPreview.ts";
import { FullSpritesheetPreview } from "./FullSpritesheetPreview.ts";

export type PreviewAreaAttrs = {
  catalog: CatalogReader;
  state: State;
  createCurrentSelectionsModel: () => CurrentSelectionsModel;
};

export const PreviewArea: m.Component<PreviewAreaAttrs> = {
  view(vnode) {
    const { catalog, state, createCurrentSelectionsModel } = vnode.attrs;
    const activeTab = state.activePreviewTab || "animation";

    const selectionsCount = Object.keys(state.selections).length;
    const selectionsTitle = `Current Selections · ${selectionsCount}`;

    const setTab = (tab: "animation" | "spritesheet") => {
      if (state.activePreviewTab !== tab) {
        state.activePreviewTab = tab;
        m.redraw();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const nextTab = activeTab === "animation" ? "spritesheet" : "animation";
        const tabBar = event.currentTarget as HTMLElement | null;
        state.activePreviewTab = nextTab;
        m.redraw.sync();
        tabBar?.querySelector<HTMLButtonElement>(`#tab-${nextTab}`)?.focus();
      }
    };

    return m("section.lpc-preview-column", { id: "preview-column" }, [
      m("div.lpc-preview-tabs-container", [
        m(
          "div.lpc-preview-tab-bar",
          {
            role: "tablist",
            "aria-label": "Preview modes",
            onkeydown: handleKeyDown,
          },
          [
            m(
              "button.lpc-preview-tab-btn",
              {
                type: "button",
                role: "tab",
                id: "tab-animation",
                "aria-controls": "mithril-preview",
                "aria-selected": String(activeTab === "animation"),
                tabindex: activeTab === "animation" ? 0 : -1,
                class:
                  activeTab === "animation" ? "is-active lpc-tab-active" : "",
                onclick: () => setTab("animation"),
              },
              "Animation",
            ),
            m(
              "button.lpc-preview-tab-btn",
              {
                type: "button",
                role: "tab",
                id: "tab-spritesheet",
                "aria-controls": "mithril-spritesheet-preview",
                "aria-selected": String(activeTab === "spritesheet"),
                tabindex: activeTab === "spritesheet" ? 0 : -1,
                class:
                  activeTab === "spritesheet" ? "is-active lpc-tab-active" : "",
                onclick: () => setTab("spritesheet"),
              },
              "Spritesheet",
            ),
          ],
        ),
        m(
          "div.lpc-preview-content",
          activeTab === "animation"
            ? m(
                "div#mithril-preview.lpc-animation-slot",
                {
                  role: "tabpanel",
                  "aria-labelledby": "tab-animation",
                },
                m(AnimationPreview, {
                  catalog,
                  state,
                }),
              )
            : m(
                "div#mithril-spritesheet-preview.lpc-spritesheet-slot",
                {
                  role: "tabpanel",
                  "aria-labelledby": "tab-spritesheet",
                },
                m(FullSpritesheetPreview, {
                  catalog,
                  state,
                }),
              ),
        ),
      ]),
      m(
        "div.lpc-preview-selections-wrapper",
        m(
          CollapsibleSection,
          {
            title: selectionsTitle,
            defaultOpen: false,
            boxClass: "box lpc-selections-panel",
            id: "current-selections-section",
          },
          m(CurrentSelections, {
            createModel: createCurrentSelectionsModel,
          }),
        ),
      ),
    ]);
  },
};
