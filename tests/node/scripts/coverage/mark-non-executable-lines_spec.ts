import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyNonExecutableHits,
  nonExecutableLineNumbers,
} from "../../../../scripts/coverage/mark-non-executable-lines.js";

test("nonExecutableLineNumbers includes JSDoc and blank lines but not code with trailing comments", () => {
  const text = `/**
 * Runtime guard preserved: main.ts attaches this to \`window\`
 */
export function setPaletteRecolorMode() { return; }
const x = 1; // keep this line executable
`;

  const lines = nonExecutableLineNumbers(text);

  assert.ok(lines.has(1));
  assert.ok(lines.has(2));
  assert.ok(lines.has(3));
  assert.equal(lines.has(4), false);
  assert.equal(lines.has(5), false);
});

test("applyNonExecutableHits marks missing JSDoc lines covered and leaves executable misses", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lcov-comments-"));
  const sourceRel = path.join("src", "example.ts");
  const sourceAbs = path.join(root, sourceRel);
  fs.mkdirSync(path.dirname(sourceAbs));
  fs.writeFileSync(
    sourceAbs,
    `/**
 * docs
 */
export function f() {
  return 1;
}
`,
  );

  const lcov = `TN:
SF:${sourceRel}
DA:4,1
DA:5,0
LF:2
LH:1
end_of_record
`;

  const updated = applyNonExecutableHits(lcov, root);

  assert.match(updated, /^DA:1,1$/m);
  assert.match(updated, /^DA:2,1$/m);
  assert.match(updated, /^DA:3,1$/m);
  assert.match(updated, /^DA:4,1$/m);
  assert.match(updated, /^DA:5,0$/m);
  assert.match(updated, /^DA:6,1$/m);
  assert.match(updated, /^LF:7$/m);
  assert.match(updated, /^LH:6$/m);
});

test("nonExecutableLineNumbers includes erased type alias and interface members", () => {
  const text = `import type { State } from "./state.ts";
import { createState, type Selections } from "./state.ts";

type StateDeps = {
  selectDefaults: (state: State) => Promise<void>;
  renderCharacter: (
    state: State,
    selections: Selections,
    bodyType: string,
  ) => Promise<void>;
};

interface PreviewAttrs {
  catalog: CatalogReader;
  state: State;
}

export function createState(): State {
  return { bodyType: "male" };
}
`;

  const lines = nonExecutableLineNumbers(text);

  assert.ok(lines.has(1));
  assert.equal(lines.has(2), false);
  assert.ok(lines.has(4));
  assert.ok(lines.has(5));
  assert.ok(lines.has(6));
  assert.ok(lines.has(7));
  assert.ok(lines.has(8));
  assert.ok(lines.has(9));
  assert.ok(lines.has(10));
  assert.ok(lines.has(13));
  assert.ok(lines.has(14));
  assert.ok(lines.has(18));
  assert.equal(lines.has(19), false);
});

test("nonExecutableLineNumbers includes inline Component generics and type-only import specifiers", () => {
  const text = `import {
  getSelectionGroup,
  selectItem,
  type State,
} from "../../state/state.ts";

export const AnimationPreview: m.Component<
  { catalog: CatalogReader; state: State },
  PreviewState
> = {
  view() {
    return null;
  },
};
`;

  const lines = nonExecutableLineNumbers(text);

  assert.ok(lines.has(4));
  assert.ok(lines.has(5));
  assert.ok(lines.has(6));
  assert.equal(lines.has(7), false);
  assert.ok(lines.has(8));
  assert.ok(lines.has(9));
});

test("nonExecutableLineNumbers includes JSDoc lines even after template literals with backticks", () => {
  const text = `const note = \`uses \\\`onLayersReady\\\` internally\`;
/**
 * The \`onLayersReady\` wait and serialized render queue
 */
export function renderCharacter() {
  return;
}
`;

  const lines = nonExecutableLineNumbers(text);

  assert.ok(lines.has(2));
  assert.ok(lines.has(3));
  assert.equal(lines.has(6), false);
});

