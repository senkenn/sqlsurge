import * as vscode from "vscode";

export let logger: vscode.LogOutputChannel;

export function createOutputChannel() {
  logger = vscode.window.createOutputChannel("sqlsurge", {
    log: true,
  });
  return logger;
}
