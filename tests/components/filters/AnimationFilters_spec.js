import {
  AnimationFilters,
  isAnimationCompatible,
  setAnimationCompatible,
  getAnimations,
  setAnimations,
} from "../../../sources/components/filters/AnimationFilters.ts";
import { createState } from "../../../sources/state/state.ts";
let state;
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("AnimationFilters Component", () => {
  let container;
  let alertStub;

  beforeEach(function () {
    state = createState();
    // Create a fresh container for each test
    container = document.createElement("div");
    document.body.appendChild(container);

    // Reset state before each test
    state.selections = {};
    state.enabledAnimations = {};

    // stub the isAnimationCompatible method for dependency injection
    const animationCompatibleStub = (_catalog, _state, itemId) =>
      itemId === "item1";
    setAnimationCompatible({
      isItemAnimationCompatible: animationCompatibleStub,
    });

    // stub ANIMATIONS for dependency injection
    const animationsStub = [
      { value: "anim1", label: "Animation 1" },
      { value: "anim2", label: "Animation 2" },
      { value: "anim3", label: "Animation 3" },
    ];
    setAnimations(animationsStub);

    alertStub = sinon.stub(window, "alert").callsFake((message) => {
      // eslint-disable-next-line no-console
      console.log("ALERT:", message);
    });
  });

  afterEach(function () {
    // Cleanup after each test
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    alertStub.restore();
  });

  it("checks animation compatibility through the public helper", () => {
    const catalog = { isLiteReady: () => true };
    expect(isAnimationCompatible(catalog, state, "item1")).to.equal(true);
    expect(isAnimationCompatible(catalog, state, "item2")).to.equal(false);
  });

  it("should display the correct count of enabled animations", () => {
    state.enabledAnimations = {
      anim1: true,
      anim2: false,
      anim3: true,
    };

    const enabledCount = Object.values(state.enabledAnimations).filter(
      Boolean,
    ).length;
    const totalCount = getAnimations().length;

    m.render(
      container,
      m(AnimationFilters, { catalog: { isLiteReady: () => true }, state }),
    );

    const labelText = container.querySelector(
      ".tree-label .is-size-7",
    ).textContent;

    expect(labelText).to.include(`(${enabledCount}/${totalCount})`);
  });

  it("should remove incompatible items when the button is clicked", () => {
    state.selections = {
      group1: { itemId: "item1" },
      group2: { itemId: "item2" },
    };

    state.enabledAnimations = {
      anim1: true,
    };

    m.mount(container, {
      view: () =>
        m(AnimationFilters, { catalog: { isLiteReady: () => true }, state }),
    });

    const expandButton = container.querySelector("span.tree-arrow");
    expandButton.click(); // Expand to show content
    m.redraw.sync();

    const removeButton = container.querySelector("button.is-small.is-warning");

    removeButton.click();
    m.redraw.sync();

    expect(state.selections).to.deep.equal({
      group1: { itemId: "item1" },
    });

    expect(alertStub.calledOnce).to.be.true;
  });

  it("should display a warning if there are incompatible items", () => {
    state.selections = {
      group1: { itemId: "item1" },
      group2: { itemId: "item2" },
    };

    state.enabledAnimations = {
      anim1: true,
    };

    m.mount(container, {
      view: () =>
        m(AnimationFilters, { catalog: { isLiteReady: () => true }, state }),
    });

    const expandButton = container.querySelector("span.tree-arrow");
    expandButton.click(); // Expand to show content
    m.redraw.sync();

    const warning = container.querySelector(".notification.is-warning");

    expect(warning).to.not.be.null;
    expect(warning.textContent).to.include("1 selected item is incompatible");
  });
});
