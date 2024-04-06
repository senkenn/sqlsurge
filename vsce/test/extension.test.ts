import * as path from "node:path";
import * as vscode from "vscode";
import { sleep } from "./helper";

const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
if (!wsPath) {
  throw new Error("wsPath is undefined");
}

describe("Prisma Completion Test", () => {
  test('Should be completed "SELECT" with $queryRaw single line', async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(5000);

    const pos = new vscode.Position(5, 44);
    editor.selection = new vscode.Selection(pos, pos);
    const actualCompletionList =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        docUri,
        pos,
      );

    expect(actualCompletionList.items.length).toBe(1);
    const { label, kind } = actualCompletionList.items[0];
    expect(label).toBe("SELECT");
    expect(kind).toBe(vscode.CompletionItemKind.Keyword);
  }, 10000);

  test('Should be completed "VALUES" with $queryRaw multi line', async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(5000);

    const pos = new vscode.Position(13, 10);
    editor.selection = new vscode.Selection(pos, pos);
    const actualCompletionList =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        docUri,
        pos,
      );

    expect(actualCompletionList.items.length).toBe(1);
    const { label, kind } = actualCompletionList.items[0];
    expect(label).toBe("VALUES");
    expect(kind).toBe(vscode.CompletionItemKind.Keyword);
  }, 10000);
});
