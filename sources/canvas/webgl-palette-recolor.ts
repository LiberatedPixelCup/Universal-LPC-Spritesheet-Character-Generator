// WebGL-accelerated palette recoloring for LPC sprites
// Uses GPU shaders for fast color replacement

import { get2DContext } from "./canvas-utils.ts";
import { debugLog } from "../utils/debug.ts";

export type PaletteMapping = { source: string[]; target: string[] };

// Shared WebGL resources for reuse
let sharedGL: WebGLRenderingContext | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedProgram: WebGLProgram | null = null;

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

function compileShader(
  gl: WebGLRenderingContext,
  type: GLenum,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to allocate WebGL shader");
  }
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

/**
 * Create a palette texture from one or more palette mappings.
 * All source colors are concatenated into row 0; target colors at the same
 * index sit in row 1. The shader loops up to `u_paletteSize` slots, so N
 * regions can be recolored in a single pass by packing them back-to-back.
 */
function createPaletteTexture(
  gl: WebGLRenderingContext,
  paletteMappings: PaletteMapping[],
): { texture: WebGLTexture; totalSize: number } {
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

  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to allocate WebGL palette texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { texture, totalSize: slot };
}

function createImageTexture(
  gl: WebGLRenderingContext,
  image: HTMLImageElement | HTMLCanvasElement,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to allocate WebGL image texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
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

  // Setup quad geometry once
  setupQuad(sharedGL, sharedProgram);

  debugLog("WebGL palette recoloring initialized (shared context)");
}

/**
 * Recolor an image using WebGL palette mapping (with shared context).
 * Accepts a list of (source, target) palette mappings and applies them all in
 * a single shader pass by packing them into one palette texture. The combined
 * total must fit within the 32-slot palette texture.
 */
export function recolorImageWebGL(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  paletteMappings: PaletteMapping[],
): HTMLCanvasElement {
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

    // Create textures (these are temporary and must be created per operation)
    const imageTexture = createImageTexture(gl, sourceImage);
    const { texture: paletteTexture, totalSize } = createPaletteTexture(
      gl,
      paletteMappings,
    );

    // Set uniforms
    const imageLocation = gl.getUniformLocation(program, "u_image");
    const paletteLocation = gl.getUniformLocation(program, "u_palette");
    const paletteSizeLocation = gl.getUniformLocation(program, "u_paletteSize");

    gl.uniform1i(imageLocation, 0);
    gl.uniform1i(paletteLocation, 1);
    gl.uniform1f(paletteSizeLocation, totalSize);

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, paletteTexture);

    // Render
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Cleanup textures (but keep program and buffers)
    gl.deleteTexture(imageTexture);
    gl.deleteTexture(paletteTexture);

    // Copy result to a new 2D canvas (so we can return it and free WebGL canvas)
    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = canvas.width;
    resultCanvas.height = canvas.height;
    const ctx = get2DContext(resultCanvas);
    ctx.drawImage(canvas, 0, 0);

    return resultCanvas;
  } catch (error) {
    console.error("WebGL recoloring failed:", error);
    throw error;
  }
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
