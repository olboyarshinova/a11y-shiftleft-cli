import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createScreenReaderChecklist,
  toScreenReaderChecklistMarkdown,
  toScreenReaderProfile,
  writeScreenReaderChecklist
} from "../../dist/core/screenReaderChecklist.js";

test("createScreenReaderChecklist creates a VoiceOver protocol by default", () => {
  const checklist = createScreenReaderChecklist({
    urls: ["https://example.com"],
    generatedAt: "2026-06-25T00:00:00.000Z"
  });

  assert.equal(checklist.profile, "voiceover");
  assert.match(checklist.profileLabel, /VoiceOver/);
  assert.match(checklist.recommendedEnvironment, /Safari/);
  assert.equal(checklist.tasks.length, 4);
  assert.match(checklist.tasks[0].steps.join(" "), /rotor/);
});

test("screen reader checklist markdown records human review fields", () => {
  const markdown = toScreenReaderChecklistMarkdown(createScreenReaderChecklist({
    profile: "nvda",
    urls: ["https://example.com/account"],
    generatedAt: "2026-06-25T00:00:00.000Z"
  }));

  assert.match(markdown, /# NVDA smoke test/);
  assert.match(markdown, /https:\/\/example\.com\/account/);
  assert.match(markdown, /Status: `not-reviewed`/);
  assert.match(markdown, /Screen reader, browser, operating system, and versions used/);
});

test("writeScreenReaderChecklist writes JSON and Markdown artifacts", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-screen-reader-"));
  const checklist = createScreenReaderChecklist({ profile: "voiceover", urls: ["https://example.com"] });
  const result = await writeScreenReaderChecklist(outputDir, checklist);

  const json = JSON.parse(await fs.readFile(result.jsonPath, "utf8"));
  const markdown = await fs.readFile(result.markdownPath, "utf8");

  assert.equal(json.profile, "voiceover");
  assert.match(markdown, /VoiceOver smoke test/);
});

test("toScreenReaderProfile rejects unsupported profiles", () => {
  assert.throws(() => toScreenReaderProfile("orca"), /Unsupported screen reader profile/);
});
