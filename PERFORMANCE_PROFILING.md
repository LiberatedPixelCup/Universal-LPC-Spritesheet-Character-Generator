# Performance Profiling

## How to Enable Profiling

The app includes a performance profiler that is automatically enabled when:
1. Running on localhost (127.0.0.1 or localhost)
2. Adding `?debug=true` to the URL query string (overrides localhost detection)
3. Adding `?debug=false` to disable it even on localhost

The DEBUG flag and profiler are initialized in `sources/main.js`.

## Profiled Operations

The profiler tracks these expensive operations:

### Image Loading
- **Operation:** `loadImage()` in `sources/canvas/renderer.js`
- **Measures:** Individual image load times
- **Format:** `image-load:<path>`

### Character Rendering
- **Operation:** `renderCharacter()` in `sources/canvas/renderer.js`
- **Measures:** Total rendering time including image loading and canvas operations
- **Format:** `renderCharacter`

## Using the Profiler

### Via Browser Console

1. Enable DEBUG mode (see above)
2. Open the browser console (F12)
3. Perform actions in the app (change selections, render character, etc.)
4. Use these commands:

```javascript
// Get a full performance report
window.profiler.report()

// Get measurements for a specific operation
window.profiler.getMeasures('renderCharacter')

// Clear all profiling data
window.profiler.clear()

// Check if profiler is enabled
window.profiler.enabled

// Enable/disable profiler manually
window.profiler.enable()
window.profiler.disable()
```

### Configuration

The profiler is configured in `sources/main.js`:

```javascript
const profiler = new window.PerformanceProfiler({
  enabled: DEBUG,           // Enable/disable profiler
  verbose: false,           // Log all marks/measures to console
  logSlowOperations: true   // Log warnings for slow operations
});
```

## Example Output

```
[Profiler] renderCharacter took 145.2ms
[Profiler] Warning: image-load:spritesheets/body/male/walk/light.png took 85ms (threshold: 50ms)
```

## Performance Report

Call `window.profiler.report()` to see a summary:

```
=== Performance Report ===
renderCharacter: 3 measurements, avg: 142ms, min: 128ms, max: 167ms
image-load:...: 15 measurements, avg: 23ms, min: 8ms, max: 85ms
```

## Adding New Profiling Points

To profile a new operation:

```javascript
// Mark start
const profiler = window.profiler;
if (profiler) {
  profiler.mark('myOperation:start');
}

// ... do expensive work ...

// Mark end and measure
if (profiler) {
  profiler.mark('myOperation:end');
  profiler.measure('myOperation', 'myOperation:start', 'myOperation:end');
}
```

## Tips

- Use meaningful operation names (e.g., `render-body`, `load-sprites`)
- Add profiling marks around suspected bottlenecks
- Use the profiler.report() to identify patterns and outliers
- Compare measurements before/after optimizations
