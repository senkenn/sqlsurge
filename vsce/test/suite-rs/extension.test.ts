import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { sleep } from "../helper";

const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
if (!wsPath) {
  throw new Error("wsPath is undefined");
}

const rootDir = path.resolve(wsPath, "..", "..");
const allTsConfigPaths = execSync(
  `find ${rootDir} -name tsconfig.json | grep -v node_modules`,
).toString();
const tsconfigPaths = allTsConfigPaths.split("\n").join(" ");

beforeAll(() => {
  // delete all tsconfig.json
  execSync(`rm -rf ${tsconfigPaths}`);
});

afterAll(() => {
  // restore tsconfig.json
  execSync(`git restore ${tsconfigPaths}`);
});

describe("SQLx Completion Test", () => {
  test('Should be completed "INSERT" with query! single line', async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(2000);

    const pos = new vscode.Position(52, 15);
    editor.selection = new vscode.Selection(pos, pos);
    const actualCompletionList =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        docUri,
        pos,
      );

    expect(actualCompletionList.items.length).toBe(1);
    const { label, kind } = actualCompletionList.items[0];
    expect(label).toBe("INSERT");
    expect(kind).toBe(vscode.CompletionItemKind.Keyword);
  }, 10000);

  test('Should be completed "SET" with query! multi line', async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(2000);

    const pos = new vscode.Position(65, 3);
    editor.selection = new vscode.Selection(pos, pos);
    const actualCompletionList =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        docUri,
        pos,
      );

    expect(actualCompletionList.items.length).toBe(1);
    const { label, kind } = actualCompletionList.items[0];
    expect(label).toBe("SET");
    expect(kind).toBe(vscode.CompletionItemKind.Keyword);
  });

  test('Should be completed "BY" with query_as! multi line', async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(2000);

    const pos = new vscode.Position(84, 8);
    editor.selection = new vscode.Selection(pos, pos);
    const actualCompletionList =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        docUri,
        pos,
      );

    expect(actualCompletionList.items.length).toBe(1);
    const { label, kind } = actualCompletionList.items[0];
    expect(label).toBe("BY");
    expect(kind).toBe(vscode.CompletionItemKind.Keyword);
  });
});

describe("Formatting Test", () => {
  afterEach(() => {
    // reset config
    vscode.workspace.getConfiguration("sqlsurge").update("formatOnSave", true);

    // restore file
    const mainRsPath = path.resolve(wsPath, "src", "main.rs");
    const settingsJsonPath = path.resolve(wsPath, ".vscode", "settings.json");
    execSync(`git restore ${mainRsPath} ${settingsJsonPath}`);
  });

  it("Should be formatted with command", async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
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
    const filePath = path.resolve(wsPath, "src", "main.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await vscode.workspace.save(docUri);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it("Should be NOT formatted with save if config is disabled", async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
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
