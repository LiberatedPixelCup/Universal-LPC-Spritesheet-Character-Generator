import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { resetCatalogForTests } from "../../sources/state/catalog.ts";
import { getItemLite } from "../../sources/state/catalog.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../browser-catalog-fixture.js";
import { state } from "../../sources/state/state.ts";
import {
  getMultiRecolors,
  getPaletteOptions,
} from "../../sources/state/palettes.ts";

describe("state/palettes.ts", () => {
  let previousSelections;
  let previousMatchBodyColorEnabled;

  beforeEach(() => {
    previousSelections = state.selections;
    previousMatchBodyColorEnabled = state.matchBodyColorEnabled;
    state.matchBodyColorEnabled = true;
    resetCatalogForTests();

    const paletteMetadata = {
      materials: {
        body: {
          default: "ulpc",
          base: "light",
          palettes: {
            ulpc: {
              light: ["#271920", "#99423c", "#cc8665", "#E4A47C"],
              bronze: ["#1A1213", "#442725", "#644133", "#7F4C31"],
            },
          },
        },
        cloth: {
          default: "ulpc",
          base: "base",
          palettes: {
            ulpc: {
              red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
              bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
            },
          },
        },
        metal: {
          default: "ulpc",
          base: "base",
          palettes: {
            ulpc: {
              brass: ["#1A1213", "#61482C", "#836332", "#AF8A35"],
              steel: ["#1D131E", "#4D4A5D", "#726B7E", "#867E7F"],
            },
          },
        },
        eye: {
          default: "ulpc",
          base: "blue",
          palettes: {
            ulpc: {
              blue: ["#2a3c49", "#5686ae", "#57cee4"],
              green: ["#2b4b29", "#53b351", "#84ec50"],
            },
            lpcr: {
              black: ["#18506f", "#52414b", "#818e97"],
            },
          },
        },
        all: {
          default: "lpcr",
          base: "white",
          palettes: {
            lpcr: {
              red: ["#1a1213", "#3e111a", "#591515", "#7b2008"],
            },
          },
        },
      },
    };

    const testItemMetadata = {
      body: {
        name: "Body",
        type_name: "body",
        matchBodyColor: true,
        recolors: [
          {
            label: "Body",
            type_name: null,
            material: "body",
            default: "ulpc",
            base: "ulpc.base",
            palettes: {
              ulpc: {
                light: ["#271920", "#99423c", "#cc8665", "#E4A47C"],
                bronze: ["#1A1213", "#442725", "#644133", "#7F4C31"],
              },
            },
            variants: ["light", "bronze"],
          },
        ],
      },
      heads_human_male: {
        name: "Human Male",
        type_name: "head",
        matchBodyColor: true,
        recolors: [
          {
            label: "Head",
            type_name: null,
            material: "body",
            default: "ulpc",
            base: "ulpc.base",
            palettes: {
              ulpc: {
                light: ["#271920", "#99423c", "#cc8665", "#E4A47C"],
                bronze: ["#1A1213", "#442725", "#644133", "#7F4C31"],
              },
            },
            variants: ["light", "bronze"],
          },
          {
            type_name: "eyes",
            label: "Eye Color",
            material: "eye",
            palettes: {
              ulpc: {
                blue: ["#2a3c49", "#5686ae", "#57cee4"],
                green: ["#2b4b29", "#53b351", "#84ec50"],
              },
              lpcr: {
                black: ["#18506f", "#52414b", "#818e97"],
              },
            },
            default: "ulpc",
            base: "ulpc.blue",
            variants: ["blue", "green", "lpcr.black"],
          },
        ],
      },
      head_ears_elven: {
        name: "Elven ears",
        type_name: "ears",
        matchBodyColor: true,
        recolors: [
          {
            label: "Body",
            type_name: null,
            material: "body",
            default: "ulpc",
            base: "ulpc.base",
            palettes: {
              ulpc: {
                light: ["#271920", "#99423c", "#cc8665", "#E4A47C"],
                bronze: ["#1A1213", "#442725", "#644133", "#7F4C31"],
              },
            },
            variants: ["light", "bronze"],
          },
        ],
      },
      torso_clothes_longsleeve2_polo: {
        name: "Longsleeve Polo",
        type_name: "clothes",
        matchBodyColor: false,
        recolors: [
          {
            label: "Cloth",
            type_name: null,
            material: "cloth",
            default: "ulpc",
            base: "ulpc.base",
            palettes: {
              ulpc: {
                red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
                bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
              },
            },
            variants: ["red", "bluegray", "metal.brass"],
          },
        ],
      },
      torso_clothes_shortsleeve: {
        name: "Shortsleeve",
        type_name: "clothes",
        matchBodyColor: false,
        recolors: [
          {
            label: "Cloth",
            type_name: null,
            material: "cloth",
            default: "ulpc",
            base: "ulpc.base",
            palettes: {
              ulpc: {
                red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
                bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
              },
            },
            variants: ["red", "bluegray"],
          },
        ],
      },
      shoulders_epaulets: {
        name: "Epaulets",
        type_name: "shoulders",
        matchBodyColor: false,
        recolors: [
          {
            label: "Cloth",
            type_name: null,
            material: "cloth",
            variants: ["red", "bluegray", "metal.brass"],
          },
        ],
      },
      shoulders_legion: {
        name: "Legion",
        type_name: "shoulders",
        matchBodyColor: false,
        recolors: [
          {
            label: "Metal",
            type_name: null,
            material: "metal",
            variants: ["brass", "steel", "all.lpcr.red"],
          },
        ],
      },
      hair_long_tied_test: {
        name: "Long tied",
        type_name: "hair",
        matchBodyColor: false,
        recolors: [
          {
            label: "Hair",
            type_name: null,
            material: "cloth",
            default: "ulpc",
            base: "ulpc.red",
            palettes: {
              ulpc: {
                red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
                bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
              },
            },
            variants: ["red", "bluegray"],
          },
          {
            label: "Hair Tie",
            type_name: "hair_tie",
            material: "cloth",
            default: "ulpc",
            base: null,
            source: [
              "#1d131e",
              "#54242E",
              "#6C3536",
              "#8c288b",
              "#b75ea5",
              "#d27abc",
            ],
            palettes: {
              ulpc: {
                red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
                bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
              },
            },
            variants: ["red", "bluegray"],
          },
        ],
      },
    };

    seedBrowserCatalog(testItemMetadata, { paletteMetadata });
    state.selections = {};
  });

  afterEach(async () => {
    state.selections = previousSelections;
    state.matchBodyColorEnabled = previousMatchBodyColorEnabled;
    await restoreAppCatalogAfterTest();
  });

  it("falls back to a matching dotted recolor when the exact recolor is missing", () => {
    state.selections = {
      clothes: {
        itemId: "torso_clothes_shortsleeve",
        recolor: "red",
      },
    };

    const recolors = getMultiRecolors(
      "torso_clothes_shortsleeve",
      state.selections,
    );

    expect(recolors).to.deep.equal({ clothes: "red" });
  });

  it("omits recolor keys when no matching fallback exists", () => {
    state.selections = {
      clothes: {
        itemId: "torso_clothes_shortsleeve",
        recolor: "green",
      },
    };

    const recolors = getMultiRecolors(
      "torso_clothes_shortsleeve",
      state.selections,
    );

    expect(recolors).to.equal(null);
  });

  it("uses matchBodyColor in getPaletteOptions for head assets", () => {
    state.selections = {
      body: {
        itemId: "body",
        recolor: "bronze",
      },
    };

    const [paletteOptions, selectedColors] = getPaletteOptions(
      "head_ears_elven",
      getItemLite("head_ears_elven").unwrapOr(null),
    );

    expect(selectedColors).to.deep.equal({ ears: "bronze" });
    expect(paletteOptions).to.have.lengthOf(1);
    expect(paletteOptions[0].selectionColor).to.equal("bronze");
    expect(paletteOptions[0].colors).to.deep.equal([
      "#1A1213",
      "#442725",
      "#644133",
      "#7F4C31",
    ]);
  });

  it("defaults source-backed recolors to source in getPaletteOptions", () => {
    const [paletteOptions, selectedColors] = getPaletteOptions(
      "hair_long_tied_test",
      getItemLite("hair_long_tied_test").unwrapOr(null),
    );

    expect(selectedColors).to.deep.equal({});
    expect(paletteOptions[1].selectionColor).to.equal(null);
    expect(paletteOptions[1].colors).to.deep.equal([
      "#1d131e",
      "#54242E",
      "#6C3536",
      "#8c288b",
      "#b75ea5",
      "#d27abc",
    ]);
  });

  it("returns head and eye recolors for the same head asset", () => {
    state.selections = {
      head: {
        itemId: "heads_human_male",
        recolor: "light",
      },
      eyes: {
        itemId: "heads_human_male",
        subId: 1,
        recolor: "green",
      },
    };

    const recolors = getMultiRecolors("heads_human_male", state.selections);

    expect(recolors).to.deep.equal({ head: "light", eyes: "green" });
  });

  it("keeps eye recolor while matchBodyColor overrides head recolor", () => {
    state.selections = {
      body: {
        itemId: "body",
        recolor: "bronze",
      },
      head: {
        itemId: "heads_human_male",
        recolor: "light",
      },
      eyes: {
        itemId: "heads_human_male",
        subId: 1,
        recolor: "lpcr.black",
      },
    };

    const recolors = getMultiRecolors("heads_human_male", state.selections);

    expect(recolors).to.deep.equal({ head: "bronze", eyes: "lpcr.black" });
  });

  it("does not force body recolor when matchBodyColorEnabled is false", () => {
    state.matchBodyColorEnabled = false;
    state.selections = {
      body: {
        itemId: "body",
        recolor: "bronze",
      },
      head: {
        itemId: "heads_human_male",
        recolor: "light",
      },
      eyes: {
        itemId: "heads_human_male",
        subId: 1,
        recolor: "lpcr.black",
      },
    };

    const recolors = getMultiRecolors("heads_human_male", state.selections);

    expect(recolors).to.deep.equal({ head: "light", eyes: "lpcr.black" });
  });

  it("removes one color if a color doesn't exist", () => {
    state.selections = {
      head: {
        itemId: "heads_human_male",
        recolor: "bronze",
      },
      eyes: {
        itemId: "heads_human_male",
        subId: 1,
        recolor: "purple",
      },
    };

    const recolors = getMultiRecolors("heads_human_male", state.selections);

    expect(recolors).to.deep.equal({ head: "bronze" });
  });

  it("falls back across same-type assets when querying the other itemId", () => {
    state.selections = {
      shoulders: {
        itemId: "shoulders_epaulets",
        recolor: "red",
      },
    };

    const recolors = getMultiRecolors("shoulders_legion", state.selections);

    expect(recolors).to.deep.equal({ shoulders: "all.lpcr.red" });
  });

  it("if on deeper asset, but secondary asset uses that as main set of colors, fall back to main set of colors", () => {
    state.selections = {
      shoulders: {
        itemId: "shoulders_epaulets",
        recolor: "metal.brass",
      },
    };

    const recolors = getMultiRecolors("shoulders_legion", state.selections);

    expect(recolors).to.deep.equal({ shoulders: "brass" });
  });

  it("removes missing same-type recolor when no valid fallback exists", () => {
    state.selections = {
      body: {
        itemId: "body",
        recolor: "bronze",
      },
      head: {
        itemId: "heads_human_male",
        recolor: "bronze",
      },
      shoulders: {
        itemId: "shoulders_legion",
        recolor: "steel",
      },
    };

    const recolors = getMultiRecolors("shoulders_epaulets", state.selections);

    expect(recolors).to.equal(null);
  });
});
