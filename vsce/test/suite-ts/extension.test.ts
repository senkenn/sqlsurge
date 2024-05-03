import { execSync } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";
import { sleep } from "../helper";

const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
if (!wsPath) {
  throw new Error("wsPath is undefined");
}

describe("Install sqls if not found in PATH", () => {
  test("Should find sqls in PATH", async () => {
    const sqlsVersion = execSync("sqls --version").toString();
    console.log(sqlsVersion);
    expect(sqlsVersion).not.toBe("");
  });
});

describe("Prisma Completion Test", () => {
  test('Should be completed "SELECT" with $queryRaw single line', async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(2000);

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
  });

  test('Should be completed "VALUES" with $queryRaw multi line', async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(2000);

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
  });
});

describe("Formatting Test", () => {
  afterEach(() => {
    // reset config
    vscode.workspace.getConfiguration("sqlsurge").update("formatOnSave", true);

    // restore file
    const mainRsPath = path.resolve(wsPath, "src", "index.ts");
    const settingsJsonPath = path.resolve(wsPath, ".vscode", "settings.json");
    execSync(`git restore ${mainRsPath} ${settingsJsonPath}`);
  });

  it("Should be formatted with command", async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // execute command
    await vscode.commands.executeCommand("sqlsurge.formatSql");

    await sleep(500);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it("Should be formatted with save if config is default(enabled)", async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await vscode.workspace.save(docUri);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it("Should be NOT formatted with save if config is disabled", async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge")
      .update("formatOnSave", false);
    await sleep(500);

    await vscode.workspace.save(docUri);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });
});