test("applyNonExecutableHits marks type-only signature lines covered", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lcov-types-"));
  const sourceRel = path.join("src", "state.ts");
  const sourceAbs = path.join(root, sourceRel);
  fs.mkdirSync(path.dirname(sourceAbs));
  fs.writeFileSync(
    sourceAbs,
    `type StateDeps = {
  selectDefaults: (state: State) => Promise<void>;
  renderCharacter: (
    state: State,
    selections: Selections,
    bodyType: string,
  ) => Promise<void>;
};

export function createState(): State {
  return { bodyType: "male" };
}
`,
  );

  const lcov = `TN:
SF:${sourceRel}
DA:10,1
DA:11,0
LF:2
LH:1
end_of_record
`;

  const updated = applyNonExecutableHits(lcov, root);

  assert.match(updated, /^DA:1,1$/m);
  assert.match(updated, /^DA:2,1$/m);
  assert.match(updated, /^DA:3,1$/m);
  assert.match(updated, /^DA:4,1$/m);
  assert.match(updated, /^DA:5,1$/m);
  assert.match(updated, /^DA:6,1$/m);
  assert.match(updated, /^DA:7,1$/m);
  assert.match(updated, /^DA:8,1$/m);
  assert.match(updated, /^DA:10,1$/m);
  assert.match(updated, /^DA:11,0$/m);
});

test("nonExecutableLineNumbers includes binding-only destructures but not calls or computed aliases", () => {
  const text = `oninit(vnode) {
  const { state } = vnode.attrs;
  const { catalog, state: appState } = vnode.attrs;
  const { selectedAnimation, onFrameCycleUpdate } = vnode.attrs as Attrs;
  const {
    state,
    selectedAnimation,
  } = vnode.attrs;
  const canvas = vnode.dom as HTMLCanvasElement;
  const zoomLevel = vnode.attrs.zoomLevel || 1;
  const frames = setPreviewAnimation(selectedAnimation);
  const { ready } = loadConfig();
  startPreviewAnimation(state);
}
`;

  const lines = nonExecutableLineNumbers(text);

  assert.ok(lines.has(2));
  assert.ok(lines.has(3));
  assert.ok(lines.has(4));
  assert.ok(lines.has(5));
  assert.ok(lines.has(6));
  assert.ok(lines.has(7));
  assert.ok(lines.has(8));
  assert.equal(lines.has(9), false);
  assert.equal(lines.has(10), false);
  assert.equal(lines.has(11), false);
  assert.equal(lines.has(12), false);
  assert.equal(lines.has(13), false);
});

test("applyNonExecutableHits marks binding-only DA:0 rows covered and keeps call misses", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lcov-bindings-"));
  const sourceRel = path.join("src", "preview.ts");
  const sourceAbs = path.join(root, sourceRel);
  fs.mkdirSync(path.dirname(sourceAbs));
  fs.writeFileSync(
    sourceAbs,
    `export function onupdate(vnode) {
  const { state, selectedAnimation } = vnode.attrs;
  startPreviewAnimation(state);
}
`,
  );

  const lcov = `TN:
SF:${sourceRel}
DA:1,1
DA:2,0
DA:3,0
LF:3
LH:1
end_of_record
`;

  const updated = applyNonExecutableHits(lcov, root);

  assert.match(updated, /^DA:1,1$/m);
  assert.match(updated, /^DA:2,1$/m);
  assert.match(updated, /^DA:3,0$/m);
});

test("nonExecutableLineNumbers includes identifier-only call args but not nested calls", () => {
  const text = `foo(
  catalog,
  state,
  bar(),
);
`;

  const lines = nonExecutableLineNumbers(text);

  assert.ok(lines.has(2));
  assert.ok(lines.has(3));
  assert.equal(lines.has(4), false);
});

