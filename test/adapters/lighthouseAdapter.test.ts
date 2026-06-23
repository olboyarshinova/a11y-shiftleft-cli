import test from "node:test";
import assert from "node:assert/strict";
import { summarizeLighthouseResult } from "../../dist/adapters/lighthouseAdapter.js";

test("summarizeLighthouseResult extracts accessibility score and audit groups", () => {
  const result = summarizeLighthouseResult("http://localhost:3000", {
    requestedUrl: "http://localhost:3000",
    finalDisplayedUrl: "http://localhost:3000/home",
    fetchTime: "2026-06-23T00:00:00.000Z",
    userAgent: "Chrome",
    categories: {
      accessibility: {
        score: 0.91
      }
    },
    audits: {
      "color-contrast": {
        id: "color-contrast",
        title: "Background and foreground colors have sufficient contrast",
        score: 0,
        scoreDisplayMode: "binary",
        description: "See [contrast guidance](https://example.com/contrast)."
      },
      "logical-tab-order": {
        id: "logical-tab-order",
        title: "The page has a logical tab order",
        score: null,
        scoreDisplayMode: "manual"
      },
      "aria-hidden-body": {
        id: "aria-hidden-body",
        title: "aria-hidden is not present on the body",
        score: 1,
        scoreDisplayMode: "binary"
      },
      "accesskeys": {
        id: "accesskeys",
        title: "No accesskeys",
        score: null,
        scoreDisplayMode: "notApplicable"
      }
    }
  }, 1234);

  assert.equal(result.accessibilityScore, 91);
  assert.equal(result.finalUrl, "http://localhost:3000/home");
  assert.equal(result.failedAudits.length, 1);
  assert.equal(result.failedAudits[0].id, "color-contrast");
  assert.equal(result.failedAudits[0].documentationUrl, "https://example.com/contrast");
  assert.equal(result.failedAudits[0].description, "See contrast guidance.");
  assert.equal(result.manualAudits.length, 1);
  assert.equal(result.manualAudits[0].id, "logical-tab-order");
  assert.equal(result.notApplicableAudits, 1);
  assert.equal(result.durationMs, 1234);
});
