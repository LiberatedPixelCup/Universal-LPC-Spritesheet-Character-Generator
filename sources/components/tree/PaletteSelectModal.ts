import m from "mithril";
import classNames from "classnames";
import type { PaletteSelectModalModel } from "../../models/palette-select-modal.ts";

function loading(onClose: () => void, message: string) {
  return [
    m("div.palette-modal-overlay", { onclick: onClose }),
    m(
      "div.palette-modal",
      {
        onclick: (event: MouseEvent) => event.stopPropagation(),
        "data-previews-ready": "false",
      },
      m("p.has-text-grey", message),
    ),
  ];
}

function isLoadingPaletteModel(
  model: PaletteSelectModalModel,
): model is { readonly loadingMessage: string } {
  return "loadingMessage" in model;
}

type PaletteSelectModalAttrs = {
  createModel: () => PaletteSelectModalModel;
  onClose: () => void;
};

type PaletteSelectModalState = {
  gateSequence?: number;
  lastPreviewCount?: number;
  completed?: number;
};

type ReadyPaletteSelectModalModel = Exclude<
  PaletteSelectModalModel,
  { readonly loadingMessage: string }
>;

function renderReadyPaletteSelectModal(
  model: ReadyPaletteSelectModalModel,
  vnode: m.Vnode<PaletteSelectModalAttrs, PaletteSelectModalState>,
) {
  if (vnode.state.lastPreviewCount !== model.previewCount) {
    vnode.state.gateSequence = (vnode.state.gateSequence ?? 0) + 1;
    vnode.state.lastPreviewCount = model.previewCount;
    vnode.state.completed = 0;
  }
  const gateSequence = vnode.state.gateSequence ?? 0;
  const previewsReady =
    model.previewCount === 0 ||
    (vnode.state.completed ?? 0) >= model.previewCount;

  return [
    m("div.palette-modal-overlay", { onclick: vnode.attrs.onClose }),
    m(
      "div.palette-modal",
      {
        onclick: (event: MouseEvent) => event.stopPropagation(),
        "data-previews-ready": previewsReady ? "true" : "false",
      },
      [
        m("header.is-flex", [
          m("h4", model.title),
          m("button", { onclick: vnode.attrs.onClose }, "x"),
        ]),
        m(
          "section",
          model.versions.map((version) =>
            m(
              version.isSource
                ? "div.palette-modal-source-block"
                : "div.palette-modal-version-block",
              { key: `${gateSequence}-${version.key}` },
              [
                m("div.tree-label", { onclick: version.toggle }, [
                  m("span.tree-arrow", {
                    class: version.isExpanded ? "expanded" : "collapsed",
                  }),
                  m("span.palette-version", version.label),
                ]),
                version.isExpanded
                  ? m(
                      "div.variants-container.is-flex.is-flex-wrap-wrap",
                      version.tiles.map((tile) =>
                        m(
                          "div.cell",
                          m(
                            "div.variant-item.is-flex.is-flex-direction-column.is-align-items-center.is-clickable",
                            {
                              class: classNames({
                                "has-background-link-light has-text-weight-bold has-text-link":
                                  tile.isSelected,
                                [`key-${tile.key}`]: true,
                              }),
                              onmouseover: (event: MouseEvent) => {
                                if (!tile.isSelected)
                                  (
                                    event.currentTarget as HTMLElement
                                  ).classList.add("has-background-white-ter");
                              },
                              onmouseout: (event: MouseEvent) => {
                                if (!tile.isSelected)
                                  (
                                    event.currentTarget as HTMLElement
                                  ).classList.remove(
                                    "has-background-white-ter",
                                  );
                              },
                              onclick: (event: MouseEvent) => {
                                event.stopPropagation();
                                tile.select();
                              },
                            },
                            [
                              m(
                                "span.variant-display-name.has-text-centered.is-size-7",
                                tile.label,
                              ),
                              m("canvas.variant-canvas.box.p-0", {
                                width: model.size,
                                height: model.size,
                                class: model.compactDisplay
                                  ? " compact-display"
                                  : "",
                                onremove: (canvasVnode: m.VnodeDOM) => {
                                  const state = canvasVnode.state as {
                                    renderId?: number;
                                  };
                                  state.renderId = (state.renderId ?? 0) + 1;
                                },
                                oncreate: (canvasVnode: m.VnodeDOM) => {
                                  const canvas =
                                    canvasVnode.dom as HTMLCanvasElement;
                                  const state = canvasVnode.state as {
                                    renderId?: number;
                                  };
                                  const renderId = (state.renderId ?? 0) + 1;
                                  state.renderId = renderId;
                                  const settledGate = gateSequence;
                                  void tile
                                    .draw(
                                      canvas,
                                      () => state.renderId !== renderId,
                                    )
                                    .then(() => {
                                      if (
                                        settledGate !==
                                          vnode.state.gateSequence ||
                                        state.renderId !== renderId
                                      )
                                        return;
                                      vnode.state.completed =
                                        (vnode.state.completed ?? 0) + 1;
                                      m.redraw();
                                    });
                                },
                              }),
                              m(
                                "div.palette-swatch",
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
          ),
        ),
        m("footer", " "),
      ],
    ),
  ];
}

export const PaletteSelectModal: m.Component<
  PaletteSelectModalAttrs,
  PaletteSelectModalState
> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    return isLoadingPaletteModel(model)
      ? loading(vnode.attrs.onClose, model.loadingMessage)
      : renderReadyPaletteSelectModal(model, vnode);
  },
};
