/**
 * Locks per-composite render work (drawCalls, sheet size, image lookups)
 * on a seeded catalog. Expected counts come from the fixtures plus
 * constants.ts — not production outfit goldens.
 */
import m from "mithril";
import { expect } from "chai";
import sinon, { type SinonSandbox } from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  initCanvas,
  renderCharacter,
  resetOffscreenCanvasStateForTests,
  resetRenderCharacterQueueForTests,
  SHEET_HEIGHT,
  SHEET_WIDTH,
} from "../../sources/canvas/renderer.ts";
import { resetImageLoadCache } from "../../sources/canvas/load-image.ts";
import { clearRecolorCache } from "../../sources/canvas/palette-recolor.ts";
import { resetSharedWebGLForTests } from "../../sources/canvas/webgl-palette-recolor.ts";
import {
  createCatalog,
  type CatalogReader,
  type CatalogWriter,
} from "../../sources/state/catalog.ts";
import {
  createState,
  type Selections,
  type State,
} from "../../sources/state/state.ts";
import {
  ANIMATION_CONFIGS,
  ANIMATION_OFFSETS,
  FRAME_SIZE,
  STANDARD_ANIMATION_FRAMES_PER_ROW,
} from "../../sources/state/constants.ts";
import {
  PerformanceProfiler,
  type RenderCharacterCounters,
} from "../../sources/performance-profiler.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";

const BODY_PATH = "body/bodies/male/";

const OFFSET_COUNT = Object.keys(ANIMATION_OFFSETS).length;

const LAST_STANDARD_BAND = ANIMATION_CONFIGS["1h_halfslash"];
const EXPECTED_SHEET_WIDTH = STANDARD_ANIMATION_FRAMES_PER_ROW * FRAME_SIZE;
const EXPECTED_SHEET_HEIGHT =
  (LAST_STANDARD_BAND.row + LAST_STANDARD_BAND.num) * FRAME_SIZE;

/**
 * Metadata names that unlock every ANIMATION_OFFSETS key. When adding a
 * standard animation row, update this list — see CONTRIBUTING.md
 * “Adding a standard animation row”. Use the metadata name, not the offset
 * key (`combat`, not `combat_idle`). Omit `watering`: it aliases `thrust`.
 */
const FULL_OFFSET_ANIMATIONS = [
  "spellcast",
  "thrust",
  "walk",
  "slash",
  "shoot",
  "hurt",
  "climb",
  "idle",
  "jump",
  "sit",
  "emote",
  "run",
  "combat",
  "1h_slash",
  "1h_halfslash",
];

const BODY_RECOLORS = [
  {
    label: "Body",
    type_name: null,
    material: "body",
    default: "ulpc",
    base: "ulpc.light",
    variants: ["light", "olive", "bronze"],
  },
];

const PALETTE_METADATA = {
  versions: {},
  materials: {
    body: {
      default: "ulpc",
      base: "light",
      palettes: {
        ulpc: {
          light: ["#FF0000"],
          olive: ["#00FF00"],
          bronze: ["#0000FF"],
        },
      },
    },
  },
};

type LayerSpec = { zPos: number; male: string };

function workItem(
  name: string,
  animations: string[],
  layers: Record<string, LayerSpec>,
): Record<string, unknown> {
  return {
    name,
    type_name: "body",
    required: ["male"],
    animations,
    recolors: BODY_RECOLORS,
    credits: [],
    layers,
  };
}

const WALK_ITEM = workItem("Walk", ["walk"], {
  layer_1: { zPos: 10, male: BODY_PATH },
});

const WALK_TWO_LAYER_ITEM = workItem("Walk two layer", ["walk"], {
  layer_1: { zPos: 10, male: BODY_PATH },
  layer_2: { zPos: 20, male: BODY_PATH },
});

const FULL_ITEM = workItem("Full", FULL_OFFSET_ANIMATIONS, {
  layer_1: { zPos: 30, male: BODY_PATH },
});

function selection(itemId: string, name: string) {
  return {
    itemId,
    variant: null,
    recolor: "olive",
    name,
  };
}

type WindowWithProfiler = {
  profiler?: PerformanceProfiler;
};

