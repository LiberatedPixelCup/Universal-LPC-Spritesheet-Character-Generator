// Full Spritesheet Preview component
import m from "mithril";
import type { State } from "../../state/state.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";
import PinchToZoom from "./PinchToZoom.ts";
import {
  copyToPreviewCanvas,
  primeSpritesheetPreviewCanvasElement,
} from "../../canvas/preview-canvas.ts";
import {
  canvas as offscreenCanvas,
  isOffscreenCanvasInitialized,
  SHEET_HEIGHT,
  SHEET_WIDTH,
} from "../../canvas/renderer.ts";
import { ScrollableContainer } from "./ScrollableContainer.ts";
import { PreviewMetadataLoadingOverlay } from "./PreviewMetadataLoadingOverlay.ts";
import type { CatalogReader } from "../../state/catalog.ts";

const SPRITESHEET_ZOOM_ID = "lpc-spritesheet-zoom";

type SpritesheetCanvasAttrs = {
  state: State;
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
  const { state } = vnode.attrs;
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
            state.showTransparencyGrid,
            state.applyTransparencyMask,
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
    const width =
      isOffscreenCanvasInitialized() && offscreenCanvas
        ? offscreenCanvas.width
        : SHEET_WIDTH;
    const height =
      isOffscreenCanvasInitialized() && offscreenCanvas
        ? offscreenCanvas.height
        : SHEET_HEIGHT;
    return m("canvas#spritesheet-preview", { width, height });
  },
};

type FullSpritesheetPreviewState = { zoomLevel: number };

export const FullSpritesheetPreview: m.Component<
  { catalog: CatalogReader; state: State },
  FullSpritesheetPreviewState
> = {
  oninit(vnode) {
    const { state } = vnode.attrs;
    vnode.state.zoomLevel = state.fullSpritesheetCanvasZoomLevel || 1;
  },
  onupdate(vnode) {
    const { state } = vnode.attrs;
    vnode.state.zoomLevel = state.fullSpritesheetCanvasZoomLevel || 1;
  },
  view(vnode) {
    const { catalog, state } = vnode.attrs;
    const zoomPct = `${Math.round(vnode.state.zoomLevel * 100)}%`;

    return m(
      CollapsibleSection,
      {
        title: "Full Spritesheet Preview",
        defaultOpen: true,
        boxClass: "box lpc-spritesheet-panel",
      },
      [
        m("div.lpc-sheet-toolbar", [
          m("div.lpc-sheet-toggles", [
            m("label.checkbox", [
              m("input[type=checkbox]", {
                checked: state.showTransparencyGrid,
                onchange: (e: Event) => {
                  const target = e.target as HTMLInputElement;
                  state.showTransparencyGrid = target.checked;
                  m.redraw();
                },
              }),
              m("span", "Show transparency grid"),
            ]),
            m("label.checkbox", [
              m("input[type=checkbox]", {
                checked: state.applyTransparencyMask,
                onclick: (e: Event) => {
                  const target = e.target as HTMLInputElement;
                  state.applyTransparencyMask = target.checked;
                  m.redraw();
                },
              }),
              m("span", "Replace Mask (Pink)"),
            ]),
          ]),
          m("div.lpc-sheet-zoom", [
            m("label.lpc-control-label.mb-0", { for: SPRITESHEET_ZOOM_ID }, [
              "Zoom: ",
              m("span.lpc-zoom-value", zoomPct),
            ]),
            m("input.lpc-range[type=range]", {
              id: SPRITESHEET_ZOOM_ID,
              min: 0.5,
              max: 2,
              step: 0.1,
              value: vnode.state.zoomLevel,
              oninput: (e: Event) => {
                const target = e.target as HTMLInputElement;
                vnode.state.zoomLevel = parseFloat(target.value);
                state.fullSpritesheetCanvasZoomLevel = vnode.state.zoomLevel;
                m.redraw();
              },
            }),
          ]),
        ]),
        m(
          "div.preview-canvas-area.preview-canvas-area--spritesheet.lpc-sheet-viewport",
          [
            m(
              ScrollableContainer,
              { classes: "spritesheet-preview lpc-sheet-scroll" },
              [
                m("div.preview-canvas-root", [
                  m(SpritesheetCanvas, {
                    state,
                    showTransparencyGrid: state.showTransparencyGrid,
                    applyTransparencyMask: state.applyTransparencyMask,
                    zoomLevel: vnode.state.zoomLevel,
                  }),
                  state.isRenderingCharacter
                    ? m("div.preview-canvas-busy", { "aria-hidden": true }, [
                        m("span.loading", {
                          "aria-label": "Rendering character",
                        }),
                      ])
                    : null,
                ]),
              ],
            ),
            m(PreviewMetadataLoadingOverlay, {
              catalog,
              state,
            }),
          ],
        ),
      ],
    );
  },
};
