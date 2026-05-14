import m from "mithril";
import { ok, err } from "neverthrow";
import { expect } from "chai";
import { describe, it } from "mocha-globals";
import { renderResult } from "../../sources/utils/render-result.ts";

describe("renderResult", () => {
  it("calls view(value) when result is Ok", () => {
    let captured;
    const result = renderResult(ok(42), (v) => {
      captured = v;
      return m("span.ok-rendered");
    });
    expect(captured).to.equal(42);
    expect(result.attrs.className).to.equal("ok-rendered");
  });

  it("renders the default loading element on Err({kind:'loading'})", () => {
    const result = renderResult(err({ kind: "loading", chunk: "lite" }), () =>
      m("span.should-not-render"),
    );
    expect(result.tag).to.equal("div");
    expect(result.attrs.className).to.equal("result-loading");
  });

  it("renders the default not-found element on Err({kind:'not-found'})", () => {
    const result = renderResult(err({ kind: "not-found", id: "ghost" }), () =>
      m("span"),
    );
    expect(result.tag).to.equal("div");
    expect(result.attrs.className).to.equal("result-error");
  });

  it("uses custom renderError when provided, passing the error", () => {
    let capturedError;
    const result = renderResult(
      err({ kind: "loading", chunk: "lite" }),
      () => m("span.should-not-render"),
      (e) => {
        capturedError = e;
        return m("span.custom-fallback");
      },
    );
    expect(capturedError).to.deep.equal({ kind: "loading", chunk: "lite" });
    expect(result.attrs.className).to.equal("custom-fallback");
  });

  it("dispatches Ok vs Err across consecutive calls with the same callbacks", () => {
    let captured = null;
    const view = (v) => {
      captured = v;
      return m("span.loaded");
    };

    const first = renderResult(err({ kind: "loading", chunk: "lite" }), view);
    expect(first.attrs.className).to.equal("result-loading");
    expect(captured).to.equal(null);

    const second = renderResult(ok(99), view);
    expect(second.attrs.className).to.equal("loaded");
    expect(captured).to.equal(99);
  });
});
