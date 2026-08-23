/**
 * Locks how many `renderCharacter` calls bootstrap and a later selection
 * change produce. Counts come from `window.profiler`, not a direct renderer
 * call — that would hide a duplicate-render regression.
 */
import m from "mithril";
import { expect } from "chai";
import sinon, { type SinonSandbox } from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { App } from "../../sources/components/App.ts";
import { createApplicationModels } from "../../sources/models/application.ts";
import {
  createCatalog,
  type CatalogReader,
  type CatalogWriter,
} from "../../sources/state/catalog.ts";
import {
  configureStateCatalog,
  createState,
  initState,
  resetStateDeps,
  setStateDeps,
  type State,
} from "../../sources/state/state.ts";
import { setHash } from "../../sources/state/hash.ts";
import {
  initCanvas,
  resetRenderCharacterQueueForTests,
} from "../../sources/canvas/renderer.ts";
import { PerformanceProfiler } from "../../sources/performance-profiler.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";

type WindowWithTestHooks = {
  profiler?: PerformanceProfiler;
  canvasRenderer?: unknown;
  isTesting?: boolean;
};

function fixtureItem(name: string, typeName: string): Record<string, unknown> {
  return {
    name,
    type_name: typeName,
    animations: ["walk"],
    required: ["male"],
    recolors: [],
    layers: {},
    credits: [],
  };
}

const CATALOG_ITEMS = {
  body: fixtureItem("Body", "body"),
  heads_human_male: fixtureItem("Human Male", "heads"),
  face_neutral: fixtureItem("Neutral", "face"),
  clothes_item: fixtureItem("Shirt", "clothes"),
};

describe("renderCharacter call counts", () => {
  let host: HTMLDivElement;
  let catalog: CatalogReader;
  let catalogWriter: CatalogWriter;
  let models: ReturnType<typeof createApplicationModels>;
  let state: State;
  let sandbox: SinonSandbox;
  let profiler: PerformanceProfiler;
  let previousRenderer: unknown;
  let previousTesting: boolean | undefined;
  let previousProfiler: PerformanceProfiler | undefined;

  function testWindow(): WindowWithTestHooks {
    return window as unknown as WindowWithTestHooks;
  }

  function callCount(): number {
    return profiler.snapshot().renderCharacter.calls.length;
  }

  async function waitForCallCount(count: number): Promise<void> {
    for (let i = 0; i < 40; i++) {
      if (callCount() >= count) {
        return;
      }
      await Promise.resolve();
    }
  }

  async function hydrateFromHash(): Promise<void> {
    setStateDeps({
      loadSelectionsFromHash: (s: State) => {
        s.selections = {
          body: { itemId: "body", variant: "", name: "Body" },
        };
      },
    });
    m.mount(host, {
      view: () => m(App, { catalog, state, models }),
    });
    await initState(state);
    m.redraw.sync();
    await waitForCallCount(1);
  }

  beforeEach(() => {
    const w = testWindow();
    previousRenderer = w.canvasRenderer;
    previousTesting = w.isTesting;
    previousProfiler = w.profiler;
    state = createState();
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    seedCatalog(catalogWriter, CATALOG_ITEMS);
    models = createApplicationModels(catalog, state);
    configureStateCatalog(catalog);
    host = document.createElement("div");
    document.body.appendChild(host);
    sandbox = sinon.createSandbox();
    sandbox.stub(globalThis, "requestAnimationFrame").callsFake(() => 1);
    sandbox.stub(globalThis, "setInterval").callsFake(() => 999);
    profiler = new PerformanceProfiler({
      enabled: true,
      logSlowOperations: false,
    });
    w.profiler = profiler;
    w.canvasRenderer = {};
    w.isTesting = true;
    setHash("");
    initCanvas();
  });

  afterEach(() => {
    sandbox.restore();
    resetStateDeps();
    resetRenderCharacterQueueForTests();
    profiler.clear();
    m.mount(host, null);
    host.remove();
    const w = testWindow();
    if (previousRenderer === undefined) {
      delete w.canvasRenderer;
    } else {
      w.canvasRenderer = previousRenderer;
    }
    w.isTesting = previousTesting;
    w.profiler = previousProfiler;
  });

  it("produces one render when initState hydrates selections from the hash", async () => {
    await hydrateFromHash();
    expect(callCount()).to.equal(1);
  });

  it("produces one render when initState applies defaults for an empty hash", async () => {
    m.mount(host, {
      view: () => m(App, { catalog, state, models }),
    });
    await initState(state);
    m.redraw.sync();
    await waitForCallCount(1);
    expect(callCount()).to.equal(1);
  });

  it("produces one more render when a later selection change redraws", async () => {
    await hydrateFromHash();
    expect(callCount()).to.equal(1);

    state.selections = {
      ...state.selections,
      clothes: { itemId: "clothes_item", variant: "", name: "Shirt" },
    };
    m.redraw.sync();
    await waitForCallCount(2);
    expect(callCount()).to.equal(2);
  });

  it("does not render again on a no-op redraw", async () => {
    await hydrateFromHash();
    expect(callCount()).to.equal(1);

    m.redraw.sync();
    await Promise.resolve();
    await Promise.resolve();
    expect(callCount()).to.equal(1);
  });
});
