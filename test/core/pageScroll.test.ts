import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePageScrollConfig,
  resolveDetectedColorSchemes,
  scrollPageForLazyContent
} from "../../dist/core/pageScroll.js";

test("normalizePageScrollConfig keeps bounded defaults", () => {
  assert.deepEqual(normalizePageScrollConfig({
    enabled: false,
    stepPx: -1,
    maxSteps: 0,
    waitMs: -10
  }), {
    enabled: false,
    stepPx: 800,
    maxSteps: 25,
    waitMs: 100
  });
});

test("resolveDetectedColorSchemes keeps one scan when themes render identically", () => {
  assert.deepEqual(resolveDetectedColorSchemes("same", "same"), ["light"]);
});

test("resolveDetectedColorSchemes scans light and dark when appearance changes", () => {
  assert.deepEqual(resolveDetectedColorSchemes("light-colors", "dark-colors"), [
    "light",
    "dark"
  ]);
});

test("scrollPageForLazyContent scrolls to the bottom and restores the top", async () => {
  let scrollY = 0;
  let scrollHeight = 1800;
  const viewportHeight = 600;
  const scrollTargets: number[] = [];
  const waits: number[] = [];

  const page = {
    evaluate: async (_pageFunction: unknown, targetY?: number) => {
      if (typeof targetY === "number") {
        scrollY = targetY;
        scrollTargets.push(targetY);
        if (targetY >= 600) scrollHeight = 2200;
        return undefined;
      }

      return {
        scrollY,
        viewportHeight,
        scrollHeight
      };
    },
    waitForTimeout: async (ms: number) => {
      waits.push(ms);
    }
  };

  const result = await scrollPageForLazyContent(page, {
    enabled: true,
    stepPx: 600,
    maxSteps: 5,
    waitMs: 20
  });

  assert.equal(result.enabled, true);
  assert.equal(result.steps, 3);
  assert.equal(result.initialScrollHeight, 1800);
  assert.equal(result.finalScrollHeight, 2200);
  assert.equal(result.reachedBottom, true);
  assert.deepEqual(scrollTargets, [600, 1200, 1600, 0]);
  assert.deepEqual(waits, [20, 20, 20, 20]);
});
