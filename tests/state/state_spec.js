import {
  applyMatchBodyColor,
  getSelectionGroup,
  getSubSelectionGroup,
  initState,
  resetAll,
  resetStateDeps,
  selectDefaults,
  selectItem,
  setStateDeps,
  state,
} from "../../sources/state/state.ts";
import { resetState } from "../../sources/state/hash.ts";
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("state/state.ts", () => {
  beforeEach(() => {
    resetStateDeps();
    resetState();
  });

  afterEach(() => {
    resetStateDeps();
    resetState();
  });

  describe("getSelectionGroup", () => {
    it("returns itemId when metadata is missing", () => {
      setStateDeps({
        getItemMetadata: () => undefined,
      });
      expect(getSelectionGroup("unknown")).to.equal("unknown");
    });

    it("returns itemId when metadata has no type_name", () => {
      setStateDeps({
        getItemMetadata: () => ({ name: "X" }),
      });
      expect(getSelectionGroup("id1")).to.equal("id1");
    });

    it("returns type_name from metadata", () => {
      setStateDeps({
        getItemMetadata: () => ({ type_name: "body", name: "Body" }),
      });
      expect(getSelectionGroup("body_item")).to.equal("body");
    });
  });

  describe("getSubSelectionGroup", () => {
    it("returns itemId when metadata is missing", () => {
      setStateDeps({
        getItemMetadata: () => undefined,
      });
      expect(getSubSelectionGroup("unknown", 0)).to.equal("unknown");
    });

    it("returns itemId when metadata has no type_name", () => {
      setStateDeps({
        getItemMetadata: () => ({ name: "X" }),
      });
      expect(getSubSelectionGroup("id1", 0)).to.equal("id1");
    });

    it("returns recolor type_name when present", () => {
      setStateDeps({
        getItemMetadata: () => ({
          type_name: "body",
          recolors: [{ type_name: "eyes", label: "Eyes" }],
        }),
      });
      expect(getSubSelectionGroup("item", 0)).to.equal("eyes");
    });

    it("falls back to meta.type_name when recolor has no type_name", () => {
      setStateDeps({
        getItemMetadata: () => ({
          type_name: "body",
          recolors: [{ label: "Sub" }],
        }),
      });
      expect(getSubSelectionGroup("item", 0)).to.equal("body");
    });
  });

  describe("selectDefaults", () => {
    function stubDefaultItemMetadata() {
      const metaById = {
        body: { type_name: "body", name: "Body" },
        heads_human_male: { type_name: "heads", name: "Human Male" },
        face_neutral: { type_name: "face", name: "Neutral" },
      };
      return {
        getItemMetadata: (id) => metaById[id],
        syncSelectionsToHash: sinon.stub(),
        renderCharacter: sinon.stub().resolves(),
        redraw: sinon.stub(),
      };
    }

    it("writes default selections for body, head, and expression", async () => {
      const deps = stubDefaultItemMetadata();
      setStateDeps(deps);
      state.selections = {};

      await selectDefaults();

      expect(state.selections).to.deep.equal({
        body: {
          itemId: "body",
          variant: "",
          recolor: "light",
          name: "Body color (light)",
        },
        heads: {
          itemId: "heads_human_male",
          variant: "",
          recolor: "light",
          name: "Human Male (light)",
        },
        face: {
          itemId: "face_neutral",
          variant: "",
          recolor: "light",
          name: "Neutral (light)",
        },
      });
      expect(deps.syncSelectionsToHash.calledOnce).to.be.true;
      expect(deps.renderCharacter.calledOnce).to.be.true;
      expect(deps.renderCharacter.firstCall.args[0]).to.equal(state.selections);
      expect(deps.renderCharacter.firstCall.args[1]).to.equal(state.bodyType);
      expect(deps.redraw.calledOnce).to.be.true;
    });

    it("uses itemId as selection keys when metadata is missing", async () => {
      setStateDeps({
        getItemMetadata: () => undefined,
        syncSelectionsToHash: sinon.stub(),
        renderCharacter: sinon.stub().resolves(),
        redraw: sinon.stub(),
      });
      state.selections = {};

      await selectDefaults();

      expect(state.selections).to.have.keys(
        "body",
        "heads_human_male",
        "face_neutral",
      );
      expect(state.selections.body.itemId).to.equal("body");
      expect(state.selections.heads_human_male.itemId).to.equal(
        "heads_human_male",
      );
      expect(state.selections.face_neutral.itemId).to.equal("face_neutral");
    });
  });

  describe("resetAll", () => {
    it("clears selections and custom image state, then calls selectDefaults and redraw", async () => {
      const selectDefaultsStub = sinon.stub().resolves();
      const redraw = sinon.stub();
      setStateDeps({ selectDefaults: selectDefaultsStub, redraw });
      state.selections = { body: { itemId: "x" } };
      state.customUploadedImage = {};
      state.customImageZPos = 7;

      await resetAll();

      expect(state.selections).to.deep.equal({});
      expect(state.customUploadedImage).to.be.null;
      expect(state.customImageZPos).to.equal(0);
      expect(selectDefaultsStub.calledOnce).to.be.true;
      expect(redraw.calledOnce).to.be.true;
    });

    it("restores default selections when using real selectDefaults", async () => {
      const deps = {
        getItemMetadata: (id) =>
          ({
            body: { type_name: "body", name: "Body" },
            heads_human_male: { type_name: "heads", name: "Human Male" },
            face_neutral: { type_name: "face", name: "Neutral" },
          })[id],
        syncSelectionsToHash: sinon.stub(),
        renderCharacter: sinon.stub().resolves(),
        redraw: sinon.stub(),
      };
      setStateDeps(deps);
      state.selections = { waist: { itemId: "w" } };
      state.customUploadedImage = { fake: true };
      state.customImageZPos = 3;

      await resetAll();

      expect(state.selections.body.itemId).to.equal("body");
      expect(state.selections.heads.itemId).to.equal("heads_human_male");
      expect(state.selections.face.itemId).to.equal("face_neutral");
      expect(state.customUploadedImage).to.be.null;
      expect(state.customImageZPos).to.equal(0);
      expect(deps.syncSelectionsToHash.calledOnce).to.be.true;
      expect(deps.renderCharacter.calledOnce).to.be.true;
      expect(deps.redraw.callCount).to.equal(2);
    });
  });

  describe("initState", () => {
    it("calls selectDefaults when loadSelectionsFromHash leaves selections empty", async () => {
      const selectDefaultsStub = sinon.stub().resolves();
      setStateDeps({
        loadSelectionsFromHash: sinon.stub(),
        selectDefaults: selectDefaultsStub,
        renderCharacter: sinon.stub().resolves(),
        redraw: sinon.stub(),
      });
      state.selections = {};

      await initState();

      expect(selectDefaultsStub.calledOnce).to.be.true;
    });

    it("renders when hash produced selections and canvas renderer exists", async () => {
      const selectDefaultsStub = sinon.stub().resolves();
      const renderCharacter = sinon.stub().resolves();
      const redraw = sinon.stub();
      setStateDeps({
        loadSelectionsFromHash: sinon.stub().callsFake(() => {
          state.selections = { body: { itemId: "b" } };
        }),
        selectDefaults: selectDefaultsStub,
        getCanvasRenderer: () => ({}),
        renderCharacter,
        redraw,
      });

      await initState();

      expect(selectDefaultsStub.called).to.be.false;
      expect(renderCharacter.calledOnce).to.be.true;
      expect(redraw.calledOnce).to.be.true;
    });

    it("skips render when canvas renderer is missing", async () => {
      const renderCharacter = sinon.stub().resolves();
      const redraw = sinon.stub();
      setStateDeps({
        loadSelectionsFromHash: sinon.stub().callsFake(() => {
          state.selections = { body: { itemId: "b" } };
        }),
        selectDefaults: sinon.stub().resolves(),
        getCanvasRenderer: () => undefined,
        renderCharacter,
        redraw,
      });

      await initState();

      expect(renderCharacter.called).to.be.false;
      expect(redraw.called).to.be.false;
    });
  });

  describe("applyMatchBodyColor", () => {
    afterEach(() => {
      state.matchBodyColorEnabled = true;
    });

    it("does nothing when matchBodyColorEnabled is false", () => {
      state.matchBodyColorEnabled = false;
      state.selections = {
        body: {
          itemId: "shirt",
          variant: "old",
          name: "Shirt (old)",
        },
      };
      setStateDeps({
        getItemMetadata: () => ({
          name: "Shirt",
          matchBodyColor: true,
          variants: ["new"],
        }),
      });

      applyMatchBodyColor("new", null);

      expect(state.selections.body.variant).to.equal("old");
    });

    it("does nothing when both variant and recolor are missing", () => {
      state.matchBodyColorEnabled = true;
      state.selections = {
        body: { itemId: "shirt", variant: "old", name: "Shirt (old)" },
      };
      setStateDeps({
        getItemMetadata: () => ({
          name: "Shirt",
          matchBodyColor: true,
          variants: ["new"],
        }),
      });

      applyMatchBodyColor(null, null);
      applyMatchBodyColor("", "");

      expect(state.selections.body.variant).to.equal("old");
    });

    it("skips items without matchBodyColor on metadata", () => {
      state.matchBodyColorEnabled = true;
      state.selections = {
        body: { itemId: "shirt", variant: "old", name: "Shirt (old)" },
      };
      setStateDeps({
        getItemMetadata: () => ({
          name: "Shirt",
          variants: ["new"],
        }),
      });

      applyMatchBodyColor("new", null);

      expect(state.selections.body.variant).to.equal("old");
    });

    it("updates variant when metadata has matchBodyColor and the variant exists", () => {
      state.matchBodyColorEnabled = true;
      state.selections = {
        body: {
          itemId: "shirt",
          variant: "old",
          name: "Shirt (old)",
        },
      };
      setStateDeps({
        getItemMetadata: () => ({
          name: "Shirt",
          matchBodyColor: true,
          variants: ["old", "new"],
        }),
      });

      applyMatchBodyColor("new", null);

      expect(state.selections.body.variant).to.equal("new");
      expect(state.selections.body.name).to.equal("Shirt (new)");
    });

    it("updates recolor when metadata has matchBodyColor and recolors[0] includes the recolor", () => {
      state.matchBodyColorEnabled = true;
      state.selections = {
        body: {
          itemId: "body",
          recolor: "dark",
          name: "Body (dark)",
        },
      };
      setStateDeps({
        getItemMetadata: () => ({
          name: "Body",
          matchBodyColor: true,
          recolors: [{ variants: ["light", "dark"] }],
        }),
      });

      applyMatchBodyColor(null, "light");

      expect(state.selections.body.recolor).to.equal("light");
      expect(state.selections.body.name).to.equal("Body (light)");
    });

    it("skips a sub-selection when that recolor slot has matchBodyColor false", () => {
      state.matchBodyColorEnabled = true;
      state.selections = {
        eyes: {
          itemId: "multi",
          subId: 0,
          recolor: "red",
          name: "Eyes (red)",
        },
      };
      setStateDeps({
        getItemMetadata: () => ({
          name: "Face",
          matchBodyColor: true,
          recolors: [{ matchBodyColor: false, variants: ["blue", "red"] }],
        }),
      });

      applyMatchBodyColor(null, "blue");

      expect(state.selections.eyes.recolor).to.equal("red");
    });

    it("updates multiple matching selections", () => {
      state.matchBodyColorEnabled = true;
      state.selections = {
        a: {
          itemId: "shirt_a",
          variant: "x",
          name: "A (x)",
        },
        b: {
          itemId: "shirt_b",
          variant: "x",
          name: "B (x)",
        },
      };
      setStateDeps({
        getItemMetadata: (id) =>
          id === "shirt_a" || id === "shirt_b"
            ? {
                name: "Shirt",
                matchBodyColor: true,
                variants: ["x", "y"],
              }
            : undefined,
      });

      applyMatchBodyColor("y", null);

      expect(state.selections.a.variant).to.equal("y");
      expect(state.selections.b.variant).to.equal("y");
    });
  });

  describe("selectItem", () => {
    it("removes the selection when isSelected is true", () => {
      setStateDeps({
        getItemMetadata: () => ({
          type_name: "body",
          name: "Body",
          variants: ["light"],
        }),
      });
      state.selections.body = {
        itemId: "body_item",
        variant: "light",
        name: "Body (light)",
      };

      selectItem("body_item", "light", true);

      expect(state.selections.body).to.be.undefined;
    });

    it("stores a variant selection when the item uses variants", () => {
      setStateDeps({
        getItemMetadata: () => ({
          type_name: "body",
          name: "Body",
          variants: ["light", "dark"],
        }),
      });
      state.selections = {};

      selectItem("body_1", "dark", false);

      expect(state.selections.body).to.deep.equal({
        itemId: "body_1",
        subId: null,
        variant: "dark",
        recolor: null,
        name: "Body (dark)",
      });
    });

    it("stores a recolor selection for a recolor sub-layer", () => {
      setStateDeps({
        getItemMetadata: () => ({
          type_name: "body",
          name: "Body",
          recolors: [
            {
              type_name: "eyes",
              label: "Eyes",
              variants: ["blue"],
            },
          ],
        }),
      });
      state.selections = {};

      selectItem("item_multi", "blue", false, 0);

      expect(state.selections.eyes).to.deep.equal({
        itemId: "item_multi",
        subId: 0,
        variant: null,
        recolor: "blue",
        name: "Eyes (blue)",
      });
    });

    it("selects the parent item with current main color when sub-color is chosen first", () => {
      setStateDeps({
        getItemMetadata: () => ({
          type_name: "hair",
          name: "Long Tied Hair",
          recolors: [
            {
              label: "Hair",
              variants: ["walnut", "blonde"],
            },
            {
              type_name: "hair_tie",
              label: "Hair Tie",
              variants: ["teal", "walnut"],
            },
          ],
        }),
      });

      state.selections = {
        hair: {
          itemId: "other_hair",
          subId: null,
          variant: null,
          recolor: "walnut",
          name: "Other Hair (walnut)",
        },
      };

      selectItem("item_multi", "teal", false, 1);

      expect(state.selections.hair).to.deep.equal({
        itemId: "item_multi",
        subId: null,
        variant: null,
        recolor: "walnut",
        name: "Long Tied Hair (walnut)",
      });
      expect(state.selections.hair_tie).to.deep.equal({
        itemId: "item_multi",
        subId: 1,
        variant: null,
        recolor: "teal",
        name: "Hair Tie (teal)",
      });
    });
  });
});
