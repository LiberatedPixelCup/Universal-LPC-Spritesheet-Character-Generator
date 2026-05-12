import {
  startPreviewAnimation,
  stopPreviewAnimation,
} from "../canvas/preview-animation.js";

/**
 * While ZIP export runs, Mithril `m.redraw()` and the preview canvas rAF loop
 * compete for the main thread. Suspend them after the first redraw (spinner)
 * and restore in `endZipExportUiSuspend()` (before the final redraw).
 *
 * Nesting depth allows future overlapping guards; each export uses one pair.
 */
let suspendDepth = 0;
let savedRedraw: (() => void) | null = null;
let resumePreviewAnimation = false;

/** Mithril is attached to `globalThis.m` by `vendor-globals.js`; treat as optional here. */
type GlobalWithMithril = typeof globalThis & {
  m?: { redraw?: () => void };
};

export function beginZipExportUiSuspend(): void {
  suspendDepth++;
  if (suspendDepth > 1) {
    return;
  }
  resumePreviewAnimation = stopPreviewAnimation();
  const mithril = (globalThis as GlobalWithMithril).m;
  if (mithril && typeof mithril.redraw === "function") {
    savedRedraw = mithril.redraw.bind(mithril);
    mithril.redraw = () => {};
  }
}

export function endZipExportUiSuspend(): void {
  if (suspendDepth === 0) {
    return;
  }
  suspendDepth--;
  if (suspendDepth > 0) {
    return;
  }
  const mithril = (globalThis as GlobalWithMithril).m;
  if (mithril && savedRedraw) {
    mithril.redraw = savedRedraw;
    savedRedraw = null;
  }
  if (resumePreviewAnimation) {
    startPreviewAnimation();
    resumePreviewAnimation = false;
  }
}
