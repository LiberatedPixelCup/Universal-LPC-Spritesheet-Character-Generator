# Open Spritesheet for macOS

The desktop package uses a bundled Chromium runtime to run the same Vite application and sprite assets offline. Links to external websites open in the system browser. The Help menu provides the bundled artwork credits and a link to the source.

## Build a disk image

On an Apple Silicon Mac with Xcode Command Line Tools and a Node.js version supported by the root package, run these commands in the repository root.

```sh
npm ci
bash macos/build-dmg.sh
```

The script downloads the pinned Electron archive and verifies its SHA-256. To use a verified archive already on disk, pass its path as the first argument. An optional second argument selects the output directory, which defaults to `release/`.

The resulting DMG contains an ad-hoc signed application. Developer ID signing and Apple notarization require a separate release configuration.

## Licensing

The original scripts in this directory, beginning with `main.ts` and `build-dmg.sh`, are licensed under Apache-2.0. The application distribution contains the GPL-3.0 LPC generator and its modifications, Electron and JavaScript dependencies with their own notices, and artwork with the permissions listed in the bundled `CREDITS.csv`. The upstream source is the [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
