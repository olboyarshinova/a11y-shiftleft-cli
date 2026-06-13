import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

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
    await page.pdf({
      path: pdfPath,
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "12mm",
        right: "12mm",
        bottom: "12mm",
        left: "12mm"
      }
    });
  } finally {
    await browser.close();
  }

  return pdfPath;
}