describe("renderCharacter work budget", function () {
  this.timeout(15_000);

  let catalog: CatalogReader;
  let catalogWriter: CatalogWriter;
  let state: State;
  let sandbox: SinonSandbox;
  let profiler: PerformanceProfiler;
  let previousProfiler: PerformanceProfiler | undefined;

  function testWindow(): WindowWithProfiler {
    return window as unknown as WindowWithProfiler;
  }

  function lastCounters(): RenderCharacterCounters {
    const calls = profiler.snapshot().renderCharacter.calls;
    if (calls.length === 0) {
      throw new Error("expected at least one renderCharacter call");
    }
    return calls[calls.length - 1].counters;
  }

  async function composite(selections: Selections): Promise<void> {
    await renderCharacter(catalog, state, selections, "male");
  }

  function expectStandardSheet(counters: RenderCharacterCounters): void {
    expect(counters.canvasWidth).to.equal(EXPECTED_SHEET_WIDTH);
    expect(counters.canvasHeight).to.equal(EXPECTED_SHEET_HEIGHT);
    expect(counters.customAnims).to.equal(0);
  }

  beforeEach(() => {
    const w = testWindow();
    previousProfiler = w.profiler;
    sandbox = sinon.createSandbox();
    sandbox.stub(globalThis, "requestAnimationFrame").callsFake(() => 1);
    sandbox.stub(globalThis, "setInterval").callsFake(() => 999);
    sandbox.stub(m, "redraw");
    state = createState();
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    seedCatalog(
      catalogWriter,
      {
        walk_item: WALK_ITEM,
        walk_two_layer: WALK_TWO_LAYER_ITEM,
        full_item: FULL_ITEM,
      },
      { paletteMetadata: PALETTE_METADATA },
    );
    resetImageLoadCache();
    clearRecolorCache();
    resetSharedWebGLForTests();
    resetRenderCharacterQueueForTests();
    initCanvas();
    profiler = new PerformanceProfiler({
      enabled: true,
      logSlowOperations: false,
    });
    w.profiler = profiler;
  });

  afterEach(() => {
    sandbox.restore();
    profiler.clear();
    resetImageLoadCache();
    clearRecolorCache();
    resetSharedWebGLForTests();
    resetRenderCharacterQueueForTests();
    resetOffscreenCanvasStateForTests();
    const w = testWindow();
    w.profiler = previousProfiler;
  });

  it("keeps SHEET_WIDTH and SHEET_HEIGHT aligned with constants.ts", () => {
    expect(SHEET_WIDTH).to.equal(EXPECTED_SHEET_WIDTH);
    expect(SHEET_HEIGHT).to.equal(EXPECTED_SHEET_HEIGHT);
  });

  it("plans one drawCall for a walk-only layer", async () => {
    await composite({
      walk: selection("walk_item", "Walk"),
    });
    const counters = lastCounters();
    expect(counters.drawCalls).to.equal(1);
    expectStandardSheet(counters);
    expect(counters.imageLoads + counters.imageCacheHits).to.equal(1);
  });

  it("plans one drawCall per ANIMATION_OFFSETS key for a full-offset layer", async () => {
    await composite({
      full: selection("full_item", "Full"),
    });
    const counters = lastCounters();
    expect(counters.drawCalls).to.equal(OFFSET_COUNT);
    expectStandardSheet(counters);
    expect(counters.imageLoads + counters.imageCacheHits).to.equal(
      OFFSET_COUNT,
    );
  });

  it("plans one drawCall per walk layer", async () => {
    await composite({
      walk: selection("walk_two_layer", "Walk two layer"),
    });
    const counters = lastCounters();
    expect(counters.drawCalls).to.equal(2);
    expectStandardSheet(counters);
  });

  it("sums walk-only and full-offset items", async () => {
    await composite({
      walk: selection("walk_item", "Walk"),
      full: selection("full_item", "Full"),
    });
    const counters = lastCounters();
    expect(counters.drawCalls).to.equal(1 + OFFSET_COUNT);
    expectStandardSheet(counters);
  });

  it("reuses the image cache on a second identical composite", async () => {
    const selections = {
      full: selection("full_item", "Full"),
    };
    await composite(selections);
    const first = lastCounters();
    expect(first.drawCalls).to.equal(OFFSET_COUNT);
    expectStandardSheet(first);

    await composite(selections);
    const calls = profiler.snapshot().renderCharacter.calls;
    expect(calls.length).to.equal(2);
    const second = calls[1].counters;
    expect(second.drawCalls).to.equal(OFFSET_COUNT);
    expectStandardSheet(second);
    expect(second.imageLoads).to.equal(0);
    expect(second.imageCacheHits).to.equal(OFFSET_COUNT);
  });
});
