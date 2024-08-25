import type { SqlNode } from "@senken/config";

import { format } from "sql-formatter";
import * as ts from "typescript";
import * as vscode from "vscode";

import { getWorkspaceConfig } from "../extConfig";
import { createLogger } from "../outputChannel";

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

    editor.edit((editBuilder) => {
      for (const sqlNode of sqlNodes) {
        logger.debug("[formatSql]", "Formatting", sqlNode);
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
        const tabSize = getWorkspaceConfig("formatSql.tabSize");
        if (tabSize === undefined) {
          continue;
        }

        // get formatted content
        const formattedContentWithDummy = format(sqlNode.content, {
          tabWidth: tabSize,
        });

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
            tabSize,
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
  tabSize: number,
): string {
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
