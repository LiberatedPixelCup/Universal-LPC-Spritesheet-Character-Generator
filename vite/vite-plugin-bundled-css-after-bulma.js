/**
 * Vite injects the extracted entry CSS after module scripts in built HTML.
 * Keep Bulma first, then the app bundle (same cascade as source index.html).
 * @returns {import("vite").Plugin}
 */
export function vitePluginBundledCssAfterBulma() {
  return {
    name: "bundled-css-after-bulma",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const stylesheetLinkRe = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
        const bundled = [];
        let m;
        while ((m = stylesheetLinkRe.exec(html)) !== null) {
          const tag = m[0];
          // With `base: "./"`, href is `./assets/...`; older builds used `/assets/...`.
          if (
            /assets\/[^"'>\s]+\.css\b/.test(tag) &&
            !/https?:\/\//i.test(tag)
          ) {
            bundled.push(tag);
          }
        }
        if (bundled.length === 0) {
          return html;
        }

        let out = html;
        for (const tag of bundled) {
          out = out.replace(tag, "");
        }

        const bulmaRe =
          /(<link\b[^>]*\brel=["']stylesheet["'][^>]*bulma[^>]*>)/i;
        if (!bulmaRe.test(out)) {
          return html;
        }

        return out.replace(
          bulmaRe,
          (_, bulmaTag) => `${bulmaTag}\n\t${bundled.join("\n\t")}`,
        );
      },
    },
  };
}
