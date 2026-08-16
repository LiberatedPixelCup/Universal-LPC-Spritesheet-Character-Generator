import { debugWarn } from "../utils/debug.ts";

let loadedImages: Record<string, HTMLImageElement> = {};
/** In-flight loads: same `src` shares one `Image` and one profiler span. */
const inFlight = new Map<string, Promise<HTMLImageElement>>();

/** Profiler is attached to `window.profiler` by `main.js`; absent in tests / Node. */
type WindowWithProfiler = Window & {
  profiler?: {
    mark: (name: string) => void;
    measure: (name: string, start: string, end: string) => void;
  };
};

/**
 * Clears the in-memory image cache. Browser tests call this so a stubbed
 * `Image` constructor cannot poison later specs that share the same module.
 */
export function resetImageLoadCache(): void {
  loadedImages = {};
  inFlight.clear();
}

/** Load an image. Rejects with `Error("Failed to load <src>")` on error. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (loadedImages[src]) {
    return Promise.resolve(loadedImages[src]);
  }
  const existing = inFlight.get(src);
  if (existing) {
    return existing;
  }

  // Register in-flight *before* creating the Image. The Promise constructor runs
  // the executor synchronously; if we only `set` after `new Promise(...)`, a
  // second concurrent `loadImage(src)` can miss `inFlight` and create a second
  // `Image` for the same `src` (fails "share one in-flight request" in tests).
  let resolve!: (img: HTMLImageElement) => void;
  let reject!: (err: Error) => void;
  const p = new Promise<HTMLImageElement>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  inFlight.set(src, p);

  // Mark start of image load (span is actual fetch/decode)
  const profiler = (window as WindowWithProfiler).profiler;
  if (profiler) {
    profiler.mark(`image-load:${src}:start`);
  }

  const img = new Image();
  img.onload = () => {
    loadedImages[src] = img;
    inFlight.delete(src);

    if (profiler) {
      profiler.mark(`image-load:${src}:end`);
      profiler.measure(
        `image-load:${src}`,
        `image-load:${src}:start`,
        `image-load:${src}:end`,
      );
    }

    resolve(img);
  };
  img.onerror = () => {
    inFlight.delete(src);
    console.error(`Failed to load image: ${src}`);
    reject(new Error(`Failed to load ${src}`));
  };
  img.src = src;

  return p;
}

export type LoadedImage<T> = {
  item: T;
  img: HTMLImageElement | null;
  success: boolean;
};

/** Load multiple images in parallel, swallowing per-image errors. */
export async function loadImagesInParallel<T>(
  items: T[],
  getPath: (item: T) => string = (item) =>
    (item as { spritePath: string }).spritePath,
): Promise<LoadedImage<T>[]> {
  const promises = items.map(
    (item): Promise<LoadedImage<T>> =>
      loadImage(getPath(item))
        .then((img): LoadedImage<T> => ({ item, img, success: true }))
        .catch(() => {
          debugWarn(`Failed to load sprite: ${getPath(item)}`);
          return { item, img: null, success: false };
        }),
  );

  return Promise.all(promises);
}
