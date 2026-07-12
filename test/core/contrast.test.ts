import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateContrastRatio,
  extractContrastEvidence,
  suggestContrastColors
} from "../../dist/core/contrast.js";

test("extractContrastEvidence reads structured axe color-contrast data", () => {
  const evidence = extractContrastEvidence("color-contrast", {
    any: [{
      id: "color-contrast",
      data: {
        fgColor: "#aaaaaa",
        bgColor: "#ffffff",
        contrastRatio: 2.32,
        expectedContrastRatio: "4.5:1",
        fontSize: "12.0pt (16px)",
        fontWeight: "normal"
      }
    }]
  });

  assert.equal(evidence?.actualRatio, 2.32);
  assert.equal(evidence?.requiredRatio, 4.5);
  assert.equal(evidence?.foreground, "#aaaaaa");
  assert.equal(evidence?.background, "#ffffff");
  assert.equal(evidence?.fontSize, "12.0pt (16px)");
  assert.equal(evidence?.suggestions.length, 6);
});

test("suggestContrastColors returns passing text and background color alternatives", () => {
  const suggestions = suggestContrastColors("#aaaaaa", "#ffffff", 4.5);

  assert.deepEqual(suggestions.map((suggestion) => `${suggestion.target}:${suggestion.purpose}`), [
    "foreground:minimum",
    "background:minimum",
    "foreground:recommended",
    "background:recommended",
    "foreground:enhanced",
    "background:enhanced"
  ]);
  assert.ok(suggestions.every((suggestion) => suggestion.contrastRatio >= 4.5));
  assert.notEqual(suggestions[0].color.toLowerCase(), "#aaaaaa");
});

test("suggestContrastColors offers a background change when light text is close to a light background", () => {
  const suggestions = suggestContrastColors("#cfd4cf", "#bcc2bd", 4.5);

  assert.deepEqual(suggestions.slice(0, 2).map((suggestion) => `${suggestion.target}:${suggestion.purpose}`), [
    "foreground:minimum",
    "background:minimum"
  ]);
  assert.ok(suggestions.some((suggestion) => suggestion.target === "background"));
  assert.ok(suggestions.every((suggestion) => suggestion.contrastRatio >= 4.5));
});

test("suggestContrastColors preserves existing text-only behavior when background alternatives duplicate", () => {
  const suggestions = suggestContrastColors("#aaaaaa", "#ffffff", 4.5)
    .filter((suggestion) => suggestion.target === "foreground");

  assert.deepEqual(suggestions.map((suggestion) => suggestion.purpose), [
    "minimum",
    "recommended",
    "enhanced"
  ]);
});

test("calculateContrastRatio follows WCAG relative luminance", () => {
  assert.equal(calculateContrastRatio("#000000", "#ffffff"), 21);
  assert.equal(calculateContrastRatio("#aaa", "#fff"), 2.32);
  assert.equal(calculateContrastRatio("not-a-color", "#fff"), undefined);
});

test("extractContrastEvidence ignores unrelated axe rules", () => {
  assert.equal(extractContrastEvidence("button-name", { any: [] }), undefined);
});
