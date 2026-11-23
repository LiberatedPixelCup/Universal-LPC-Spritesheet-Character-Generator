import type TinyGesture from "tinygesture";

export type ZoomBounds = { min?: number; max?: number };

export default class PinchToZoom {
  element: HTMLElement;
  onZoom: (scale: number) => void;
  initialZoom: number;
  currentZoom: number;
  bounds?: ZoomBounds;
  gesture: TinyGesture<HTMLElement> | null = null;

  private constructor(
    element: HTMLElement,
    onZoom: (scale: number) => void,
    initialZoom: number,
    bounds?: ZoomBounds,
  ) {
    this.element = element;
    this.onZoom = onZoom;
    this.initialZoom = initialZoom;
    this.currentZoom = initialZoom;
    this.bounds = bounds;
  }

  private clampZoom(value: number): number {
    let result = value;
    if (this.bounds?.min !== undefined && result < this.bounds.min) {
      result = this.bounds.min;
    }
    if (this.bounds?.max !== undefined && result > this.bounds.max) {
      result = this.bounds.max;
    }
    return result;
  }

  setZoom(zoom: number): void {
    const clamped = this.clampZoom(zoom || 1);
    this.initialZoom = clamped;
    this.currentZoom = clamped;
  }

  /**
   * Loads `tinygesture` on demand (separate chunk) for pinch-to-zoom after the UI is up.
   */
  static async create(
    element: HTMLElement,
    onZoom: (scale: number) => void,
    initialZoom: number = 1,
    bounds?: ZoomBounds,
  ): Promise<PinchToZoom> {
    const pinch = new PinchToZoom(element, onZoom, initialZoom || 1, bounds);

    const { default: TinyGestureCtor } = await import("tinygesture");
    const gesture = new TinyGestureCtor(element, { mouseSupport: false });
    pinch.gesture = gesture;

    gesture.on("pinch", () => {
      const scale = gesture.scale;
      if (scale == null) return;
      pinch.currentZoom = pinch.clampZoom(pinch.initialZoom * scale);
      pinch.onZoom(pinch.currentZoom);
    });

    gesture.on("pinchend", () => {
      pinch.initialZoom = pinch.currentZoom;
    });

    return pinch;
  }

  destroy(): void {
    this.gesture?.destroy();
    this.gesture = null;
  }
}
