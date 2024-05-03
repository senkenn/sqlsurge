import * as vscode from "vscode";

type ExtConfig = {
  formatOnSave: boolean;
};

export const extConfig: ExtConfig = {
  formatOnSave: true,
};

export function getWorkspaceConfig(): ExtConfig {
  const config = vscode.workspace.getConfiguration("sqlsurge");

  const formatOnSave = config.get("formatOnSave");
  if (typeof formatOnSave !== "boolean") {
    throw new Error(
      `formatOnSave must be a boolean, but got ${formatOnSave}(type:${typeof formatOnSave})`,
    );
  }

  return { formatOnSave };
}
