import type { SqlNode } from "@senken/config";

import { format } from "sql-formatter";
import * as vscode from "vscode";

export async function commandFormatSqlProvider(
  logger: vscode.LogOutputChannel,
  refresh: RefreshFunc,
) {
  return vscode.commands.registerCommand("sqlsurge.formatSql", () =>
    formatSql(logger, refresh),
  );
}

type RefreshFunc = (
  document: vscode.TextDocument,
) => Promise<(SqlNode & { vFileName: string })[]>;

async function formatSql(
  logger: vscode.LogOutputChannel,
  refresh: RefreshFunc,
): Promise<void> {
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

        const config = vscode.workspace
          .getConfiguration("sqlsurge")
          .get("formatSql") as {
          indent: boolean;
          tabSize: number;
        };
        // TODO: config validation

        // get formatted content
        const formattedContentWithDummy = format(sqlNode.content, {
          tabWidth: config.tabSize,
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
        if (config.indent) {
          formattedContent = indentedContent(
            formattedContent,
            sqlNode.method_line,
            config.tabSize,
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

  if (indents.length % tabSize !== 0) {
    // TODO: log
    throw new Error("indent size should be multiple of indents length");
  }

  const oneLevelDown = indents.slice(0, tabSize);
  return content
    .split("\n")
    .map((line) => indents + oneLevelDown + line)
    .join("\n");
}
