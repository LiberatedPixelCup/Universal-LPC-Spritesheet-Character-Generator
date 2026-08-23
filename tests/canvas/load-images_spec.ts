import { expect } from "chai";
import { describe, it } from "mocha-globals";
import {
  loadImage,
  loadImagesInParallel,
  getImageLoadStats,
  resetImageLoadCache,
} from "../../sources/canvas/load-image.ts";

describe("canvas/load-image.ts", function () {
  this.timeout(10_000);

  describe("loadImage", () => {
    it("should load an image successfully", async () => {
      const src = "/spritesheets/arms/bracers/thin/hurt.png";
      const img = await loadImage(src);
      expect(img).to.be.instanceOf(Image);
      expect(img.src).to.include(src);
    });

    it("should cache loaded images", async () => {
      const src = "/spritesheets/arms/bracers/thin/hurt.png";
      const img1 = await loadImage(src);
      const img2 = await loadImage(src);
      expect(img1).to.equal(img2);
    });

    it("increments imageLoads on first fetch and imageCacheHits on cache hit", async () => {
      resetImageLoadCache();
      const src = "/spritesheets/arms/bracers/thin/hurt.png";
      await loadImage(src);
      expect(getImageLoadStats()).to.deep.equal({ cacheHits: 0, loads: 1 });
      await loadImage(src);
      expect(getImageLoadStats()).to.deep.equal({ cacheHits: 1, loads: 1 });
    });

    it("should share one in-flight request when the same src is requested concurrently", async () => {
      // Not thin/hurt.png — earlier tests already cache that URL.
      resetImageLoadCache();
      const src = "/spritesheets/arms/bracers/thin/walk.png";
      const [a, b] = await Promise.all([loadImage(src), loadImage(src)]);
      expect(a).to.equal(b);
      expect(getImageLoadStats().loads).to.equal(1);
      expect(getImageLoadStats().cacheHits).to.equal(0);
    });

    it("marks and measures when window.profiler is set", async () => {
      resetImageLoadCache();
      const marks: string[] = [];
      const measures: string[] = [];
      const prev = window.profiler;
      window.profiler = {
        mark: (name: string) => {
          marks.push(name);
        },
        measure: (name: string, start: string, end: string) => {
          measures.push(`${name}:${start}:${end}`);
        },
      };
      try {
        await loadImage("/spritesheets/arms/bracers/thin/hurt.png");
        expect(marks.length).to.be.greaterThan(0);
        expect(measures.length).to.be.greaterThan(0);
      } finally {
        window.profiler = prev;
      }
    });

    it("should reject if the image fails to load", async () => {
      const src = "/spritesheets/arms/bracers/thin/invalid.png";
      try {
        await loadImage(src);
        throw new Error("expected loadImage to reject");
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.include(`Failed to load ${src}`);
      }
    });
  });

  describe("loadImagesInParallel", () => {
    it("should load multiple images successfully", async () => {
      const items = [
        { spritePath: "/spritesheets/arms/bracers/thin/hurt.png" },
        { spritePath: "/spritesheets/arms/bracers/thin/walk.png" },
      ];
      const results = await loadImagesInParallel(items);
      expect(results.length).to.equal(2);
      results.forEach((result, index) => {
        expect(result.success).to.equal(true);
        expect(result.img).to.be.instanceOf(Image);
        if (!result.img) {
          throw new Error("expected loaded image");
        }
        expect(result.img.src).to.include(items[index].spritePath);
      });
    });

    it("should handle image load failures gracefully", async () => {
      const items = [
        { spritePath: "/spritesheets/arms/bracers/thin/hurt.png" },
        { spritePath: "/spritesheets/arms/bracers/thin/invalid.png" },
      ];
      const results = await loadImagesInParallel(items);
      expect(results.length).to.equal(2);

      const successResult = results[0];
      expect(successResult.success).to.equal(true);
      expect(successResult.img).to.be.instanceOf(Image);
      if (!successResult.img) {
        throw new Error("expected loaded image");
      }
      expect(successResult.img.src).to.include(items[0].spritePath);

      const failureResult = results[1];
      expect(failureResult.success).to.equal(false);
      expect(failureResult.img).to.equal(null);
    });

    it("should use a custom path extractor function", async () => {
      const items = [
        { customPath: "/spritesheets/arms/bracers/thin/hurt.png" },
        { customPath: "/spritesheets/arms/bracers/thin/walk.png" },
      ];
      const getPath = (item: { customPath: string }) => item.customPath;
      const results = await loadImagesInParallel(items, getPath);
      expect(results.length).to.equal(2);
      results.forEach((result, index) => {
        expect(result.success).to.equal(true);
        expect(result.img).to.be.instanceOf(Image);
        if (!result.img) {
          throw new Error("expected loaded image");
        }
        expect(result.img.src).to.include(items[index].customPath);
      });
    });
  });
});
