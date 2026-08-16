import fs from "node:fs";
import path from "node:path";

/**
 * Accept POSTs of Istanbul `window.__coverage__` from the Testem Mocha run
 * and write one JSON file per browser under `coverage/browser/`.
 *
 * @returns {import("vite").Plugin}
 */
export function vitePluginCoverageCollect() {
  return {
    name: "vite-plugin-coverage-collect",
    configureServer(server) {
      server.middlewares.use("/__coverage__", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const chunks = [];
        req.on("data", (chunk) => {
          chunks.push(chunk);
        });
        req.on("error", (err) => {
          res.statusCode = 500;
          res.end(String(err));
        });
        req.on("end", () => {
          try {
            const search = req.url?.includes("?")
              ? req.url.slice(req.url.indexOf("?"))
              : "";
            const id =
              new URLSearchParams(search)
                .get("id")
                ?.replace(/[^A-Za-z0-9._-]/g, "_") || "unknown";
            const outDir = path.resolve(
              server.config.root,
              "coverage",
              "browser",
            );
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(
              path.join(outDir, `${id}.json`),
              Buffer.concat(chunks),
            );
            res.statusCode = 204;
            res.end();
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    },
  };
}
