import path from "node:path";
import { writeHtmlPdf } from "./writeHtmlPdf.js";

export async function writeExplorationPdf(outputDir: string): Promise<string> {
  const htmlPath = path.resolve(outputDir, "exploration.html");
  const pdfPath = path.resolve(outputDir, "exploration.pdf");
  await writeHtmlPdf(htmlPath, pdfPath);

  return pdfPath;
}
