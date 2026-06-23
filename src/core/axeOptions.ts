export function getAxeRunOptions(): { rules: Record<string, { enabled: boolean }> } {
  return {
    rules: {
      "target-size": { enabled: true }
    }
  };
}
