import test from "node:test";
import assert from "node:assert/strict";
import { workflowTemplate } from "../../dist/commands/ci.js";

test("workflowTemplate includes compliance standard and multiple URLs", () => {
  const workflow = workflowTemplate({
    urls: [
      "http://localhost:4200",
      "http://localhost:4200/favorites"
    ],
    startCommand: "npm run dev -- --host localhost --port 4200",
    failOn: "warning",
    standard: "section508"
  });

  assert.match(workflow, /curl -fsS http:\/\/localhost:4200/);
  assert.match(
    workflow,
    /npx a11y-shiftleft check --dynamic --url http:\/\/localhost:4200 http:\/\/localhost:4200\/favorites --out reports --fail-on warning --standard section508/
  );
});
