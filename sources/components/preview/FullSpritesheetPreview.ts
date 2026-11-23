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
  getCanvasRenderVersion,
  isCharacterCanvasReady,
  isOffscreenCanvasInitialized,
  SHEET_HEIGHT,
  SHEET_WIDTH,
} from "../../canvas/renderer.ts";
import { ScrollableContainer } from "./ScrollableContainer.ts";
import { PreviewMetadataLoadingOverlay } from "./PreviewMetadataLoadingOverlay.ts";
import type { CatalogReader } from "../../state/catalog.ts";

const SPRITESHEET_ZOOM_ID = "lpc-spritesheet-zoom";
const ZOOM_BOUNDS = { min: 0.5, max: 2 } as const;

type SpritesheetCanvasAttrs = {
  state: State;
  showTransparencyGrid: boolean;
  applyTransparencyMask: boolean;
  zoomLevel: number;
};

type SpritesheetCanvasState = {
  zoomLevel: number;
  lastContentKey: string | null;
  lastZoom: number | null;
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
  if (!window.canvasRenderer || !isOffscreenCanvasInitialized()) {
    return;
  }

  const domCanvas = vnode.dom as HTMLCanvasElement;
  const { showTransparencyGrid, applyTransparencyMask, zoomLevel } =
    vnode.attrs;
  const contentKey = `${getCanvasRenderVersion()}|${showTransparencyGrid}|${applyTransparencyMask}`;

  if (
    isCharacterCanvasReady(state) &&
    vnode.state.lastContentKey !== contentKey
  ) {
    copyToPreviewCanvas(
      domCanvas,
      showTransparencyGrid,
      applyTransparencyMask,
      zoomLevel,
    );
    vnode.state.lastContentKey = contentKey;
    vnode.state.lastZoom = zoomLevel;
    vnode.state.zoomLevel = zoomLevel;
    vnode.state.pinch?.setZoom(zoomLevel);
  } else if (vnode.state.lastZoom !== zoomLevel) {
    domCanvas.style.zoom = zoomLevel === 1 ? "" : zoomLevel.toString();
    vnode.state.lastZoom = zoomLevel;
    vnode.state.zoomLevel = zoomLevel;
    vnode.state.pinch?.setZoom(zoomLevel);
  }

  if (!vnode.state.pinch && !vnode.state._pinchCreatePromise) {
    vnode.state._pinchCreatePromise = PinchToZoom.create(
      domCanvas,
      (scale) => {
        if (!isOffscreenCanvasInitialized()) {
          return;
        }
        vnode.state.zoomLevel = scale;
        vnode.state.lastZoom = scale;
        state.fullSpritesheetCanvasZoomLevel = scale;
        domCanvas.style.zoom = scale === 1 ? "" : scale.toString();
        m.redraw();
      },
      vnode.state.zoomLevel,
      ZOOM_BOUNDS,
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
}

const SpritesheetCanvas: m.Component<
  SpritesheetCanvasAttrs,
  SpritesheetCanvasState
> = {
  oncreate(vnode) {
    vnode.state.zoomLevel = vnode.attrs.zoomLevel;
    vnode.state.lastContentKey = null;
    vnode.state.lastZoom = null;
    vnode.state._pinchUnmounted = false;
    vnode.state.pinch = null;
    vnode.state._pinchCreatePromise = null;
    if (isCharacterCanvasReady(vnode.attrs.state)) {
      primeSpritesheetPreviewCanvasElement(vnode.dom as HTMLCanvasElement);
    }
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
    return m("canvas#spritesheet-preview", {
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
    });
  },
};

export const FullSpritesheetPreview: m.Component<{
  catalog: CatalogReader;
  state: State;
}> = {
  view(vnode) {
    const { catalog, state } = vnode.attrs;
    const zoomLevel = state.fullSpritesheetCanvasZoomLevel || 1;
    const zoomPct = `${Math.round(zoomLevel * 100)}%`;

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
              value: zoomLevel,
              oninput: (e: Event) => {
                const target = e.target as HTMLInputElement;
                state.fullSpritesheetCanvasZoomLevel = parseFloat(target.value);
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
                    zoomLevel,
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
