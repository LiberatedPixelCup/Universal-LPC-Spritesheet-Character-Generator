import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveConfig } from "vite";
import { METADATA_MODULE_BASENAMES } from "../../../../scripts/generateSources/state.ts";
import {
  itemMetadataCodeSplittingGroups,
  itemMetadataResolveAliases,
} from "../../../../vite/wiring.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

/** Avoid `vite-plugin-run` / robocopy firing on `configResolved` during `resolveConfig` (rsync side effects). */
function withoutSpritesheetCopyPlugins(plugins) {
  return plugins.filter(
    (p) =>
      p?.name !== "vite:plugin:run" && p?.name !== "copy-spritesheets-robocopy",
  );
}

function expectedMetadataChunkNames() {
  return itemMetadataCodeSplittingGroups().map((g) => g.name);
}

test("vite.config.js factory (build): aliases, chunk groups, plugin order", async () => {
  const { default: viteConfigFactory } =
    await import("../../../../vite.config.js");
  const cfg = viteConfigFactory({ command: "build" });

  assert.equal(cfg.resolve.alias[0].find, "mocha-globals");
  const metaAliases = cfg.resolve.alias.slice(1);
  const expectedAliases = itemMetadataResolveAliases();
  assert.deepEqual(metaAliases, expectedAliases);

  const groupNames = cfg.build.rolldownOptions.output.codeSplitting.groups.map(
    (g) => g.name,
  );
  assert.deepEqual(groupNames, ["vendor", ...expectedMetadataChunkNames()]);

  assert.equal(cfg.plugins[0].name, "preview-serve-dist-spritesheets");
  assert.equal(cfg.plugins[1].name, "vite-plugin-item-metadata");
  assert.equal(cfg.plugins[2].name, "vite-plugin-metadata-modulepreload");
  assert.equal(cfg.plugins[3].name, "bundled-css-after-bulma");
  if (process.platform === "win32") {
    assert.equal(cfg.plugins[4].name, "copy-spritesheets-robocopy");
  } else {
    assert.equal(cfg.plugins[4].name, "vite:plugin:run");
  }
});

test("vite.config.js factory (serve): metadata aliases and chunk groups match build", async () => {
  const { default: viteConfigFactory } =
    await import("../../../../vite.config.js");
  const cfg = viteConfigFactory({ command: "serve" });

  const metaAliases = cfg.resolve.alias.slice(1);
  assert.deepEqual(metaAliases, itemMetadataResolveAliases());

  const groupNames = cfg.build.rolldownOptions.output.codeSplitting.groups.map(
    (g) => g.name,
  );
  assert.deepEqual(groupNames, ["vendor", ...expectedMetadataChunkNames()]);

  assert.equal(cfg.plugins[0].name, "preview-serve-dist-spritesheets");
  assert.equal(cfg.plugins[1].name, "vite-plugin-item-metadata");
  assert.equal(cfg.plugins[2].name, "vite-plugin-metadata-modulepreload");
  assert.equal(cfg.plugins[3].name, "bundled-css-after-bulma");
  assert.equal(cfg.plugins[4].name, "dynamic assets");
});

test("resolveConfig (build): merged aliases and rolldown groups stay consistent", async () => {
  const { default: viteConfigFactory } =
    await import("../../../../vite.config.js");
  const user = viteConfigFactory({ command: "build" });
  const resolved = await resolveConfig(
    {
      ...user,
      root: repoRoot,
      configFile: false,
      plugins: withoutSpritesheetCopyPlugins(user.plugins),
    },
    "build",
    "production",
    "production",
  );

  const aliases = resolved.resolve.alias;
  const mocha = aliases.find((a) => a.find === "mocha-globals");
  assert.ok(mocha);
  assert.equal(
    mocha.replacement,
    path.join(repoRoot, "tests", "bdd-globals.js"),
  );

  const distTargets = new Set(
    METADATA_MODULE_BASENAMES.map((b) => path.join(repoRoot, "dist", b)),
  );
  const metaResolved = aliases.filter((a) => distTargets.has(a.replacement));
  assert.equal(metaResolved.length, METADATA_MODULE_BASENAMES.length);
  assert.deepEqual(
    new Set(metaResolved.map((a) => a.replacement)),
    distTargets,
  );
  for (const basename of METADATA_MODULE_BASENAMES) {
    const entry = metaResolved.find(
      (a) => a.replacement === path.join(repoRoot, "dist", basename),
    );
    assert.ok(entry, `missing merged alias for ${basename}`);
    assert.ok(entry.find instanceof RegExp || typeof entry.find === "string");
  }

  const groupNames =
    resolved.build.rolldownOptions.output.codeSplitting.groups.map(
      (g) => g.name,
    );
  assert.deepEqual(groupNames, ["vendor", ...expectedMetadataChunkNames()]);

  assert.ok(
    resolved.plugins.some((p) => p?.name === "vite-plugin-item-metadata"),
  );
});

test("resolveConfig (serve): merged config includes dynamic assets and metadata groups", async () => {
  const { default: viteConfigFactory } =
    await import("../../../../vite.config.js");
  const user = viteConfigFactory({ command: "serve" });
  const resolved = await resolveConfig(
    { ...user, root: repoRoot, configFile: false },
    "serve",
    "development",
    "development",
  );

  const groupNames =
    resolved.build.rolldownOptions.output.codeSplitting.groups.map(
      (g) => g.name,
    );
  assert.deepEqual(groupNames, ["vendor", ...expectedMetadataChunkNames()]);

  assert.ok(
    resolved.plugins.some((p) => p?.name === "vite-plugin-item-metadata"),
  );
  assert.ok(resolved.plugins.some((p) => p?.name === "dynamic assets"));
});
