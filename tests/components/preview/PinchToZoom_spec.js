import sinon from "sinon";
import { assert } from "chai";
import { describe, it, afterEach } from "mocha-globals";
import PinchToZoom from "../../../sources/components/preview/PinchToZoom.ts";

const polyfilledDocs = new WeakSet();

/**
 * Helpers to fire synthetic pinch gestures: build touch points, wrap them in lists, dispatch
 * `touchstart` / `touchmove` / `touchend` so TinyGesture sees the same fields as real events.
 *
 * Touch lists: we always go through `document.createTouch` and `document.createTouchList` (native
 * on WebKit; polyfilled in this file when absent). That gives a real `TouchList` where required and
 * keeps Chromium happy by upgrading plain objects to `new Touch(...)` when the `Touch` constructor
 * exists.
 *
 * Dispatch: prefer `new TouchEvent(...)`, then legacy `createEvent("TouchEvent")` +
 * `initTouchEvent`. Safari desktop often supports neither for synthetic events, so we last-resort
 * dispatch a generic `Event` and define `touches`, `targetTouches`, and `changedTouches` on it.
 *
 * Firefox in Testem needs touch APIs enabled; see `tests/testem-firefox-user.js`.
 */
function ensureDocumentTouchFactories(doc) {
  if (doc.createTouch && doc.createTouchList) {
    return;
  }
  if (polyfilledDocs.has(doc)) {
    return;
  }
  polyfilledDocs.add(doc);

  doc.createTouch = function (
    view,
    target,
    identifier,
    pageX,
    pageY,
    screenX,
    screenY,
    radiusX,
    radiusY,
    rotationAngle,
    force,
  ) {
    return {
      identifier,
      target,
      clientX: pageX,
      clientY: pageY,
      pageX,
      pageY,
      screenX: screenX ?? pageX,
      screenY: screenY ?? pageY,
      radiusX: radiusX ?? 0,
      radiusY: radiusY ?? 0,
      rotationAngle: rotationAngle ?? 0,
      force: force ?? 0,
    };
  };

  doc.createTouchList = function (...items) {
    const list = [...items];
    list.item = (index) => list[index] ?? null;
    Object.defineProperty(list, "length", { value: list.length });
    return list;
  };
}

function makeTouch(target, identifier, x, y) {
  const doc = target.ownerDocument;
  ensureDocumentTouchFactories(doc);
  const win = doc.defaultView ?? window;
  return doc.createTouch(win, target, identifier, x, y, x, y, 1, 1, 0, 0.5);
}

function toTouchList(doc, touches) {
  ensureDocumentTouchFactories(doc);

  if (typeof TouchEvent === "function" && typeof Touch === "function") {
    const list = touches.map((t) =>
      t instanceof Touch
        ? t
        : new Touch({
            identifier: t.identifier,
            target: t.target,
            clientX: t.clientX,
            clientY: t.clientY,
            screenX: t.screenX,
            screenY: t.screenY,
            pageX: t.pageX,
            pageY: t.pageY,
            radiusX: t.radiusX ?? 0,
            radiusY: t.radiusY ?? 0,
            rotationAngle: t.rotationAngle ?? 0,
            force: t.force ?? 0,
          }),
    );
    // WebKit (Safari) rejects plain arrays here; use createTouchList (native or our polyfill).
    if (doc.createTouchList) {
      return list.length === 0
        ? doc.createTouchList()
        : doc.createTouchList(...list);
    }
    return list;
  }

  return touches.length === 0
    ? doc.createTouchList()
    : doc.createTouchList(...touches);
}