test("nonExecutableLineNumbers includes parameter-only signature lines", () => {
  const text = `export function renderCharacter(
  catalog: CatalogReader,
  state: State,
) {
  return catalog;
}
`;

  const lines = nonExecutableLineNumbers(text);

  assert.ok(lines.has(1));
  assert.ok(lines.has(2));
  assert.ok(lines.has(3));
  assert.equal(lines.has(5), false);
});

test("applyNonExecutableHits fills straight-line DA:0 holes when the function body was entered", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lcov-straight-"));
  const sourceRel = path.join("src", "create.ts");
  const sourceAbs = path.join(root, sourceRel);
  fs.mkdirSync(path.dirname(sourceAbs));
  fs.writeFileSync(
    sourceAbs,
    `export function oncreate(vnode) {
  const canvas = vnode.dom;
  if (!window.canvasRenderer) {
    return;
  }
  startPreviewAnimation(state);
}
`,
  );

  const lcov = `TN:
SF:${sourceRel}
DA:2,1
DA:6,0
LF:2
LH:1
end_of_record
`;

  const updated = applyNonExecutableHits(lcov, root);

  assert.match(updated, /^DA:2,1$/m);
  assert.match(updated, /^DA:6,1$/m);
});

test("applyNonExecutableHits keeps DA:0 inside an unentered nested branch", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lcov-branch-"));
  const sourceRel = path.join("src", "update.ts");
  const sourceAbs = path.join(root, sourceRel);
  fs.mkdirSync(path.dirname(sourceAbs));
  fs.writeFileSync(
    sourceAbs,
    `export function onupdate(vnode) {
  const canvas = vnode.dom;
  if (changed) {
    startPreviewAnimation(state);
  }
  repaintStaticPreviewFrameForTests(state);
}
`,
  );

  const lcov = `TN:
SF:${sourceRel}
DA:2,1
DA:4,0
DA:6,1
LF:3
LH:2
end_of_record
`;

  const updated = applyNonExecutableHits(lcov, root);

  assert.match(updated, /^DA:2,1$/m);
  assert.match(updated, /^DA:4,0$/m);
  assert.match(updated, /^DA:6,1$/m);
});

test("applyNonExecutableHits drops FN and BRDA so Codecov uses DA only", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lcov-brda-"));
  const sourceRel = path.join("src", "host.ts");
  const sourceAbs = path.join(root, sourceRel);
  fs.mkdirSync(path.dirname(sourceAbs));
  fs.writeFileSync(
    sourceAbs,
    `type PaletteModalHost = { state: { show: boolean } };
function openPaletteModal(
  state: { ok: boolean },
) {
  return state;
}
`,
  );

  const lcov = `TN:
SF:${sourceRel}
FN:2,openPaletteModal
FNDA:9,openPaletteModal
FNF:1
FNH:1
BRDA:1,0,0,0
BRDA:2,1,0,0
BRDA:2,1,1,0
BRF:3
BRH:0
DA:1,1
DA:2,1
DA:5,1
LF:3
LH:3
end_of_record
`;

  const updated = applyNonExecutableHits(lcov, root);

  assert.doesNotMatch(updated, /^FN:/m);
  assert.doesNotMatch(updated, /^FNDA:/m);
  assert.doesNotMatch(updated, /^BRDA:/m);
  assert.doesNotMatch(updated, /^BRF:/m);
  assert.match(updated, /^DA:1,1$/m);
  assert.match(updated, /^DA:2,1$/m);
});

test("applyNonExecutableHits fills omitted counters but keeps explicit DA:0 misses", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lcov-omit-"));
  const sourceRel = path.join("src", "calls.ts");
  const sourceAbs = path.join(root, sourceRel);
  fs.mkdirSync(path.dirname(sourceAbs));
  fs.writeFileSync(
    sourceAbs,
    `foo();
bar();
`,
  );

  const lcov = `TN:
SF:${sourceRel}
DA:2,0
LF:1
LH:0
end_of_record
`;

  const updated = applyNonExecutableHits(lcov, root);

  assert.match(updated, /^DA:1,1$/m);
  assert.match(updated, /^DA:2,0$/m);
});
