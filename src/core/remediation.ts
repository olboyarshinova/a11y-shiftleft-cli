import type { Framework, RemediationHint, WcagCriterion } from "../types.js";

const RULE_HINTS: Record<string, RemediationHint> = {
  "canvas-alternative-not-detected": {
    summary: "Provide an accessible equivalent when canvas content communicates information or supports interaction.",
    howToFix: [
      "Add concise fallback text or semantic HTML content inside the canvas element for the same information or function.",
      "Use aria-label or aria-labelledby only when a short accessible name is sufficient; provide structured nearby content for charts or complex graphics.",
      "Mark the canvas decorative only when it conveys no information, then verify the complete task without seeing it."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#alternative_content"
    ]
  },
  "iframe-scan-unavailable": {
    summary: "Test the embedded document directly because this audit could not inspect its frame content.",
    howToFix: [
      "Run the audit against the iframe source URL when you control or can access it.",
      "Confirm the iframe has a descriptive title and that keyboard and screen-reader users can enter, use, and leave it.",
      "Document third-party ownership and request an accessible alternative when the embedded service cannot be remediated."
    ],
    docs: ["https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"]
  },
  "frame-title": {
    summary: "Give each iframe a concise title that identifies its embedded content or purpose.",
    howToFix: [
      "Add a unique title attribute to the iframe element.",
      "Describe the frame purpose rather than its implementation or URL.",
      "Confirm that multiple frames can be distinguished in a screen-reader frame list."
    ],
    docs: ["https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"]
  },
  "video-caption": {
    summary: "Provide synchronized captions for prerecorded video that contains audio.",
    howToFix: [
      "Add an accurate captions track with kind=\"captions\", the correct language, and a useful label.",
      "Synchronize dialogue and meaningful sounds, and identify speakers when needed.",
      "Review caption accuracy, timing, readability, and player controls manually."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html",
      "https://www.w3.org/WAI/media/av/captions/"
    ]
  },
  "media-video-captions-not-detected": {
    summary: "Confirm whether this video contains prerecorded audio and needs synchronized captions.",
    howToFix: [
      "If the video contains speech or meaningful audio, add a captions track with the correct language and label.",
      "If the video is silent, document that decision and provide text for essential visual information when needed.",
      "Check caption accuracy, timing, speaker identification, and sound descriptions manually."
    ],
    docs: ["https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html"]
  },
  "audio-caption": {
    summary: "Provide a text alternative for prerecorded audio-only content.",
    howToFix: [
      "Link to a transcript near the audio player and make the relationship clear.",
      "Include dialogue, speakers, and meaningful non-speech sounds.",
      "Review transcript completeness and accuracy manually."
    ],
    docs: ["https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html"]
  },
  "media-audio-transcript-not-detected": {
    summary: "Confirm whether this audio-only content needs a nearby text transcript.",
    howToFix: [
      "Provide a clearly named transcript link or adjacent transcript for prerecorded audio.",
      "Include speech, speaker changes, and meaningful sounds.",
      "Keep the transcript easy to find from the player."
    ],
    docs: ["https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html"]
  },
  "no-autoplay-audio": {
    summary: "Prevent uncontrolled audio from playing automatically for more than three seconds.",
    howToFix: [
      "Remove autoplay, start muted, or stop playback within three seconds.",
      "Provide a keyboard-accessible pause, stop, or independent volume control.",
      "Make the control easy to find before other page audio begins."
    ],
    docs: ["https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html"]
  },
  "media-autoplay-control-risk": {
    summary: "Avoid autoplay with sound unless users can quickly pause, stop, or control it.",
    howToFix: [
      "Remove autoplay or start the media muted.",
      "Expose keyboard-accessible controls before playback starts.",
      "Confirm whether audible playback lasts more than three seconds."
    ],
    docs: ["https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html"]
  },
  "image-alt-filename": {
    summary: "Replace filename-like alternative text with the image purpose in this context.",
    howToFix: [
      "Describe the information or function the image contributes instead of its file name.",
      "Use alt=\"\" when the image is purely decorative and adjacent content already conveys its purpose.",
      "Confirm the final announcement in context with a supported screen reader."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      "https://www.w3.org/WAI/tutorials/images/decision-tree/"
    ]
  },
  "image-alt-generic": {
    summary: "Replace generic alternative text with a concise description of the image purpose.",
    howToFix: [
      "Avoid alternatives that only say image, photo, icon, graphic, or logo.",
      "Name the subject, information, brand, or action that matters in the current context.",
      "Use an empty alternative only when the image is decorative."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      "https://www.w3.org/WAI/tutorials/images/informative/"
    ]
  },
  "image-alt-duplicates-nearby-text": {
    summary: "Avoid making assistive technology announce the same nearby label twice.",
    howToFix: [
      "When adjacent visible text already names the image or link, consider alt=\"\" for the image.",
      "Keep one concise accessible name on the complete link or button.",
      "Confirm that removing duplicate wording does not remove information unique to the image."
    ],
    docs: ["https://www.w3.org/WAI/tutorials/images/decorative/"]
  },
  "image-alt-repeated": {
    summary: "Confirm that images with different sources genuinely have the same purpose before reusing alternative text.",
    howToFix: [
      "Describe each image's distinct information when the sources communicate different content.",
      "Keep repeated alternatives only when the images have the same function and meaning in context.",
      "Mark repeated decorative images with alt=\"\"."
    ],
    docs: ["https://www.w3.org/WAI/tutorials/images/informative/"]
  },
  "image-alt-excessive-length": {
    summary: "Keep alternative text concise and move complex explanation into nearby content or a long description.",
    howToFix: [
      "Retain the essential purpose and information in a short alternative.",
      "Describe complex charts, diagrams, or instructions in adjacent structured content.",
      "Avoid repeating captions or surrounding prose in the alt attribute."
    ],
    docs: ["https://www.w3.org/WAI/tutorials/images/complex/"]
  },
  "form-invalid-error-not-associated": {
    summary: "Associate the invalid field with a visible, specific error message.",
    howToFix: [
      "Give the error message an id and reference it from the field with aria-errormessage or aria-describedby.",
      "Set aria-invalid only when the field is invalid, and keep the referenced message visible and exposed to assistive technology.",
      "Explain what is wrong and how to correct it, then confirm the result with a supported screen reader."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html"
    ]
  },
  "modal-accessible-name-missing": {
    summary: "Give the dialog a concise accessible name that identifies its purpose.",
    howToFix: [
      "Reference the visible dialog heading with aria-labelledby, or use aria-label when no visible heading is appropriate.",
      "Keep the dialog role on the container that owns the modal content and focus behavior.",
      "Verify the dialog name in the browser accessibility tree and with a supported screen reader."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
      "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/"
    ]
  },
  "modal-initial-focus-outside": {
    summary: "Move focus to a meaningful element inside the dialog when it opens.",
    howToFix: [
      "Focus the first task-relevant control, or a static heading with tabindex=\"-1\" when users need dialog context first.",
      "Do not leave focus on obscured background content after the modal becomes visible.",
      "Retest the opening sequence using only the keyboard and a screen reader."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
      "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/"
    ]
  },
  "modal-focus-not-restored": {
    summary: "Restore focus to the dialog trigger or the next logical control after closing.",
    howToFix: [
      "Store a reference to the element that opened the dialog and focus it after the dialog closes.",
      "When the trigger no longer exists, move focus to the nearest logical workflow destination.",
      "Verify focus restoration for Escape, close buttons, cancel actions, and successful completion."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
      "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/"
    ]
  },
  "modal-focus-escapes": {
    summary: "Keep keyboard focus inside the modal until the user closes it.",
    howToFix: [
      "Make background content inert while the modal is open and keep the active focus cycle within the dialog.",
      "Move Tab from the last focusable control to the first, and Shift+Tab from the first control to the last.",
      "Retest forward and reverse traversal, every close path, and focus restoration without a pointer."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
      "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/"
    ]
  },
  "modal-escape-no-effect": {
    summary: "Provide a predictable keyboard-operable way to dismiss the dialog.",
    howToFix: [
      "Support Escape for cancellable dialogs when it does not discard critical work without confirmation.",
      "Always provide a clearly named keyboard-focusable close or cancel control.",
      "Verify that closing the dialog restores focus to a logical location."
    ],
    docs: [
      "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/"
    ]
  },
  "layout-horizontal-overflow": {
    summary: "Allow content to reflow at a 320 CSS pixel viewport without requiring two-dimensional scrolling.",
    howToFix: [
      "Replace fixed content widths with responsive max-width, minmax(), flex-wrap, or grid layouts that can shrink.",
      "Keep essential text and controls inside the viewport; place genuinely two-dimensional content such as data tables in a clearly bounded scroll container.",
      "Retest the complete task at 320 CSS pixels and at 400% browser zoom."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/reflow.html"
    ]
  },
  "layout-clipped-text": {
    summary: "Prevent meaningful text from being clipped when the page reflows to a narrow viewport.",
    howToFix: [
      "Remove fixed heights and hidden overflow from text containers unless the complete text remains available through an accessible control.",
      "Allow text to wrap and containers to grow after zoom, localization, and user font changes.",
      "Confirm manually that the flagged text is meaningful and unavailable, because intentional visual truncation can be acceptable when the full name remains accessible."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/reflow.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html"
    ]
  },
  "color-contrast": {
    summary: "Increase foreground/background contrast until the text meets the required WCAG ratio.",
    howToFix: [
      "Use a darker foreground color or lighter background color for normal text.",
      "Keep contrast at least 4.5:1 for normal text and 3:1 for large text."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    ]
  },
  "document-title": {
    summary: "Give the page a descriptive document title.",
    howToFix: [
      "Set a title that identifies the current page or route.",
      "Keep titles unique enough that browser tabs and screen reader page lists are understandable."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title"
    ],
    frameworkExamples: {
      react: "<title>Favorite items</title>",
      vue: "<title>Favorite items</title>",
      angular: "<title>Favorite items</title>"
    }
  },
  "page-title-duplicate": {
    summary: "Give each distinct page a title that identifies its topic or purpose.",
    howToFix: [
      "Put the page-specific description before the shared product or site name.",
      "Verify that browser tabs and screen reader page lists distinguish every scanned route."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title"
    ]
  },
  "page-title-placeholder": {
    summary: "Replace the starter template title with a descriptive page title.",
    howToFix: [
      "Remove framework placeholders such as React App, Vue App, or Vite + React.",
      "Use a title that states the current page purpose and includes the product name only as supporting context."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title"
    ]
  },
  "html-has-lang": {
    summary: "Declare the primary language of the page on the html element.",
    howToFix: [
      "Add a lang attribute to the html element, such as lang=\"en\".",
      "Use the language that matches the main page content."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang"
    ],
    frameworkExamples: {
      react: "<html lang=\"en\">",
      vue: "<html lang=\"en\">",
      angular: "<html lang=\"en\">"
    }
  },
  "html-lang-valid": {
    summary: "Use a valid BCP 47 language code on the html element.",
    howToFix: [
      "Replace invalid language values with a valid code such as en, es, fr, or en-US.",
      "Keep the lang value aligned with the main content language."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html",
      "https://www.w3.org/International/questions/qa-html-language-declarations"
    ]
  },
  "valid-lang": {
    summary: "Use valid language codes wherever lang attributes appear.",
    howToFix: [
      "Replace invalid lang values with valid BCP 47 language codes.",
      "Use lang on content fragments only when they differ from the page language."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html",
      "https://www.w3.org/International/questions/qa-html-language-declarations"
    ]
  },
  "image-alt": {
    summary: "Provide useful alternative text for meaningful images, or mark decorative images as decorative.",
    howToFix: [
      "Add an alt attribute that describes the image purpose in context.",
      "Use an empty alt attribute only when the image is decorative."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      "https://www.w3.org/WAI/tutorials/images/"
    ],
    frameworkExamples: {
      react: "<img src={avatarUrl} alt=\"Customer profile photo\" />",
      vue: "<img :src=\"avatarUrl\" alt=\"Customer profile photo\">"
    }
  },
  "jsx-a11y/alt-text": {
    summary: "Provide useful alternative text for meaningful images, or mark decorative images as decorative.",
    howToFix: [
      "Add an alt prop that describes the image purpose in context.",
      "Use alt=\"\" only when the image is decorative."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      "https://www.w3.org/WAI/tutorials/images/"
    ],
    frameworkExamples: {
      react: "<img src={avatarUrl} alt=\"Customer profile photo\" />"
    }
  },
  "@angular-eslint/template/alt-text": {
    summary: "Provide useful alternative text for meaningful images in Angular templates.",
    howToFix: [
      "Add an alt attribute that describes the image purpose in context.",
      "Use alt=\"\" only when the image is decorative."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      "https://www.w3.org/WAI/tutorials/images/"
    ],
    frameworkExamples: {
      angular: "<img [src]=\"avatarUrl\" alt=\"Customer profile photo\">"
    }
  },
  "input-image-alt": {
    summary: "Provide alternative text for image submit buttons.",
    howToFix: [
      "Add alt text that describes the action performed by the image button.",
      "Prefer a text button when the image is not essential."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html"
    ],
    frameworkExamples: {
      react: "<input type=\"image\" src={searchIcon} alt=\"Search\" />",
      vue: "<input type=\"image\" :src=\"searchIcon\" alt=\"Search\">",
      angular: "<input type=\"image\" [src]=\"searchIcon\" alt=\"Search\">"
    }
  },
  "button-name": {
    summary: "Give every button an accessible name.",
    howToFix: [
      "Use visible button text when possible.",
      "For icon-only buttons, add aria-label or aria-labelledby."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ],
    frameworkExamples: {
      react: "<button type=\"button\" aria-label=\"Open menu\"><MenuIcon /></button>",
      vue: "<button type=\"button\" aria-label=\"Open menu\"><MenuIcon /></button>",
      angular: "<button type=\"button\" aria-label=\"Open menu\"><app-menu-icon /></button>"
    }
  },
  "input-button-name": {
    summary: "Give every input button an accessible name.",
    howToFix: [
      "Add a value attribute that describes the button action.",
      "Use a native button with visible text when the control is not constrained to input."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ],
    frameworkExamples: {
      react: "<input type=\"button\" value=\"Add favorite\" />",
      vue: "<input type=\"button\" value=\"Add favorite\">",
      angular: "<input type=\"button\" value=\"Add favorite\">"
    }
  },
  "link-name": {
    summary: "Give every link text or an accessible name that explains its purpose.",
    howToFix: [
      "Use descriptive link text instead of generic labels like 'click here'.",
      "For icon-only links, add aria-label or aria-labelledby."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ]
  },
  "label": {
    summary: "Associate every form control with a visible label or accessible name.",
    howToFix: [
      "Connect label and control with htmlFor/id, for/id, or an equivalent framework binding.",
      "Use aria-label only when a visible label is not practical."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
    ],
    frameworkExamples: {
      react: "<label htmlFor=\"email\">Email</label><input id=\"email\" name=\"email\" />",
      vue: "<label for=\"email\">Email</label><input id=\"email\" name=\"email\">",
      angular: "<label for=\"email\">Email</label><input id=\"email\" name=\"email\">"
    }
  },
  "select-name": {
    summary: "Give every select element a visible label or accessible name.",
    howToFix: [
      "Connect a visible label to the select with for/id.",
      "Use aria-label only when a visible label is not practical."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ],
    frameworkExamples: {
      react: "<label htmlFor=\"sort\">Sort by</label><select id=\"sort\" name=\"sort\" />",
      vue: "<label for=\"sort\">Sort by</label><select id=\"sort\" name=\"sort\"></select>",
      angular: "<label for=\"sort\">Sort by</label><select id=\"sort\" name=\"sort\"></select>"
    }
  },
  "form-field-multiple-labels": {
    summary: "Avoid multiple competing labels for one form control.",
    howToFix: [
      "Keep one primary visible label associated with the form control.",
      "Move helper text into aria-describedby when extra instructions are needed."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
    ]
  },
  "jsx-a11y/label-has-associated-control": {
    summary: "Associate every form label with its control.",
    howToFix: [
      "Use htmlFor on the label and a matching id on the input.",
      "Keep visible label text near the input so users understand the required action."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
    ],
    frameworkExamples: {
      react: "<label htmlFor=\"email\">Email</label><input id=\"email\" name=\"email\" />"
    }
  },
  "@angular-eslint/template/label-has-associated-control": {
    summary: "Associate every form label with its Angular template control.",
    howToFix: [
      "Use for on the label and a matching id on the input.",
      "Keep visible label text near the input so users understand the required action."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
    ],
    frameworkExamples: {
      angular: "<label for=\"email\">Email</label><input id=\"email\" name=\"email\">"
    }
  },
  "keyboard": {
    summary: "Ensure interactive behavior is available from the keyboard.",
    howToFix: [
      "Prefer native controls such as button, a, input, and select.",
      "If a custom widget is unavoidable, implement keyboard handlers and focus management."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html"
    ]
  },
  "@angular-eslint/template/click-events-have-key-events": {
    summary: "Pair click behavior with keyboard interaction, or use a native control.",
    howToFix: [
      "Replace clickable non-interactive elements with button or a where possible.",
      "If custom behavior remains, add keyboard event support and a valid focus target."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html"
    ],
    frameworkExamples: {
      angular: "<button type=\"button\" (click)=\"save()\">Save</button>"
    }
  },
  "@angular-eslint/template/interactive-supports-focus": {
    summary: "Make custom interactive elements focusable, or use native interactive elements.",
    howToFix: [
      "Prefer native button or link elements.",
      "If a custom element is necessary, add an appropriate tabindex and keyboard behavior."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html"
    ]
  },
  "@angular-eslint/template/no-positive-tabindex": {
    summary: "Avoid positive tabindex values because they create confusing focus order.",
    howToFix: [
      "Remove positive tabindex values.",
      "Use DOM order and tabindex=\"0\" only when a custom focus target is necessary."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html"
    ]
  },
  "aria-required-attr": {
    summary: "Provide required ARIA attributes for the element role.",
    howToFix: [
      "Check the role requirements and add the missing aria-* attribute.",
      "Prefer native semantic elements when they provide the same behavior."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ]
  },
  "aria-allowed-attr": {
    summary: "Use ARIA attributes only on elements and roles that support them.",
    howToFix: [
      "Remove unsupported aria-* attributes from the element.",
      "If the attribute is needed, use a role or native element that supports it."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
      "https://www.w3.org/TR/wai-aria-1.2/#states_and_properties"
    ]
  },
  "aria-roles": {
    summary: "Use valid ARIA roles and avoid overriding native semantics unnecessarily.",
    howToFix: [
      "Replace invalid role values with valid WAI-ARIA roles.",
      "Remove redundant roles when a native HTML element already exposes the right semantics."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ]
  },
  "aria-valid-attr": {
    summary: "Use valid ARIA attribute names.",
    howToFix: [
      "Fix typos in aria-* attributes.",
      "Remove custom aria-* attributes that are not defined by WAI-ARIA."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
      "https://www.w3.org/TR/wai-aria-1.2/#states_and_properties"
    ]
  },
  "aria-valid-attr-value": {
    summary: "Use valid values for ARIA attributes.",
    howToFix: [
      "Check the allowed value type for the failing aria-* attribute.",
      "Use true/false, token, id reference, or number values only where the ARIA specification allows them."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
      "https://www.w3.org/TR/wai-aria-1.2/#states_and_properties"
    ]
  },
  "heading-order": {
    summary: "Keep headings in a logical order.",
    howToFix: [
      "Do not skip heading levels only for visual styling.",
      "Use CSS for size and keep heading levels aligned with the page outline."
    ],
    docs: [
      "https://www.w3.org/WAI/tutorials/page-structure/headings/",
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
    ],
    frameworkExamples: {
      react: "<main><h1>Settings</h1><section><h2>Notifications</h2></section></main>",
      vue: "<main><h1>Settings</h1><section><h2>Notifications</h2></section></main>",
      angular: "<main><h1>Settings</h1><section><h2>Notifications</h2></section></main>"
    }
  },
  "listitem": {
    summary: "Use list items only inside semantic lists.",
    howToFix: [
      "Place li elements inside ul or ol.",
      "If the content is not a list, use neutral elements such as div or p instead."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/li"
    ]
  },
  "list": {
    summary: "Use semantic list markup for list content.",
    howToFix: [
      "Use ul or ol for grouped list items.",
      "Do not use list roles or li elements for layout-only groups."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ul"
    ]
  },
  "autocomplete-valid": {
    summary: "Use valid autocomplete tokens for fields that collect user information.",
    howToFix: [
      "Use standardized autocomplete values such as email, name, tel, street-address, or one-time-code.",
      "Remove invalid tokens so browsers and assistive technologies can identify input purpose."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete"
    ],
    frameworkExamples: {
      react: "<input id=\"email\" name=\"email\" autoComplete=\"email\" />",
      vue: "<input id=\"email\" name=\"email\" autocomplete=\"email\">",
      angular: "<input id=\"email\" name=\"email\" autocomplete=\"email\">"
    }
  },
  "landmark-one-main": {
    summary: "Add exactly one main landmark so users can jump to the primary page content.",
    howToFix: [
      "Wrap the page's primary content in one main element.",
      "Do not create multiple main landmarks on the same page."
    ],
    docs: [
      "https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/main"
    ],
    frameworkExamples: {
      react: "<main><h1>Favorite items</h1>{children}</main>",
      vue: "<main><h1>Favorite items</h1><slot /></main>",
      angular: "<main><h1>Favorite items</h1><app-list /></main>"
    }
  },
  "page-has-heading-one": {
    summary: "Add a clear h1 that names the current page or route.",
    howToFix: [
      "Use one h1 near the start of the main content.",
      "If the visual design cannot show it, keep an h1 available to screen readers with a visually-hidden utility class."
    ],
    docs: [
      "https://www.w3.org/WAI/tutorials/page-structure/headings/",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements"
    ],
    frameworkExamples: {
      react: "<main><h1>Favorite items</h1></main>",
      vue: "<main><h1>Favorite items</h1></main>",
      angular: "<main><h1>Favorite items</h1></main>"
    }
  },
  "keyboard-focus-lost": {
    summary: "Keep keyboard focus on a meaningful interactive target after every Tab press.",
    howToFix: [
      "Do not remove or disable the currently focused element without moving focus to the next logical target.",
      "Check custom key handlers for preventDefault calls that stop normal Tab navigation.",
      "After closing temporary UI, restore focus to the control that opened it or another logical target."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html"
    ]
  },
  "keyboard-control-unreachable": {
    summary: "Make every interactive control reachable in the logical keyboard focus order.",
    howToFix: [
      "Use a native interactive element such as button, a, input, select, or textarea whenever possible.",
      "Remove tabindex=\"-1\" from controls that users must reach directly and avoid positive tabindex values.",
      "Check whether an inert, hidden, disabled, or collapsed ancestor incorrectly excludes the control from navigation."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex"
    ]
  },
  "keyboard-activation-no-effect": {
    summary: "Implement the documented keyboard interaction for this stateful control.",
    howToFix: [
      "Prefer the native HTML control whose built-in keyboard behavior matches the interaction.",
      "For a custom widget, follow the WAI-ARIA Authoring Practices keyboard pattern for its role.",
      "Update focus and the relevant checked, selected, expanded, or pressed state when the key is handled."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
      "https://www.w3.org/WAI/ARIA/apg/patterns/"
    ]
  },
  "region": {
    summary: "Place visible page content inside semantic landmarks.",
    howToFix: [
      "Wrap primary content in main and repeated navigation in nav.",
      "Use header, footer, aside, or section with an accessible name where they match the content purpose."
    ],
    docs: [
      "https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/",
      "https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/landmark_role"
    ],
    frameworkExamples: {
      react: "<main><h1>Favorite items</h1><ItemList /></main>",
      vue: "<main><h1>Favorite items</h1><ItemList /></main>",
      angular: "<main><h1>Favorite items</h1><app-list /></main>"
    }
  },
  "@angular-eslint/template/button-has-type": {
    summary: "Add an explicit type to every button in Angular templates.",
    howToFix: [
      "Use type=\"button\" for normal UI actions.",
      "Use type=\"submit\" only for buttons that intentionally submit a form."
    ],
    docs: [
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#type"
    ],
    frameworkExamples: {
      angular: "<button type=\"button\" (click)=\"toggleFavorite(item)\">Favorite</button>"
    }
  }
};

