export function formatCliError(error: unknown, argv: string[] = process.argv): string {
  const message = error instanceof Error
    ? error.stack || error.message
    : String(error);

  if (isMissingChromiumError(message)) {
    return [
      "Chromium is missing.",
      "",
      "Install the browser used by Playwright:",
      "  npx playwright install chromium"
    ].join("\n");
  }

  if (isTargetUrlError(message)) {
    const url = findCliOptionValue(argv, "--url") || "the target URL";
    const doctorUrl = url === "the target URL" ? "<url>" : url;
    return [
      `Could not open ${url}.`,
      "",
      "Try:",
      "  npm run dev",
      `  npx a11y-shiftleft-cli doctor --url ${doctorUrl}`
    ].join("\n");
  }

  return message;
}

function isMissingChromiumError(message: string): boolean {
  return /Executable doesn't exist|Please run.*playwright install|playwright install/i.test(message)
    && /chromium|chrome|browser/i.test(message);
}

function isTargetUrlError(message: string): boolean {
  return /ECONNREFUSED|ERR_CONNECTION_REFUSED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_RESET|net::ERR_|Timeout .*URL|Navigation timeout/i.test(message);
}

function findCliOptionValue(argv: string[], option: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === option) return argv[index + 1];
    if (value.startsWith(`${option}=`)) return value.slice(option.length + 1);
  }
  return undefined;
}
