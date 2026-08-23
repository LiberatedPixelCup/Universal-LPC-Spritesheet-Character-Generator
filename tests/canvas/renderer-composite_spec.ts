/**
 * Dest-pixel contract for today's `renderCharacter` 2D loop.
 *
 * Existing renderer_spec.js covers planning (`drawCalls`, geometry), not
 * compositor-visible pixels. These cases must stay green after the standard
 * draw loop is replaced.
 */
import { expect } from "chai";
import sinon, { type SinonSandbox } from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  renderCharacter,
  resetRenderCharacterQueueForTests,
  resetOffscreenCanvasStateForTests,
  canvas as rendererCanvas,
  SHEET_WIDTH,
  SHEET_HEIGHT,
} from "../../sources/canvas/renderer.ts";
import {
  resetImageLoadCache,
  setLoadImageForTests,
} from "../../sources/canvas/load-image.ts";
import { clearRecolorCache } from "../../sources/canvas/palette-recolor.ts";
import { resetSharedWebGLForTests } from "../../sources/canvas/webgl-palette-recolor.ts";
import {
  createCatalog,
  type CatalogReader,
  type CatalogWriter,
} from "../../sources/state/catalog.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";
import { createState } from "../../sources/state/state.ts";
import { ANIMATION_OFFSETS } from "../../sources/state/constants.ts";
import { readPixel } from "./palette-recolor-test-helpers.ts";
import { resetRendererModuleState } from "./renderer-test-helpers.ts";
import m from "mithril";

const WALK_Y = ANIMATION_OFFSETS.walk;
const WHEELCHAIR_EXTRA_HEIGHT = 64 * 4;

const RED = { r: 255, g: 0, b: 0, a: 255 };
const GREEN = { r: 0, g: 255, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };
const MAGENTA = { r: 255, g: 0, b: 255, a: 255 };
const CYAN = { r: 0, g: 255, b: 255, a: 255 };
const EMPTY = { r: 0, g: 0, b: 0, a: 0 };
const OLIVE = { r: 0, g: 255, b: 0, a: 255 };
const BRONZE = { r: 0, g: 0, b: 255, a: 255 };

