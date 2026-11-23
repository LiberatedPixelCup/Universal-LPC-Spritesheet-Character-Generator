import m from "mithril";
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { CollapsibleSection } from "../../sources/components/CollapsibleSection.ts";
import { CurrentSelections } from "../../sources/components/selections/CurrentSelections.ts";
import { PaletteSelectModal } from "../../sources/components/tree/PaletteSelectModal.ts";
import { ItemWithRecolors } from "../../sources/components/tree/ItemWithRecolors.ts";
import { ItemWithVariants } from "../../sources/components/tree/ItemWithVariants.ts";
import { ScrollableContainer } from "../../sources/components/preview/ScrollableContainer.ts";
import { Download } from "../../sources/components/download/Download.ts";
import { LicenseFilters } from "../../sources/components/filters/LicenseFilters.ts";
import { AnimationFilters } from "../../sources/components/filters/AnimationFilters.ts";
import { SearchControl } from "../../sources/components/filters/SearchControl.ts";
import { CategoryTree } from "../../sources/components/tree/CategoryTree.ts";
import { BodyTypeSelector } from "../../sources/components/tree/BodyTypeSelector.ts";
import { AdvancedTools } from "../../sources/components/advanced/AdvancedTools.ts";
import { createState } from "../../sources/state/state.ts";
import type { PaletteSelectModalModel } from "../../sources/models/palette-select-modal.ts";
import type {
  CurrentSelectionItemModel,
  CurrentSelectionsModel,
} from "../../sources/models/current-selections.ts";

