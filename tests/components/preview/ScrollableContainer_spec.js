import m from "mithril";
import { ScrollableContainer } from "../../../sources/components/preview/ScrollableContainer.ts";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

/**
 * ScrollableContainer reads pageX/pageY. Synthetic MouseEvent init often leaves them at 0
 * in real browsers, so drag math never moves scrollLeft.
 */
function dispatchMouseWithPage(el, type, pageX, pageY, init = {}) {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    ...init,
  });
  Object.defineProperty(e, "pageX", { value: pageX });
  Object.defineProperty(e, "pageY", { value: pageY });
  el.dispatchEvent(e);
}

describe("ScrollableContainer", function () {
  let host;

  beforeEach(function () {
    host = document.createElement("div");
    host.style.position = "relative";
    document.body.appendChild(host);
  });

  afterEach(function () {
    m.render(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  });

  it("renders root with scrollable-container and mt-3 classes", function () {
    m.render(host, m(ScrollableContainer));

    const el = host.querySelector("div.scrollable-container");
    assert.notEqual(el, null);
    assert.isTrue(el.classList.contains("mt-3"));
  });

  it("merges classes from attrs", function () {
    m.render(
      host,
      m(ScrollableContainer, { classes: "is-narrow custom-preview" }),
    );

    const el = host.querySelector("div.scrollable-container");
    assert.isTrue(el.classList.contains("is-narrow"));
    assert.isTrue(el.classList.contains("custom-preview"));
  });

  it("renders vnode children", function () {
    m.render(host, m(ScrollableContainer, m("span.inner", "preview body")));

    const inner = host.querySelector("span.inner");
    assert.notEqual(inner, null);
    assert.strictEqual(inner.textContent, "preview body");
  });

  it("sets grabbing cursor on mousedown and grab after mouseup", function () {
    m.render(
      host,
      m(
        ScrollableContainer,
        m("div", { style: { width: "200px", height: "20px" } }, "x"),
      ),
    );

    const el = host.querySelector(".scrollable-container");
    el.style.width = "80px";
    el.style.overflow = "auto";

    el.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        pageX: 100,
        pageY: 20,
      }),
    );
    assert.strictEqual(el.style.cursor, "grabbing");

    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assert.strictEqual(el.style.cursor, "grab");
  });

  it("resets cursor to grab on mouseleave while dragging", function () {
    m.render(host, m(ScrollableContainer, m("div", "c")));

    const el = host.querySelector(".scrollable-container");

    el.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        pageX: 50,
        pageY: 10,
      }),
    );
    assert.strictEqual(el.style.cursor, "grabbing");

    el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    assert.strictEqual(el.style.cursor, "grab");
  });

  it("updates scroll position while dragging", function () {
    m.render(
      host,
      m(
        ScrollableContainer,
        m("div", { style: { width: "400px", height: "40px" } }, "wide"),
      ),
    );

    const el = host.querySelector(".scrollable-container");
    el.style.width = "100px";
    el.style.height = "60px";
    el.style.overflow = "auto";

    assert.isAbove(
      el.scrollWidth,
      el.clientWidth,
      "fixture must overflow horizontally so drag-scroll can apply",
    );

    const startLeft = el.scrollLeft;

    dispatchMouseWithPage(el, "mousedown", 100, 20);
    dispatchMouseWithPage(el, "mousemove", 40, 20, { cancelable: true });

    assert.isAbove(el.scrollLeft, startLeft);
  });

  it("does not scroll on mousemove when not dragging", function () {
    m.render(
      host,
      m(
        ScrollableContainer,
        m("div", { style: { width: "400px", height: "40px" } }, "wide"),
      ),
    );

    const el = host.querySelector(".scrollable-container");
    el.style.width = "100px";
    el.style.overflow = "auto";

    const before = el.scrollLeft;
    el.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        pageX: 10,
        pageY: 10,
      }),
    );
    assert.strictEqual(el.scrollLeft, before);
  });
});
