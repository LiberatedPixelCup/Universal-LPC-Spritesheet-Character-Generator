import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import sinon from "sinon";
import { CategoryTree as CategoryTreeComponent } from "../../../sources/components/tree/CategoryTree.ts";
import { categoryTreeModelFactory } from "../../../sources/models/category-tree.ts";
import {
  configureStateCatalog,
  createState,
} from "../../../sources/state/state.ts";
let state;
import { createCatalog } from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import { seedCatalog } from "../../browser-catalog-fixture.js";

const CategoryTree = {
  view: (vnode) =>
    m(CategoryTreeComponent, {
      createModel: () =>
        categoryTreeModelFactory.create(vnode.attrs.catalog, vnode.attrs.state),
      headerContent: vnode.attrs.headerContent,
    }),
};

describe("CategoryTree", function () {
  let host;
  let catalog;
  let catalogWriter;
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    configureStateCatalog(catalog);
    state = createState();
    state.expandedNodes = {};
    state.searchQuery = "";
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(function () {
    m.render(host, null);
    sandbox.restore();
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  });

  it("shows loading panel until the category index is ready", function () {
    m.render(host, m(CategoryTree, { catalog, state }));

    assert.ok(host.querySelector(".category-tree-loading-overlay"));
    assert.strictEqual(
      host
        .querySelector(".category-tree-loading-overlay")
        .getAttribute("aria-busy"),
      "true",
    );
    assert.include(host.textContent, "Available Items");
    assert.include(host.textContent, "Loading category index…");
    assert.strictEqual(host.querySelector("button"), null);
  });

  it("remembers the first category's scroll position after loading and search", async function () {
    const shortDesktop = Object.assign(new EventTarget(), { matches: false });
    const media = sandbox.stub(window, "matchMedia").callThrough();
    media
      .withArgs("(min-width: 1100px)")
      .returns(Object.assign(new EventTarget(), { matches: true }));
    media.withArgs("(max-height: 480px)").returns(shortDesktop);
    const viewportHeight = sandbox.stub(window, "innerHeight").value(481);
    const render = () =>
      m.render(
        host,
        m(CategoryTree, {
          catalog,
          state,
          headerContent: m("input[type=search]", {
            value: state.searchQuery,
            oninput: (event) => {
              state.searchQuery = event.target.value;
            },
          }),
        }),
      );
    render();
    assert.isNull(host.querySelector(".lpc-tree-scroll-container"));

    seedCatalog(catalogWriter, {});
    render();
    const list = host.querySelector(".lpc-tree-scroll-container");
    list.style.height = "40px";
    list.style.overflowY = "auto";
    list.firstElementChild.style.minHeight = "240px";
    list.scrollTop = 120;
    assert.strictEqual(list.scrollTop, 120);

    state.selectedCategory = "all";
    render();
    assert.strictEqual(list.scrollTop, 0);

    state.selectedCategory = "body";
    render();
    assert.strictEqual(list.scrollTop, 120);

    const search = host.querySelector("input[type=search]");
    const input = (value) => {
      search.dispatchEvent(new Event("beforeinput", { bubbles: true }));
      // Mirrors the browser scrolling the search caret into view while typing.
      list.scrollTop = 25;
      search.value = value;
      search.dispatchEvent(new Event("input", { bubbles: true }));
      list.dispatchEvent(new Event("scroll"));
      render();
    };
    input("a");
    assert.strictEqual(list.scrollTop, 25);
    input("arm");
    assert.strictEqual(list.scrollTop, 0);
    list.scrollTop = 160;
    list.dispatchEvent(new Event("scroll"));

    input("a");
    assert.strictEqual(list.scrollTop, 120);
    input("arm");
    assert.strictEqual(list.scrollTop, 0);
    input("");
    assert.strictEqual(list.scrollTop, 120);

    const switchCategory = (restored) => {
      state.searchQuery = "";
      state.selectedCategory = "all";
      render();
      assert.strictEqual(list.scrollTop, 0);
      state.selectedCategory = "body";
      render();
      assert.strictEqual(list.scrollTop, restored);
    };
    const scroll = (offset) => {
      list.scrollTop = offset;
      list.dispatchEvent(new Event("scroll"));
    };
    const wheel = (deltaY = 10) =>
      list.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY }));

    input("a");
    switchCategory(120);

    input("a");
    wheel();
    scroll(25);
    switchCategory(120);

    input("a");
    wheel();
    scroll(160);
    scroll(25);
    switchCategory(25);

    list.scrollTop = 120;
    input("a");
    wheel();
    scroll(160);
    search.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    scroll(25);
    shortDesktop.matches = true;
    shortDesktop.dispatchEvent(new Event("change"));
    shortDesktop.matches = false;
    shortDesktop.dispatchEvent(new Event("change"));
    assert.strictEqual(list.scrollTop, 160);
    scroll(25);
    switchCategory(160);

    list.scrollTop = 120;
    input("arm");
    input("a");
    wheel();
    scroll(160);
    switchCategory(120);

    input("a");
    wheel();
    scroll(160);
    input("");
    assert.strictEqual(list.scrollTop, 160);

    input("a");
    wheel();
    scroll(120);
    viewportHeight.value(950);
    list.style.height = "280px";
    scroll(0);
    window.dispatchEvent(new Event("resize"));
    assert.strictEqual(list.scrollTop, 0);
    input("");
    assert.strictEqual(list.scrollTop, 0);
    viewportHeight.value(481);
    list.style.height = "40px";
    window.dispatchEvent(new Event("resize"));
    assert.strictEqual(list.scrollTop, 120);

    const waitForLayout = () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    const setMaxScroll = (max) => {
      list.style.height = `${list.scrollHeight - max}px`;
      assert.strictEqual(list.scrollHeight - list.clientHeight, max);
    };
    list.firstElementChild.style.minHeight = "360px";
    for (const userScroll of [false, true]) {
      list.style.height = "40px";
      input("a");
      wheel();
      scroll(220);
      setMaxScroll(131);
      input("");
      await waitForLayout();
      assert.strictEqual(list.scrollTop, 131);

      // Shrink the scroll range without a viewport or a user-scroll event.
      setMaxScroll(80);
      assert.strictEqual(list.scrollTop, 80);
      await waitForLayout();
      if (userScroll) {
        wheel(-20);
        scroll(60);
      }

      list.style.height = "40px";
      switchCategory(userScroll ? 60 : 220);
      await waitForLayout();
    }

    const setupPendingScroll = async () => {
      list.style.height = "40px";
      list.firstElementChild.style.minHeight = "360px";
      state.searchQuery = "";
      state.selectedCategory = "body";
      render();
      await waitForLayout();
      input("a");
      wheel();
      scroll(220);
      assert.strictEqual(list.scrollTop, 220);
      setMaxScroll(131);
      input("");
      await waitForLayout();
      assert.strictEqual(list.scrollTop, 131);
      setMaxScroll(80);
      assert.strictEqual(list.scrollTop, 80);
      await waitForLayout();
    };

    await setupPendingScroll();
    setMaxScroll(131);
    render();
    assert.strictEqual(list.scrollTop, 80);
    setMaxScroll(220);
    render();
    assert.strictEqual(list.scrollTop, 220);
    await waitForLayout();
    wheel(-160);
    scroll(60);
    await waitForLayout();
    setMaxScroll(260);
    render();
    assert.strictEqual(list.scrollTop, 60);
    switchCategory(60);
    await waitForLayout();

    await setupPendingScroll();
    wheel(-20);
    scroll(60);
    await waitForLayout();
    setMaxScroll(220);
    render();
    assert.strictEqual(list.scrollTop, 60);
    switchCategory(60);
    await waitForLayout();
  });

  it("disables Expand Selected while the item list (lite) is not ready", function () {
    catalogWriter.registerIndexMetadata({
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes: {
        byTypeName: {},
        hashMatch: { itemsByTypeName: {} },
      },
    });
    catalogWriter.registerPaletteMetadata({ versions: {}, materials: {} });

    m.render(host, m(CategoryTree, { catalog, state }));

    const expandBtn = [...host.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Expand Selected",
    );
    assert.notEqual(expandBtn, null);
    assert.isTrue(expandBtn.disabled);
    assert.strictEqual(expandBtn.getAttribute("title"), "Loading item list…");
  });

  it("renders toolbar, match-body-color control, body selector, and category items", function () {
    seedCatalog(
      catalogWriter,
      {
        ct_hat_1: {
          name: "Category Tree Hat",
          type_name: "hat",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
          path: ["Gear"],
        },
      },
      {
        categoryTree: {
          items: [],
          children: {
            Gear: { items: ["ct_hat_1"], children: {} },
          },
        },
      },
    );
    state.expandedNodes.Gear = true;

    m.render(host, m(CategoryTree, { catalog, state }));

    assert.strictEqual(
      host.querySelector("h3.title")?.textContent?.trim(),
      "Available Items",
    );

    const labels = [...host.querySelectorAll("button")].map((b) =>
      b.textContent.trim(),
    );
    assert.includeMembers(labels, [
      "Reset all",
      "Collapse All",
      "Expand Selected",
      "Compact Display",
    ]);

    const expandSelected = [...host.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Expand Selected",
    );
    assert.isFalse(expandSelected.disabled);

    const matchCb = host.querySelector("#match-body-color-checkbox");
    assert.notEqual(matchCb, null);
    assert.strictEqual(
      matchCb.getAttribute("aria-describedby"),
      "match-body-color-label",
    );
    assert.include(host.textContent, "Match body color");

    assert.ok(
      [...host.querySelectorAll(".tree-label")].some((el) =>
        el.textContent.includes("Gear"),
      ),
    );
    assert.ok(
      [...host.querySelectorAll(".tree-node")].some((el) =>
        el.textContent.includes("Category Tree Hat"),
      ),
    );
  });

  it("Expand Selected expands paths for the current selection", function () {
    seedCatalog(
      catalogWriter,
      {
        ct_hat_1: {
          name: "Category Tree Hat",
          type_name: "hat",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
          path: ["Gear"],
        },
      },
      {
        categoryTree: {
          items: [],
          children: {
            Gear: { items: ["ct_hat_1"], children: {} },
          },
        },
      },
    );
    state.selections.hat = {
      itemId: "ct_hat_1",
      name: "Category Tree Hat",
    };
    state.expandedNodes = {};

    m.render(host, m(CategoryTree, { catalog, state }));

    const expandBtn = [...host.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Expand Selected",
    );
    expandBtn.click();

    assert.isTrue(state.expandedNodes.Gear);
    assert.isTrue(state.expandedNodes.ct_hat_1);
  });

  it("Collapse All clears expanded nodes", function () {
    seedCatalog(
      catalogWriter,
      {
        ct_hat_1: {
          name: "Category Tree Hat",
          type_name: "hat",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
          path: ["Gear"],
        },
      },
      {
        categoryTree: {
          items: [],
          children: {
            Gear: { items: ["ct_hat_1"], children: {} },
          },
        },
      },
    );
    state.expandedNodes = { Gear: true };

    m.render(host, m(CategoryTree, { catalog, state }));

    const collapseBtn = [...host.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Collapse All",
    );
    collapseBtn.click();

    assert.deepEqual(state.expandedNodes, {});
  });
});