describe("UI Redesign accessibility & focus regressions", function () {
  let host: HTMLDivElement;

  beforeEach(function () {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(function () {
    m.mount(host, null);
    m.render(host, null);
    host.remove();
  });

  it("CollapsibleSection exposes button disclosure semantics and invokes onToggle once", function () {
    const toggleCalls: boolean[] = [];
    m.mount(host, {
      view: () =>
        m(
          CollapsibleSection,
          {
            title: "Demo",
            id: "demo-sec",
            defaultOpen: true,
            onToggle: (isCollapsed: boolean) => {
              toggleCalls.push(isCollapsed);
            },
          },
          m("p", "Body"),
        ),
    });

    const btn = host.querySelector<HTMLButtonElement>(
      "button.collapsible-header",
    );
    expect(btn).to.not.equal(null);
    expect(btn!.type).to.equal("button");
    expect(btn!.getAttribute("aria-expanded")).to.equal("true");
    expect(btn!.getAttribute("aria-controls")).to.equal("demo-sec-content");
    expect(
      btn!.querySelector(".tree-arrow")?.getAttribute("aria-hidden"),
    ).to.equal("true");
    expect(host.querySelector("#demo-sec-content")).to.not.equal(null);

    btn!.click();
    m.redraw.sync();
    expect(toggleCalls).to.deep.equal([true]);
    expect(btn!.getAttribute("aria-expanded")).to.equal("false");
    expect(host.querySelector("#demo-sec-content")).to.equal(null);
  });

  it("CurrentSelections recovers focus to next remove button and then to heading when emptied", function () {
    let items: CurrentSelectionItemModel[] = [
      {
        key: "a",
        name: "Hat A",
        isCompatible: true,
        tooltip: "Licenses: CC0",
        remove() {
          items = items.filter((it) => it.key !== "a");
        },
      },
      {
        key: "b",
        name: "Coat B",
        isCompatible: false,
        tooltip: "⚠️ Incompatible",
        remove() {
          items = items.filter((it) => it.key !== "b");
        },
      },
    ];

    m.mount(host, {
      view: () =>
        m(CurrentSelections, {
          createModel: (): CurrentSelectionsModel =>
            items.length
              ? { kind: "ready" as const, items }
              : { kind: "empty" as const },
        }),
    });

    const firstRemove = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Hat A"]',
    );
    expect(firstRemove).to.not.equal(null);
    firstRemove!.focus();
    firstRemove!.click();
    m.redraw.sync();

    const secondRemove = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Coat B"]',
    );
    expect(secondRemove).to.not.equal(null);
    expect(document.activeElement).to.equal(secondRemove);

    secondRemove!.click();
    m.redraw.sync();
    const heading = host.querySelector<HTMLElement>("h3.lpc-subpanel-title");
    expect(document.activeElement).to.equal(heading);
  });

  it("PaletteSelectModal keeps dialog shell across loading->ready, guards single Escape close, ignores inner click, and restores focus", function () {
    const opener = document.createElement("button");
    opener.textContent = "Open";
    const fallback = document.createElement("button");
    fallback.textContent = "Fallback";
    host.appendChild(opener);
    host.appendChild(fallback);
    opener.focus();

    let model: PaletteSelectModalModel = {
      loadingMessage: "Loading palette data…",
    };
    let closeCalls = 0;
    let selectCalls = 0;

    const modalHost = document.createElement("div");
    host.appendChild(modalHost);

    m.mount(modalHost, {
      view: () =>
        m(PaletteSelectModal, {
          createModel: () => model,
          onClose: () => {
            closeCalls += 1;
          },
          returnFocusTo: opener,
          fallbackFocusTo: fallback,
        }),
    });

    const dialog = modalHost.querySelector<HTMLDialogElement>(
      "dialog.palette-modal",
    );
    expect(dialog).to.not.equal(null);
    const closeBtn = dialog!.querySelector<HTMLButtonElement>(
      'button[aria-label="Close palette"]',
    );
    expect(closeBtn).to.not.equal(null);
    expect(document.activeElement).to.equal(closeBtn);

    // Transition loading -> ready reuses same <dialog> DOM node
    model = {
      bodyType: "male",
      previewLayersKey: "[]",
      previewContentKey: "[]",
      title: "Cloth",
      size: 64,
      compactDisplay: false,
      previewCount: 1,
      versions: [
        {
          key: "v1",
          label: "Universal LPC",
          isSource: false,
          isExpanded: true,
          toggle() {},
          tiles: [
            {
              key: "red",
              label: "Red",
              colors: ["#900", "#f00"],
              isSelected: true,
              select() {
                selectCalls += 1;
              },
              draw: async () => 1,
            },
          ],
        },
      ],
    };
    m.redraw.sync();
    expect(modalHost.querySelector("dialog.palette-modal")).to.equal(dialog);

    // Inner click must NOT dismiss
    dialog!.querySelector<HTMLElement>(".lpc-palette-dialog-inner")!.click();
    expect(closeCalls).to.equal(0);

    // Tile selection calls select and keeps dialog open
    const tileBtn = dialog!.querySelector<HTMLButtonElement>(
      "button.lpc-palette-tile",
    );
    expect(tileBtn!.getAttribute("aria-pressed")).to.equal("true");
    tileBtn!.click();
    expect(selectCalls).to.equal(1);
    expect(closeCalls).to.equal(0);

    // Click inside dialog bounding rect does not dismiss
    const rect = dialog!.getBoundingClientRect();
    dialog!.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: rect.left + 5,
        clientY: rect.top + 5,
      }),
    );
    expect(closeCalls).to.equal(0);

    // Cancel event (Escape) fires onClose once even if triggered twice
    dialog!.dispatchEvent(new Event("cancel", { cancelable: true }));
    dialog!.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(closeCalls).to.equal(1);
    expect(document.activeElement).to.equal(opener);

    // Fallback focus restore when opener is disconnected
    m.mount(modalHost, null);
    opener.remove();
    let closeCalls2 = 0;
    m.mount(modalHost, {
      view: () =>
        m(PaletteSelectModal, {
          createModel: () => model,
          onClose: () => {
            closeCalls2 += 1;
          },
          returnFocusTo: opener,
          fallbackFocusTo: fallback,
        }),
    });
    const dialog2 = modalHost.querySelector<HTMLDialogElement>(
      "dialog.palette-modal",
    );
    dialog2!.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: -10,
        clientY: -10,
      }),
    );
    expect(closeCalls2).to.equal(1);
    expect(document.activeElement).to.equal(fallback);
  });

  it("ItemWithRecolors separates disclosure, thumbnail, and swatch buttons and skips prepareSelection while loading", function () {
    let prepareCalls = 0;
    let paletteReady = false;
    let isExpanded = true;

    m.mount(host, {
      view: () =>
        m(ItemWithRecolors, {
          createModel: () => ({
            name: "Recolor Shirt",
            bodyType: "male",
            isSearchMatch: false,
            isCompatible: true,
            isExpanded,
            isSelected: false,
            paletteReady,
            layersReady: true,
            compactDisplay: false,
            selectedColors: {},
            paletteOptions: [
              {
                label: "Cloth",
                colors: ["#111", "#eee"],
                prepareSelection() {
                  prepareCalls += 1;
                },
                createModalModel: () => ({ loadingMessage: "Loading…" }),
              },
            ],
            toggle() {
              isExpanded = !isExpanded;
            },
            drawPreview: async () => 0,
          }),
        }),
    });

    // While loading: clicking swatch opens modal request without calling prepareSelection
    const loadingSwatch = host.querySelector<HTMLButtonElement>(
      "button.palette-recolor-item",
    );
    expect(loadingSwatch).to.not.equal(null);
    loadingSwatch!.click();
    expect(prepareCalls).to.equal(0);

    // Once ready: sibling buttons exist (no nested buttons) and thumbnail calls prepareSelection once
    paletteReady = true;
    m.redraw.sync();
    const closeBtn = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Close palette"]',
    );
    closeBtn?.click();
    m.redraw.sync();

    const thumbBtn = host.querySelector<HTMLButtonElement>(
      "button.lpc-recolor-thumb-btn",
    );
    const swatchBtn = host.querySelector<HTMLButtonElement>(
      "button.palette-recolor-item",
    );
    expect(thumbBtn).to.not.equal(null);
    expect(swatchBtn).to.not.equal(null);
    expect(thumbBtn!.querySelector("button")).to.equal(null);
    expect(swatchBtn!.querySelector("button")).to.equal(null);

    thumbBtn!.click();
    m.redraw.sync();
    expect(prepareCalls).to.equal(1);
    expect(host.querySelector("dialog.palette-modal")).to.not.equal(null);
  });

  it("Download renders all 9 buttons in PNG -> ZIP -> Credits -> JSON order with a single primary button", function () {
    m.render(
      host,
      m(Download, {
        createModel: () => ({
          pngDisabled: false,
          zipDisabled: false,
          zipByAnimationRunning: false,
          zipByItemRunning: false,
          zipByAnimationAndItemRunning: false,
          zipIndividualFramesRunning: false,
          saveSpritesheet() {},
          downloadCreditsTxt() {},
          downloadCreditsCsv() {},
          exportZipByAnimation: async () => {},
          exportZipByItem: async () => {},
          exportZipByAnimationAndItem: async () => {},
          exportZipByAnimationAndFrame: async () => {},
          exportJsonToClipboard: async () => ({ kind: "unavailable" as const }),
          importJsonFromClipboard: async () => ({
            kind: "unavailable" as const,
          }),
        }),
      }),
    );

    const actionButtons = [
      ...host.querySelectorAll<HTMLButtonElement>("#download-buttons button"),
    ];
    expect(actionButtons.map((b) => b.textContent?.trim())).to.deep.equal([
      "Spritesheet (PNG)",
      "ZIP: Split by animation",
      "ZIP: Split by item",
      "ZIP: Split by animation and item",
      "ZIP: Split by animation and frame",
      "Credits (TXT)",
      "Credits (CSV)",
      "Export to Clipboard (JSON)",
      "Import from Clipboard (JSON)",
    ]);
    const primaryButtons = actionButtons.filter((b) =>
      b.classList.contains("is-primary"),
    );
    expect(primaryButtons.length).to.equal(1);
    expect(primaryButtons[0].textContent?.trim()).to.equal("Spritesheet (PNG)");
  });

  it("wires accessible labels, aria-expanded, and aria-pressed on Search, Filters, CategoryTree, BodyType, and AdvancedTools", function () {
    const state = createState();
    m.render(host, [
      m(SearchControl, {
        createModel: () => ({
          value: "",
          disabled: false,
          setValue() {},
        }),
      }),
      m(LicenseFilters, {
        createModel: () => ({
          liteReady: true,
          creditsReady: true,
          summary: "(1/1)",
          incompatibleCount: 0,
          options: [
            {
              key: "CC0",
              label: "CC0",
              url: "https://example.org",
              urlLabel: "1.0",
              enabled: true,
              setEnabled() {},
            },
          ],
          removeIncompatible: () => 0,
        }),
      }),
      m(AnimationFilters, {
        createModel: () => ({
          liteReady: true,
          summary: "(All)",
          incompatibleCount: 0,
          options: [],
          removeIncompatible: () => 0,
        }),
      }),
      m(CategoryTree, {
        createModel: () => ({
          isLoading: false,
          liteReady: true,
          compactDisplay: true,
          matchBodyColorEnabled: true,
          bodyTypes: {
            selected: "male",
            options: [{ value: "male", label: "Male" }],
            select() {},
          },
          roots: [],
          reset() {},
          collapseAll() {},
          expandSelected() {},
          toggleCompactDisplay() {},
          setMatchBodyColor() {},
        }),
      }),
      m(BodyTypeSelector, {
        model: {
          selected: "male",
          options: [{ value: "male", label: "Male" }],
          select() {},
        },
      }),
      m(AdvancedTools, { state }),
    ]);

    const searchLabel = host.querySelector<HTMLLabelElement>(
      'label[for="lpc-search-input"]',
    );
    expect(searchLabel).to.not.equal(null);
    expect(host.querySelector("#lpc-search-input")).to.not.equal(null);

    const compactBtn = [
      ...host.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent?.trim() === "Compact Display");
    expect(compactBtn).to.not.equal(null);
    expect(compactBtn!.getAttribute("aria-pressed")).to.equal("true");

    const licenseBtn = [
      ...host.querySelectorAll<HTMLButtonElement>(
        "button.lpc-filter-disclosure",
      ),
    ][0];
    expect(licenseBtn.getAttribute("aria-expanded")).to.equal("false");
    expect(licenseBtn.querySelector("a")).to.equal(null);
  });

  it("blocks incompatible ItemWithRecolors & ItemWithVariants activation and syncs native dialog close", async function () {
    let prepareCalls = 0;
    let paletteReady = false;
    m.mount(host, {
      view: () => [
        m(ItemWithRecolors, {
          createModel: () => ({
            name: "Locked Shirt",
            bodyType: "male",
            isSearchMatch: false,
            isCompatible: false,
            isExpanded: true,
            isSelected: false,
            paletteReady,
            layersReady: true,
            compactDisplay: false,
            selectedColors: {},
            paletteOptions: [
              {
                label: "Cloth",
                colors: ["#111", "#eee"],
                prepareSelection() {
                  prepareCalls += 1;
                },
                createModalModel: () => ({ loadingMessage: "Loading…" }),
              },
            ],
            toggle() {},
            drawPreview: async () => 0,
          }),
        }),
        m(ItemWithVariants, {
          createModel: () => ({
            name: "Locked Hat",
            isSearchMatch: false,
            isCompatible: false,
            isExpanded: true,
            toggle: () => {},
            variants: [
              {
                key: "blue",
                label: "Blue",
                isSelected: false,
                isCompatible: false,
                size: 64,
                compactDisplay: false,
                select() {},
                loadPreview: async () => () => {},
              },
            ],
          }),
        }),
      ],
    });

    // While loading: incompatible swatch ignores click
    const loadingSwatch = host.querySelector<HTMLButtonElement>(
      "button.palette-recolor-item",
    );
    expect(loadingSwatch!.getAttribute("aria-disabled")).to.equal("true");
    loadingSwatch!.click();
    m.redraw.sync();
    expect(host.querySelector("dialog.palette-modal")).to.equal(null);

    // Once ready: incompatible thumb & swatch omit is-clickable and ignore clicks
    paletteReady = true;
    m.redraw.sync();
    const thumb = host.querySelector<HTMLButtonElement>(
      "button.lpc-recolor-thumb-btn",
    );
    const swatch = host.querySelector<HTMLButtonElement>(
      "button.palette-recolor-item",
    );
    expect(thumb!.classList.contains("is-clickable")).to.equal(false);
    expect(swatch!.classList.contains("is-not-compatible")).to.equal(true);
    thumb!.click();
    swatch!.click();
    m.redraw.sync();
    expect(prepareCalls).to.equal(0);
    expect(host.querySelector("dialog.palette-modal")).to.equal(null);

    // Incompatible variant tile omits is-clickable
    const variantTile = host.querySelector<HTMLButtonElement>(
      "button.lpc-variant-tile",
    );
    expect(variantTile!.classList.contains("is-clickable")).to.equal(false);
    expect(variantTile!.classList.contains("is-not-compatible")).to.equal(true);

    // Native <dialog> close event without cancel still fires onClose once
    let nativeCloseCalls = 0;
    m.mount(host, {
      view: () =>
        m(PaletteSelectModal, {
          createModel: () => ({ loadingMessage: "Loading…" }),
          onClose: () => {
            nativeCloseCalls += 1;
          },
        }),
    });
    const dlg = host.querySelector<HTMLDialogElement>("dialog.palette-modal");
    const closed = new Promise<Event>((resolve) => {
      dlg!.addEventListener("close", resolve, { once: true });
    });
    dlg!.close();
    await closed;
    expect(nativeCloseCalls).to.equal(1);
  });

  it("ScrollableContainer ignores right-click mousedown and stops dragging on window mouseup", function () {
    m.mount(host, {
      view: () => m(ScrollableContainer, m("div", "sheet")),
    });
    const container = host.querySelector<HTMLElement>(".scrollable-container")!;
    container.dispatchEvent(
      new MouseEvent("mousedown", { button: 2, bubbles: true }),
    );
    expect(container.style.cursor).to.not.equal("grabbing");

    // Left-click starts drag; window mouseup ends it cleanly
    container.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, bubbles: true }),
    );
    expect(container.style.cursor).to.equal("grabbing");
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(container.style.cursor).to.equal("grab");

    // Second mouseup while not dragging is a no-op
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(container.style.cursor).to.equal("grab");
  });

  it("LicenseFilters and AnimationFilters point to warnings below", function () {
    m.mount(host, {
      view: () => [
        m(LicenseFilters, {
          createModel: () => ({
            liteReady: true,
            creditsReady: true,
            summary: "(1/5)",
            incompatibleCount: 1,
            options: [],
            removeIncompatible: () => 0,
          }),
        }),
        m(AnimationFilters, {
          createModel: () => ({
            liteReady: true,
            summary: "(1/5)",
            incompatibleCount: 1,
            options: [],
            removeIncompatible: () => 0,
          }),
        }),
      ],
    });
    for (const btn of host.querySelectorAll<HTMLButtonElement>(
      "button.lpc-filter-disclosure",
    )) {
      btn.click();
    }
    m.redraw.sync();
    const warnings = [
      ...host.querySelectorAll<HTMLElement>(".lpc-warning-box"),
    ];
    expect(warnings.length).to.equal(2);
    for (const w of warnings) {
      expect(w.textContent).to.include("(marked with ⚠️ below)");
    }
  });
});
