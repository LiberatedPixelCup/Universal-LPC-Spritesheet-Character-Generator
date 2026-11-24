import m from "mithril";
import { assert } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { AdvancedTools } from "../../../sources/components/advanced/AdvancedTools.ts";
import { AdvancedToolsDrawer } from "../../../sources/components/advanced/AdvancedToolsDrawer.ts";
import { clearCustomImage, createState } from "../../../sources/state/state.ts";
let state;

function expandAdvancedTools(host) {
  host.querySelector(".collapsible-header").click();
  m.redraw.sync();
}

describe("AdvancedTools", function () {
  let host;

  beforeEach(function () {
    state = createState();
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
    m.mount(host, { view: () => m(AdvancedTools, { state }) });
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
    m.mount(host, { view: () => m(AdvancedTools, { state }) });
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
      m.mount(host, { view: () => m(AdvancedTools, { state }) });
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
    m.mount(host, { view: () => m(AdvancedTools, { state }) });
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

  it("discards an in-flight upload after reset and accepts the same filename again", function () {
    const requests = [];
    sinon.stub(window, "Image").callsFake(function () {
      requests.push(this);
    });
    sinon.stub(URL, "createObjectURL").returns("blob:fake");
    m.mount(host, { view: () => m(AdvancedTools, { state }) });
    expandAdvancedTools(host);
    const input = host.querySelector("#customFileInput");
    const choose = () => {
      const data = new DataTransfer();
      data.items.add(new File(["x"], "overlay.png", { type: "image/png" }));
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    choose();
    clearCustomImage(state);
    m.redraw.sync();
    assert.strictEqual(input.value, "");
    choose();
    requests[1].onload();
    requests[0].onload();
    assert.strictEqual(state.customUploadedImage, requests[1]);
  });

  it("revokes Object URLs, surfaces upload errors, and locks z-pos/clear during ZIP export", function () {
    const requests = [];
    sinon.stub(window, "Image").callsFake(function () {
      requests.push(this);
    });
    sinon.stub(URL, "createObjectURL").returns("blob:fake-err");
    const revokeSpy = sinon.stub(URL, "revokeObjectURL");

    for (const isDrawer of [false, true]) {
      requests.length = 0;
      revokeSpy.resetHistory();
      state = createState();
      m.mount(host, {
        view: () =>
          isDrawer
            ? m(AdvancedToolsDrawer, { state, onClose: () => {} })
            : m(AdvancedTools, { state }),
      });
      if (!isDrawer) expandAdvancedTools(host);

      const fileInput = host.querySelector('input[type="file"]');
      const selectFile = (name) => {
        const dt = new DataTransfer();
        dt.items.add(new File(["img"], name, { type: "image/png" }));
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      };

      selectFile("bad.png");
      requests[0].onerror();
      m.redraw.sync();
      assert.isTrue(revokeSpy.calledWith("blob:fake-err"));
      assert.include(host.textContent, "Failed to load selected image file.");

      // Upload valid image and lock during ZIP export
      selectFile("good.png");
      requests[1].onload();
      m.redraw.sync();
      assert.strictEqual(state.customUploadedImage, requests[1]);
      assert.notInclude(
        host.textContent,
        "Failed to load selected image file.",
      );

      state.isExportingZip = true;
      m.redraw.sync();
      const zInput = host.querySelector('input[type="number"]');
      assert.isTrue(zInput.disabled);
      zInput.value = "99";
      zInput.dispatchEvent(new Event("input", { bubbles: true }));
      assert.strictEqual(state.customImageZPos, 0);

      const clearBtn = [...host.querySelectorAll("button")].find(
        (btn) => btn.textContent.trim() === "Clear Custom Image",
      );
      assert.isTrue(clearBtn.disabled);
      clearBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      assert.strictEqual(state.customUploadedImage, requests[1]);

      state.isExportingZip = false;
      m.redraw.sync();
      clearBtn.click();
      m.redraw.sync();
      assert.isNull(state.customUploadedImage);
      m.mount(host, null);
    }
  });
});
