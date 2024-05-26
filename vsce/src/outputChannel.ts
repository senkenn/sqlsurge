import * as vscode from "vscode";

export function createOutputChannel(): vscode.LogOutputChannel {
  const logger = vscode.window.createOutputChannel("sqlsurge", {
    log: true,
  });
  return logger;
}
