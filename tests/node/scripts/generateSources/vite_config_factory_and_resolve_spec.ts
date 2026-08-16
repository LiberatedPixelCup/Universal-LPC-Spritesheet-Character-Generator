import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveConfig } from "vite";
import type { Alias, ConfigEnv, Plugin, PluginOption, UserConfig } from "vite";
import { METADATA_MODULE_BASENAMES } from "../../../../scripts/generateSources/state.ts";
import {
  itemMetadataCodeSplittingGroups,
  itemMetadataResolveAliases,
} from "../../../../vite/wiring.ts";
import viteConfigFactory from "../../../../vite.config.ts";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

type AliasEntry = { find: string | RegExp; replacement: string };

type NamedChunkGroup = { name: string };

function userConfigFor(command: ConfigEnv["command"]): UserConfig {
  const cfg = viteConfigFactory({
    command,
    mode: command === "build" ? "production" : "development",
  });
  if (cfg instanceof Promise) {
    throw new Error("expected sync vite config factory");
  }
  return cfg;
}

function configAliases(cfg: UserConfig): AliasEntry[] {
  const alias = cfg.resolve?.alias;
  if (!Array.isArray(alias)) {
    throw new Error("expected resolve.alias array");
  }
  return alias;
}

function configPlugins(cfg: UserConfig): Plugin[] {
  const plugins = cfg.plugins ?? [];
  if (!plugins.every((p) => p && typeof p === "object" && "name" in p)) {
    throw new Error("expected a flat plugin array");
  }
  return plugins as Plugin[];
}

function chunkGroupsFromOutput(output: unknown): NamedChunkGroup[] {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("expected a single rolldown output");
  }
  const codeSplitting = (output as { codeSplitting?: unknown }).codeSplitting;
  if (!codeSplitting || typeof codeSplitting !== "object") {
    throw new Error("expected codeSplitting.groups");
  }
  const groups = (codeSplitting as { groups?: NamedChunkGroup[] }).groups;
  if (!groups) {
    throw new Error("expected codeSplitting.groups");
  }
  return groups;
}

function configChunkGroups(cfg: UserConfig): NamedChunkGroup[] {
  return chunkGroupsFromOutput(cfg.build?.rolldownOptions?.output);
}

/** Avoid `vite-plugin-run` / robocopy firing on `configResolved` during `resolveConfig` (rsync side effects). */
function withoutSpritesheetCopyPlugins(
  plugins: PluginOption[] | undefined,
): Plugin[] {
  return configPlugins({ plugins }).filter(
    (p) =>
      p.name !== "vite:plugin:run" && p.name !== "copy-spritesheets-robocopy",
  );
}

function expectedMetadataChunkNames(): string[] {
  return itemMetadataCodeSplittingGroups().map((g) => g.name);
}

test("vite.config.ts factory (build): aliases, chunk groups, plugin order", () => {
  const cfg = userConfigFor("build");
  const aliases = configAliases(cfg);
  const plugins = configPlugins(cfg);

  assert.equal(aliases[0].find, "mocha-globals");
  const metaAliases = aliases.slice(1);
  const expectedAliases = itemMetadataResolveAliases();
  assert.deepEqual(metaAliases, expectedAliases);

  const groupNames = configChunkGroups(cfg).map((g) => g.name);
  assert.deepEqual(groupNames, ["vendor", ...expectedMetadataChunkNames()]);

  assert.equal(plugins[0].name, "preview-serve-dist-spritesheets");
  assert.equal(plugins[1].name, "vite-plugin-item-metadata");
  assert.equal(plugins[2].name, "vite-plugin-metadata-modulepreload");
  assert.equal(plugins[3].name, "bundled-css-after-bulma");
  if (process.platform === "win32") {
    assert.equal(plugins[4].name, "copy-spritesheets-robocopy");
  } else {
    assert.equal(plugins[4].name, "vite:plugin:run");
  }
});

test("vite.config.ts factory (serve): metadata aliases and chunk groups match build", () => {
  const cfg = userConfigFor("serve");
  const aliases = configAliases(cfg);
  const plugins = configPlugins(cfg);

  const metaAliases = aliases.slice(1);
  assert.deepEqual(metaAliases, itemMetadataResolveAliases());

  const groupNames = configChunkGroups(cfg).map((g) => g.name);
  assert.deepEqual(groupNames, ["vendor", ...expectedMetadataChunkNames()]);

  assert.equal(plugins[0].name, "preview-serve-dist-spritesheets");
  assert.equal(plugins[1].name, "vite-plugin-item-metadata");
  assert.equal(plugins[2].name, "vite-plugin-metadata-modulepreload");
  assert.equal(plugins[3].name, "bundled-css-after-bulma");
  assert.equal(plugins[4].name, "dynamic assets");
});

test("resolveConfig (build): merged aliases and rolldown groups stay consistent", async () => {
  const user = userConfigFor("build");
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
  const mocha = aliases.find((a: Alias) => a.find === "mocha-globals");
  assert.ok(mocha);
  assert.equal(
    mocha.replacement,
    path.join(repoRoot, "tests", "bdd-globals.js"),
  );

  const distTargets = new Set(
    METADATA_MODULE_BASENAMES.map((b) => path.join(repoRoot, "dist", b)),
  );
  const metaResolved = aliases.filter((a: Alias) =>
    distTargets.has(a.replacement),
  );
  assert.equal(metaResolved.length, METADATA_MODULE_BASENAMES.length);
  assert.deepEqual(
    new Set(metaResolved.map((a: Alias) => a.replacement)),
    distTargets,
  );
  for (const basename of METADATA_MODULE_BASENAMES) {
    const entry = metaResolved.find(
      (a: Alias) => a.replacement === path.join(repoRoot, "dist", basename),
    );
    assert.ok(entry, `missing merged alias for ${basename}`);
    assert.ok(entry.find instanceof RegExp || typeof entry.find === "string");
  }

  const groupNames = chunkGroupsFromOutput(
    resolved.build.rolldownOptions.output,
  ).map((g) => g.name);
  assert.deepEqual(groupNames, ["vendor", ...expectedMetadataChunkNames()]);

  assert.ok(
    resolved.plugins.some((p) => p?.name === "vite-plugin-item-metadata"),
  );
});

test("resolveConfig (serve): merged config includes dynamic assets and metadata groups", async () => {
  const user = userConfigFor("serve");
  const resolved = await resolveConfig(
    { ...user, root: repoRoot, configFile: false },
    "serve",
    "development",
    "development",
  );

  const groupNames = chunkGroupsFromOutput(
    resolved.build.rolldownOptions.output,
  ).map((g) => g.name);
  assert.deepEqual(groupNames, ["vendor", ...expectedMetadataChunkNames()]);

  assert.ok(
    resolved.plugins.some((p) => p?.name === "vite-plugin-item-metadata"),
  );
  assert.ok(resolved.plugins.some((p) => p?.name === "dynamic assets"));
});
