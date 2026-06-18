# v0.6.2 Release Notes

`a11y-shiftleft-cli` v0.6.2 is a visual exploration hotfix.

## Fixed

- Popup protection now listens only for popup windows created by the active
  page. It no longer observes and accidentally closes the primary exploration
  page.
- Axe scans can complete normally on affected sites instead of returning only
  `adapter/explore-scan-error` findings with a closed-page message.

The fix was reproduced against Binaryville. After the change, exploration
again detected the route-specific color contrast findings with a measured
ratio of `3.12:1` against the required `4.5:1` ratio.

## Update

```bash
npm install --save-dev a11y-shiftleft-cli@0.6.2
```
