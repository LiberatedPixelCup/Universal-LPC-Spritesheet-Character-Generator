import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  beginZipExportUiSuspend,
  endZipExportUiSuspend,
} from "../../sources/utils/zip-export-ui-suspend.ts";

/** Drain nested suspend depth so module state does not leak between tests. */
function drainZipExportUiSuspend() {
  for (let i = 0; i < 10; i++) {
    endZipExportUiSuspend();
  }
}

describe("utils/zip-export-ui-suspend.ts", () => {
  let savedM;

  beforeEach(() => {
    savedM = globalThis.m;
    globalThis.m = {
      redraw: sinon.spy(),
    };
  });

  afterEach(() => {
    drainZipExportUiSuspend();
    globalThis.m = savedM;
  });

  it("replaces m.redraw with a no-op until endZipExportUiSuspend restores it", () => {
    const redraw = globalThis.m.redraw;

    beginZipExportUiSuspend();
    globalThis.m.redraw();
    globalThis.m.redraw();
    expect(redraw.called).to.equal(false);

    endZipExportUiSuspend();
    globalThis.m.redraw();
    expect(redraw.calledOnce).to.equal(true);
  });

  it("nests: inner end does not restore; outer end restores", () => {
    const redraw = globalThis.m.redraw;

    beginZipExportUiSuspend();
    beginZipExportUiSuspend();

    globalThis.m.redraw();
    expect(redraw.called).to.equal(false);

    endZipExportUiSuspend();
    globalThis.m.redraw();
    expect(redraw.called).to.equal(false);

    endZipExportUiSuspend();
    globalThis.m.redraw();
    expect(redraw.calledOnce).to.equal(true);
  });

  it("endZipExportUiSuspend is safe when suspend depth is already zero", () => {
    expect(() => endZipExportUiSuspend()).to.not.throw();
  });

  it("beginZipExportUiSuspend does not throw when globalThis.m is missing", () => {
    globalThis.m = undefined;
    expect(() => beginZipExportUiSuspend()).to.not.throw();
    drainZipExportUiSuspend();
  });

  it("beginZipExportUiSuspend does not throw when m.redraw is not a function", () => {
    globalThis.m = { redraw: "not-a-fn" };
    expect(() => beginZipExportUiSuspend()).to.not.throw();
    drainZipExportUiSuspend();
  });
});
