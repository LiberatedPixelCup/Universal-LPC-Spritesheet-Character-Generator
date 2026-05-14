import type TinyGesture from "tinygesture";

export default class PinchToZoom {
  element: HTMLElement;
  onZoom: (scale: number) => void;
  initialZoom: number;
  currentZoom: number;
  gesture: TinyGesture<HTMLElement> | null = null;

  private constructor(
    element: HTMLElement,
    onZoom: (scale: number) => void,
    initialZoom: number,
  ) {
    this.element = element;
    this.onZoom = onZoom;
    this.initialZoom = initialZoom;
    this.currentZoom = initialZoom;
  }

  /**
   * Loads `tinygesture` on demand (separate chunk) for pinch-to-zoom after the UI is up.
   */
  static async create(
    element: HTMLElement,
    onZoom: (scale: number) => void,
    initialZoom: number = 1,
  ): Promise<PinchToZoom> {
    const pinch = new PinchToZoom(element, onZoom, initialZoom || 1);

    const { default: TinyGestureCtor } = await import("tinygesture");
    const gesture = new TinyGestureCtor(element, { mouseSupport: false });
    pinch.gesture = gesture;

    gesture.on("pinch", () => {
      const scale = gesture.scale;
      if (scale == null) return;
      pinch.currentZoom = pinch.initialZoom * scale;
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
