import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plugin, ResolvedConfig } from "vite";
import { METADATA_MODULE_BASENAMES } from "../../../../scripts/generateSources/state.ts";
import type { GenerateSourcesDeps } from "../../../../scripts/generate_sources.ts";
import { vitePluginItemMetadata } from "../../../../vite/vite-plugin-item-metadata.ts";
import {
  itemMetadataCodeSplittingGroups,
  itemMetadataPlugins,
  itemMetadataResolveAliases,
  metadataEnvForViteCommand,
} from "../../../../vite/wiring.ts";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

function callPluginHook(hook: unknown, ...args: unknown[]): void {
  if (typeof hook === "function") {
    hook(...args);
    return;
  }
  if (hook && typeof hook === "object" && "handler" in hook) {
    (hook as { handler: (...hookArgs: unknown[]) => unknown }).handler(...args);
  }
}

function runConfigResolved(plugin: Plugin, root: string): void {
  callPluginHook(plugin.configResolved, { root } as ResolvedConfig);
}

function runBuildStart(plugin: Plugin): void {
  callPluginHook(plugin.buildStart);
}

test("itemMetadataResolveAliases: one entry per metadata basename, dist replacements, regex matches", () => {
  const aliases = itemMetadataResolveAliases();
  assert.equal(aliases.length, METADATA_MODULE_BASENAMES.length);
  for (let i = 0; i < METADATA_MODULE_BASENAMES.length; i++) {
    const basename = METADATA_MODULE_BASENAMES[i];
    const { find, replacement } = aliases[i];
    assert.equal(replacement, path.join(repoRoot, "dist", basename));
    assert.ok(find instanceof RegExp);
    assert.match(`prefix/${basename}`, find);
    assert.match(basename, find);
  }
});

test("itemMetadataCodeSplittingGroups: names and tests align with METADATA_MODULE_BASENAMES order", () => {
  const groups = itemMetadataCodeSplittingGroups();
  assert.equal(groups.length, METADATA_MODULE_BASENAMES.length);
  for (let i = 0; i < METADATA_MODULE_BASENAMES.length; i++) {
    const basename = METADATA_MODULE_BASENAMES[i];
    const {
      name,
      test: groupTest,
      priority,
      minSize,
      maxSize,
      maxModuleSize,
    } = groups[i];
    assert.equal(name, basename.replace(/\.js$/, ""));
    assert.ok(groupTest instanceof RegExp);
    assert.ok(groupTest.test(`/some/chunk/${basename}`));
    assert.ok(groupTest.test(path.win32.join("C:", "mix", basename)));
    assert.equal(priority, 100);
    assert.equal(minSize, 0);
    assert.equal(maxSize, 10_000_000);
    assert.equal(maxModuleSize, 10_000_000);
  }
});

test("metadataEnvForViteCommand: build is production; serve is development", () => {
  assert.equal(metadataEnvForViteCommand("build"), "production");
  assert.equal(metadataEnvForViteCommand("serve"), "development");
});

test("itemMetadataPlugins forwards production vs development env via stub generateSources", () => {
  const buildCalls: GenerateSourcesDeps[] = [];
  const [buildPlugin] = itemMetadataPlugins("build", {
    generateSources: (opts = {}) => {
      buildCalls.push(opts);
    },
  });
  runConfigResolved(buildPlugin, "/tmp/vite-root-build");
  runBuildStart(buildPlugin);
  assert.equal(buildCalls.length, 1);
  assert.equal(buildCalls[0].env, "production");

  const serveCalls: GenerateSourcesDeps[] = [];
  const [servePlugin] = itemMetadataPlugins("serve", {
    generateSources: (opts = {}) => {
      serveCalls.push(opts);
    },
  });
  runConfigResolved(servePlugin, "/tmp/vite-root-serve");
  runBuildStart(servePlugin);
  assert.equal(serveCalls.length, 1);
  assert.equal(serveCalls[0].env, "development");
});

test("vitePluginItemMetadata buildStart invokes generateSources with writeMetadata and metadataOutputPath", () => {
  const calls: GenerateSourcesDeps[] = [];
  const plugin = vitePluginItemMetadata("development", {
    generateSources: (opts = {}) => {
      calls.push(opts);
    },
  });
  const root = path.join(os.tmpdir(), `vite-meta-test-${process.pid}`);
  fs.mkdirSync(root, { recursive: true });
  try {
    runConfigResolved(plugin, root);
    runBuildStart(plugin);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(calls.length, 1);
  const opts = calls[0];
  assert.equal(opts.writeMetadata, true);
  assert.equal(opts.writeCredits, false);
  assert.equal(opts.env, "development");
  assert.equal(
    opts.metadataOutputPath,
    path.join(root, "dist", "item-metadata.js"),
  );
  assert.equal(typeof opts.writeFileSync, "function");
});

test("vitePluginItemMetadata does not set writeCredits in metadata-only temp roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vite-credits-skip-"));
  const calls: GenerateSourcesDeps[] = [];
  const originalWrite = fs.writeFileSync;
  const captured: Array<[string, string]> = [];
  fs.writeFileSync = ((filePath: fs.PathOrFileDescriptor, contents: string) => {
    captured.push([String(filePath), String(contents)]);
    return originalWrite(filePath, contents);
  }) as typeof fs.writeFileSync;

  try {
    const plugin = vitePluginItemMetadata("production", {
      generateSources: (opts = {}) => {
        calls.push(opts);
        opts.writeFileSync!(path.join(root, "dist", "item-metadata.js"), "js");
      },
    });
    runConfigResolved(plugin, root);
    runBuildStart(plugin);
  } finally {
    fs.writeFileSync = originalWrite;
    fs.rmSync(root, { recursive: true, force: true });
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].writeCredits, false);
  assert.equal(path.basename(captured[0][0]), "item-metadata.js");
  assert.equal(captured[0][1], "js");
});

test("vitePluginItemMetadata returns expected plugin shape", () => {
  const plugin = vitePluginItemMetadata("production", {
    generateSources: () => {},
  });
  assert.equal(plugin.name, "vite-plugin-item-metadata");
  assert.equal(plugin.enforce, "pre");
  assert.equal(typeof plugin.configResolved, "function");
  assert.equal(typeof plugin.buildStart, "function");
  assert.equal(typeof plugin.configureServer, "function");
});
