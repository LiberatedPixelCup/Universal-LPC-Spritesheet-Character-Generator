import {
  drawFrameToFrame,
  drawFramesToCustomAnimation,
} from "../../sources/canvas/draw-frames.js";
import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";
import sinon from "sinon";

describe("drawFrameToFrame", () => {
  let destCtx;

  beforeEach(() => {
    // Create a mock CanvasRenderingContext2D
    destCtx = {
      drawImage: sinon.spy(),
    };
  });

  it("should directly copy the frame when source and destination sizes are the same", () => {
    const destPos = { x: 50, y: 50 };
    const destFrameSize = 64;
    const src = {}; // Mock source image
    const srcPos = { x: 0, y: 0 };
    const srcFrameSize = 64;

    drawFrameToFrame(
      destCtx,
      destPos,
      destFrameSize,
      src,
      srcPos,
      srcFrameSize,
    );

    expect(destCtx.drawImage.calledOnce).to.be.true;
    expect(
      destCtx.drawImage.calledWith(
        src,
        srcPos.x,
        srcPos.y,
        srcFrameSize,
        srcFrameSize,
        destPos.x,
        destPos.y,
        destFrameSize,
        destFrameSize,
      ),
    ).to.be.true;
  });

  it("should center the source frame in the destination when sizes are different", () => {
    const destPos = { x: 50, y: 50 };
    const destFrameSize = 128;
    const src = {}; // Mock source image
    const srcPos = { x: 0, y: 0 };
    const srcFrameSize = 64;

    drawFrameToFrame(
      destCtx,
      destPos,
      destFrameSize,
      src,
      srcPos,
      srcFrameSize,
    );

    const offset = (destFrameSize - srcFrameSize) / 2;

    expect(destCtx.drawImage.calledOnce).to.be.true;
    expect(
      destCtx.drawImage.calledWith(
        src,
        srcPos.x,
        srcPos.y,
        srcFrameSize,
        srcFrameSize,
        destPos.x + offset,
        destPos.y + offset,
        srcFrameSize,
        srcFrameSize,
      ),
    ).to.be.true;
  });

  it("should throw an error if drawImage if destCtx is not provided", () => {
    const destPos = { x: 50, y: 50 };
    const destFrameSize = 64;
    const src = {}; // Mock source image
    const srcPos = { x: 0, y: 0 };
    const srcFrameSize = 64;

    expect(() => {
      drawFrameToFrame(null, destPos, destFrameSize, src, srcPos, srcFrameSize);
    }).to.throw(Error);
  });
});

describe("drawFramesToCustomAnimation", () => {
  let customAnimationContext;

  beforeEach(() => {
    customAnimationContext = {
      drawImage: sinon.spy(),
    };
  });

  it("uses single-animation directional rows when source height is 256 or less", () => {
    const customAnimationDefinition = {
      frameSize: 64,
      frames: [["sit-n,2"], ["sit-w,2"], ["sit-s,2"], ["sit-e,2"]],
    };
    const src = { width: 832, height: 256 };

    drawFramesToCustomAnimation(
      customAnimationContext,
      customAnimationDefinition,
      0,
      src,
    );

    expect(customAnimationContext.drawImage.callCount).to.equal(4);
    expect(customAnimationContext.drawImage.getCall(0).args).to.deep.equal([
      src,
      128,
      0,
      64,
      64,
      0,
      0,
      64,
      64,
    ]);
    expect(customAnimationContext.drawImage.getCall(1).args).to.deep.equal([
      src,
      128,
      64,
      64,
      64,
      0,
      64,
      64,
      64,
    ]);
    expect(customAnimationContext.drawImage.getCall(2).args).to.deep.equal([
      src,
      128,
      128,
      64,
      64,
      0,
      128,
      64,
      64,
    ]);
    expect(customAnimationContext.drawImage.getCall(3).args).to.deep.equal([
      src,
      128,
      192,
      64,
      64,
      0,
      192,
      64,
      64,
    ]);
  });

  it("uses universal-sheet animationRowsLayout rows when source is a full sheet", () => {
    const customAnimationDefinition = {
      frameSize: 64,
      frames: [["sit-e,2"]],
    };
    const src = { width: 832, height: 3456 };

    drawFramesToCustomAnimation(
      customAnimationContext,
      customAnimationDefinition,
      0,
      src,
    );

    expect(customAnimationContext.drawImage.callCount).to.equal(1);
    expect(customAnimationContext.drawImage.getCall(0).args).to.deep.equal([
      src,
      128,
      2048,
      64,
      64,
      0,
      0,
      64,
      64,
    ]);
  });
});
