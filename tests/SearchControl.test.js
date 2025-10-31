// SearchControl component tests - Browser compatible
import { state } from "../sources/state/state.js";
import { SearchControl } from "../sources/components/filters/SearchControl.js";

// Use global o and m (loaded from CDN in index.html)
const o = window.o;
const m = window.m;

o.spec("SearchControl", function() {
  let container;

  o.beforeEach(function() {
    // Reset state before each test
    state.searchQuery = "";

    // Create a fresh container for each test
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  o.afterEach(function() {
    // Cleanup after each test
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  o("renders a search input field", function() {
    m.render(container, m(SearchControl));

    // Should render an input with type=search and placeholder attribute
    const input = container.querySelector(
      "input[type=search][placeholder=Search]"
    );
    o(input).notEquals(null);
  });

  o("displays the label 'Search:'", function() {
    m.render(container, m(SearchControl));

    // Should have a label with text "Search:"
    o(container.textContent.includes("Search:")).equals(true);
  });

  o("input reflects current state value", function() {
    const test_query = "test query";
    state.searchQuery = test_query;
    m.render(container, m(SearchControl));

    // Input value should match state
    const input = container.querySelector("input");
    o(input.value).equals(test_query);
  });
});
