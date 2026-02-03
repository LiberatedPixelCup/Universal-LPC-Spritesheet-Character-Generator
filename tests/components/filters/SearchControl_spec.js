// SearchControl component tests - Browser compatible
import { state } from "../../../sources/state/state.js";
import { SearchControl } from "../../../sources/components/filters/SearchControl.js";
import { assert } from "chai";

describe("SearchControl", function() {
  let container;

  beforeEach(function() {
    // Reset state before each test
    state.searchQuery = "";

    // Create a fresh container for each test
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(function() {
    // Cleanup after each test
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("renders a search input field", function() {
    m.render(container, m(SearchControl));

    // Should render an input with type=search and placeholder attribute
    const input = container.querySelector(
      "input[type=search][placeholder=Search]"
    );
    assert.notEqual(input, null);
  });

  it("displays the label 'Search:'", function() {
    m.render(container, m(SearchControl));

    // Should have a label with text "Search:"
    assert.include(container.textContent, "Search:");
  });

  it("input reflects current state value", function() {
    const test_query = "test query";
    state.searchQuery = test_query;
    m.render(container, m(SearchControl));

    // Input value should match state
    const input = container.querySelector("input");
    assert.strictEqual(input.value, test_query);
  });
});
