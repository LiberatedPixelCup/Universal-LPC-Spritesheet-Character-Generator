import TinyGesture from 'https://cdn.jsdelivr.net/npm/tinygesture@3.0.0/+esm';

export default class PinchToZoom {
    initialZoom = 1;
    currentZoom = 1;
    element = null;
    gesture = null;
    onZoom = null;

    constructor(element, onZoom, initialZoom = 1) {
        this.element = element;
        this.onZoom = onZoom;
        this.initialZoom = initialZoom || 1;
        this.currentZoom = this.initialZoom;

        this.init();
    }

    init() {
        this.gesture = new TinyGesture(this.element, { mouseSupport: false });

        this.gesture.on('pinch', (event) => {
            const scale = this.gesture.scale;
            this.currentZoom = this.initialZoom * scale;
            this.onZoom(this.currentZoom);
        });

        this.gesture.on('pinchend', (event) => {
            this.initialZoom = this.currentZoom;
        });
    }
}
