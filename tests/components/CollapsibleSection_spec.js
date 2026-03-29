// CollapsibleSection component tests - Browser compatible
import { CollapsibleSection } from "../../sources/components/CollapsibleSection.js";
import { assert } from "chai";

describe("CollapsibleSection", function() {
  let container;

  beforeEach(function() {
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

  it("renders with a title", function() {
    m.render(container, m(CollapsibleSection, { title: "Test Section" }));

    // Check for exact element
    const titleElement = container.querySelector("h3.collapsible-title");
    assert.notEqual(titleElement, null);
    assert.strictEqual(titleElement.textContent, "Test Section");

    // Check for collapsible title wrapper
    const collapsibleTitle = container.querySelector(".collapsible-title");
    assert.notEqual(collapsibleTitle, null);
  });

  it("renders children when not collapsed (defaultOpen: true)", function() {
    m.render(
      container,
      m(
        CollapsibleSection,
        {
          title: "Section",
          defaultOpen: true
        },
        "Child content"
      )
    );

    // Should show child content when open
    const child = container.querySelector("div.collapsible-content");
    assert.notEqual(child, null);
    assert.strictEqual(child.textContent, "Child content");
  });

  it("hides children when collapsed (defaultOpen: false)", function() {
    m.render(
      container,
      m(
        CollapsibleSection,
        {
          title: "Section",
          defaultOpen: false
        },
        "Child content"
      )
    );

    // Should not show child content when collapsed
    const child = container.querySelector("div.collapsible-content");
    assert.strictEqual(child, null);
    assert.notInclude(container.textContent, "Child content");
  });

  it("starts open by default", function() {
    m.render(
      container,
      m(
        CollapsibleSection,
        {
          title: "Section"
        },
        "Content"
      )
    );

    // Should be open by default (defaultOpen: true)
    const child = container.querySelector("div.collapsible-content");
    assert.notEqual(child, null);
    assert.strictEqual(child.textContent, "Content");
  });

  it("shows expanded arrow when open", function() {
    m.render(
      container,
      m(CollapsibleSection, {
        title: "Section",
        defaultOpen: true
      })
    );

    // Should have expanded arrow class
    const arrow = container.querySelector("span.tree-arrow.expanded");
    assert.notEqual(arrow, null);
  });

  it("shows collapsed arrow when closed", function() {
    m.render(
      container,
      m(CollapsibleSection, {
        title: "Section",
        defaultOpen: false
      })
    );

    // Should have collapsed arrow class
    const arrow = container.querySelector("span.tree-arrow.collapsed");
    assert.notEqual(arrow, null);
  });

  it("applies custom box class", function() {
    m.render(
      container,
      m(CollapsibleSection, {
        title: "Section",
        boxClass: "custom-box"
      })
    );

    // Should have the custom class
    const box = container.querySelector("div.custom-box");
    assert.notEqual(box, null);
  });

  it("uses default box class when not specified", function() {
    m.render(
      container,
      m(CollapsibleSection, {
        title: "Section"
      })
    );

    // Should have default "box" class
    const box = container.querySelector(".box");
    assert.notEqual(box, null);
  });
});
