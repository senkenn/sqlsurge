import * as vscode from "vscode";

let logger: vscode.LogOutputChannel | undefined;

export function createLogger(): vscode.LogOutputChannel {
  if (logger) {
    return logger;
  }

  logger = vscode.window.createOutputChannel("sqlsurge", {
    log: true,
  });
  return logger;
}
