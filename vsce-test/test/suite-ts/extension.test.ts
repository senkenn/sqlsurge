import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  resetTestWorkspace,
  sleep,
  waitingTimeCompletion,
  waitingTimeFormatting,
} from "../helper";

const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
if (!wsPath) {
  throw new Error("wsPath is undefined");
}

beforeAll(async () => {
  await resetTestWorkspace(wsPath, [
    path.resolve(wsPath, "src", "index.ts"),
    path.resolve(wsPath, "src", "userDefined.ts"),
  ]);
});
afterEach(async () => {
  await resetTestWorkspace(wsPath, [
    path.resolve(wsPath, "src", "index.ts"),
    path.resolve(wsPath, "src", "userDefined.ts"),
  ]);
});

describe("Install sqls if not found in PATH", () => {
  test("Should find sqls in PATH", async () => {
    const sqlsVersion = execSync("sqls --version").toString();
    expect(sqlsVersion).not.toBe("");
  });
});

describe("Restart Language Server Test", () => {
  test("Should restart SQL language server", async () => {
    await vscode.commands.executeCommand("sqlsurge.restartSqlLanguageServer");

    // confirm completion
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);

    // Wait for server activation
    await sleep(waitingTimeCompletion);

    const pos = new vscode.Position(5, 44);
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

describe("Completion Test", () => {
  test('Should be completed "SELECT" with $queryRaw single line', async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(waitingTimeCompletion);

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
    await sleep(waitingTimeCompletion);

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

  it('Should be completed "INSERT" with user-defined function', async () => {
    const filePath = path.resolve(wsPath, "src", "userDefined.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await sleep(waitingTimeFormatting);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge", vscode.workspace.workspaceFolders?.[0].uri)
      .update("customRawSqlQuery", {
        language: "typescript",
        configs: [
          {
            functionName: "query",
            sqlArgNo: 2,
            isTemplateLiteral: false,
          },
        ],
      });
    // Wait for server activation
    await sleep(waitingTimeCompletion);

    const pos = new vscode.Position(13, 9);
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
  });
});

describe("Formatting Test", () => {
  it("Should be formatted with command", async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(waitingTimeFormatting);

    // execute command
    await vscode.commands.executeCommand("sqlsurge.formatSql");

    await sleep(waitingTimeFormatting);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it("Should be formatted with save if config is default(enabled)", async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(waitingTimeFormatting);

    await vscode.workspace.save(docUri);
    await sleep(waitingTimeFormatting);

    const newText = fs.readFileSync(filePath, "utf8");
    expect(newText).toMatchSnapshot();
  });

  it("Should be NOT formatted with save if config is disabled", async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(waitingTimeFormatting);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge")
      .update("formatOnSave", false);
    await sleep(waitingTimeFormatting);

    await vscode.workspace.save(docUri);

    const newText = fs.readFileSync(filePath, "utf8");
    expect(newText).toMatchSnapshot();
  });

  it("Should be formatted with indent if config is enabled(default: off)", async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(waitingTimeFormatting);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge")
      .update("formatSql.indent", true);

    // execute command
    await vscode.commands.executeCommand("sqlsurge.formatSql");
    await sleep(waitingTimeFormatting);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it("Should be formatted with 2 tab size indent", async () => {
    const filePath = path.resolve(wsPath, "src", "index.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Wait for server activation
    await sleep(waitingTimeFormatting);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge", vscode.workspace.workspaceFolders?.[0].uri)
      .update("formatSql.indent", true);
    await vscode.workspace
      .getConfiguration("sqlsurge")
      .update("formatSql.tabSize", 2);

    // execute command
    await vscode.commands.executeCommand("sqlsurge.formatSql");
    await sleep(waitingTimeFormatting);

    const formattedText = doc.getText();
    expect(formattedText).toMatchSnapshot();
  });

  it("Should be formatted with user-defined function", async () => {
    const filePath = path.resolve(wsPath, "src", "userDefined.ts");
    const docUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(doc);

    await sleep(waitingTimeFormatting);

    // change config
    await vscode.workspace
      .getConfiguration("sqlsurge", vscode.workspace.workspaceFolders?.[0].uri)
      .update("customRawSqlQuery", {
        language: "typescript",
        configs: [
          {
            functionName: "query",
            sqlArgNo: 2,
            isTemplateLiteral: false,
          },
        ],
      });

    // execute command
    await vscode.commands.executeCommand("sqlsurge.formatSql");
    await sleep(waitingTimeFormatting);

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
      const filePath = path.resolve(wsPath, "src", "index.ts");
      const docUri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(docUri);
      const editor = await vscode.window.showTextDocument(doc);

      await sleep(waitingTimeFormatting);

      // change config
      const replaceRange = new vscode.Range(
        new vscode.Position(5, 38),
        new vscode.Position(5, 71),
      );
      await editor.edit((editBuilder) => {
        editBuilder.replace(replaceRange, content);
      });

      // execute command
      await vscode.commands.executeCommand("sqlsurge.formatSql");
      await sleep(waitingTimeFormatting);

      // execute command
      const formattedText = doc.getText();
      expect(formattedText).toMatchSnapshot();
    },
  );
});
