import * as vscode from "vscode";
import { findSqlsInPath } from "../startSqlsClient";

export const command = vscode.commands.registerCommand(
  "sqlsurge.installSqls",
  async () => {
    // check if sqls is already installed
    let sqlsPath = await findSqlsInPath();
    if (sqlsPath) {
      await vscode.window.showInformationMessage("sqls is already installed.");
      return;
    }

    // install sqls
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Installing sqls...",
      },
      async () => {
        vscode.window
          .createOutputChannel("sqlsurge")
          .appendLine("Installing sqls...");

        // install sqls with command and wait for it
        const terminal = vscode.window.createTerminal("install sqls");
        terminal.show();
        terminal.sendText("go install github.com/sqls-server/sqls@latest");
        const timeout = 60 * 1000;
        const start = Date.now();
        while (Date.now() - start < timeout) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          sqlsPath = await findSqlsInPath();
          if (sqlsPath) {
            break;
          }
        }
      },
    );
    if (!sqlsPath) {
      vscode.window.showErrorMessage("Failed to install sqls");
      return;
    }

    // after installation
    vscode.window
      .createOutputChannel("sqlsurge")
      .appendLine("sqls is installed.");
    const actions = await vscode.window.showInformationMessage(
      "sqls was successfully installed! Restart language server to enable SQL language features.",
      "Restart Language Server",
    );
    if (actions === "Restart Language Server") {
      vscode.commands.executeCommand("sqlsurge.restartSqlLanguageServer");
    }
  },
);
