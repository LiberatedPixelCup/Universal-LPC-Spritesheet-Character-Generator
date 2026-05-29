import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { CurrentSelections } from "../../../sources/components/selections/CurrentSelections.ts";
import { state } from "../../../sources/state/state.ts";
import {
  defaultCatalog,
  resetCatalogForTests,
} from "../../../sources/state/catalog.ts";
import {
  resetState,
  setEnabledLicenses,
  setEnabledAnimations,
} from "../../../sources/state/filters.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../../browser-catalog-fixture.js";

describe("CurrentSelections", function () {
  let host;

  beforeEach(function () {
    resetState();
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(async function () {
    m.render(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    resetState();
    await restoreAppCatalogAfterTest();
  });

  it("shows loading copy when item list (lite) is not ready", function () {
    resetCatalogForTests();

    m.render(host, m(CurrentSelections, { catalog: defaultCatalog }));

    assert.include(host.textContent, "Current Selections");
    assert.include(host.textContent, "Loading item list…");
    assert.strictEqual(host.querySelector(".tags"), null);
  });

  it("shows empty copy when catalog is ready but nothing is selected", function () {
    seedBrowserCatalog({
      sel_body: {
        name: "Body",
        type_name: "body",
        animations: ["walk"],
        credits: [],
        layers: {},
      },
    });
    state.selections = {};

    m.render(host, m(CurrentSelections, { catalog: defaultCatalog }));

    assert.include(host.textContent, "No items selected yet");
    assert.strictEqual(host.querySelector(".tag"), null);
  });

  it("renders selection tags with titles, license/animation lines, and delete controls", function () {
    seedBrowserCatalog({
      sel_hat: {
        name: "Test Hat",
        type_name: "hat",
        animations: ["walk", "idle"],
        credits: [{ file: "hat.png", licenses: ["CC0"] }],
        layers: {},
      },
      sel_coat: {
        name: "Winter Coat",
        type_name: "coat",
        animations: ["walk"],
        credits: [],
        layers: {},
      },
    });
    setEnabledLicenses(["CC0"]);

    state.selections = {
      hat: { itemId: "sel_hat", name: "Test Hat (blue)" },
      coat: { itemId: "sel_coat", name: "Winter Coat (long)" },
    };

    m.render(host, m(CurrentSelections, { catalog: defaultCatalog }));

    const heading = host.querySelector("h3.title");
    assert.notEqual(heading, null);
    assert.strictEqual(heading.textContent, "Current Selections");

    const tags = host.querySelectorAll("span.tag.is-medium.is-info");
    assert.strictEqual(tags.length, 2);

    assert.include(host.textContent, "Test Hat（Blue）");
    assert.include(host.textContent, "Winter Coat（Long）");

    const hatTag = [...host.querySelectorAll("span.tag.is-medium")].find((el) =>
      el.textContent.includes("Test Hat"),
    );
    assert.notEqual(hatTag, null);
    const hatTitle = hatTag.getAttribute("title");
    assert.include(hatTitle, "Licenses: CC0");
    assert.include(hatTitle, "Animations: Walk, Idle");

    assert.strictEqual(
      host.querySelectorAll("button.delete.is-small").length,
      2,
    );
  });

  it("uses warning styling when license filters exclude item credits", function () {
    seedBrowserCatalog({
      sel_gpl_item: {
        name: "GPL Asset",
        type_name: "misc",
        animations: ["walk"],
        credits: [{ file: "a.png", licenses: ["GPL 3.0"] }],
        layers: {},
      },
    });
    setEnabledLicenses(["CC0"]);

    state.selections = {
      misc: { itemId: "sel_gpl_item", name: "GPL Asset" },
    };

    m.render(host, m(CurrentSelections, { catalog: defaultCatalog }));

    const tag = host.querySelector("span.tag.is-medium.is-warning");
    assert.notEqual(tag, null);
    assert.include(tag.textContent, "⚠️");
    const title = tag.getAttribute("title");
    assert.include(title, "Incompatible");
    assert.include(title, "licenses");
  });

  it("uses warning styling when animation filters exclude item animations", function () {
    seedBrowserCatalog({
      sel_walk_only: {
        name: "Walk Only",
        type_name: "hat",
        animations: ["walk"],
        credits: [],
        layers: {},
      },
    });
    setEnabledAnimations(["run"]);

    state.selections = {
      hat: { itemId: "sel_walk_only", name: "Walk Only" },
    };

    m.render(host, m(CurrentSelections, { catalog: defaultCatalog }));

    const tag = host.querySelector("span.tag.is-medium.is-warning");
    assert.notEqual(tag, null);
    const title = tag.getAttribute("title");
    assert.include(title, "animations");
  });

  it("remove control deletes that selection and updates the view", function () {
    seedBrowserCatalog({
      sel_a: {
        name: "Item A",
        type_name: "hat",
        animations: ["walk"],
        credits: [],
        layers: {},
      },
    });

    state.selections = {
      only: { itemId: "sel_a", name: "Item A" },
    };

    m.render(host, m(CurrentSelections, { catalog: defaultCatalog }));

    const del = host.querySelector("button.delete.is-small");
    assert.notEqual(del, null);
    del.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    assert.deepEqual(state.selections, {});
    // `m.render` roots do not always redraw after inline handlers in tests; re-sync the tree.
    m.render(host, m(CurrentSelections, { catalog: defaultCatalog }));
    assert.include(host.textContent, "No items selected yet");
  });
});
