import { drawFrameToFrame } from '../../../sources/canvas/draw-frames.js';
import { expect } from 'chai';
import sinon from 'sinon';

describe('drawFrameToFrame', () => {
  let destCtx;

  beforeEach(() => {
    // Create a mock CanvasRenderingContext2D
    destCtx = {
      drawImage: sinon.spy(),
    };
  });

  it('should directly copy the frame when source and destination sizes are the same', () => {
    const destPos = { x: 50, y: 50 };
    const destFrameSize = 64;
    const src = {}; // Mock source image
    const srcPos = { x: 0, y: 0 };
    const srcFrameSize = 64;

    drawFrameToFrame(destCtx, destPos, destFrameSize, src, srcPos, srcFrameSize);

    expect(destCtx.drawImage.calledOnce).to.be.true;
    expect(destCtx.drawImage.calledWith(
      src,
      srcPos.x,
      srcPos.y,
      srcFrameSize,
      srcFrameSize,
      destPos.x,
      destPos.y,
      destFrameSize,
      destFrameSize
    )).to.be.true;
  });

  it('should center the source frame in the destination when sizes are different', () => {
    const destPos = { x: 50, y: 50 };
    const destFrameSize = 128;
    const src = {}; // Mock source image
    const srcPos = { x: 0, y: 0 };
    const srcFrameSize = 64;

    drawFrameToFrame(destCtx, destPos, destFrameSize, src, srcPos, srcFrameSize);

    const offset = (destFrameSize - srcFrameSize) / 2;

    expect(destCtx.drawImage.calledOnce).to.be.true;
    expect(destCtx.drawImage.calledWith(
      src,
      srcPos.x,
      srcPos.y,
      srcFrameSize,
      srcFrameSize,
      destPos.x + offset,
      destPos.y + offset,
      srcFrameSize,
      srcFrameSize
    )).to.be.true;
  });

  it('should throw an error if drawImage if destCtx is not provided', () => {
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