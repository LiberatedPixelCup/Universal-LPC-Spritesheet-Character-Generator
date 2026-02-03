import {
  LicenseFilters,
  setLicenseCompatible,
  getLicenseConfig,
  setLicenseConfig,
} from "../../../../sources/components/filters/LicenseFilters.js";
import { state } from "../../../../sources/state/state.js";
import { expect } from "chai";
import sinon from "sinon";

describe("LicenseFilters Component", () => {
  let container;
  let alertStub;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement("div");
    document.body.appendChild(container);

    // Reset state before each test
    state.selections = {};
    state.enabledAnimations = {};

    // stub the isLicenseCompatible method for dependency injection
    const licenseCompatibleStub = (itemId) => itemId === "item1";
    setLicenseCompatible({ isItemLicenseCompatible: licenseCompatibleStub });

    // stub LICENSES for dependency injection
    const licensesStub = [
      { key: "l1", label: "license1", versions: ["l1v1", "l1v2"] },
      { key: "l2", label: "license2", versions: "l2" },
    ];
    setLicenseConfig(licensesStub);

    alertStub = sinon
      .stub(window, "alert")
      .callsFake((message) => console.log("ALERT:", message));
  });

  afterEach(function () {
    // Cleanup after each test
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    alertStub.restore();
  });

  it("should render the correct number of enabled licenses", () => {
    state.enabledLicenses = { l1: true, l2: false, l3: true };
    const enabledCount = Object.values(state.enabledLicenses).filter(
      Boolean,
    ).length;
    const totalCount = getLicenseConfig().length;

    m.render(container, m(LicenseFilters));

    const labelText = container.querySelector(
      ".tree-label .is-size-7",
    ).textContent;

    expect(labelText).to.include(`(${enabledCount}/${totalCount} enabled)`);
  });

  it("should display a warning if there are incompatible items", () => {
    state.selections = {
      item1: { itemId: "item1" },
      item2: { itemId: "item2" },
    };
    state.enabledLicenses = { l1: true };

    m.mount(container, LicenseFilters);

    const expandButton = container.querySelector("span.tree-arrow");
    expandButton.click(); // Expand to show content
    m.redraw.sync();

    const warning = container.querySelector(".notification.is-warning");

    expect(warning).to.not.be.null;
    expect(warning.textContent).to.include("1 selected item is incompatible");
  });

  it("should remove incompatible items when the button is clicked", () => {
    state.selections = {
      item1: { itemId: "item1" },
      item2: { itemId: "item2" },
    };
    state.enabledLicenses = { l1: true };

    m.mount(container, LicenseFilters);

    const expandButton = container.querySelector("span.tree-arrow");
    expandButton.click(); // Expand to show content
    m.redraw.sync();

    const removeButton = container.querySelector("button.is-small.is-warning");

    removeButton.click();
    m.redraw.sync();

    expect(state.selections).to.deep.equal({
      item1: { itemId: "item1" },
    });
  });
});
