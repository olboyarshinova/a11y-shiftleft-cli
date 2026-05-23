const RULE_TO_WCAG = {
  "color-contrast": ["1.4.3"],
  "image-alt": ["1.1.1"],
  "jsx-a11y/alt-text": ["1.1.1"],
  "jsx-a11y/label-has-associated-control": ["1.3.1", "3.3.2"],
  "label": ["1.3.1", "3.3.2"],
  "aria-required-attr": ["4.1.2"],
  "aria-roles": ["4.1.2"],
  "button-name": ["4.1.2"],
  "link-name": ["2.4.4", "4.1.2"],
  "keyboard": ["2.1.1"],
  "focus-order-semantics": ["2.4.3"]
};

export function mapRuleToWcag(ruleId = "") {
  if (RULE_TO_WCAG[ruleId]) return RULE_TO_WCAG[ruleId];

  const lowerRuleId = ruleId.toLowerCase();
  const match = Object.entries(RULE_TO_WCAG)
    .find(([rule]) => lowerRuleId.includes(rule));

  return match ? match[1] : [];
}
