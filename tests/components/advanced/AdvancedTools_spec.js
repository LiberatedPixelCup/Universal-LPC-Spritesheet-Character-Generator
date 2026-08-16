import m from "mithril";
import { assert } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { AdvancedTools } from "../../../sources/components/advanced/AdvancedTools.ts";
import { state } from "../../../sources/state/state.ts";

function expandAdvancedTools(host) {
  host.querySelector(".collapsible-header").click();
  m.redraw.sync();
}

describe("AdvancedTools", function () {
  let host;

  beforeEach(function () {
    host = document.createElement("div");
    document.body.appendChild(host);
    state.customUploadedImage = null;
    state.customImageZPos = 0;
  });

  afterEach(function () {
    sinon.restore();
    m.mount(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    state.customUploadedImage = null;
    state.customImageZPos = 0;
  });

  it("shows the file input and z-pos field after expand, without a clear button", function () {
    m.mount(host, AdvancedTools);
    assert.strictEqual(host.querySelector("#customFileInput"), null);

    expandAdvancedTools(host);

    assert.notEqual(host.querySelector("#customFileInput"), null);
    assert.notEqual(host.querySelector('input[type="number"]'), null);
    assert.strictEqual(
      [...host.querySelectorAll("button")].find(
        (btn) => btn.textContent.trim() === "Clear Custom Image",
      ),
      undefined,
    );
  });

  it("writes customImageZPos from the number field and treats invalid as 0", function () {
    m.mount(host, AdvancedTools);
    expandAdvancedTools(host);

    const input = host.querySelector('input[type="number"]');
    input.value = "70";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    assert.strictEqual(state.customImageZPos, 70);

    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    assert.strictEqual(state.customImageZPos, 0);
  });

  it("loads an uploaded image into state", async function () {
    const OriginalImage = window.Image;
    window.Image = class FakeImage {
      constructor() {
        this.onload = null;
      }
      set src(_value) {
        queueMicrotask(() => this.onload?.());
      }
    };
    sinon.stub(URL, "createObjectURL").returns("blob:fake");

    try {
      m.mount(host, AdvancedTools);
      expandAdvancedTools(host);

      const input = host.querySelector("#customFileInput");
      const data = new DataTransfer();
      data.items.add(new File(["x"], "overlay.png", { type: "image/png" }));
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      m.redraw.sync();

      assert.notEqual(state.customUploadedImage, null);
      assert.notEqual(
        [...host.querySelectorAll("button")].find(
          (btn) => btn.textContent.trim() === "Clear Custom Image",
        ),
        undefined,
      );
    } finally {
      window.Image = OriginalImage;
    }
  });

  it("clears the custom image, z-pos, and file input", function () {
    m.mount(host, AdvancedTools);
    expandAdvancedTools(host);
    state.customUploadedImage = new Image();
    state.customImageZPos = 10;
    m.redraw.sync();

    const fileInput = host.querySelector("#customFileInput");
    const data = new DataTransfer();
    data.items.add(new File(["x"], "overlay.png", { type: "image/png" }));
    fileInput.files = data.files;

    const clear = [...host.querySelectorAll("button")].find(
      (btn) => btn.textContent.trim() === "Clear Custom Image",
    );
    clear.click();
    m.redraw.sync();

    assert.strictEqual(state.customUploadedImage, null);
    assert.strictEqual(state.customImageZPos, 0);
    assert.strictEqual(fileInput.value, "");
  });
});
