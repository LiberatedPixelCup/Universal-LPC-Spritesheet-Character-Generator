// Animation Preview component
import m from "mithril";
import type { State } from "../../state/state.ts";
import { ANIMATIONS, FRAME_SIZE } from "../../state/constants.ts";
import { customAnimations } from "../../custom-animations.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";
import {
  setPreviewAnimation,
  startPreviewAnimation,
  stopPreviewAnimation,
  getCustomAnimations,
  getPreviewFrameCycle,
  repaintStaticPreviewFrameForTests,
} from "../../canvas/preview-animation.ts";
import {
  initPreviewCanvas,
  setPreviewCanvasZoom,
} from "../../canvas/preview-canvas.ts";
import PinchToZoom from "./PinchToZoom.ts";
import { ScrollableContainer } from "./ScrollableContainer.ts";
import { PreviewMetadataLoadingOverlay } from "./PreviewMetadataLoadingOverlay.ts";
import type { CatalogReader } from "../../state/catalog.ts";

const ANIMATION_SELECT_ID = "lpc-animation-select";
const ANIMATION_ZOOM_ID = "lpc-animation-zoom";

type PreviewCanvasAttrs = {
  state: State;
  selectedAnimation: string;
  zoomLevel: number;
};

type PreviewCanvasState = {
  zoomLevel: number;
  lastAnimation: string;
  _pinchUnmounted: boolean;
  pinch: PinchToZoom | null;
};

export const PreviewCanvas: m.Component<
  PreviewCanvasAttrs,
  PreviewCanvasState
> = {
  oncreate(vnode) {
    const canvas = vnode.dom as HTMLCanvasElement;
    const { state, selectedAnimation } = vnode.attrs;
    const zoomLevel = vnode.attrs.zoomLevel || 1;

    if (!window.canvasRenderer) {
      console.error("Canvas renderer not available yet");
      return;
    }

    setPreviewAnimation(selectedAnimation);
    initPreviewCanvas(canvas);
    setPreviewCanvasZoom(zoomLevel);
    startPreviewAnimation(state);

    vnode.state.zoomLevel = zoomLevel;
    vnode.state.lastAnimation = selectedAnimation;
    vnode.state._pinchUnmounted = false;
    vnode.state.pinch = null;
    PinchToZoom.create(
      canvas,
      (scale) => {
        vnode.state.zoomLevel = scale;

        if (window.canvasRenderer) {
          m.redraw();
          setPreviewCanvasZoom(vnode.state.zoomLevel);
        }

        state.previewCanvasZoomLevel = vnode.state.zoomLevel;
      },
      vnode.state.zoomLevel,
    ).then((pinch) => {
      if (vnode.state._pinchUnmounted) {
        pinch.destroy();
        return;
      }
      vnode.state.pinch = pinch;
    });
  },
  onupdate(vnode) {
    const { state, selectedAnimation } = vnode.attrs;

    if (vnode.state.lastAnimation !== selectedAnimation) {
      if (window.canvasRenderer) {
        stopPreviewAnimation();
        setPreviewAnimation(selectedAnimation);
        initPreviewCanvas(vnode.dom as HTMLCanvasElement);
        startPreviewAnimation(state);
      }
      vnode.state.lastAnimation = selectedAnimation;
    }

    const zoomLevel = state.previewCanvasZoomLevel || 1;
    if (vnode.state.zoomLevel !== zoomLevel) {
      vnode.state.zoomLevel = zoomLevel;
      setPreviewCanvasZoom(zoomLevel);
    }
    repaintStaticPreviewFrameForTests(state);
  },
  onremove(vnode) {
    vnode.state._pinchUnmounted = true;
    vnode.state.pinch?.destroy();
    vnode.state.pinch = null;
    if (window.canvasRenderer) {
      stopPreviewAnimation();
    }
  },
  view(vnode) {
    let frameSize = FRAME_SIZE;
    const customAnimDef =
      getCustomAnimations()?.[vnode.attrs.selectedAnimation];
    if (customAnimDef) {
      frameSize = customAnimDef.frameSize;
    }
    return m("canvas#previewAnimations", {
      width: 4 * frameSize,
      height: frameSize,
    });
  },
};

