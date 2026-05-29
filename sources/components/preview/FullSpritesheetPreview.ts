// Full Spritesheet Preview component
import m from "mithril";
import { state } from "../../state/state.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";
import PinchToZoom from "./PinchToZoom.ts";
import {
  copyToPreviewCanvas,
  primeSpritesheetPreviewCanvasElement,
} from "../../canvas/preview-canvas.ts";
import { isOffscreenCanvasInitialized } from "../../canvas/renderer.ts";
import { ScrollableContainer } from "./ScrollableContainer.ts";
import { PreviewMetadataLoadingOverlay } from "./PreviewMetadataLoadingOverlay.ts";
import { t } from "../../../lang/i18n.ts";

type SpritesheetCanvasAttrs = {
  showTransparencyGrid: boolean;
  applyTransparencyMask: boolean;
  zoomLevel: number;
};

type SpritesheetCanvasState = {
  zoomLevel: number;
  pinch: PinchToZoom | null;
  _pinchUnmounted: boolean;
  _pinchCreatePromise: Promise<PinchToZoom> | null;
};

/**
 * Offscreen `canvas` in renderer.ts is created in `initCanvas()` after index+lite
 * metadata register; the spritesheet preview mounts earlier, so we defer PinchToZoom
 * and the first `copyToPreviewCanvas` until `isOffscreenCanvasInitialized()`.
 */
function syncFullSpritesheetFromOffscreen(
  vnode: m.VnodeDOM<SpritesheetCanvasAttrs, SpritesheetCanvasState>,
): void {
  if (!window.canvasRenderer) {
    return;
  }
  if (!isOffscreenCanvasInitialized()) {
    return;
  }

  const domCanvas = vnode.dom as HTMLCanvasElement;
  const { showTransparencyGrid, applyTransparencyMask, zoomLevel } =
    vnode.attrs;

  if (!vnode.state.pinch) {
    copyToPreviewCanvas(
      domCanvas,
      showTransparencyGrid,
      applyTransparencyMask,
      zoomLevel,
    );
    vnode.state.zoomLevel = zoomLevel;
    if (!vnode.state._pinchCreatePromise) {
      vnode.state._pinchCreatePromise = PinchToZoom.create(
        domCanvas,
        (scale) => {
          if (!isOffscreenCanvasInitialized()) {
            return;
          }
          vnode.state.zoomLevel = scale;
          m.redraw();
          copyToPreviewCanvas(
            domCanvas,
            showTransparencyGrid,
            applyTransparencyMask,
            vnode.state.zoomLevel,
          );
          state.fullSpritesheetCanvasZoomLevel = vnode.state.zoomLevel;
        },
        vnode.state.zoomLevel,
      ).then((pinch) => {
        vnode.state._pinchCreatePromise = null;
        if (vnode.state._pinchUnmounted) {
          pinch.destroy();
          return pinch;
        }
        vnode.state.pinch = pinch;
        return pinch;
      });
    }
    return;
  }

  m.redraw();
  copyToPreviewCanvas(
    domCanvas,
    showTransparencyGrid,
    applyTransparencyMask,
    zoomLevel,
  );
}

const SpritesheetCanvas: m.Component<
  SpritesheetCanvasAttrs,
  SpritesheetCanvasState
> = {
  oncreate(vnode) {
    vnode.state.zoomLevel = vnode.attrs.zoomLevel;
    vnode.state._pinchUnmounted = false;
    vnode.state.pinch = null;
    vnode.state._pinchCreatePromise = null;
    primeSpritesheetPreviewCanvasElement(vnode.dom as HTMLCanvasElement);
    if (!window.canvasRenderer) {
      console.error("Canvas renderer not available yet");
      return;
    }
    syncFullSpritesheetFromOffscreen(vnode);
  },
  onupdate(vnode) {
    if (!window.canvasRenderer) {
      return;
    }
    syncFullSpritesheetFromOffscreen(vnode);
  },
  onremove(vnode) {
    vnode.state._pinchUnmounted = true;
    vnode.state.pinch?.destroy();
    vnode.state.pinch = null;
    vnode.state._pinchCreatePromise = null;
  },
  view() {
    return m("canvas#spritesheet-preview");
  },
};

type FullSpritesheetPreviewState = { zoomLevel: number };

export const FullSpritesheetPreview: m.Component<
  Record<string, never>,
  FullSpritesheetPreviewState
> = {
  oninit(vnode) {
    vnode.state.zoomLevel = state.fullSpritesheetCanvasZoomLevel || 1;
  },
  onupdate(vnode) {
    vnode.state.zoomLevel = state.fullSpritesheetCanvasZoomLevel || 1;
  },
  view(vnode) {
    return m(
      CollapsibleSection,
      {
        title: t("fullSpritesheetPreview.title"),
        defaultOpen: true,
        boxClass: "box mt-4",
      },
      [
        m("div.columns.is-mobile.is-variable.is-1.is-multiline", [
          m(
            "div.column.is-narrow.is-flex.is-align-items-left.is-flex-direction-column",
            [
              m("div.my-1", [
                m("label.checkbox", [
                  m("input[type=checkbox]", {
                    checked: state.showTransparencyGrid,
                    onchange: (e: Event) => {
                      const target = e.target as HTMLInputElement;
                      state.showTransparencyGrid = target.checked;
                      m.redraw();
                    },
                  }),
                  ` ${t("fullSpritesheetPreview.showGrid")}`,
                ]),
              ]),
              m("div.mt-1", [
                m("label.checkbox", [
                  m("input[type=checkbox]", {
                    checked: state.applyTransparencyMask,
                    onclick: (e: Event) => {
                      const target = e.target as HTMLInputElement;
                      state.applyTransparencyMask = target.checked;
                      m.redraw();
                    },
                  }),
                  ` ${t("fullSpritesheetPreview.replaceMask")}`,
                ]),
              ]),
            ],
          ),
          m("div.column", [
            m("div.field.is-horizontal.is-align-items-center", [
              m("div.field-label.is-normal", [
                m(
                  "label.label.mb-0",
                  t("fullSpritesheetPreview.zoom", {
                    zoom: Math.round(vnode.state.zoomLevel * 100),
                  }),
                ),
              ]),
              m("div.field-body", [
                m("div.field.mb-0", [
                  m("div.control.is-expanded", [
                    m("input.is-fullwidth[type=range]", {
                      min: 0.5,
                      max: 2,
                      step: 0.1,
                      value: vnode.state.zoomLevel,
                      oninput: (e: Event) => {
                        const target = e.target as HTMLInputElement;
                        vnode.state.zoomLevel = parseFloat(target.value);
                        state.fullSpritesheetCanvasZoomLevel =
                          vnode.state.zoomLevel;
                        m.redraw();
                      },
                    }),
                  ]),
                ]),
              ]),
            ]),
          ]),
        ]),
        m("div.preview-canvas-area.preview-canvas-area--spritesheet", [
          m(ScrollableContainer, { classes: "spritesheet-preview" }, [
            m("div.preview-canvas-root", [
              m(SpritesheetCanvas, {
                showTransparencyGrid: state.showTransparencyGrid,
                applyTransparencyMask: state.applyTransparencyMask,
                zoomLevel: vnode.state.zoomLevel,
              }),
              state.isRenderingCharacter
                ? m("div.preview-canvas-busy", { "aria-hidden": true }, [
                    m("span.loading", {
                      "aria-label": t(
                        "fullSpritesheetPreview.renderingCharacter",
                      ),
                    }),
                  ])
                : null,
            ]),
          ]),
          m(PreviewMetadataLoadingOverlay),
        ]),
      ],
    );
  },
};
