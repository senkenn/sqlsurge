import { execFileSync, execSync } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resetTestWorkspace(
  wsPath: string,
  testFilePaths: string[],
) {
  // Files to be restored
  const settingsJsonPath = path.resolve(wsPath, ".vscode", "settings.json");
  const testFilePathJoinedWithSpace = testFilePaths.join(" ");
  const sqlFormatterConfigPath = path.resolve(wsPath, ".sql-formatter.json");

  // restore saved files
  execFileSync("git", [
    "restore",
    ...testFilePaths,
    settingsJsonPath,
    sqlFormatterConfigPath,
  ]);

  // revert unsaved changes
  await vscode.commands.executeCommand("workbench.action.files.revert");
}

export const waitingTimeCompletion = process.platform === "win32" ? 4000 : 1500;
export const waitingTimeFormatting = process.platform === "win32" ? 1500 : 1000;
