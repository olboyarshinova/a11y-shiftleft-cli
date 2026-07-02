import { spawn } from "node:child_process";

type Platform = NodeJS.Platform;

export interface OpenReportCommand {
  command: string;
  args: string[];
}

export function getOpenReportCommand(filePath: string, platform: Platform = process.platform): OpenReportCommand {
  if (platform === "darwin") {
    return { command: "open", args: [filePath] };
  }

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", filePath] };
  }

  return { command: "xdg-open", args: [filePath] };
}

export async function openReportFile(filePath: string): Promise<void> {
  const { command, args } = getOpenReportCommand(filePath);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code && code !== 0) {
        reject(new Error(`Open command exited with code ${code}.`));
        return;
      }
      resolve();
    });
  });
}