const paletteMetadata = {
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

type Rgba = { r: number; g: number; b: number; a: number };

function alphaCanvas(
  r: number,
  g: number,
  b: number,
  a: number,
  w = 4,
  h = 4,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context");
  ctx.clearRect(0, 0, w, h);
  if (a > 0) {
    ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

async function canvasToImage(
  canvas: HTMLCanvasElement,
): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = canvas.toDataURL("image/png");
  await img.decode();
  return img;
}

function spriteForSrc(src: string): HTMLCanvasElement | "reject" {
  if (src.includes("/fail/")) return "reject";
  if (src.includes("/front-alpha/")) return alphaCanvas(0, 255, 0, 128);
  if (src.includes("/front-clear/")) return alphaCanvas(0, 255, 0, 0);
  if (src.includes("/behind/") || src.includes("/red/")) {
    return alphaCanvas(255, 0, 0, 255);
  }
  if (src.includes("/front/") || src.includes("/green/")) {
    return alphaCanvas(0, 255, 0, 255);
  }
  if (src.includes("/plain/")) return alphaCanvas(255, 0, 255, 255);
  if (src.includes("/recolor/")) return alphaCanvas(255, 0, 0, 255);
  if (src.includes("/wheel/")) return alphaCanvas(0, 255, 255, 255);
  return "reject";
}

function walkItem(
  pathPrefix: string,
  zPos: number,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: "Walk item",
    type_name: "misc",
    required: ["male"],
    animations: ["walk"],
    recolors: [],
    layers: {
      layer_1: {
        zPos,
        male: pathPrefix,
      },
    },
    ...extras,
  };
}

function recolorBodyItem(pathPrefix: string): Record<string, unknown> {
  return {
    name: "Body Color",
    type_name: "body",
    required: ["male"],
    animations: ["walk"],
    recolors: [
      {
        label: "Body",
        type_name: null,
        material: "body",
        default: "ulpc",
        base: "ulpc.light",
        variants: ["light", "olive", "bronze"],
      },
    ],
    layers: {
      layer_1: {
        zPos: 10,
        male: pathPrefix,
      },
    },
  };
}

function destPixel(x: number, y: number): Rgba {
  if (!rendererCanvas) throw new Error("renderer canvas missing");
  return readPixel(rendererCanvas, x, y) as Rgba;
}

function assertPixel(x: number, y: number, expected: Rgba): void {
  expect(destPixel(x, y)).to.deep.include(expected);
}

function sourceOver(
  dst: Rgba,
  src: { r: number; g: number; b: number; a: number },
): Rgba {
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context");
  ctx.fillStyle = `rgba(${dst.r},${dst.g},${dst.b},${dst.a / 255})`;
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = `rgba(${src.r},${src.g},${src.b},${src.a / 255})`;
  ctx.fillRect(0, 0, 1, 1);
  return readPixel(c, 0, 0) as Rgba;
}

describe("canvas/renderer.ts dest pixels", function () {
  this.timeout(15_000);

  let sandbox: SinonSandbox;
  let catalog: CatalogReader;
  let catalogWriter: CatalogWriter;
  let state: ReturnType<typeof createState>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    state = createState();
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    resetImageLoadCache();
    clearRecolorCache();
    resetSharedWebGLForTests();
    resetRendererModuleState();
    setLoadImageForTests(async (src) => {
      const sprite = spriteForSrc(src);
      if (sprite === "reject") {
        return Promise.reject(new Error(`Failed to load ${src}`));
      }
      return canvasToImage(sprite);
    });
    sandbox.stub(m, "redraw");
  });

  afterEach(() => {
    resetImageLoadCache();
    clearRecolorCache();
    resetSharedWebGLForTests();
    resetRenderCharacterQueueForTests();
    resetOffscreenCanvasStateForTests();
    sandbox.restore();
  });

  it("places a walk-only layer at ANIMATION_OFFSETS.walk and leaves (0,0) empty", async () => {
    seedCatalog(catalogWriter, {
      behind: walkItem("test/behind/", 10),
    });
    await renderCharacter(
      catalog,
      state,
      { slot: { itemId: "behind", variant: "olive", name: "Behind" } },
      "male",
    );
    assertPixel(0, 0, EMPTY);
    assertPixel(0, WALK_Y, RED);
  });

  it("draws the higher-zPos layer in front", async () => {
    seedCatalog(catalogWriter, {
      behind: walkItem("test/behind/", 10),
      front: walkItem("test/front/", 50),
    });
    await renderCharacter(
      catalog,
      state,
      {
        a: { itemId: "behind", variant: "olive", name: "Behind" },
        b: { itemId: "front", variant: "olive", name: "Front" },
      },
      "male",
    );
    assertPixel(0, WALK_Y, GREEN);
  });

  it("flips dest color when zPos order is reversed", async () => {
    seedCatalog(catalogWriter, {
      behind: walkItem("test/behind/", 50),
      front: walkItem("test/front/", 10),
    });
    await renderCharacter(
      catalog,
      state,
      {
        a: { itemId: "behind", variant: "olive", name: "Behind" },
        b: { itemId: "front", variant: "olive", name: "Front" },
      },
      "male",
    );
    assertPixel(0, WALK_Y, RED);
  });

  it("blends a semi-transparent layer with 2D source-over", async () => {
    seedCatalog(catalogWriter, {
      behind: walkItem("test/behind/", 10),
      front: walkItem("test/front-alpha/", 50),
    });
    await renderCharacter(
      catalog,
      state,
      {
        a: { itemId: "behind", variant: "olive", name: "Behind" },
        b: { itemId: "front", variant: "olive", name: "Front" },
      },
      "male",
    );
    const expected = sourceOver(RED, { r: 0, g: 255, b: 0, a: 128 });
    assertPixel(0, WALK_Y, expected);
  });

  it("leaves dest unchanged when the front layer is fully transparent", async () => {
    seedCatalog(catalogWriter, {
      behind: walkItem("test/behind/", 10),
      front: walkItem("test/front-clear/", 50),
    });
    await renderCharacter(
      catalog,
      state,
      {
        a: { itemId: "behind", variant: "olive", name: "Behind" },
        b: { itemId: "front", variant: "olive", name: "Front" },
      },
      "male",
    );
    assertPixel(0, WALK_Y, RED);
  });

  it("remaps a recolorable walk layer from the source palette", async () => {
    seedCatalog(
      catalogWriter,
      { "body-color": recolorBodyItem("test/recolor/") },
      { paletteMetadata },
    );
    await renderCharacter(
      catalog,
      state,
      {
        body: {
          itemId: "body-color",
          variant: null,
          recolor: "olive",
          name: "Body Color",
        },
      },
      "male",
    );
    assertPixel(0, WALK_Y, OLIVE);

    await renderCharacter(
      catalog,
      state,
      {
        body: {
          itemId: "body-color",
          variant: null,
          recolor: "bronze",
          name: "Body Color",
        },
      },
      "male",
    );
    assertPixel(0, WALK_Y, BRONZE);
  });

  it("blits a no-recolor item as the source color", async () => {
    seedCatalog(catalogWriter, {
      plain: walkItem("test/plain/", 10),
    });
    await renderCharacter(
      catalog,
      state,
      { slot: { itemId: "plain", variant: "olive", name: "Plain" } },
      "male",
    );
    assertPixel(0, WALK_Y, MAGENTA);
  });

  it("skips a failed load and still draws the other layer", async () => {
    seedCatalog(catalogWriter, {
      missing: walkItem("test/fail/", 10),
      front: walkItem("test/front/", 50),
    });
    await renderCharacter(
      catalog,
      state,
      {
        a: { itemId: "missing", variant: "olive", name: "Missing" },
        b: { itemId: "front", variant: "olive", name: "Front" },
      },
      "male",
    );
    assertPixel(0, WALK_Y, GREEN);
  });

  it("clears the previous walk-band pixel on the next render", async () => {
    seedCatalog(catalogWriter, {
      behind: walkItem("test/behind/", 10),
      front: walkItem("test/front/", 10),
    });
    await renderCharacter(
      catalog,
      state,
      { slot: { itemId: "behind", variant: "olive", name: "Behind" } },
      "male",
    );
    assertPixel(0, WALK_Y, RED);

    await renderCharacter(catalog, state, {}, "male");
    assertPixel(0, WALK_Y, EMPTY);
  });

  it("composites a custom upload behind a higher-z catalog layer", async () => {
    seedCatalog(catalogWriter, {
      front: walkItem("test/front/", 10),
    });
    state.customUploadedImage = await canvasToImage(
      alphaCanvas(0, 0, 255, 255),
    );
    state.customImageZPos = 5;
    await renderCharacter(
      catalog,
      state,
      { slot: { itemId: "front", variant: "olive", name: "Front" } },
      "male",
    );
    assertPixel(0, 0, BLUE);
    assertPixel(0, WALK_Y, GREEN);
  });

  it("composites a custom upload in front when its zPos is higher", async () => {
    seedCatalog(catalogWriter, {
      behind: walkItem("test/behind/", 10),
    });
    state.customUploadedImage = await canvasToImage(
      alphaCanvas(0, 0, 255, 255),
    );
    state.customImageZPos = 50;
    await renderCharacter(
      catalog,
      state,
      { slot: { itemId: "behind", variant: "olive", name: "Behind" } },
      "male",
    );
    assertPixel(0, WALK_Y, BLUE);
  });

  it("grows for wheelchair and blits the custom sprite at SHEET_HEIGHT", async () => {
    seedCatalog(catalogWriter, {
      behind: walkItem("test/behind/", 10),
      wheel_item: {
        name: "Wheel item",
        type_name: "misc",
        required: ["male"],
        animations: ["walk"],
        recolors: [],
        layers: {
          layer_1: {
            zPos: 10,
            custom_animation: "wheelchair",
            male: "test/wheel/",
          },
        },
      },
    });
    await renderCharacter(
      catalog,
      state,
      {
        body: { itemId: "behind", variant: "olive", name: "Behind" },
        slot: { itemId: "wheel_item", variant: "cyan", name: "Wheel" },
      },
      "male",
    );
    if (!rendererCanvas) throw new Error("renderer canvas missing");
    expect(rendererCanvas.height).to.equal(
      SHEET_HEIGHT + WHEELCHAIR_EXTRA_HEIGHT,
    );
    expect(rendererCanvas.width).to.equal(SHEET_WIDTH);
    assertPixel(0, WALK_Y, RED);
    assertPixel(0, SHEET_HEIGHT, CYAN);
  });

  it("serializes overlapping renderCharacter calls so the later selection wins", async () => {
    seedCatalog(catalogWriter, {
      red: walkItem("test/red/", 10),
      green: walkItem("test/green/", 10),
    });
    let releaseFirst: () => void = () => {};
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let holding = false;
    setLoadImageForTests(async (src) => {
      const sprite = spriteForSrc(src);
      if (sprite === "reject") {
        return Promise.reject(new Error(`Failed to load ${src}`));
      }
      const img = await canvasToImage(sprite);
      if (!holding && src.includes("/red/")) {
        holding = true;
        await firstHold;
      }
      return img;
    });

    const first = renderCharacter(
      catalog,
      state,
      { slot: { itemId: "red", variant: "olive", name: "Red" } },
      "male",
    );
    const second = renderCharacter(
      catalog,
      state,
      { slot: { itemId: "green", variant: "olive", name: "Green" } },
      "male",
    );
    await Promise.resolve();
    releaseFirst();
    await Promise.all([first, second]);
    assertPixel(0, WALK_Y, GREEN);
  });

  it("writes targetCanvas and does not clobber the module offscreen canvas", async () => {
    seedCatalog(catalogWriter, {
      behind: walkItem("test/behind/", 10),
    });
    if (!rendererCanvas) throw new Error("renderer canvas missing");
    const moduleCtx = rendererCanvas.getContext("2d");
    if (!moduleCtx) throw new Error("2d context");
    moduleCtx.fillStyle = "rgb(255,0,255)";
    moduleCtx.fillRect(0, 0, 1, 1);

    const target = document.createElement("canvas");
    await renderCharacter(
      catalog,
      state,
      { slot: { itemId: "behind", variant: "olive", name: "Behind" } },
      "male",
      target,
    );

    expect(readPixel(rendererCanvas, 0, 0)).to.deep.include(MAGENTA);
    expect(target.height).to.equal(SHEET_HEIGHT);
    expect(readPixel(target, 0, WALK_Y)).to.deep.include(RED);
    expect(readPixel(target, 0, 0)).to.deep.include(EMPTY);
  });
});