export function getRemediationHint(
  ruleId: string,
  wcagCriteria: WcagCriterion[] = [],
  framework: Framework | string = "unknown",
  options: {
    helpUrl?: string;
  } = {}
): RemediationHint {
  const directHint = findRuleHint(ruleId);
  if (directHint) {
    return withAdditionalDocs(
      filterFrameworkExamples(directHint, framework),
      options.helpUrl
    );
  }

  if (wcagCriteria.length === 0) {
    return createGenericHint(ruleId, options);
  }

  return {
    summary: "Review the mapped WCAG success criteria and fix the underlying accessibility requirement.",
    howToFix: wcagCriteria.map((criterion) => `Address WCAG ${criterion.id} ${criterion.title}.`),
    docs: unique([
      ...(options.helpUrl ? [options.helpUrl] : []),
      ...wcagCriteria.map((criterion) => criterion.url)
    ])
  };
}

function createGenericHint(
  ruleId: string,
  options: {
    helpUrl?: string;
  }
): RemediationHint {
  if (ruleId === "adapter/human-verification") {
    return {
      summary: "Run the audit against an environment that allows trusted automation, or record manual evidence for the blocked page.",
      howToFix: [
        "Use a staging, preview, or allowlisted URL where bot protection does not replace the page with a human-verification challenge.",
        "If production must be tested, coordinate with the site owner or security team to allow the audit runner temporarily.",
        "Do not bypass CAPTCHA automatically; document the blocked page and complete a manual accessibility review for the affected flow."
      ],
      docs: options.helpUrl ? [options.helpUrl] : []
    };
  }

  if (ruleId.startsWith("adapter/")) {
    return {
      summary: "Restore the scanner setup so the affected accessibility checks can run.",
      howToFix: [
        "Read the adapter error message and verify the target URL, installed dependencies, and project configuration.",
        "Run the command again with --verbose and confirm that the adapter completes before relying on the report."
      ],
      docs: options.helpUrl ? [options.helpUrl] : []
    };
  }

  return {
    summary: `Review the reported target and resolve the ${ruleId} accessibility rule.`,
    howToFix: [
      "Inspect the reported selector or source location and compare it with the rule guidance.",
      "Prefer native semantic HTML; add ARIA only when native semantics cannot express the required behavior.",
      "Rerun the automated check, then verify the affected interaction manually with keyboard and assistive technology where relevant."
    ],
    docs: options.helpUrl
      ? [options.helpUrl]
      : ["https://www.w3.org/WAI/test-evaluate/preliminary/"]
  };
}

function withAdditionalDocs(hint: RemediationHint, helpUrl?: string): RemediationHint {
  if (!helpUrl) return hint;

  return {
    ...hint,
    docs: unique([helpUrl, ...hint.docs])
  };
}

function findRuleHint(ruleId: string): RemediationHint | undefined {
  if (RULE_HINTS[ruleId]) return RULE_HINTS[ruleId];

  const lowerRuleId = ruleId.toLowerCase();
  const match = Object.entries(RULE_HINTS)
    .find(([rule]) => lowerRuleId.includes(rule));

  return match ? match[1] : undefined;
}

function filterFrameworkExamples(hint: RemediationHint, framework: Framework | string): RemediationHint {
  if (!hint.frameworkExamples || framework === "auto" || framework === "unknown") return hint;
  if (framework !== "react" && framework !== "vue" && framework !== "angular") return hint;

  const example = hint.frameworkExamples[framework];
  if (!example) return hint;

  return {
    ...hint,
    frameworkExamples: {
      [framework]: example
    }
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
