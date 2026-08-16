import path from "node:path";
import { fileURLToPath } from "node:url";
import { PurgeCSS } from "purgecss";
import {
  getPurgeContentGlobs,
  getPurgeSafelist,
} from "./purgecss-critical-safelist.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Runs PurgeCSS on emitted CSS assets except the async deferred stylesheet
 * (`*load-deferred-styles*.css`), so the full Bulma + app bundle stays intact.
 */
export function vitePluginPurgeCriticalCss() {
  const repoRoot = path.resolve(__dirname, "..");

  return {
    name: "vite-plugin-purge-critical-css",
    apply: "build",
    enforce: "post",
    async generateBundle(_options, bundle) {
      const content = getPurgeContentGlobs(repoRoot);
      const safelist = getPurgeSafelist();

      for (const asset of Object.values(bundle)) {
        if (asset.type !== "asset" || !asset.fileName?.endsWith(".css")) {
          continue;
        }
        if (asset.fileName.includes("load-deferred")) {
          continue;
        }

        let src;
        if (typeof asset.source === "string") {
          src = asset.source;
        } else if (asset.source instanceof Uint8Array) {
          src = new TextDecoder().decode(asset.source);
        } else {
          continue;
        }

        const [out] = await new PurgeCSS().purge({
          content,
          css: [{ raw: src }],
          safelist,
        });

        if (out?.css != null) {
          asset.source = out.css;
        }
      }
    },
  };
}
