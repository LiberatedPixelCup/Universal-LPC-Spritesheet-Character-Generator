import { AnimationFilters } from "../../../sources/components/filters/AnimationFilters.ts";
import { animationFiltersModelFactory } from "../../../sources/models/animation-filters.ts";
import { createCatalog } from "../../../sources/state/catalog.ts";
import { createState } from "../../../sources/state/state.ts";
import { setAnimations } from "../../../sources/state/filters.ts";
import { ANIMATIONS } from "../../../sources/state/constants.ts";
import { seedCatalog } from "../../browser-catalog-fixture.js";
import { assert } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("AnimationFilters Component", function () {
  let host;
  let alertStub;

  beforeEach(function () {
    host = document.createElement("div");
    document.body.appendChild(host);
    alertStub = sinon.stub(window, "alert");
    setAnimations(ANIMATIONS);
  });

  afterEach(function () {
    m.mount(host, null);
    host.remove();
    alertStub.restore();
  });

  function render(model) {
    m.mount(host, {
      view: () => m(AnimationFilters, { createModel: () => model }),
    });
  }

  function expand() {
    host.querySelector("span.tree-arrow").click();
    m.redraw.sync();
  }

  it("renders its summary, loading state, and supplied options", function () {
    let enabled;
    render({
      liteReady: false,
      summary: "(1/3)",
      incompatibleCount: 0,
      options: [
        {
          value: "walk",
          label: "Walk",
          enabled: true,
          setEnabled(value) {
            enabled = value;
          },
        },
      ],
      removeIncompatible: () => 0,
    });

    assert.include(host.textContent, "(1/3)");
    expand();
    assert.include(host.textContent, "Loading item list…");

    const checkbox = host.querySelector("input[type=checkbox]");
    assert.isTrue(checkbox.checked);
    assert.isTrue(checkbox.disabled);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    assert.isFalse(enabled);
  });

  it("renders a warning and reports removals through the UI", function () {
    render({
      liteReady: true,
      summary: "(1/1)",
      incompatibleCount: 1,
      options: [],
      removeIncompatible: () => 1,
    });
    expand();

    assert.include(host.textContent, "1 selected item is incompatible");
    host.querySelector("button.is-warning").click();
    assert.isTrue(alertStub.calledOnceWith("Removed 1 incompatible item(s)"));
  });

  it("reports when a rendered incompatibility is gone before removal", function () {
    render({
      liteReady: true,
      summary: "(1/1)",
      incompatibleCount: 1,
      options: [],
      removeIncompatible: () => 0,
    });
    expand();

    host.querySelector("button.is-warning").click();
    assert.isTrue(alertStub.calledOnceWith("No incompatible items found"));
  });

  it("derives compatibility and commands from catalog and state", function () {
    const { reader: catalog, writer } = createCatalog();
    const state = createState();
    seedCatalog(writer, {
      compatible: { name: "Compatible", animations: ["walk"] },
      incompatible: { name: "Incompatible", animations: ["jump"] },
    });
    state.enabledAnimations = { walk: true };
    state.selections = {
      first: { itemId: "compatible", name: "Compatible" },
      second: { itemId: "incompatible", name: "Incompatible" },
    };

    const model = animationFiltersModelFactory.create(catalog, state);
    assert.strictEqual(model.summary, `(1/${ANIMATIONS.length})`);
    assert.strictEqual(model.incompatibleCount, 1);
    model.options.find((option) => option.value === "walk").setEnabled(false);
    assert.isFalse(state.enabledAnimations.walk);

    state.enabledAnimations.walk = true;
    assert.strictEqual(model.removeIncompatible(), 1);
    assert.deepEqual(Object.keys(state.selections), ["first"]);
  });

  it("uses the all summary when no animations are enabled", function () {
    const { reader: catalog } = createCatalog();
    const state = createState();
    state.enabledAnimations = {};

    const model = animationFiltersModelFactory.create(catalog, state);
    assert.isFalse(model.liteReady);
    assert.strictEqual(model.summary, "(All)");
  });
});
