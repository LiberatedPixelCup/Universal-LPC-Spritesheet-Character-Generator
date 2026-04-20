import { spawnSync } from "node:child_process";
import path from "node:path";
import { DynamicPublicDirectory } from "vite-multiple-assets";
import { run } from "vite-plugin-run";

/** @returns {string[]} Command and args for vite-plugin-run (first element is the executable). */
function copySpritesheetsRsyncRun() {
  return [
    "rsync",
    "-ahu",
    "--delete",
    "--info=progress2",
    "--no-inc-recursive",
    "spritesheets",
    "dist",
  ];
}

/**
 * Windows: mirror `spritesheets/` into `dist/spritesheets` with robocopy (same flags as before).
 * Robocopy uses exit codes 0–7 for success; ≥8 is failure — we fail the build only on real errors.
 */
function vitePluginCopySpritesheetsRobocopy() {
  return {
    name: "copy-spritesheets-robocopy",
    apply: "build",
    closeBundle() {
      const dest = path.join("dist", "spritesheets");
      const result = spawnSync(
        "robocopy",
        [
          "spritesheets",
          dest,
          "/MIR",
          "/Z",
          "/XO",
          "/MT:8",
          "/NFL",
          "/NDL",
          "/NJH",
          "/NJS",
          "/NP",
        ],
        { stdio: "inherit", shell: false, windowsHide: true },
      );
      if (result.error) {
        throw result.error;
      }
      const code = result.status;
      if (code === null) {
        throw new Error("robocopy was terminated by a signal");
      }
      if (code >= 8) {
        throw new Error(`robocopy failed with exit code ${code}`);
      }
    },
  };
}

/**
 * Plugin that keeps spritesheets available to Vite: in dev, serve the tree from disk; on build,
 * copy (mirror) `spritesheets/` into `dist/spritesheets` so the production output matches the repo.
 *
 * - **Dev (`vite`, `command === "serve"`):** serve `public/` and `spritesheets/` (no `dist/` copy).
 * - **Build on Windows:** robocopy into `dist/` with exit codes mapped so real failures fail the build.
 * - **Build on macOS / Linux:** `rsync` via `vite-plugin-run`.
 *
 * @param {"serve" | "build"} command Vite CLI command from `defineConfig`.
 * @returns {import("vite").Plugin}
 */
export function getSpritesheetsPlugin(command) {
  if (command === "serve") {
    return DynamicPublicDirectory(["public/**", "{\x01,spritesheets}/**"]);
  }

  if (process.platform === "win32") {
    return vitePluginCopySpritesheetsRobocopy();
  }

  return run({
    input: [
      {
        name: "copy spritesheets",
        run: copySpritesheetsRsyncRun,
        condition: () => true,
        onFileChanged: () => {},
      },
    ],
    silent: false,
  });
}
