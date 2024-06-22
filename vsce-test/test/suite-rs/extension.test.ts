import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { resetTestWorkspace, sleep } from "../helper";

const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
if (!wsPath) {
  throw new Error("wsPath is undefined");
}

const rootDir = path.resolve(wsPath, "..", "..");
const allTsConfigPaths = execSync(
  `find ${rootDir} -name tsconfig.json | grep -v node_modules`,
).toString();
const tsconfigPaths = allTsConfigPaths.split("\n").join(" ");

beforeAll(async () => {
  // delete all tsconfig.json
  execSync(`rm -rf ${tsconfigPaths}`);

  await resetTestWorkspace(wsPath, [
    path.resolve(wsPath, "src", "main.rs"),
    path.resolve(wsPath, "src", "diesel.rs"),
  ]);
});

afterEach(async () => {
  // restore tsconfig.json
  execSync(`git restore ${tsconfigPaths}`);

  await resetTestWorkspace(wsPath, [
    path.resolve(wsPath, "src", "main.rs"),
    path.resolve(wsPath, "src", "diesel.rs"),
  ]);
});

describe("Completion Test", () => {
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

  it('Should be completed "INSERT" with diesel function', async () => {
    const filePath = path.resolve(wsPath, "src", "diesel.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await sleep(1000);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge", vscode.workspace.workspaceFolders?.[0].uri)
      .update("customRawSqlQuery", {
        language: "rust",
        configs: [
          {
            functionName: "sql_query",
            sqlArgNo: 1,
            isMacro: false,
          },
        ],
      });
    // Wait for server activation
    await sleep(2000);

    const pos = new vscode.Position(14, 4);
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
});

describe("Formatting Test", () => {
  it("Should be formatted with command", async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(1000);

    // execute command
    await vscode.commands.executeCommand("sqlsurge.formatSql");

    await sleep(1000);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it("Should be formatted with save if config is default(enabled)", async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await sleep(1000);
    await vscode.workspace.save(docUri);
    await sleep(1000);

    const newText = fs.readFileSync(filePath, "utf8");
    expect(newText).toMatchSnapshot();
  });

  it("Should be NOT formatted with save if config is disabled", async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await sleep(1000);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge")
      .update("formatOnSave", false);

    await vscode.workspace.save(docUri);
    await sleep(1000);

    const newText = fs.readFileSync(filePath, "utf8");
    expect(newText).toMatchSnapshot();
  });

  it("Should be formatted with indent if config is enabled(default: off)", async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await sleep(1000);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge")
      .update("formatSql.indent", true);

    // execute command
    await vscode.commands.executeCommand("sqlsurge.formatSql");
    await sleep(1000);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it("Should be formatted with 2 tab size indent", async () => {
    const filePath = path.resolve(wsPath, "src", "main.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await sleep(1000);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge", vscode.workspace.workspaceFolders?.[0].uri)
      .update("formatSql.indent", true);
    await vscode.workspace
      .getConfiguration("sqlsurge")
      .update("formatSql.tabSize", 2);

    // execute command
    await vscode.commands.executeCommand("sqlsurge.formatSql");
    await sleep(1000);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it("Should be formatted with diesel function", async () => {
    const filePath = path.resolve(wsPath, "src", "diesel.rs");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await sleep(1000);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge", vscode.workspace.workspaceFolders?.[0].uri)
      .update("customRawSqlQuery", {
        language: "rust",
        configs: [
          {
            functionName: "sql_query",
            sqlArgNo: 1,
            isMacro: false,
          },
        ],
      });

    // execute command
    await vscode.commands.executeCommand("sqlsurge.formatSql");
    await sleep(1000);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it.each`
    desc                      | content
    ${"empty"}                | ${""}
    ${"one space"}            | ${" "}
    ${"one new line"}         | ${"\n"}
    ${"spaces and new lines"} | ${"\n  \n  \n"}
  `(
    "Should NOT be formatted with empty content: $desc",
    async ({ content }) => {
      const filePath = path.resolve(wsPath, "src", "main.rs");
      const docUri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(docUri);
      const editor = await vscode.window.showTextDocument(doc);

      await sleep(1000);

      // change config
      const replaceRange = new vscode.Range(
        new vscode.Position(52, 9),
        new vscode.Position(52, 69),
      );
      await editor.edit((editBuilder) => {
        editBuilder.replace(replaceRange, content);
      });

      // execute command
      await vscode.commands.executeCommand("sqlsurge.formatSql");
      await sleep(1000);

      // execute command
      const formattedText = doc.getText();
      expect(formattedText).toMatchSnapshot();
    },
  );
});
