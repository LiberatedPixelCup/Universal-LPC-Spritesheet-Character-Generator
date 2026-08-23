// WebGL-accelerated palette recoloring for LPC sprites
// Uses GPU shaders for fast color replacement

import { get2DContext } from "./canvas-utils.ts";
import { debugLog, debugWarn } from "../utils/debug.ts";

export type PaletteMapping = { source: string[]; target: string[] };

/** WebGL snapshot; CPU recolor still returns a canvas. */
export type RecolorOutput = HTMLCanvasElement | ImageBitmap;

// Shared WebGL resources for reuse
let sharedGL: WebGLRenderingContext | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedProgram: WebGLProgram | null = null;
let sharedImageTexture: WebGLTexture | null = null;
let sharedPaletteTexture: WebGLTexture | null = null;
let sharedImageLocation: WebGLUniformLocation | null = null;
let sharedPaletteLocation: WebGLUniformLocation | null = null;
let sharedPaletteSizeLocation: WebGLUniformLocation | null = null;

/** True when the shared canvas still holds a result that has not been copied. */
let liveUnsnapshotted = false;

type LiveSnapshotHandler = (snap: RecolorOutput) => void;
let liveSnapshotHandler: LiveSnapshotHandler | null = null;

/**
 * Called when a deferred live result is copied so the LRU can store the
 * snapshot. `palette-recolor.ts` installs this at module load.
 */
export function setWebGLLiveSnapshotHandler(
  handler: LiveSnapshotHandler | null,
): void {
  liveSnapshotHandler = handler;
}

/** Drop a deferred live result without copying (cache clear / GL reset). */
export function discardWebGLLiveSnapshot(): void {
  liveUnsnapshotted = false;
}

/** @internal Test helper — drop shared GL so the next call re-inits. */
export function resetSharedWebGLForTests(): void {
  discardWebGLLiveSnapshot();
  sharedGL = null;
  sharedCanvas = null;
  sharedProgram = null;
  sharedImageTexture = null;
  sharedPaletteTexture = null;
  sharedImageLocation = null;
  sharedPaletteLocation = null;
  sharedPaletteSizeLocation = null;
}

/**
 * Vertex shader - renders a full-screen quad
 */
const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

/**
 * Fragment shader - performs palette-based color replacement
 * Looks up each pixel color in the palette and replaces with target color
 */
const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_palette;
uniform float u_paletteSize;

varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    // Skip transparent pixels
    if (color.a < 0.01) {
        gl_FragColor = color;
        return;
    }

    // Look up color in palette (source colors are in first row)
    for (float i = 0.0; i < 32.0; i++) {
        if (i >= u_paletteSize) break;

        float paletteX = (i + 0.5) / 32.0;
        vec3 sourceColor = texture2D(u_palette, vec2(paletteX, 0.25)).rgb;

        // Check if current pixel matches this palette color (with small tolerance)
        vec3 diff = abs(color.rgb - sourceColor);
        if (diff.r < 0.004 && diff.g < 0.004 && diff.b < 0.004) {
            // Match found - get target color from second row
            vec3 targetColor = texture2D(u_palette, vec2(paletteX, 0.75)).rgb;
            gl_FragColor = vec4(targetColor, color.a);
            return;
        }
    }

    // No match - keep original color
    gl_FragColor = color;
}
`;

function throwShaderAllocationFailed(): never {
  const message = "Failed to allocate WebGL shader";
  throw new Error(message);
}

function requireShader(shader: WebGLShader | null): WebGLShader {
  if (shader) {
    return shader;
  }
  return throwShaderAllocationFailed();
}

function compileShader(
  gl: WebGLRenderingContext,
  type: GLenum,
  source: string,
): WebGLShader {
  const shader = requireShader(gl.createShader(type));
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${info}`);
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to allocate WebGL program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking failed: ${info}`);
  }

  return program;
}

/** Convert hex color to RGB array normalized 0-1. */
function hexToRgbNormalized(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

function setNearestClamp(gl: WebGLRenderingContext): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function createReusableTexture(gl: WebGLRenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to allocate WebGL texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  setNearestClamp(gl);
  return texture;
}

/**
 * Pack source/target palettes into the shared 32×2 palette texture.
 * All source colors are concatenated into row 0; target colors at the same
 * index sit in row 1. The shader loops up to `u_paletteSize` slots, so N
 * regions can be recolored in a single pass by packing them back-to-back.
 */
function uploadPaletteTexture(
  gl: WebGLRenderingContext,
  paletteMappings: PaletteMapping[],
): number {
  const data = new Uint8Array(32 * 2 * 4); // 32 colors × 2 rows × RGBA
  const TARGET_ROW_OFFSET = 32 * 4;

  let slot = 0;
  for (const { source, target } of paletteMappings) {
    const n = Math.min(source.length, target.length);
    for (let i = 0; i < n && slot < 32; i++, slot++) {
      const srcRgb = hexToRgbNormalized(source[i]);
      data[slot * 4 + 0] = Math.round(srcRgb[0] * 255);
      data[slot * 4 + 1] = Math.round(srcRgb[1] * 255);
      data[slot * 4 + 2] = Math.round(srcRgb[2] * 255);
      data[slot * 4 + 3] = 255;

      const tgtRgb = hexToRgbNormalized(target[i]);
      data[TARGET_ROW_OFFSET + slot * 4 + 0] = Math.round(tgtRgb[0] * 255);
      data[TARGET_ROW_OFFSET + slot * 4 + 1] = Math.round(tgtRgb[1] * 255);
      data[TARGET_ROW_OFFSET + slot * 4 + 2] = Math.round(tgtRgb[2] * 255);
      data[TARGET_ROW_OFFSET + slot * 4 + 3] = 255;
    }
  }

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, sharedPaletteTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    32,
    2,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data,
  );
  return slot;
}

function uploadImageTexture(
  gl: WebGLRenderingContext,
  image: HTMLImageElement | HTMLCanvasElement,
): void {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sharedImageTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

/** Setup a full-screen quad for rendering. */
function setupQuad(gl: WebGLRenderingContext, program: WebGLProgram): void {
  // Quad vertices (position + texCoord)
  const vertices = new Float32Array([
    -1,
    -1,
    0,
    1, // Bottom-left
    1,
    -1,
    1,
    1, // Bottom-right
    -1,
    1,
    0,
    0, // Top-left
    1,
    1,
    1,
    0, // Top-right
  ]);

  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error("Failed to allocate WebGL vertex buffer");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);

  gl.enableVertexAttribArray(texCoordLocation);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
}

/** Initialize shared WebGL context and resources (call once). */
function initSharedWebGL(): void {
  if (sharedGL) return; // Already initialized

  // Create a reusable canvas
  sharedCanvas = document.createElement("canvas");
  sharedGL = sharedCanvas.getContext("webgl", {
    antialias: false, // Disable antialiasing for crisp pixels
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });

  if (!sharedGL) {
    throw new Error("WebGL not supported");
  }

  // Create shader program once
  sharedProgram = createProgram(sharedGL, VERTEX_SHADER, FRAGMENT_SHADER);
  sharedGL.useProgram(sharedProgram);

  sharedImageTexture = createReusableTexture(sharedGL);
  sharedPaletteTexture = createReusableTexture(sharedGL);
  sharedImageLocation = sharedGL.getUniformLocation(sharedProgram, "u_image");
  sharedPaletteLocation = sharedGL.getUniformLocation(
    sharedProgram,
    "u_palette",
  );
  sharedPaletteSizeLocation = sharedGL.getUniformLocation(
    sharedProgram,
    "u_paletteSize",
  );

  // Setup quad geometry once
  setupQuad(sharedGL, sharedProgram);

  debugLog("WebGL palette recoloring initialized (shared context)");
}

function copySharedCanvasTo2D(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = canvas.width;
  resultCanvas.height = canvas.height;
  const ctx = get2DContext(resultCanvas);
  ctx.drawImage(canvas, 0, 0);
  return resultCanvas;
}

/**
 * Snapshot the current WebGL canvas. `createImageBitmap` copies without
 * detaching the drawing buffer, so a later same-size recolor can reuse the
 * canvas. Fall back to a 2D canvas copy when the API is missing or throws.
 */
async function snapshotSharedCanvas(
  canvas: HTMLCanvasElement,
): Promise<RecolorOutput> {
  if (typeof createImageBitmap === "function") {
    try {
      // Start the copy before yielding so a later draw cannot clobber it.
      return await createImageBitmap(canvas);
    } catch (error) {
      debugWarn("createImageBitmap failed, copying to a 2D canvas", error);
    }
  }
  return copySharedCanvasTo2D(canvas);
}

function closeUnusedSnapshot(value: RecolorOutput): void {
  if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) {
    value.close();
  }
}

/**
 * Copy a deferred live result before the next draw clobbers the shared canvas.
 * Must run inside {@link enqueueRecolor}.
 */
async function snapshotCurrentSharedCanvas(): Promise<RecolorOutput> {
  return snapshotSharedCanvas(sharedCanvas as HTMLCanvasElement);
}

export async function commitWebGLLiveSnapshot(): Promise<void> {
  if (!liveUnsnapshotted || !sharedCanvas) return;
  const snap = await snapshotCurrentSharedCanvas();
  liveUnsnapshotted = false;
  if (liveSnapshotHandler) liveSnapshotHandler(snap);
  else closeUnusedSnapshot(snap);
}

let recolorTail: Promise<unknown> = Promise.resolve();

/** Serialize shared-canvas draws and deferred snapshots. */
export function enqueueRecolor<T>(fn: () => Promise<T>): Promise<T> {
  const next = recolorTail.then(fn, fn);
  recolorTail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function recolorImageWebGLNow(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  paletteMappings: PaletteMapping[],
  snapshot: boolean,
): Promise<RecolorOutput> {
  // Initialize shared resources if needed
  if (!sharedGL) {
    initSharedWebGL();
  }

  // `initSharedWebGL` either populates these or throws.
  const gl = sharedGL!;
  const canvas = sharedCanvas!;
  const program = sharedProgram!;

  try {
    // Resize canvas if needed
    if (
      canvas.width !== sourceImage.width ||
      canvas.height !== sourceImage.height
    ) {
      canvas.width = sourceImage.width;
      canvas.height = sourceImage.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    // Use the shared program
    gl.useProgram(program);

    uploadImageTexture(gl, sourceImage);
    const totalSize = uploadPaletteTexture(gl, paletteMappings);

    gl.uniform1i(sharedImageLocation, 0);
    gl.uniform1i(sharedPaletteLocation, 1);
    gl.uniform1f(sharedPaletteSizeLocation, totalSize);

    // Render
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (!snapshot) {
      liveUnsnapshotted = true;
      return canvas;
    }
    liveUnsnapshotted = false;
    return snapshotSharedCanvas(canvas);
  } catch (error) {
    console.error("WebGL recoloring failed:", error);
    throw error;
  }
}

/**
 * Recolor an image using WebGL palette mapping (with shared context).
 * Accepts a list of (source, target) palette mappings and applies them all in
 * a single shader pass by packing them into one palette texture. The combined
 * total must fit within the 32-slot palette texture.
 *
 * Returns a stable snapshot (ImageBitmap or 2D canvas). Cacheable
 * `getImageToDraw` misses skip this copy and return the live canvas. Outside
 * `renderCharacter` the next WebGL recolor snapshots into the LRU first;
 * during a render, copies wait until idle (or the next render).
 *
 * Recolors are queued so two callers cannot draw into the shared canvas while
 * the previous snapshot is still copying.
 */
export function recolorImageWebGL(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  paletteMappings: PaletteMapping[],
): Promise<RecolorOutput> {
  return enqueueRecolor(async () => {
    await commitWebGLLiveSnapshot();
    return recolorImageWebGLNow(sourceImage, paletteMappings, true);
  });
}

/** Check if WebGL is available. */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}
