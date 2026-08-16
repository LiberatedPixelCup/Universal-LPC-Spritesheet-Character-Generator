import type { IndexHtmlTransformContext, Plugin } from "vite";

/**
 * Injects `<link rel="modulepreload">` for the three largest metadata chunks
 * (index, item, layers) so the browser fetches them in parallel with the entry graph.
 *
 * Rolldown may emit a tiny stub and a large chunk per logical name; we pick the
 * larger file per prefix by `code.length`.
 */

const CRITICAL_PREFIXES = [
  "index-metadata",
  "item-metadata",
  "layers-metadata",
] as const;

type CriticalPrefix = (typeof CRITICAL_PREFIXES)[number];

/**
 * @returns Vite plugin
 */
export function vitePluginMetadataModulePreload(): Plugin {
  return {
    name: "vite-plugin-metadata-modulepreload",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx: IndexHtmlTransformContext) {
        if (ctx.bundle) {
          const best = new Map<string, { fileName: string; size: number }>();
          for (const chunk of Object.values(ctx.bundle)) {
            if (chunk.type !== "chunk") continue;
            const fileName = chunk.fileName;
            if (!fileName) continue;
            const base = fileName.replace(/^assets\//, "");
            const m = base.match(
              /^(index-metadata|item-metadata|layers-metadata)-/,
            );
            if (!m) continue;
            const prefix = m[1] as CriticalPrefix;
            const size = chunk.code?.length ?? 0;
            const prev = best.get(prefix);
            if (!prev || size > prev.size) {
              best.set(prefix, { fileName, size });
            }
          }
          const links: string[] = [];
          for (const prefix of CRITICAL_PREFIXES) {
            const entry = best.get(prefix);
            if (entry) {
              links.push(
                `<link rel="modulepreload" crossorigin href="./${entry.fileName}">`,
              );
            }
          }
          if (links.length === 0) return html;
          return html.replace("</head>", `${links.join("\n  ")}\n</head>`);
        }

        const devLinks = CRITICAL_PREFIXES.map(
          (p) => `<link rel="modulepreload" crossorigin href="./${p}.js">`,
        ).join("\n  ");
        return html.replace("</head>", `${devLinks}\n</head>`);
      },
    },
  };
}
