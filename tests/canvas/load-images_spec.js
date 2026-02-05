import { expect } from 'chai';
import { loadImage, loadImagesInParallel } from '../../sources/canvas/load-image.js';

describe('canvas/load-image.js', function() {
  this.timeout(10000); // Extend timeout for image loading
  describe('loadImage', () => {
    it('should load an image successfully', async () => {
      const src = '/spritesheets/arms/bracers/female/hurt/brass.png';
      const img = await loadImage(src);
      expect(img).to.be.an.instanceof(Image);
      expect(img.src).to.include(src);
    });

    it('should cache loaded images', async () => {
      const src = '/spritesheets/arms/bracers/female/hurt/brass.png';
      const img1 = await loadImage(src);
      const img2 = await loadImage(src);
      expect(img1).to.equal(img2); // Cached image should be returned
    });

    it('should reject if the image fails to load', async () => {
      const src = '/spritesheets/arms/bracers/female/hurt/invalid.png';
      try {
        await loadImage(src);
      } catch (err) {
        expect(err).to.be.an('error');
        expect(err.message).to.include(`Failed to load ${src}`);
      }
    });
  });

  describe('loadImagesInParallel', () => {
    it('should load multiple images successfully', async () => {
      const items = [
        { spritePath: '/spritesheets/arms/bracers/female/hurt/brass.png' },
        { spritePath: '/spritesheets/arms/bracers/female/hurt/bronze.png' },
      ];
      const results = await loadImagesInParallel(items);
      expect(results).to.be.an('array').with.lengthOf(2);
      results.forEach((result, index) => {
        expect(result.success).to.be.true;
        expect(result.img).to.be.an.instanceof(Image);
        expect(result.img.src).to.include(items[index].spritePath);
      });
    });

    it('should handle image load failures gracefully', async () => {
      const items = [
        { spritePath: '/spritesheets/arms/bracers/female/hurt/brass.png' },
        { spritePath: '/spritesheets/arms/bracers/female/hurt/invalid.png' },
      ];
      const results = await loadImagesInParallel(items);
      expect(results).to.be.an('array').with.lengthOf(2);

      const successResult = results[0];
      expect(successResult.success).to.be.true;
      expect(successResult.img).to.be.an.instanceof(Image);
      expect(successResult.img.src).to.include(items[0].spritePath);

      const failureResult = results[1];
      expect(failureResult.success).to.be.false;
      expect(failureResult.img).to.be.null;
    });

    it('should use a custom path extractor function', async () => {
      const items = [
        { customPath: '/spritesheets/arms/bracers/female/hurt/brass.png' },
        { customPath: '/spritesheets/arms/bracers/female/hurt/bronze.png' },
      ];
      const getPath = (item) => item.customPath;
      const results = await loadImagesInParallel(items, getPath);
      expect(results).to.be.an('array').with.lengthOf(2);
      results.forEach((result, index) => {
        expect(result.success).to.be.true;
        expect(result.img).to.be.an.instanceof(Image);
        expect(result.img.src).to.include(items[index].customPath);
      });
    });
  });
});