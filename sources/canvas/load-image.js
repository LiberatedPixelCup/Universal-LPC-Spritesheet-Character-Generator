let loadedImages = {};
let imagesToLoad = 0;
let imagesLoaded = 0;

/**
 * Load an image
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (loadedImages[src]) {
      resolve(loadedImages[src]);
      return;
    }

    // Mark start of image load for profiling
    const profiler = window.profiler;
    if (profiler) {
      profiler.mark(`image-load:${src}:start`);
    }

    const img = new Image();
    img.onload = () => {
      loadedImages[src] = img;
      imagesLoaded++;

      // Mark end and measure
      if (profiler) {
        profiler.mark(`image-load:${src}:end`);
        profiler.measure(`image-load:${src}`, `image-load:${src}:start`, `image-load:${src}:end`);
      }

      resolve(img);
    };
    img.onerror = () => {
      console.error(`Failed to load image: ${src}`);
      imagesLoaded++;
      reject(new Error(`Failed to load ${src}`));
    };
    img.src = src;
    imagesToLoad++;
  });
}

/**
 * Load multiple images in parallel
 * @param {Array} items - Array of items with a spritePath property
 * @param {Function} getPath - Optional function to extract path from item (defaults to item.spritePath)
 * @returns {Promise<Array>} Array of {item, img, success} objects
 */
export async function loadImagesInParallel(items, getPath = (item) => item.spritePath) {
  const promises = items.map(item =>
    loadImage(getPath(item))
      .then(img => ({ item, img, success: true }))
      .catch(err => {
        console.warn(`Failed to load sprite: ${getPath(item)}`);
        return { item, img: null, success: false };
      })
  );

  return Promise.all(promises);
}