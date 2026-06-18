# v0.6.3 Release Notes

`a11y-shiftleft-cli` v0.6.3 fixes annotation alignment in visual reports.

## Fixed

- Error-crop metadata now uses the actual encoded PNG or JPEG dimensions
  instead of assuming that Playwright captured the requested clip size.
- Annotation percentages are calculated against the real image dimensions for
  full-page and focused evidence screenshots.
- Error crops explicitly request capture beyond the current viewport.
- Annotation borders use border-box sizing so the border does not expand the
  highlighted region.

The regression was reproduced with a crop whose requested size was
`1280x896`, while the saved JPEG was actually `1280x720`. The report now stores
`1280x720` and uses that same coordinate space in previews and expanded views.

## Update

```bash
npm install --save-dev a11y-shiftleft-cli@0.6.3
```
