import { execSync } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resetTestWorkspace(wsPath: string, testFilePath: string) {
  // reset config
  vscode.workspace.getConfiguration("sqlsurge").update("formatOnSave", true);

  // restore file
  const settingsJsonPath = path.resolve(wsPath, ".vscode", "settings.json");
  execSync(`git restore ${testFilePath} ${settingsJsonPath}`);

  // close active editor
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
}
