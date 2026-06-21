import test from "node:test";
import assert from "node:assert/strict";
import { activationKeysForStep, compareFocusPaths, createKeyboardStateId, findUnreachableFocusableSelectors, getKeyboardActivationSafety, issuesForFocusStep } from "../../dist/adapters/keyboardPlaywrightAdapter.js";
import type { KeyboardFocusStep } from "../../dist/types.js";

function focusStep(overrides: Partial<KeyboardFocusStep> = {}): KeyboardFocusStep {
  return {
    index: 1,
    direction: "forward",
    selector: "#save",
    tagName: "button",
    role: "button",
    accessibleName: "Save",
    tabIndex: 0,
    visible: true,
    focusVisible: true,
    indicatorVisible: true,
    obscured: false,
    pageState: {
      id: "state-example",
      url: "http://localhost:3000",
      title: "Example",
      heading: "Settings",
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
      openDialogs: 0,
      expandedControls: 0
    },
    ...overrides
  };
}

test("issuesForFocusStep reports missing keyboard focus indicators", () => {
  const issues = issuesForFocusStep(focusStep({ indicatorVisible: false }), "react", "http://localhost:3000");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "keyboard-focus-indicator-missing");
  assert.deepEqual(issues[0].wcag, ["2.4.7"]);
  assert.equal(issues[0].severity, "warning");
});

test("issuesForFocusStep reports invisible and obscured focus without duplication", () => {
  const invisible = issuesForFocusStep(focusStep({ visible: false, obscured: true }), "vue", "http://localhost:3000");
  const obscured = issuesForFocusStep(focusStep({ obscured: true }), "angular", "http://localhost:4200");

  assert.deepEqual(invisible.map((issue) => issue.ruleId), ["keyboard-focus-not-visible"]);
  assert.deepEqual(invisible[0].wcag, ["2.4.7", "2.4.11"]);
  assert.deepEqual(obscured.map((issue) => issue.ruleId), ["keyboard-focus-obscured"]);
  assert.deepEqual(obscured[0].wcag, ["2.4.11"]);
});

test("issuesForFocusStep keeps a visible focus treatment clean", () => {
  assert.deepEqual(issuesForFocusStep(focusStep(), "unknown", "http://localhost:3000"), []);
});

test("compareFocusPaths requires an exact reverse traversal", () => {
  assert.equal(compareFocusPaths(["#first", "#second", "#third"], ["#third", "#second", "#first"]), true);
  assert.equal(compareFocusPaths(["#first", "#second", "#third"], ["#third", "#first"]), false);
  assert.equal(compareFocusPaths(["#first", "#second"], ["#first", "#second"]), false);
});

test("createKeyboardStateId is stable and changes with semantic UI state", () => {
  const { id: _id, ...state } = focusStep().pageState;
  const initial = createKeyboardStateId(state, ["#menu|button|false"]);

  assert.equal(initial, createKeyboardStateId(state, ["#menu|button|false"]));
  assert.notEqual(initial, createKeyboardStateId(state, ["#menu|button|true"]));
  assert.notEqual(initial, createKeyboardStateId({ ...state, scrollY: 400 }, ["#menu|button|false"]));
});

test("findUnreachableFocusableSelectors returns unique inventory targets missing from the completed path", () => {
  assert.deepEqual(
    findUnreachableFocusableSelectors(["#first", "#second", "#second", "#third"], ["#first", "#third"]),
    ["#second"]
  );
});

test("activationKeysForStep selects bounded role-specific keyboard interactions", () => {
  assert.deepEqual(activationKeysForStep(focusStep({ role: "button" })), ["Enter", "Space"]);
  assert.deepEqual(activationKeysForStep(focusStep({ role: "switch" })), ["Space"]);
  assert.deepEqual(activationKeysForStep(focusStep({ role: "tab" })), ["ArrowRight", "ArrowLeft"]);
  assert.deepEqual(activationKeysForStep(focusStep({ role: "link", tagName: "a" })), []);
  assert.deepEqual(activationKeysForStep(focusStep({ pageState: { ...focusStep().pageState, openDialogs: 1 } })), ["Escape"]);
});

test("getKeyboardActivationSafety reuses safe mode and blocks form and navigation side effects", () => {
  const safeMetadata = {
    tagName: "button",
    inputType: "",
    buttonType: "button",
    inForm: false,
    disabled: false,
    href: "",
    ariaExpanded: "",
    ariaSelected: "",
    ariaPressed: "false"
  };

  assert.equal(getKeyboardActivationSafety(focusStep({ selector: "#toggle", accessibleName: "Toggle menu" }), safeMetadata, "http://localhost:3000").safe, true);
  assert.equal(getKeyboardActivationSafety(focusStep({ accessibleName: "Pay now" }), safeMetadata, "http://localhost:3000").safe, false);
  assert.equal(getKeyboardActivationSafety(focusStep({ tagName: "a", role: "link" }), { ...safeMetadata, tagName: "a", href: "https://example.com" }, "http://localhost:3000").safe, false);
  assert.equal(getKeyboardActivationSafety(focusStep(), { ...safeMetadata, inputType: "submit", inForm: true }, "http://localhost:3000").safe, false);
  assert.equal(getKeyboardActivationSafety(
    focusStep({ selector: "#toggle", accessibleName: "Toggle menu" }),
    safeMetadata,
    "http://localhost:3000",
    {
      enabled: true,
      blockedText: ["toggle menu"],
      blockedRoles: [],
      blockedUrls: [],
      blockedSelectors: [],
      allowedSelectors: [],
      dismissDialogs: true,
      isolateCookies: true
    }
  ).safe, false);
});
