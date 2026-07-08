export const MOBILE_DEVICE_PRESET = "iPhone 13";
export const TABLET_DEVICE_PRESET = "iPad (gen 7)";

export interface DevicePresetOptions {
  device?: string;
  mobile?: boolean;
  tablet?: boolean;
}

export function resolveDevicePreset(options: DevicePresetOptions): string | undefined {
  const explicitDevice = options.device?.trim();
  const selectedProfiles = [
    explicitDevice ? "--device" : undefined,
    options.mobile ? "--mobile" : undefined,
    options.tablet ? "--tablet" : undefined
  ].filter(Boolean);

  if (selectedProfiles.length > 1) {
    throw new Error(`Choose only one browser device profile: ${selectedProfiles.join(", ")}.`);
  }

  if (options.mobile) return MOBILE_DEVICE_PRESET;
  if (options.tablet) return TABLET_DEVICE_PRESET;
  return explicitDevice || undefined;
}
