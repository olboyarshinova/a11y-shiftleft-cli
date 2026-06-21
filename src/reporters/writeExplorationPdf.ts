import path from "node:path";
import { writeHtmlPdf } from "./writeHtmlPdf.js";

export async function writeExplorationPdf(outputDir: string, baseName = "exploration"): Promise<string> {
  const htmlPath = path.resolve(outputDir, `${baseName}.html`);
  const pdfPath = path.resolve(outputDir, `${baseName}.pdf`);
  await writeHtmlPdf(htmlPath, pdfPath);

  return pdfPath;
}
