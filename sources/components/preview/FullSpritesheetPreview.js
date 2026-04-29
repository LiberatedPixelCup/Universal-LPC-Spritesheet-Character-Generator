// Full Spritesheet Preview component
import m from "mithril";
import { state } from "../../state/state.ts";
import { CollapsibleSection } from "../CollapsibleSection.js";
import PinchToZoom from "./PinchToZoom.js";
import {
  copyToPreviewCanvas,
  primeSpritesheetPreviewCanvasElement,
} from "../../canvas/preview-canvas.js";
import { isOffscreenCanvasInitialized } from "../../canvas/renderer.js";
import { ScrollableContainer } from "./ScrollableContainer.js";
import { PreviewMetadataLoadingOverlay } from "./PreviewMetadataLoadingOverlay.js";

/**
 * Offscreen `canvas` in renderer.js is created in `initCanvas()` after index+lite
 * metadata register; the spritesheet preview mounts earlier, so we defer PinchToZoom
 * and the first `copyToPreviewCanvas` until `isOffscreenCanvasInitialized()`.
 */
function syncFullSpritesheetFromOffscreen(vnode) {
  if (!window.canvasRenderer) {
    return;
  }
  if (!isOffscreenCanvasInitialized()) {
    return;
  }

  const domCanvas = vnode.dom;
  const showTransparencyGrid = vnode.attrs.showTransparencyGrid;
  const applyTransparencyMask = vnode.attrs.applyTransparencyMask;
  const zoomLevel = vnode.attrs.zoomLevel;

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
          return;
        }
        vnode.state.pinch = pinch;
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

// Canvas wrapper component with its own lifecycle
const SpritesheetCanvas = {
  oncreate: function (vnode) {
    vnode.state.zoomLevel = vnode.attrs.zoomLevel;
    vnode.state._pinchUnmounted = false;
    primeSpritesheetPreviewCanvasElement(vnode.dom);
    if (!window.canvasRenderer) {
      console.error("Canvas renderer not available yet");
      return;
    }
    syncFullSpritesheetFromOffscreen(vnode);
  },
  onupdate: function (vnode) {
    if (!window.canvasRenderer) {
      return;
    }
    syncFullSpritesheetFromOffscreen(vnode);
  },
  onremove: function (vnode) {
    vnode.state._pinchUnmounted = true;
    vnode.state.pinch?.destroy();
    vnode.state.pinch = null;
    vnode.state._pinchCreatePromise = null;
  },
  view: function () {
    return m("canvas#spritesheet-preview");
  },
};

export const FullSpritesheetPreview = {
  oninit: function (vnode) {
    // Initialize zoom level to 1 (100%)
    vnode.state.zoomLevel = state.fullSpritesheetCanvasZoomLevel || 1;
  },
  onupdate: function (vnode) {
    // When state changes (selections, bodyType, etc.), preview canvas needs to update
    // The SpritesheetCanvas component will handle the actual copy in its onupdate
    vnode.state.zoomLevel = state.fullSpritesheetCanvasZoomLevel || 1;
  },
  view: function (vnode) {
    return m(
      CollapsibleSection,
      {
        title: "Full Spritesheet Preview",
        storageKey: "spritesheet-preview",
        defaultOpen: true,
        boxClass: "box mt-4",
      },
      [
        m("div.columns.is-mobile.is-variable.is-1.is-multiline", [
          // Checkboxes column
          m(
            "div.column.is-narrow.is-flex.is-align-items-left.is-flex-direction-column",
            [
              m("div.my-1", [
                // Show transparency grid checkbox
                m("label.checkbox", [
                  m("input[type=checkbox]", {
                    checked: state.showTransparencyGrid,
                    onchange: (e) => {
                      state.showTransparencyGrid = e.target.checked;
                      // Trigger re-render to update preview canvas
                      m.redraw();
                    },
                  }),
                  " Show transparency grid",
                ]),
              ]),
              m("div.mt-1", [
                // Apply transparency mask checkbox
                m("label.checkbox", [
                  m("input[type=checkbox]", {
                    checked: state.applyTransparencyMask,
                    onclick: (e) => {
                      state.applyTransparencyMask = e.target.checked;
                      // Trigger re-render to update preview canvas
                      m.redraw();
                    },
                  }),
                  " Replace Mask (Pink)",
                ]),
              ]),
            ],
          ),
          // Zoom column
          m("div.column", [
            m("div.field.is-horizontal.is-align-items-center", [
              m("div.field-label.is-normal", [
                m(
                  "label.label.mb-0",
                  `Zoom: ${Math.round(vnode.state.zoomLevel * 100)}%`,
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
                      oninput: (e) => {
                        vnode.state.zoomLevel = parseFloat(e.target.value);
                        state.fullSpritesheetCanvasZoomLevel =
                          vnode.state.zoomLevel;
                        // Trigger re-render to update preview canvas zoom
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
                      "aria-label": "Rendering character",
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
