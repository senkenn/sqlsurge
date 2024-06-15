import type { SqlNode } from "@senken/config";

import { format } from "sql-formatter";
import * as vscode from "vscode";
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
      sqlNodes.map((sqlNode) => {
        // get prefix and suffix of space or new line
        const prefixMatch = sqlNode.content.match(/^(\s*)/);
        const prefix = prefixMatch ? prefixMatch[0].replace(/ +$/g, "") : "";
        const suffixMatch = sqlNode.content.match(/(\s*)$/);
        const suffix = suffixMatch ? suffixMatch[0] : "";

        // convert place holder to dummy if there are any place holders
        const placeHolderRegExp =
          document.languageId === "typescript"
            ? /\$\{.*\}/g
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

        const isEnabledIndent = vscode.workspace
          .getConfiguration("sqlsurge")
          .get("formatSql.indent");
        const defaultTabSize = 4;
        const tabSize =
          (vscode.workspace
            .getConfiguration("sqlsurge")
            .get("formatSql.tabSize") as number) ?? defaultTabSize;
        // TODO: config validation, and get from package.json

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
      });
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
