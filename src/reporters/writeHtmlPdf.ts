import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import type { Page } from "playwright";

type PdfOptions = NonNullable<Parameters<Page["pdf"]>[0]>;

export interface PdfAccessibilityFeatures {
  tagged: boolean;
  structureTree: boolean;
  language: boolean;
  title: boolean;
  outline: boolean;
}

export async function writeHtmlPdf(htmlPath: string, pdfPath: string): Promise<string> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 1200
      }
    });

    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: "networkidle"
    });
    await page.emulateMedia({ media: "screen" });
    await assertAccessibleHtmlSource(page);
    await page.pdf(accessiblePdfOptions(pdfPath));
    await assertAccessiblePdfStructure(pdfPath);
  } finally {
    await browser.close();
  }

  return pdfPath;
}

export function accessiblePdfOptions(pdfPath: string): PdfOptions {
  return {
    path: pdfPath,
    format: "A4",
    landscape: true,
    printBackground: true,
    tagged: true,
    outline: true,
    margin: {
      top: "12mm",
      right: "12mm",
      bottom: "12mm",
      left: "12mm"
    }
  };
}

export function inspectPdfAccessibility(buffer: Buffer): PdfAccessibilityFeatures {
  const source = buffer.toString("latin1");

  return {
    tagged: /\/MarkInfo\b[\s\S]*?\/Marked\s+true\b/.test(source),
    structureTree: /\/StructTreeRoot\b/.test(source),
    language: /\/Lang\s*(?:\([^)]*\)|<[^>]*>)/.test(source),
    title: /\/Title\s*(?:\([^)]*\)|<[^>]*>)/.test(source),
    outline: /\/Type\s*\/Outlines\b/.test(source)
  };
}

export async function assertAccessiblePdfStructure(pdfPath: string): Promise<void> {
  const features = inspectPdfAccessibility(await fs.readFile(pdfPath));
  const missing = Object.entries(features)
    .filter(([, present]) => !present)
    .map(([feature]) => feature);

  if (missing.length > 0) {
    throw new Error(`Generated PDF is missing accessibility features: ${missing.join(", ")}.`);
  }
}

async function assertAccessibleHtmlSource(page: Page): Promise<void> {
  const result = await page.evaluate(() => ({
    language: document.documentElement.lang.trim(),
    title: document.title.trim(),
    hasMain: Boolean(document.querySelector("main")),
    hasHeadingOne: Boolean(document.querySelector("h1")),
    imagesWithoutAlt: document.querySelectorAll("img:not([alt])").length,
    unlabeledTables: [...document.querySelectorAll("table")].filter((table) => (
      !table.querySelector("caption") &&
      !table.hasAttribute("aria-label") &&
      !table.hasAttribute("aria-labelledby")
    )).length
  }));
  const missing = [
    !result.language && "document language",
    !result.title && "document title",
    !result.hasMain && "main landmark",
    !result.hasHeadingOne && "level-one heading",
    result.imagesWithoutAlt > 0 && `alt text for ${result.imagesWithoutAlt} image(s)`,
    result.unlabeledTables > 0 && `accessible names for ${result.unlabeledTables} table(s)`
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`HTML source cannot be exported as an accessible PDF; missing ${missing.join(", ")}.`);
  }
}
