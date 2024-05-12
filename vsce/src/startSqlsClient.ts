import { delimiter } from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";

interface LanguageServerConfig {
  flags: string[];
}

export let client: LanguageClient;

export async function startSqlsClient() {
  const sqlsConfig = vscode.workspace.getConfiguration("sqlsurge");
  const config: LanguageServerConfig = {
    flags: sqlsConfig.languageServerFlags || [],
  };

  let sqlsInPATH = await findSqlsInPath();
  if (!sqlsInPATH) {
    // not found sqls, install sqls automatically
    const action = await vscode.window.showInformationMessage(
      "sqls is not installed yet. You need to install sqls to enable SQL language features.",
      "Install with command",
      "Install manually (Jump to the installation guide)",
    );
    switch (action) {
      case "Install with command":
        await vscode.commands.executeCommand("sqlsurge.installSqls");
        break;
      case "Install manually (Jump to the installation guide)":
        await vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.parse(
            "https://github.com/sqls-server/sqls?tab=readme-ov-file#installation",
          ),
        );
        vscode.window
          .createOutputChannel("sqlsurge")
          .appendLine("sqls is not installed.");
        return;
      default:
        vscode.window
          .createOutputChannel("sqlsurge")
          .appendLine("sqls is not installed.");
        return;
    }

    // check again
    sqlsInPATH = await findSqlsInPath();
    if (!sqlsInPATH) {
      throw new Error("sqls should be installed but not found in PATH");
    }
  }

  const serverOptions: ServerOptions = {
    command: sqlsInPATH.fsPath,
    args: [...config.flags],
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: "sql", pattern: "**/*.sql" }],
  };

  client = new LanguageClient("sqls", serverOptions, clientOptions);
  client.start();
}

export async function findSqlsInPath(): Promise<vscode.Uri | undefined> {
  const path = process.env.PATH;

  if (!path) {
    throw new Error("PATH environment variable is not set");
  }

  for (const dir of path.split(delimiter)) {
    const sqls = vscode.Uri.joinPath(vscode.Uri.file(dir), "sqls");
    if (await fileExists(sqls)) {
      return sqls;
    }
  }

  return;
}

async function fileExists(path: vscode.Uri) {
  try {
    await vscode.workspace.fs.stat(path);
    return true;
  } catch (err: any) {
    if (err.code === "ENOENT" || err.code === "FileNotFound") {
      return false;
    }
    throw err;
  }
}
