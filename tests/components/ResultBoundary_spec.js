import m from "mithril";
import { ok, err } from "neverthrow";
import { expect } from "chai";
import { describe, it } from "mocha-globals";
import { ResultBoundary } from "../../sources/components/ResultBoundary.js";

describe("ResultBoundary", () => {
  it("calls view(value) when read returns Ok", () => {
    let captured;
    const result = ResultBoundary.view({
      attrs: {
        read: () => ok(42),
        view: (v) => {
          captured = v;
          return m("span.ok-rendered");
        },
      },
    });
    expect(captured).to.equal(42);
    expect(result.attrs.className).to.equal("ok-rendered");
  });

  it("renders the default loading element on Err({kind:'loading'})", () => {
    const result = ResultBoundary.view({
      attrs: {
        read: () => err({ kind: "loading", chunk: "lite" }),
        view: () => m("span.should-not-render"),
      },
    });
    expect(result.tag).to.equal("div");
    expect(result.attrs.className).to.equal("result-loading");
  });

  it("renders the default not-found element on Err({kind:'not-found'})", () => {
    const result = ResultBoundary.view({
      attrs: {
        read: () => err({ kind: "not-found", id: "ghost" }),
        view: () => m("span"),
      },
    });
    expect(result.tag).to.equal("div");
    expect(result.attrs.className).to.equal("result-error");
  });

  it("uses custom renderError when provided, passing the error", () => {
    let capturedError;
    const result = ResultBoundary.view({
      attrs: {
        read: () => err({ kind: "loading", chunk: "lite" }),
        view: () => m("span.should-not-render"),
        renderError: (e) => {
          capturedError = e;
          return m("span.custom-fallback");
        },
      },
    });
    expect(capturedError).to.deep.equal({ kind: "loading", chunk: "lite" });
    expect(result.attrs.className).to.equal("custom-fallback");
  });

  it("transitions from loading to ok across consecutive renders", () => {
    let stage = "loading";
    let captured = null;
    const attrs = {
      read: () =>
        stage === "loading" ? err({ kind: "loading", chunk: "lite" }) : ok(99),
      view: (v) => {
        captured = v;
        return m("span.loaded");
      },
    };

    const first = ResultBoundary.view({ attrs });
    expect(first.attrs.className).to.equal("result-loading");
    expect(captured).to.equal(null);

    stage = "loaded";
    const second = ResultBoundary.view({ attrs });
    expect(second.attrs.className).to.equal("loaded");
    expect(captured).to.equal(99);
  });
});
