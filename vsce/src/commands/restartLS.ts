import * as vscode from "vscode";
import { restartLanguageServer } from "../startSqlsClient";

export const command = vscode.commands.registerCommand(
  "sqlsurge.restartSqlLanguageServer",
  async () => {
    await restartLanguageServer();
  },
);
