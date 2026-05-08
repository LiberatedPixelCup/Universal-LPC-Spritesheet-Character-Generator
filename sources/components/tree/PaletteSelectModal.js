// PaletteSelectModal.js
import m from "mithril";
import classNames from "classnames";
import { Result } from "neverthrow";
import { drawRecolorPreview } from "../../canvas/palette-recolor.js";
import {
  chunkReady,
  getItemMerged,
  getPaletteMetadata,
} from "../../state/catalog.ts";
import { ResultBoundary } from "../ResultBoundary.js";
import { state, getSelectionGroup } from "../../state/state.ts";
import { ucwords } from "../../utils/helpers.ts";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from "../../state/constants.ts";
import { t } from "../../i18n/index.ts";
import {
  translatePaletteLabel,
  translateRecolorOptionLabel,
  translateVariantLabel,
} from "../../i18n/metadata.ts";

/**
 * Mirrors which variant canvases the modal will mount: default-expands the first version row,
 * then counts recolor tiles for every expanded `opt.versions` category.
 * @param {string} itemId
 * @param {object} opt palette option from `getPaletteOptions`
 * @param {object} paletteMeta resolved palette metadata
 * @returns {number}
 */
function prepareAndCountPalettePreviewCanvases(itemId, opt, paletteMeta) {
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
 * @param {import("mithril").Vnode} rootViewNode
 * @param {number} total
 */
function syncPalettePreviewGate(rootViewNode, total) {
  if (rootViewNode.state._palettePreviewLastTotal === total) {
    return;
  }
  rootViewNode.state.palettePreviewGateSeq =
    (rootViewNode.state.palettePreviewGateSeq || 0) + 1;
  rootViewNode.state._palettePreviewLastTotal = total;
  rootViewNode.state.palettePreviewExpected = total;
  rootViewNode.state.palettePreviewCompleted = 0;
}

function renderLoadingOverlay(onClose, message) {
  return [
    m("div.palette-modal-overlay", { onclick: onClose }),
    m(
      "div.palette-modal",
      {
        onclick: (e) => e.stopPropagation(),
        "data-previews-ready": "false",
      },
      m("p.has-text-grey", message),
    ),
  ];
}

function renderModal(attrs, paletteMeta, meta) {
  const {
    itemId,
    opt,
    selectedColors,
    compactDisplay,
    rootViewNode,
    onClose,
    onSelect,
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
    rootViewNode.state.palettePreviewCompleted >=
      rootViewNode.state.palettePreviewExpected;

  const overlay = m("div.palette-modal-overlay", { onclick: onClose });

  return [
    overlay,
    m(
      "div.palette-modal",
      {
        onclick: (e) => e.stopPropagation(),
        "data-previews-ready": previewsReady ? "true" : "false",
      },
      [
        m("header.is-flex", [
          m("h4", translateRecolorOptionLabel(opt)),
          m(
            "button",
            { onclick: onClose, "aria-label": t("common.close") },
            "x",
          ),
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
                      material !== opt.material
                        ? t("metadata.paletteMaterialFormat", {
                            palette: translatePaletteLabel(
                              paletteVersionMeta?.label,
                            ),
                            material: translatePaletteLabel(
                              materialMeta?.label,
                            ),
                          })
                        : translatePaletteLabel(paletteVersionMeta?.label),
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
                              onmouseover: (e) => {
                                const div = e.currentTarget;
                                if (!isSelected)
                                  div.classList.add("has-background-white-ter");
                              },
                              onmouseout: (e) => {
                                const div = e.currentTarget;
                                if (!isSelected)
                                  div.classList.remove(
                                    "has-background-white-ter",
                                  );
                              },
                              onclick: (e) => {
                                e.stopPropagation();
                                onSelect(key);
                              },
                            },
                            [
                              m(
                                "span.variant-display-name.has-text-centered.is-size-7",
                                translateVariantLabel(
                                  palette,
                                  ucwords(palette.replaceAll("_", " ")),
                                ),
                              ),
                              m("canvas.variant-canvas.box.p-0", {
                                width: compactDisplay
                                  ? COMPACT_FRAME_SIZE
                                  : FRAME_SIZE,
                                height: compactDisplay
                                  ? COMPACT_FRAME_SIZE
                                  : FRAME_SIZE,
                                class: compactDisplay ? " compact-display" : "",
                                onremove: (canvasVnode) => {
                                  canvasVnode.dom._recolorRenderId =
                                    (canvasVnode.dom._recolorRenderId || 0) + 1;
                                },
                                oncreate: (canvasVnode) => {
                                  const renderId =
                                    (canvasVnode.dom._recolorRenderId || 0) + 1;
                                  canvasVnode.dom._recolorRenderId = renderId;
                                  const settledGate =
                                    rootViewNode.state.palettePreviewGateSeq;
                                  void drawRecolorPreview(
                                    itemId,
                                    meta,
                                    canvasVnode.dom,
                                    itemColors,
                                    renderId,
                                  ).then(() => {
                                    if (
                                      settledGate !==
                                      rootViewNode.state.palettePreviewGateSeq
                                    ) {
                                      return;
                                    }
                                    if (
                                      typeof renderId === "number" &&
                                      canvasVnode.dom._recolorRenderId !==
                                        renderId
                                    ) {
                                      return;
                                    }
                                    rootViewNode.state
                                      .palettePreviewCompleted++;
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

export const PaletteSelectModal = {
  view: function (vnode) {
    const { itemId, onClose } = vnode.attrs;
    // Order matters: Result.combine short-circuits to the first Err. We
    // surface a different loading message depending on which chunk is
    // missing (matches the legacy two-stage UX: palette first, then layer).
    return m(ResultBoundary, {
      read: () =>
        Result.combine([
          chunkReady("palette"),
          chunkReady("lite"),
          chunkReady("layers"),
          getPaletteMetadata(),
          getItemMerged(itemId),
        ]),
      view: ([, , , paletteMeta, meta]) =>
        renderModal(vnode.attrs, paletteMeta, meta),
      renderError: (error) => {
        const message =
          error.kind === "loading" && error.chunk === "palette"
            ? t("common.loadingPaletteData")
            : t("common.loadingLayerData");
        return renderLoadingOverlay(onClose, message);
      },
    });
  },
};
