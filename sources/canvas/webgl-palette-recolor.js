// WebGL-accelerated palette recoloring for LPC sprites
// Uses GPU shaders for fast color replacement

// Shared WebGL resources for reuse
let sharedGL = null;
let sharedCanvas = null;
let sharedProgram = null;
let sharedQuadBuffer = null;

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

/**
 * Compile a shader
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {number} type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
 * @param {string} source - Shader source code
 * @returns {WebGLShader} Compiled shader
 */
function compileShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Shader compilation failed: ${info}`);
	}

	return shader;
}

/**
 * Create a shader program
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {string} vertexSource - Vertex shader source
 * @param {string} fragmentSource - Fragment shader source
 * @returns {WebGLProgram} Shader program
 */
function createProgram(gl, vertexSource, fragmentSource) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

	const program = gl.createProgram();
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

/**
 * Convert hex color to RGB array
 * @param {string} hex - Hex color (e.g., "#271920")
 * @returns {number[]} RGB values [r, g, b] normalized to 0-1
 */
function hexToRgbNormalized(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return [0, 0, 0];
	return [
		parseInt(result[1], 16) / 255,
		parseInt(result[2], 16) / 255,
		parseInt(result[3], 16) / 255
	];
}

/**
 * Create a palette texture from source and target palettes
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {string[]} sourcePalette - Array of hex colors (source)
 * @param {string[]} targetPalette - Array of hex colors (target)
 * @returns {WebGLTexture} Palette texture
 */
function createPaletteTexture(gl, sourcePalette, targetPalette) {
	const size = Math.max(sourcePalette.length, targetPalette.length);
	const data = new Uint8Array(32 * 2 * 4); // 32 colors × 2 rows × RGBA

	// First row: source colors
	for (let i = 0; i < sourcePalette.length; i++) {
		const rgb = hexToRgbNormalized(sourcePalette[i]);
		data[i * 4 + 0] = Math.round(rgb[0] * 255);
		data[i * 4 + 1] = Math.round(rgb[1] * 255);
		data[i * 4 + 2] = Math.round(rgb[2] * 255);
		data[i * 4 + 3] = 255;
	}

	// Second row: target colors
	for (let i = 0; i < targetPalette.length; i++) {
		const rgb = hexToRgbNormalized(targetPalette[i]);
		const offset = 32 * 4; // Second row offset
		data[offset + i * 4 + 0] = Math.round(rgb[0] * 255);
		data[offset + i * 4 + 1] = Math.round(rgb[1] * 255);
		data[offset + i * 4 + 2] = Math.round(rgb[2] * 255);
		data[offset + i * 4 + 3] = 255;
	}

	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	return texture;
}

/**
 * Create a texture from an image
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {HTMLImageElement|HTMLCanvasElement} image - Source image
 * @returns {WebGLTexture} Image texture
 */
function createImageTexture(gl, image) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	return texture;
}

/**
 * Setup a full-screen quad for rendering
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLProgram} program - Shader program
 */
function setupQuad(gl, program) {
	// Quad vertices (position + texCoord)
	const vertices = new Float32Array([
		-1, -1,  0, 1,  // Bottom-left
		 1, -1,  1, 1,  // Bottom-right
		-1,  1,  0, 0,  // Top-left
		 1,  1,  1, 0   // Top-right
	]);

	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

	const positionLocation = gl.getAttribLocation(program, 'a_position');
	const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');

	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);

	gl.enableVertexAttribArray(texCoordLocation);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
}

/**
 * Initialize shared WebGL context and resources (call once)
 */
function initSharedWebGL() {
	if (sharedGL) return; // Already initialized

	// Create a reusable canvas
	sharedCanvas = document.createElement('canvas');
	sharedGL = sharedCanvas.getContext('webgl', {
		premultipliedAlpha: false,
		preserveDrawingBuffer: true
	});

	if (!sharedGL) {
		throw new Error('WebGL not supported');
	}

	// Create shader program once
	sharedProgram = createProgram(sharedGL, VERTEX_SHADER, FRAGMENT_SHADER);
	sharedGL.useProgram(sharedProgram);

	// Setup quad geometry once
	setupQuad(sharedGL, sharedProgram);

	if (DEBUG) {
		console.log('WebGL palette recoloring initialized (shared context)');
	}
}

/**
 * Recolor an image using WebGL palette mapping (with shared context)
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage - Source image
 * @param {string[]} sourcePalette - Array of hex colors (source)
 * @param {string[]} targetPalette - Array of hex colors (target)
 * @returns {HTMLCanvasElement} Recolored canvas
 */
export function recolorImageWebGL(sourceImage, sourcePalette, targetPalette) {
	// Initialize shared resources if needed
	if (!sharedGL) {
		initSharedWebGL();
	}

	const gl = sharedGL;

	try {
		// Resize canvas if needed
		if (sharedCanvas.width !== sourceImage.width || sharedCanvas.height !== sourceImage.height) {
			sharedCanvas.width = sourceImage.width;
			sharedCanvas.height = sourceImage.height;
			gl.viewport(0, 0, sharedCanvas.width, sharedCanvas.height);
		}

		// Use the shared program
		gl.useProgram(sharedProgram);

		// Create textures (these are temporary and must be created per operation)
		const imageTexture = createImageTexture(gl, sourceImage);
		const paletteTexture = createPaletteTexture(gl, sourcePalette, targetPalette);

		// Set uniforms
		const imageLocation = gl.getUniformLocation(sharedProgram, 'u_image');
		const paletteLocation = gl.getUniformLocation(sharedProgram, 'u_palette');
		const paletteSizeLocation = gl.getUniformLocation(sharedProgram, 'u_paletteSize');

		gl.uniform1i(imageLocation, 0);
		gl.uniform1i(paletteLocation, 1);
		gl.uniform1f(paletteSizeLocation, sourcePalette.length);

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
		const resultCanvas = document.createElement('canvas');
		resultCanvas.width = sharedCanvas.width;
		resultCanvas.height = sharedCanvas.height;
		const ctx = resultCanvas.getContext('2d');
		ctx.drawImage(sharedCanvas, 0, 0);

		return resultCanvas;
	} catch (error) {
		console.error('WebGL recoloring failed:', error);
		throw error;
	}
}

/**
 * Check if WebGL is available
 * @returns {boolean} True if WebGL is supported
 */
export function isWebGLAvailable() {
	try {
		const canvas = document.createElement('canvas');
		return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
	} catch (e) {
		return false;
	}
}
