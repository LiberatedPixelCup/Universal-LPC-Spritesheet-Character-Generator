import { expect } from "chai";
import { drawTransparencyBackground } from "../../../sources/canvas/canvas-utils.js";

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe("drawTransparencyBackground", () => {
  it("should draw a checkered pattern on the canvas", () => {
    const width = 16;
    const height = 16;
    const squareSize = 8;

    // Create a mock canvas and context
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");

    // Call the function
    drawTransparencyBackground(context, width, height, squareSize);

    // Get pixel data
    const imageData = context.getImageData(0, 0, width, height).data;

    // Check the colors of the squares
    const lightGray = [204, 204, 204, 255]; // #CCCCCC
    const darkGray = [153, 153, 153, 255]; // #999999

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const pixel = [
          imageData[index],
          imageData[index + 1],
          imageData[index + 2],
          imageData[index + 3],
        ];

        const isEvenRow = Math.floor(y / squareSize) % 2 === 0;
        const isEvenCol = Math.floor(x / squareSize) % 2 === 0;
        const isLight = isEvenRow === isEvenCol;

        if (isLight) {
          expect(pixel).to.deep.equal(lightGray);
        } else {
          expect(pixel).to.deep.equal(darkGray);
        }
      }
    }
  });

  it("should handle non-default square sizes", () => {
    const width = 24;
    const height = 24;
    const squareSize = 12;

    // Create a mock canvas and context
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");

    // Call the function
    drawTransparencyBackground(context, width, height, squareSize);

    // Get pixel data
    const imageData = context.getImageData(0, 0, width, height).data;

    // Check the colors of the squares
    const lightGray = [204, 204, 204, 255]; // #CCCCCC
    const darkGray = [153, 153, 153, 255]; // #999999

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const pixel = [
          imageData[index],
          imageData[index + 1],
          imageData[index + 2],
          imageData[index + 3],
        ];

        const isEvenRow = Math.floor(y / squareSize) % 2 === 0;
        const isEvenCol = Math.floor(x / squareSize) % 2 === 0;
        const isLight = isEvenRow === isEvenCol;

        if (isLight) {
          expect(pixel).to.deep.equal(lightGray);
        } else {
          expect(pixel).to.deep.equal(darkGray);
        }
      }
    }
  });
});