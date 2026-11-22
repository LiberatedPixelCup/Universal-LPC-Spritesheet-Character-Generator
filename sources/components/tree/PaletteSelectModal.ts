import m from "mithril";
import classNames from "classnames";
import type { PaletteSelectModalModel } from "../../models/palette-select-modal.ts";

let nextDialogId = 0;

function isLoadingPaletteModel(
  model: PaletteSelectModalModel,
): model is { readonly loadingMessage: string } {
  return "loadingMessage" in model;
}

type PaletteSelectModalAttrs = {
  createModel: () => PaletteSelectModalModel;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
  fallbackFocusTo?: HTMLElement | null;
};

type PaletteSelectModalState = {
  dialogTitleId: string;
  openerEl: HTMLElement | null;
  closing: boolean;
  gateSequence: number;
  previewKey: string | null;
  completed: number;
};

type PaletteCanvasState = { removed?: boolean };

type ReadyPaletteSelectModalModel = Exclude<
  PaletteSelectModalModel,
  { readonly loadingMessage: string }
>;

function restoreDialogFocus(
  openerEl: HTMLElement | null,
  fallbackEl?: HTMLElement | null,
): void {
  const target = openerEl?.isConnected
    ? openerEl
    : fallbackEl?.isConnected
      ? fallbackEl
      : null;
  target?.focus();
}