function fireTouch(target, type, touches, changedTouches) {
  const doc = target.ownerDocument;
  const tl = toTouchList(doc, touches);
  const cl = toTouchList(doc, changedTouches);

  const touchInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    touches: tl,
    targetTouches: tl,
    changedTouches: cl,
  };

  if (typeof TouchEvent === "function") {
    try {
      target.dispatchEvent(new TouchEvent(type, touchInit));
      return;
    } catch {
      /* ctor exists but dispatch rejects init (try fallbacks below) */
    }
  }

  try {
    const win = doc.defaultView ?? window;
    const event = doc.createEvent("TouchEvent");
    event.initTouchEvent(
      type,
      true,
      true,
      win,
      0,
      false,
      false,
      false,
      false,
      tl,
      tl,
      cl,
      1,
      0,
    );
    target.dispatchEvent(event);
    return;
  } catch {
    /* Safari desktop: no synthetic TouchEvent / createEvent("TouchEvent") */
  }

  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(ev, {
    touches: { value: tl, enumerable: true },
    targetTouches: { value: tl, enumerable: true },
    changedTouches: { value: cl, enumerable: true },
  });
  target.dispatchEvent(ev);
}

/** Two-finger pinch: horizontal spread from `startSep` to `endSep` (centered at x = cx). */
function pinchMoveSpread(target, cx, y, startSep, endSep) {
  const half0 = startSep / 2;
  const t0Start = makeTouch(target, 0, cx - half0, y);
  const t1Start = makeTouch(target, 1, cx + half0, y);
  fireTouch(target, "touchstart", [t0Start, t1Start], [t0Start, t1Start]);

  const half1 = endSep / 2;
  const t0Moved = makeTouch(target, 0, cx - half1, y);
  const t1Held = makeTouch(target, 1, cx + half0, y);
  fireTouch(target, "touchmove", [t0Moved, t1Held], [t0Moved]);

  const t0End = makeTouch(target, 0, cx - half1, y);
  const t1Moved = makeTouch(target, 1, cx + half1, y);
  fireTouch(target, "touchmove", [t0End, t1Moved], [t1Moved]);
}

function endTwoFingerPinch(target, cx, y, endSep) {
  const half = endSep / 2;
  const t0 = makeTouch(target, 0, cx - half, y);
  const t1 = makeTouch(target, 1, cx + half, y);
  fireTouch(target, "touchend", [t1], [t0]);
  fireTouch(target, "touchend", [], [t1]);
}

describe("PinchToZoom", function () {
  const cx = 200;
  const y = 150;

  afterEach(function () {
    sinon.restore();
  });

  it("create wires tinygesture pinch to onZoom with initialZoom times scale", async function () {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const onZoom = sinon.spy();
    const pinch = await PinchToZoom.create(el, onZoom, 2);

    pinchMoveSpread(el, cx, y, 100, 120);
    assert.isTrue(onZoom.called);
    assert.approximately(onZoom.lastCall.args[0], 2.4, 0.001);

    pinch.destroy();
    el.remove();
  });

  it("treats initialZoom 0 as 1", async function () {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const onZoom = sinon.spy();
    const pinch = await PinchToZoom.create(el, onZoom, 0);

    pinchMoveSpread(el, cx, y, 100, 120);
    assert.approximately(onZoom.lastCall.args[0], 1.2, 0.001);

    pinch.destroy();
    el.remove();
  });

  it("pinchend commits current zoom as the next pinch baseline", async function () {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const onZoom = sinon.spy();
    const pinch = await PinchToZoom.create(el, onZoom, 1);

    pinchMoveSpread(el, cx, y, 100, 120);
    assert.approximately(onZoom.lastCall.args[0], 1.2, 0.001);
    endTwoFingerPinch(el, cx, y, 120);

    pinchMoveSpread(el, cx, y, 100, 120);
    assert.approximately(onZoom.lastCall.args[0], 1.44, 0.001);

    pinch.destroy();
    el.remove();
  });

  it("destroy removes listeners without throwing", async function () {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const pinch = await PinchToZoom.create(el, () => {});

    assert.doesNotThrow(() => pinch.destroy());
    assert.strictEqual(pinch.gesture, null);

    el.remove();
  });
});
