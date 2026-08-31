import { SearchControl } from "../../../sources/components/filters/SearchControl.ts";
import { searchControlModelFactory } from "../../../sources/models/search-control.ts";
import { createCatalog } from "../../../sources/state/catalog.ts";
import { createState } from "../../../sources/state/state.ts";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("SearchControl", function () {
  let host;

  beforeEach(function () {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(function () {
    m.render(host, null);
    host.remove();
  });

  it("renders the supplied value and invokes its command", function () {
    let changedTo;
    m.render(
      host,
      m(SearchControl, {
        createModel: () => ({
          value: "hat",
          disabled: false,
          setValue(value) {
            changedTo = value;
          },
        }),
      }),
    );

    const input = host.querySelector("input[type=search]");
    assert.strictEqual(input.value, "hat");
    input.value = "helmet";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    assert.strictEqual(changedTo, "helmet");
  });

  it("renders the loading state", function () {
    m.render(
      host,
      m(SearchControl, {
        createModel: () => ({
          value: "",
          disabled: true,
          title: "Loading item list…",
          setValue() {},
        }),
      }),
    );

    const input = host.querySelector("input");
    assert.isTrue(input.disabled);
    assert.strictEqual(input.title, "Loading item list…");
  });

  it("creates a live search command from catalog and state", function () {
    const { reader: catalog, writer } = createCatalog();
    const state = createState();
    const loadingModel = searchControlModelFactory.create(catalog, state);
    assert.isTrue(loadingModel.disabled);

    loadingModel.setValue("armor");
    assert.strictEqual(state.searchQuery, "armor");

    writer.registerItemMetadata({ items: {} });
    const readyModel = searchControlModelFactory.create(catalog, state);
    assert.isFalse(readyModel.disabled);
    assert.strictEqual(readyModel.value, "armor");
    assert.isUndefined(readyModel.title);
  });
});
