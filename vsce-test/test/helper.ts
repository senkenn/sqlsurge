import { execSync } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resetTestWorkspace(
  wsPath: string,
  testFilePaths: string[],
) {
  // restore file
  const settingsJsonPath = path.resolve(wsPath, ".vscode", "settings.json");
  const testFilePathJoinedWithSpace = testFilePaths.join(" ");

  execSync(`git restore ${testFilePathJoinedWithSpace} ${settingsJsonPath}`);

  // close active editor
  await vscode.commands.executeCommand("workbench.action.closeAllGroups");
}
