import m from "mithril";
import classNames from "classnames";
import { Result } from "neverthrow";
import { drawRecolorPreview } from "../../canvas/palette-recolor.ts";
import type {
  CatalogReader,
  ItemMerged,
  PaletteMetadata,
  LoadError,
} from "../../state/catalog.ts";
import type { LayersToLoadCatalog } from "../../state/meta.ts";
import { renderResult } from "../../utils/render-result.ts";
import { state, getSelectionGroup } from "../../state/state.ts";
import { ucwords } from "../../utils/helpers.ts";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from "../../state/constants.ts";
import type { PaletteOption } from "../../state/palettes.ts";

export type PaletteSelectModalCatalog = Pick<
  CatalogReader,
  "chunkReady" | "getItemMerged" | "getPaletteMetadata"
> &
  LayersToLoadCatalog;

type RootViewState = {
  palettePreviewGateSeq?: number;
  _palettePreviewLastTotal?: number;
  palettePreviewExpected?: number;
  palettePreviewCompleted?: number;
};

/**
 * Minimal slice of the parent vnode the modal reads/mutates. Using `{ state }`
 * rather than `m.Vnode<...>` sidesteps Mithril's invariant Vnode generic when
 * the parent's full state is wider than `RootViewState`.
 */
type RootViewRef = { state: RootViewState };

export type PaletteSelectModalAttrs = {
  itemId: string;
  opt: PaletteOption;
  selectedColors: Record<string, string>;
  compactDisplay: boolean;
  rootViewNode: RootViewRef;
  onClose: () => void;
  onSelect: (recolor: string) => void;
  catalog: PaletteSelectModalCatalog;
};

/**
 * Mirrors which variant canvases the modal will mount: default-expands the first version row,
 * then counts recolor tiles for every expanded `opt.versions` category.
 */
function prepareAndCountPalettePreviewCanvases(
  itemId: string,
  opt: PaletteOption,
  paletteMeta: PaletteMetadata,
): number {
  const firstNodePath = `${itemId}-${opt.idx}-${opt.versions[0]}`;
  if (state.expandedNodes[firstNodePath] === undefined) {
    state.expandedNodes[firstNodePath] = true;
  }
  let n = 0;
  for (const cat of opt.versions) {
    const [material, version] = cat.split(".");
    const nodePath = `${itemId}-${opt.idx}-${cat}`;
    const materialMeta = paletteMeta.materials[material];
    const recolors = materialMeta?.palettes?.[version] ?? {};
    const isExpanded = state.expandedNodes[nodePath] || false;
    if (isExpanded) {
      n += Object.keys(recolors).length;
    }
  }
  return n;
}

/**
 * When the number of preview canvases changes (modal open, expand/collapse), reset the gate so
 * stale `drawRecolorPreview` completions are ignored and `data-previews-ready` stays accurate.
 */
function syncPalettePreviewGate(
  rootViewNode: RootViewRef,
  total: number,
): void {
  if (rootViewNode.state._palettePreviewLastTotal === total) {
    return;
  }
  rootViewNode.state.palettePreviewGateSeq =
    (rootViewNode.state.palettePreviewGateSeq || 0) + 1;
  rootViewNode.state._palettePreviewLastTotal = total;
  rootViewNode.state.palettePreviewExpected = total;
  rootViewNode.state.palettePreviewCompleted = 0;
}

function renderLoadingOverlay(onClose: () => void, message: string) {
  return [
    m("div.palette-modal-overlay", { onclick: onClose }),
    m(
      "div.palette-modal",
      {
        onclick: (e: MouseEvent) => e.stopPropagation(),
        "data-previews-ready": "false",
      },
      m("p.has-text-grey", message),
    ),
  ];
}

