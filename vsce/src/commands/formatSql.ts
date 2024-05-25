import type { SqlNode } from "@senken/config";

import { format } from "sql-formatter";
import * as vscode from "vscode";
import type { RefreshFunc } from "../interface";
import { logger } from "../outputChannel";

export async function commandFormatSqlProvider(refresh: RefreshFunc) {
  return vscode.commands.registerCommand("sqlsurge.formatSql", async () => {
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
          const prefix = prefixMatch ? prefixMatch[0] : "";
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

          // get formatted content
          const formattedContentWithDummy = format(sqlNode.content);

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
  });
}
