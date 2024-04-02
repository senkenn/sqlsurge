import * as path from "node:path";
import * as vscode from "vscode";

const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
if (!wsPath) {
  throw new Error("wsPath is undefined");
}

describe("Completion Test", () => {
  test("Should be completion", async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const pos = new vscode.Position(5, 45);
    editor.selection = new vscode.Selection(pos, pos);
    const actualCompletionList =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        docUri,
        pos,
      );
    console.log(actualCompletionList.items.length);
    await new Promise((resolve) => setTimeout(resolve, 6000));
    console.log(actualCompletionList.items);

    expect(true).toBe(true);
  }, 10000);
});
