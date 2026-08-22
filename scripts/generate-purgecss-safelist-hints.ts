#!/usr/bin/env node
/* eslint-disable no-console -- CLI helper prints hints to stdout */
/**
 * Prints class-name hints for vite/purgecss-critical-safelist.ts (manual merge).
 * Usage: node scripts/generate-purgecss-safelist-hints.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walkSourceFiles(p, out);
    else if (name.isFile() && (p.endsWith(".ts") || p.endsWith(".js"))) {
      out.push(p);
    }
  }
  return out;
}

const classes = new Set<string>();

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const m of html.matchAll(/\bclass="([^"]+)"/g)) {
  for (const c of m[1].trim().split(/\s+/)) {
    if (c) classes.add(c);
  }
}

for (const file of walkSourceFiles(path.join(root, "sources"))) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/m\(\s*["']([a-z0-9._-]+)["']/gi)) {
    const sel = m[1];
    if (sel.includes(".")) {
      for (const part of sel.split(".")) {
        if (part && part !== "div" && part !== "span" && part !== "section") {
          classes.add(part);
        }
      }
    }
  }
  for (const m of text.matchAll(/class:\s*["']([^"']+)["']/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (c && !c.includes("${")) classes.add(c.trim());
    }
  }
}

console.log(
  [...classes]
    .sort()
    .map((c) => `      "${c}",`)
    .join("\n"),
);
