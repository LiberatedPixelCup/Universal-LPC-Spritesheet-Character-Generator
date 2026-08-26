// Animation Preview component
import m from "mithril";
import type { State } from "../../state/state.ts";
import { ANIMATIONS, FRAME_SIZE } from "../../state/constants.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";
import {
  setPreviewAnimation,
  startPreviewAnimation,
  stopPreviewAnimation,
  getCustomAnimations,
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

type PreviewCanvasAttrs = {
  state: State;
  selectedAnimation: string;
  zoomLevel: number;
  onFrameCycleUpdate: (frameCycle: string) => void;
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
    const { state, selectedAnimation, onFrameCycleUpdate } = vnode.attrs;
    const zoomLevel = vnode.attrs.zoomLevel || 1;

    if (!window.canvasRenderer) {
      console.error("Canvas renderer not available yet");
      return;
    }

    initPreviewCanvas(canvas);
    const frames = setPreviewAnimation(selectedAnimation);
    startPreviewAnimation(state);

    if (frames) {
      onFrameCycleUpdate(frames.join("-"));
    }

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

    vnode.state.zoomLevel = state.previewCanvasZoomLevel || 1;
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

type AnimationPreviewState = {
  selectedAnimation: string;
  zoomLevel: number;
  frameCycle: string;
};

export const AnimationPreview: m.Component<
  { catalog: CatalogReader; state: State },
  AnimationPreviewState
> = {
  oninit(vnode) {
    const { state } = vnode.attrs;
    vnode.state.selectedAnimation = "walk";
    vnode.state.zoomLevel = state.previewCanvasZoomLevel || 1;
    if (window.canvasRenderer) {
      const frames = setPreviewAnimation("walk");
      vnode.state.frameCycle = frames ? frames.join("-") : "";
    } else {
      vnode.state.frameCycle = "";
    }
  },
  onupdate(vnode) {
    const { state } = vnode.attrs;
    vnode.state.zoomLevel = state.previewCanvasZoomLevel || 1;
  },
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

    if (
      !allAnimations.find(
        (anim) => anim.value === vnode.state.selectedAnimation,
      )
    ) {
      vnode.state.selectedAnimation = "walk";
      state.selectedAnimation = "walk";
      if (window.canvasRenderer) {
        const frames = setPreviewAnimation("walk");
        vnode.state.frameCycle = frames ? frames.join("-") : "";
      }
    }

    return m(
      CollapsibleSection,
      {
        title: "Animation Preview",
        defaultOpen: true,
        boxClass: "box",
      },
      [
        m("div.columns.is-multiline", [
          m("div.column", [
            m("div.field.is-horizontal.is-align-items-center", [
              m("div.field-label.is-normal", [
                m("label.label.mb-0", "Animation"),
              ]),
              m("div.field-body", [
                m("div.field.has-addons.mb-0", [
                  m("div.control", [
                    m("div.select", [
                      m(
                        "select",
                        {
                          value: vnode.state.selectedAnimation,
                          onchange: (e: Event) => {
                            const target = e.target as HTMLSelectElement;
                            vnode.state.selectedAnimation = target.value;
                            state.selectedAnimation =
                              vnode.state.selectedAnimation;
                            if (window.canvasRenderer) {
                              const frames = setPreviewAnimation(target.value);
                              vnode.state.frameCycle = frames
                                ? frames.join("-")
                                : "";
                            }
                          },
                        },
                        allAnimations.map((anim) =>
                          m("option", { value: anim.value }, anim.label),
                        ),
                      ),
                    ]),
                  ]),
                  m("div.control", [
                    m("span.button.is-static.is-light", vnode.state.frameCycle),
                  ]),
                ]),
              ]),
            ]),
          ]),
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
                      oninput: (e: Event) => {
                        const target = e.target as HTMLInputElement;
                        vnode.state.zoomLevel = parseFloat(target.value);
                        state.previewCanvasZoomLevel = vnode.state.zoomLevel;
                        if (window.canvasRenderer) {
                          setPreviewCanvasZoom(vnode.state.zoomLevel);
                        }
                      },
                    }),
                  ]),
                ]),
              ]),
            ]),
          ]),
        ]),
        m("div.mt-3", [
          m("div.preview-canvas-area", [
            m(ScrollableContainer, { classes: "spritesheet-preview" }, [
              m("div.preview-canvas-root", [
                m(PreviewCanvas, {
                  state,
                  selectedAnimation: vnode.state.selectedAnimation,
                  zoomLevel: vnode.state.zoomLevel,
                  onFrameCycleUpdate: (frameCycle) => {
                    vnode.state.frameCycle = frameCycle;
                  },
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
            ]),
          ]),
        ]),
      ],
    );
  },
};
