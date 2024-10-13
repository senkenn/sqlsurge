import { type FormatOptionsWithLanguage, format } from "sql-formatter";
import * as ts from "typescript";
import * as vscode from "vscode";
import { getWorkspaceConfig } from "../extConfig";
import type { SqlNode } from "../interface";
import { createLogger } from "../outputChannel";

const sqlFormatterConfigFileName = ".sql-formatter.json";

export async function commandFormatSqlProvider(refresh: RefreshFunc) {
  return vscode.commands.registerCommand("sqlsurge.formatSql", () =>
    formatSql(refresh),
  );
}

type RefreshFunc = (
  document: vscode.TextDocument,
) => Promise<(SqlNode & { vFileName: string })[]>;

async function formatSql(refresh: RefreshFunc): Promise<void> {
  const logger = createLogger();

  try {
    logger.info("[commandFormatSqlProvider]", "Formatting...");
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const document = editor.document;
    const sqlNodes = await refresh(document);

    const sqlFormatterOptions = await getSqlFormatterOptions();
    if (!sqlFormatterOptions) {
      logger.info(
        "[commandFormatSqlProvider]",
        "Using default sql-formatter config.",
      );
    }

    editor.edit((editBuilder) => {
      for (const sqlNode of sqlNodes) {
        formatSqlNode(sqlNode, document, editBuilder, sqlFormatterOptions);
      }
    });

    logger.info("[commandFormatSqlProvider]", "Formatted");
  } catch (error) {
    logger.error(`[commandFormatSqlProvider] ${error}`);
    vscode.window.showErrorMessage(`[commandFormatSqlProvider] ${error}`);
  }
}

async function getSqlFormatterOptions(): Promise<
  FormatOptionsWithLanguage | undefined
> {
  const logger = createLogger();

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    logger.error("[commandFormatSqlProvider]", "No open workspace");
    return undefined;
  }

  const sqlFormatterConfigUri = vscode.Uri.joinPath(
    workspaceFolder.uri,
    sqlFormatterConfigFileName,
  );
  try {
    logger.info(
      "[commandFormatSqlProvider]",
      "Reading sql-formatter config file.",
    );
    const sqlFormatterOptionsBinary = await vscode.workspace.fs.readFile(
      sqlFormatterConfigUri,
    );
    return JSON.parse(
      sqlFormatterOptionsBinary.toString(),
    ) as FormatOptionsWithLanguage;
  } catch (error) {
    logger.warn(
      "[commandFormatSqlProvider]",
      "Failed to read sql-formatter config file.",
      error,
    );
    return undefined;
  }
}

function formatSqlNode(
  sqlNode: SqlNode & { vFileName: string },
  document: vscode.TextDocument,
  editBuilder: vscode.TextEditorEdit,
  sqlFormatterOptions: FormatOptionsWithLanguage | undefined,
): void {
  const logger = createLogger();
  logger.debug("[formatSql]", "Formatting", sqlNode);

  if (sqlNode.content.match(/^\s*$/)) {
    logger.debug("[formatSql]", "Skip formatting for empty content", sqlNode);
    return;
  }

  const { prefix, suffix } = getPrefixAndSuffix(sqlNode.content);
  const { startPosition, endPosition } = getPositions(
    sqlNode,
    document,
    prefix,
    suffix,
  );

  if (shouldSkipFormatting(document, startPosition, endPosition)) {
    logger.debug(
      "[formatSql]",
      "Skip formatting for typescript string 1 line",
      sqlNode,
    );
    return;
  }

  const isEnabledIndent = getWorkspaceConfig("formatSql.indent");
  let formattedContent = format(sqlNode.content, sqlFormatterOptions);

  if (isEnabledIndent) {
    formattedContent = indentedContent(formattedContent, sqlNode.method_line);
  }

  editBuilder.replace(
    new vscode.Range(
      new vscode.Position(
        sqlNode.code_range.start.line,
        sqlNode.code_range.start.character,
      ),
      new vscode.Position(
        sqlNode.code_range.end.line,
        sqlNode.code_range.end.character,
      ),
    ),
    prefix + formattedContent + suffix,
  );
}

function getPrefixAndSuffix(content: string): {
  prefix: string;
  suffix: string;
} {
  const prefix = content.match(/^(\s*)/)?.[0].replace(/ +$/g, "") ?? "";
  const suffix = content.match(/(\s*)$/)?.[0] ?? "";
  return { prefix, suffix };
}

function getPositions(
  sqlNode: SqlNode,
  document: vscode.TextDocument,
  prefix: string,
  suffix: string,
): { startPosition: number; endPosition: number } {
  const sourceText = document.getText();
  const sourceFile = ts.createSourceFile(
    "unusedFileName",
    sourceText,
    ts.ScriptTarget.Latest, // TODO: #74 re-consider this it should be the same as the vscode lsp or project tsconfig.json
  );
  const startPosition =
    sourceFile.getPositionOfLineAndCharacter(
      sqlNode.code_range.start.line,
      sqlNode.code_range.start.character,
    ) - prefix.length;
  const endPosition =
    sourceFile.getPositionOfLineAndCharacter(
      sqlNode.code_range.end.line,
      sqlNode.code_range.end.character,
    ) + suffix.length;
  return { startPosition, endPosition };
}

function shouldSkipFormatting(
  document: vscode.TextDocument,
  startPosition: number,
  endPosition: number,
): boolean {
  const sourceText = document.getText();
  const startMatch = sourceText[startPosition - 1]?.match(/^["']$/);
  const endMatch = sourceText[endPosition]?.match(/^["']$/);
  return (
    document.languageId === "typescript" &&
    startMatch !== undefined &&
    startMatch !== null &&
    endMatch !== undefined &&
    endMatch !== null
  );
}

function indentedContent(
  content: string,
  methodLine: SqlNode["method_line"],
): string {
  const logger = createLogger();

  const defaultTabSize = 2;
  let tabSize =
    vscode.window.activeTextEditor?.options.tabSize ?? defaultTabSize;
  if (typeof tabSize === "string") {
    logger.warn(
      "[indentedContent]",
      `tabSize is ${tabSize}. Using default tabSize: ${defaultTabSize}`,
    );
    tabSize = defaultTabSize;
  }

  const lineText =
    vscode.window.activeTextEditor?.document.lineAt(methodLine).text;
  if (!lineText) {
    return content;
  }

  const indents = lineText.match(/^(\s*)/)?.[0];
  if (!indents) {
    return content;
  }

  const oneLevelDown = indents.slice(0, tabSize);
  return content
    .split("\n")
    .map((line) => indents + oneLevelDown + line)
    .join("\n");
}
