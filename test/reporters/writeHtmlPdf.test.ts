import test from "node:test";
import assert from "node:assert/strict";
import {
  accessiblePdfOptions,
  inspectPdfAccessibility
} from "../../dist/reporters/writeHtmlPdf.js";

test("accessiblePdfOptions enables tagged PDF structure and bookmarks", () => {
  const options = accessiblePdfOptions("reports/exploration.pdf");

  assert.equal(options.tagged, true);
  assert.equal(options.outline, true);
  assert.equal(options.path, "reports/exploration.pdf");
  assert.equal(options.printBackground, true);
});

test("inspectPdfAccessibility recognizes required Chromium PDF metadata", () => {
  const pdf = Buffer.from(`
    /Title (Accessibility report)
    /Lang (en)
    /Type /StructTreeRoot
    /Type /Outlines
    /MarkInfo << /Type /MarkInfo /Marked true >>
    /StructTreeRoot 12 0 R
  `, "latin1");

  assert.deepEqual(inspectPdfAccessibility(pdf), {
    tagged: true,
    structureTree: true,
    language: true,
    title: true,
    outline: true
  });
});

test("inspectPdfAccessibility reports missing untagged PDF features", () => {
  assert.deepEqual(inspectPdfAccessibility(Buffer.from("%PDF-1.4")), {
    tagged: false,
    structureTree: false,
    language: false,
    title: false,
    outline: false
  });
});