function isClickOutsideDialogRect(
  dialog: HTMLDialogElement,
  event: MouseEvent,
): boolean {
  if (event.target !== dialog) {
    return false;
  }
  const rect = dialog.getBoundingClientRect();
  // Synthetic `.click()` in unit tests has clientX=0, clientY=0 with target===dialog
  if (event.clientX === 0 && event.clientY === 0) {
    return true;
  }
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

function renderReadyBody(
  model: ReadyPaletteSelectModalModel,
  vnode: m.Vnode<PaletteSelectModalAttrs, PaletteSelectModalState>,
  gateSequence: number,
) {
  return model.versions.map((version) =>
    m(
      version.isSource
        ? "div.palette-modal-source-block"
        : "div.palette-modal-version-block",
      { key: version.key },
      [
        m(
          "button.tree-label.lpc-palette-version-btn",
          {
            type: "button",
            "aria-expanded": String(version.isExpanded),
            onclick: version.toggle,
          },
          [
            m("span.tree-arrow", {
              class: version.isExpanded ? "expanded" : "collapsed",
              "aria-hidden": "true",
            }),
            m("span.palette-version", version.label),
          ],
        ),
        version.isExpanded
          ? m(
              "div.variants-container.lpc-palette-grid",
              version.tiles.map((tile) =>
                m(
                  "div.cell",
                  { key: tile.key },
                  m(
                    "button.variant-item.lpc-palette-tile.is-clickable",
                    {
                      type: "button",
                      "aria-pressed": String(tile.isSelected),
                      class: classNames({
                        "has-background-link-light lpc-tile-selected":
                          tile.isSelected,
                        [`key-${tile.key}`]: true,
                      }),
                      onclick: (event: MouseEvent) => {
                        event.stopPropagation();
                        tile.select();
                      },
                    },
                    [
                      m(
                        "span.variant-display-name",
                        { key: "label" },
                        tile.label,
                      ),
                      m("canvas.variant-canvas", {
                        key: gateSequence,
                        width: model.size,
                        height: model.size,
                        "aria-hidden": "true",
                        class: model.compactDisplay ? "compact-display" : "",
                        onremove: (canvasVnode: m.VnodeDOM) => {
                          const state = canvasVnode.state as PaletteCanvasState;
                          state.removed = true;
                        },
                        oncreate: (canvasVnode: m.VnodeDOM) => {
                          const canvas = canvasVnode.dom as HTMLCanvasElement;
                          const state = canvasVnode.state as PaletteCanvasState;
                          const isStale = () =>
                            state.removed === true ||
                            gateSequence !== vnode.state.gateSequence ||
                            vnode.state.closing;
                          const settle = () => {
                            if (isStale()) return;
                            vnode.state.completed += 1;
                            m.redraw();
                          };
                          void tile.draw(canvas, isStale).then(settle, settle);
                        },
                      }),
                      m(
                        "span.palette-swatch",
                        { key: "swatch", "aria-hidden": "true" },
                        tile.colors.map((color) =>
                          m("span", {
                            style: { backgroundColor: color },
                          }),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          : null,
      ],
    ),
  );
}

export const PaletteSelectModal: m.Component<
  PaletteSelectModalAttrs,
  PaletteSelectModalState
> = {
  oninit(vnode) {
    nextDialogId += 1;
    vnode.state.dialogTitleId = `lpc-palette-dialog-title-${nextDialogId}`;
    vnode.state.closing = false;
    vnode.state.gateSequence = 0;
    vnode.state.previewKey = null;
    vnode.state.completed = 0;
    vnode.state.openerEl =
      vnode.attrs.returnFocusTo ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
  },
  oncreate(vnode) {
    const dialog = vnode.dom as HTMLDialogElement;
    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    }
    const closeBtn = dialog.querySelector<HTMLButtonElement>(
      "button.lpc-palette-close",
    );
    closeBtn?.focus();
  },
  onremove(vnode) {
    const dialog = vnode.dom as HTMLDialogElement;
    if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  },
  view(vnode) {
    const model = vnode.attrs.createModel();
    const isLoading = isLoadingPaletteModel(model);

    const previewKey = isLoading
      ? null
      : JSON.stringify([
          model.bodyType,
          model.previewLayersKey,
          model.previewContentKey,
        ]);
    if (vnode.state.previewKey !== previewKey) {
      vnode.state.previewKey = previewKey;
      vnode.state.gateSequence += 1;
      vnode.state.completed = 0;
    }
    const previewsReady =
      !isLoading && vnode.state.completed >= model.previewCount;

    const requestClose = (dialog?: HTMLDialogElement | null) => {
      if (vnode.state.closing) return;
      vnode.state.closing = true;
      if (dialog?.open && typeof dialog.close === "function") {
        dialog.close();
      }
      vnode.attrs.onClose();
      restoreDialogFocus(vnode.state.openerEl, vnode.attrs.fallbackFocusTo);
    };

    const headingText = isLoading ? "Palette" : model.title || "Palette";

    return m(
      "dialog.palette-modal.lpc-palette-dialog",
      {
        "aria-labelledby": vnode.state.dialogTitleId,
        "data-previews-ready": previewsReady ? "true" : "false",
        oncancel: (event: Event) => {
          event.preventDefault();
          requestClose(event.currentTarget as HTMLDialogElement);
        },
        onclose: (event: Event) => {
          requestClose(event.currentTarget as HTMLDialogElement);
        },
        onclick: (event: MouseEvent) => {
          const dialog = event.currentTarget as HTMLDialogElement;
          if (isClickOutsideDialogRect(dialog, event)) {
            requestClose(dialog);
          }
        },
      },
      [
        m(
          "div.lpc-palette-dialog-inner",
          {
            onclick: (event: MouseEvent) => {
              event.stopPropagation();
            },
          },
          [
            m("header.lpc-palette-header", [
              m("h4", { id: vnode.state.dialogTitleId }, headingText),
              m(
                "button.lpc-palette-close",
                {
                  type: "button",
                  "aria-label": "Close palette",
                  onclick: (event: MouseEvent) => {
                    event.stopPropagation();
                    const dialog = (event.currentTarget as HTMLElement).closest(
                      "dialog",
                    );
                    requestClose(dialog);
                  },
                },
                "×",
              ),
            ]),
            m(
              "section.lpc-palette-body",
              isLoading
                ? m("p.lpc-palette-loading", model.loadingMessage)
                : renderReadyBody(model, vnode, vnode.state.gateSequence),
            ),
          ],
        ),
      ],
    );
  },
};
