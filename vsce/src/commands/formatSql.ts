import type { SqlNode } from "../interface";

import { type FormatOptionsWithLanguage, format } from "sql-formatter";
import * as ts from "typescript";
import * as vscode from "vscode";

import { getWorkspaceConfig } from "../extConfig";
import { createLogger } from "../outputChannel";

const sqlFormatterConfigFileName = ".sql-formatter.json";
const sqlFormatterTabWidthDefault = 2;

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
    const dummyPlaceHolder = '"SQLSURGE_DUMMY"';

    // get sql-formatter config
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      logger.error("[commandFormatSqlProvider]", "Not open workspace");
      return;
    }
    const sqlFormatterConfigUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      sqlFormatterConfigFileName,
    );
    let sqlFormatterOptionsBinary: Uint8Array | undefined = undefined;
    try {
      logger.info(
        "[commandFormatSqlProvider]",
        "Find & Reading sql-formatter config file.",
      );
      sqlFormatterOptionsBinary = await vscode.workspace.fs.readFile(
        sqlFormatterConfigUri,
      );
    } catch (error) {
      logger.warn(
        "[commandFormatSqlProvider]",
        "Failed to read sql-formatter config file.",
        error,
      );
      logger.info(
        "[commandFormatSqlProvider]",
        "Use default sql-formatter config.",
      );
    }
    const sqlFormatterOptions =
      sqlFormatterOptionsBinary &&
      (JSON.parse(
        sqlFormatterOptionsBinary.toString(),
      ) as FormatOptionsWithLanguage);

    // edit document with formatted content
    editor.edit((editBuilder) => {
      for (const sqlNode of sqlNodes) {
        logger.debug("[formatSql]", "Formatting", sqlNode);

        // skip empty content
        if (sqlNode.content.match(/^\s*$/)) {
          logger.debug(
            "[formatSql]",
            "Skip formatting for empty content",
            sqlNode,
          );
          continue;
        }

        // get prefix and suffix of space or new line
        const prefix =
          sqlNode.content
            .match(/^(\s*)/)?.[0]
            .replace(/ +$/g, "") ?? // remove indent space
          "";
        const suffix = sqlNode.content.match(/(\s*)$/)?.[0] ?? "";

        // skip typescript && "" or '' string(1 line)
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
        if (
          document.languageId === "typescript" &&
          sourceText[startPosition - 1]?.match(/^["']$/) &&
          sourceText[endPosition]?.match(/^["']$/)
        ) {
          logger.debug(
            "[formatSql]",
            "Skip formatting for typescript string 1 line",
            sqlNode,
          );
          continue;
        }

        // convert place holder to dummy if there are any place holders
        const placeHolderRegExp =
          document.languageId === "typescript"
            ? /\$(\{.*\}|\d+)/g // ${1} or $1
            : document.languageId === "rust"
              ? /(\$\d+|\?)/g
              : undefined;
        if (placeHolderRegExp === undefined) {
          throw new Error("placeHolderRegExp is undefined");
        }

        const placeHolders = sqlNode.content.match(placeHolderRegExp);
        if (placeHolders) {
          sqlNode.content = sqlNode.content.replaceAll(
            placeHolderRegExp,
            dummyPlaceHolder,
          );
        }

        const isEnabledIndent = getWorkspaceConfig("formatSql.indent");

        // get formatted content
        const formattedContentWithDummy = format(
          sqlNode.content,
          sqlFormatterOptions,
        );

        // reverse the place holders
        let formattedContent = formattedContentWithDummy;
        if (placeHolders) {
          placeHolders.forEach((placeHolder, index) => {
            formattedContent = formattedContent.replace(
              dummyPlaceHolder,
              placeHolder,
            );
          });
        }

        // add indent if config is enabled
        if (isEnabledIndent) {
          formattedContent = indentedContent(
            formattedContent,
            sqlNode.method_line,
          );
        }

        // replace with formatted content
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
    });

    logger.info("[commandFormatSqlProvider]", "Formatted");
  } catch (error) {
    logger.error(`[commandFormatSqlProvider] ${error}`);
    vscode.window.showErrorMessage(`[commandFormatSqlProvider] ${error}`);
  }
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
      `tabSize is ${tabSize}. Use default tabSize: ${defaultTabSize}`,
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
