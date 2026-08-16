import { test } from "node:test";
import assert from "node:assert/strict";
import {
  animationRowsLayout,
  customAnimations,
  customAnimationSize,
  customAnimationBase,
} from "../../sources/custom-animations.ts";

const FRAME_SPEC = /^[a-z0-9_]+-[nwes],\d+$/;

test("customAnimationSize and customAnimationBase for wheelchair", () => {
  const wheelchair = customAnimations.wheelchair;
  assert.deepEqual(customAnimationSize(wheelchair), {
    width: 128,
    height: 256,
  });
  assert.equal(customAnimationBase(wheelchair), "sit");
});

test("customAnimationSize and customAnimationBase for walk_128", () => {
  const walk128 = customAnimations.walk_128;
  assert.deepEqual(customAnimationSize(walk128), { width: 1152, height: 512 });
  assert.equal(customAnimationBase(walk128), "walk");
});

test("every custom animation has 4 rows and a 64, 128, or 192 frameSize", () => {
  for (const [name, def] of Object.entries(customAnimations)) {
    assert.equal(def.frames.length, 4, `${name} should have 4 direction rows`);
    assert.ok(
      def.frameSize === 64 || def.frameSize === 128 || def.frameSize === 192,
      `${name} frameSize should be 64, 128, or 192`,
    );
  }
});

test("every custom animation cell matches name-dir,column and layout keys exist", () => {
  for (const [name, def] of Object.entries(customAnimations)) {
    for (const [rowIndex, row] of def.frames.entries()) {
      assert.ok(row.length > 0, `${name} row ${rowIndex} should not be empty`);
      for (const spec of row) {
        assert.match(
          spec,
          FRAME_SPEC,
          `${name} frame spec ${spec} should match name-dir,column`,
        );
        const rowKey = spec.split(",")[0];
        assert.ok(
          Object.hasOwn(animationRowsLayout, rowKey),
          `${name} uses ${rowKey} which is missing from animationRowsLayout`,
        );
      }
    }
  }
});
