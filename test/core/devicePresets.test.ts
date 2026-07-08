import test from "node:test";
import assert from "node:assert/strict";
import {
  MOBILE_DEVICE_PRESET,
  TABLET_DEVICE_PRESET,
  resolveDevicePreset
} from "../../dist/core/devicePresets.js";

test("resolveDevicePreset maps friendly mobile and tablet shortcuts", () => {
  assert.equal(resolveDevicePreset({ mobile: true }), MOBILE_DEVICE_PRESET);
  assert.equal(resolveDevicePreset({ tablet: true }), TABLET_DEVICE_PRESET);
  assert.equal(resolveDevicePreset({ device: "Pixel 5" }), "Pixel 5");
});

test("resolveDevicePreset trims explicit device names", () => {
  assert.equal(resolveDevicePreset({ device: " iPhone 13 " }), "iPhone 13");
  assert.equal(resolveDevicePreset({ device: "   " }), undefined);
});

test("resolveDevicePreset rejects conflicting device profile options", () => {
  assert.throws(
    () => resolveDevicePreset({ device: "Pixel 5", mobile: true }),
    /Choose only one browser device profile/
  );
  assert.throws(
    () => resolveDevicePreset({ mobile: true, tablet: true }),
    /Choose only one browser device profile/
  );
});
