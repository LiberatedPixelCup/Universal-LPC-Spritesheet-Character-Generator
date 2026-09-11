import m from "mithril";
import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha-globals";
import { TreeNode } from "../../../sources/components/tree/TreeNode.ts";
import {
  categoryTreeModelFactory,
  treeNodeModelFactory,
} from "../../../sources/models/category-tree.ts";
import type { TreeNodeModel } from "../../../sources/models/category-tree.ts";
import {
  createCatalog,
  type CatalogReader,
} from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import { createState } from "../../../sources/state/state.ts";

describe("Tree models", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(() => {
    m.render(host, null);
    host.remove();
  });

  it("creates the body type options and updates the selected body type", () => {
    const { reader, writer } = createCatalog();
    writer.registerIndexMetadata({
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes: {
        byTypeName: {},
        hashMatch: { itemsByTypeName: {} },
      },
    });
    const state = createState();
    const model = categoryTreeModelFactory.create(reader, state);

    if (model.isLoading) throw new Error("category tree should be ready");
    expect(model.bodyTypes.options).to.deep.equal(
      BODY_TYPES.map((value) => ({
        value,
        label: value[0].toUpperCase() + value.slice(1),
      })),
    );

    model.bodyTypes.select("female");

    expect(state.bodyType).to.equal("female");
  });

  it("does not resolve item metadata for a collapsed node", () => {
    const catalog = {
      isLiteReady: () => true,
      getItemLite: () => {
        throw new Error("collapsed items must stay lazy");
      },
    } as unknown as CatalogReader;
    const model = treeNodeModelFactory.create(catalog, createState(), "gear", {
      items: ["unused"],
      children: {},
    });

    expect(model).to.not.equal(null);
    expect(model?.items).to.deep.equal([]);
  });

  it("does not invoke child providers while the parent is collapsed", () => {
    let calls = 0;
    const model: TreeNodeModel = {
      name: "Gear",
      isCompatible: true,
      isExpanded: false,
      children: [
        {
          key: "child",
          createModel: () => {
            calls += 1;
            return null;
          },
        },
      ],
      items: [],
      toggle() {},
    };
    m.render(
      host,
      m(TreeNode, {
        createModel: () => model,
      }),
    );

    expect(calls).to.equal(0);
  });
});