function renderModal(
  attrs: PaletteSelectModalAttrs,
  paletteMeta: PaletteMetadata,
  meta: ItemMerged,
) {
  const {
    itemId,
    opt,
    selectedColors,
    compactDisplay,
    rootViewNode,
    onClose,
    onSelect,
    catalog,
  } = attrs;

  const selectionGroup = opt.type_name ?? getSelectionGroup(itemId);
  const selection = state.selections[selectionGroup];
  const previewCanvasTotal = prepareAndCountPalettePreviewCanvases(
    itemId,
    opt,
    paletteMeta,
  );
  syncPalettePreviewGate(rootViewNode, previewCanvasTotal);

  const previewsReady =
    rootViewNode.state.palettePreviewExpected === 0 ||
    (rootViewNode.state.palettePreviewCompleted ?? 0) >=
      (rootViewNode.state.palettePreviewExpected ?? 0);

  const overlay = m("div.palette-modal-overlay", { onclick: onClose });

  return [
    overlay,
    m(
      "div.palette-modal",
      {
        onclick: (e: MouseEvent) => e.stopPropagation(),
        "data-previews-ready": previewsReady ? "true" : "false",
      },
      [
        m("header.is-flex", [
          m("h4", opt.label),
          m("button", { onclick: onClose }, "x"),
        ]),
        m(
          "section",
          opt.versions.map((cat) => {
            const [material, version] = cat.split(".");
            const nodePath = `${itemId}-${opt.idx}-${cat}`;
            const paletteVersionMeta = paletteMeta.versions?.[version];
            const materialMeta = paletteMeta.materials[material];
            const recolors = materialMeta?.palettes?.[version] ?? {};
            const isExpanded = state.expandedNodes[nodePath] || false;
            return m(
              "div.palette-modal-version-block",
              {
                key: `${rootViewNode.state.palettePreviewGateSeq}-${nodePath}`,
              },
              [
                m(
                  "div.tree-label",
                  {
                    onclick: () => {
                      state.expandedNodes[nodePath] = !isExpanded;
                    },
                  },
                  [
                    m("span.tree-arrow", {
                      class: isExpanded ? "expanded" : "collapsed",
                    }),
                    m(
                      "span.palette-version",
                      paletteVersionMeta?.label +
                        (material !== opt.material
                          ? ` - ${materialMeta?.label}`
                          : ""),
                    ),
                  ],
                ),
                isExpanded
                  ? m("div.variants-container.is-flex.is-flex-wrap-wrap", [
                      ...Object.entries(recolors).map(([palette, colors]) => {
                        const gradient = colors.slice().reverse();
                        const key =
                          (material !== opt.material ? material + "." : "") +
                          (version !== opt.default ? version + "." : "") +
                          palette;
                        const isSelected =
                          (selection?.itemId === itemId ||
                            selectionGroup === opt.type_name) &&
                          selection?.recolor === key;
                        const itemColors = {
                          ...selectedColors,
                          [selectionGroup]: key,
                        };
                        return m("div.cell", [
                          m(
                            "div.variant-item.is-flex.is-flex-direction-column.is-align-items-center.is-clickable",
                            {
                              class: classNames({
                                "has-background-link-light has-text-weight-bold has-text-link":
                                  isSelected,
                              }),
                              onmouseover: (e: MouseEvent) => {
                                const div = e.currentTarget as HTMLElement;
                                if (!isSelected)
                                  div.classList.add("has-background-white-ter");
                              },
                              onmouseout: (e: MouseEvent) => {
                                const div = e.currentTarget as HTMLElement;
                                if (!isSelected)
                                  div.classList.remove(
                                    "has-background-white-ter",
                                  );
                              },
                              onclick: (e: MouseEvent) => {
                                e.stopPropagation();
                                onSelect(key);
                              },
                            },
                            [
                              m(
                                "span.variant-display-name.has-text-centered.is-size-7",
                                ucwords(palette.replaceAll("_", " ")),
                              ),
                              m("canvas.variant-canvas.box.p-0", {
                                width: compactDisplay
                                  ? COMPACT_FRAME_SIZE
                                  : FRAME_SIZE,
                                height: compactDisplay
                                  ? COMPACT_FRAME_SIZE
                                  : FRAME_SIZE,
                                class: compactDisplay ? " compact-display" : "",
                                onremove: (canvasVnode: m.VnodeDOM) => {
                                  const cs = canvasVnode.state as {
                                    renderId?: number;
                                  };
                                  cs.renderId = (cs.renderId ?? 0) + 1;
                                },
                                oncreate: (canvasVnode: m.VnodeDOM) => {
                                  const canvas =
                                    canvasVnode.dom as HTMLCanvasElement;
                                  const cs = canvasVnode.state as {
                                    renderId?: number;
                                  };
                                  const renderId = (cs.renderId ?? 0) + 1;
                                  cs.renderId = renderId;
                                  const settledGate =
                                    rootViewNode.state.palettePreviewGateSeq;
                                  void drawRecolorPreview(
                                    catalog,
                                    itemId,
                                    meta,
                                    canvas,
                                    itemColors,
                                    () => cs.renderId !== renderId,
                                  ).then(() => {
                                    if (
                                      settledGate !==
                                      rootViewNode.state.palettePreviewGateSeq
                                    ) {
                                      return;
                                    }
                                    if (cs.renderId !== renderId) {
                                      return;
                                    }
                                    rootViewNode.state.palettePreviewCompleted =
                                      (rootViewNode.state
                                        .palettePreviewCompleted ?? 0) + 1;
                                    m.redraw();
                                  });
                                },
                              }),
                              m(
                                "div.palette-swatch",
                                gradient.map((color) =>
                                  m("span", {
                                    style: {
                                      backgroundColor: color,
                                    },
                                  }),
                                ),
                              ),
                            ],
                          ),
                        ]);
                      }),
                    ])
                  : null,
              ],
            );
          }),
        ),
        m("footer", " "),
      ],
    ),
  ];
}

export const PaletteSelectModal: m.Component<PaletteSelectModalAttrs> = {
  view(vnode) {
    const { itemId, onClose, catalog } = vnode.attrs;
    // Order matters: Result.combine short-circuits to the first Err. We
    // surface a different loading message depending on which chunk is
    // missing (matches the legacy two-stage UX: palette first, then layer).
    return renderResult(
      Result.combine([
        catalog.chunkReady("palette"),
        catalog.chunkReady("lite"),
        catalog.chunkReady("layers"),
        catalog.getPaletteMetadata(),
        catalog.getItemMerged(itemId),
      ]),
      ([, , , paletteMeta, meta]) =>
        renderModal(vnode.attrs, paletteMeta, meta),
      (error: LoadError) => {
        const message =
          error.kind === "loading" && error.chunk === "palette"
            ? "Loading palette data…"
            : "Loading layer data…";
        return renderLoadingOverlay(onClose, message);
      },
    );
  },
};
