// CollapsibleSection component tests - Browser compatible
import { CollapsibleSection } from "../sources/components/CollapsibleSection.js";

// Use global o and m (loaded from CDN in index.html)
const o = window.o;
const m = window.m;

o.spec("CollapsibleSection", function() {
  let container;

  o.beforeEach(function() {
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

  o("renders with a title", function() {
    m.render(container, m(CollapsibleSection, { title: "Test Section" }));

    // Check for exact element
    const titleElement = container.querySelector("h3.collapsible-title");
    o(titleElement).notEquals(null);
    o(titleElement.textContent).equals("Test Section");

    // Check for collapsible title wrapper
    const collapsibleTitle = container.querySelector(".collapsible-title");
    o(collapsibleTitle).notEquals(null);
  });

  o("renders children when not collapsed (defaultOpen: true)", function() {
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
    o(child).notEquals(null);
    o(child.textContent).equals("Child content");
  });

  o("hides children when collapsed (defaultOpen: false)", function() {
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
    o(child).equals(null);
    o(container.textContent.includes("Child content")).equals(false);
  });

  o("starts open by default", function() {
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
    o(child).notEquals(null);
    o(child.textContent).equals("Content");
  });

  o("shows expanded arrow when open", function() {
    m.render(
      container,
      m(CollapsibleSection, {
        title: "Section",
        defaultOpen: true
      })
    );

    // Should have expanded arrow class
    const arrow = container.querySelector("span.tree-arrow.expanded");
    o(arrow).notEquals(null);
  });

  o("shows collapsed arrow when closed", function() {
    m.render(
      container,
      m(CollapsibleSection, {
        title: "Section",
        defaultOpen: false
      })
    );

    // Should have collapsed arrow class
    const arrow = container.querySelector("span.tree-arrow.collapsed");
    o(arrow).notEquals(null);
  });

  o("applies custom box class", function() {
    m.render(
      container,
      m(CollapsibleSection, {
        title: "Section",
        boxClass: "custom-box"
      })
    );

    // Should have the custom class
    const box = container.querySelector("div.custom-box");
    o(box).notEquals(null);
  });

  o("uses default box class when not specified", function() {
    m.render(
      container,
      m(CollapsibleSection, {
        title: "Section"
      })
    );

    // Should have default "box" class
    const box = container.querySelector(".box");
    o(box).notEquals(null);
  });
});