type AnimationOption = { value: string; label: string };

export const AnimationPreview: m.Component<{
  catalog: CatalogReader;
  state: State;
}> = {
  view(vnode) {
    const { catalog, state } = vnode.attrs;
    const customAnims = Object.keys(getCustomAnimations());
    const allAnimations: AnimationOption[] = [
      ...ANIMATIONS,
      ...customAnims.map((anim) => ({
        value: anim,
        label: anim.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      })),
    ];

    const available = allAnimations.some(
      (anim) => anim.value === state.selectedAnimation,
    );
    const awaitingOutfit =
      Object.hasOwn(customAnimations, state.selectedAnimation) &&
      (!state.previewBootstrapRenderDone ||
        state.pendingCharacterRender !== null);
    const selectedAnimation = available ? state.selectedAnimation : "walk";
    if (!available && !awaitingOutfit) {
      state.selectedAnimation = selectedAnimation;
    }

    const frameCycle = getPreviewFrameCycle(selectedAnimation).join("-");
    const zoomLevel = state.previewCanvasZoomLevel || 1;
    const zoomPct = `${Math.round(zoomLevel * 100)}%`;

    return m(
      CollapsibleSection,
      {
        title: "Animation Preview",
        defaultOpen: true,
        boxClass: "box lpc-animation-panel",
      },
      [
        m("div.lpc-anim-controls", [
          m("div.lpc-anim-select-group", [
            m(
              "label.lpc-control-label.mb-0",
              { for: ANIMATION_SELECT_ID },
              "Animation",
            ),
            m("div.select.lpc-select", [
              m(
                "select",
                {
                  id: ANIMATION_SELECT_ID,
                  value: selectedAnimation,
                  onupdate: (select: m.VnodeDOM) => {
                    // Mithril sets value before inserting new options on updates.
                    const element = select.dom as HTMLSelectElement;
                    if (element.value !== selectedAnimation) {
                      element.value = selectedAnimation;
                    }
                  },
                  onchange: (e: Event) => {
                    const target = e.target as HTMLSelectElement;
                    state.selectedAnimation = target.value;
                  },
                },
                allAnimations.map((anim) =>
                  m("option", { value: anim.value }, anim.label),
                ),
              ),
            ]),
            frameCycle
              ? m(
                  "span.lpc-frame-cycle",
                  { "aria-label": "Frame cycle" },
                  frameCycle,
                )
              : null,
          ]),
          m("div.lpc-anim-zoom-group", [
            m("label.lpc-control-label.mb-0", { for: ANIMATION_ZOOM_ID }, [
              "Zoom: ",
              m("span.lpc-zoom-value", zoomPct),
            ]),
            m("input.lpc-range[type=range]", {
              id: ANIMATION_ZOOM_ID,
              min: 0.5,
              max: 2,
              step: 0.1,
              value: zoomLevel,
              oninput: (e: Event) => {
                const target = e.target as HTMLInputElement;
                state.previewCanvasZoomLevel = parseFloat(target.value);
              },
            }),
          ]),
        ]),
        m("div.preview-canvas-area.lpc-anim-viewport", [
          m(
            ScrollableContainer,
            { classes: "spritesheet-preview lpc-anim-scroll" },
            [
              m("div.preview-canvas-root", [
                m(PreviewCanvas, {
                  state,
                  selectedAnimation,
                  zoomLevel,
                }),
                state.isRenderingCharacter
                  ? m("div.preview-canvas-busy", { "aria-hidden": true }, [
                      m("span.loading", {
                        "aria-label": "Rendering character",
                      }),
                    ])
                  : null,
                m(PreviewMetadataLoadingOverlay, {
                  catalog,
                  state,
                }),
              ]),
            ],
          ),
        ]),
      ],
    );
  },
};
