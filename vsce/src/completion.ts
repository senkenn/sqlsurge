import * as vscode from "vscode";
import { ORIGINAL_SCHEME, type SqlNode } from "./interface";
import { createLogger } from "./outputChannel";

export async function completionProvider(
  virtualDocuments: Map<string, string>,
  refresh: (
    document: vscode.TextDocument,
  ) => Promise<(SqlNode & { vFileName: string })[]>,
) {
  return {
    async provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken,
      context: vscode.CompletionContext,
    ) {
      const logger = createLogger();

      logger.debug("[provideCompletionItems]", "Starting completion...");
      logger.debug("[provideCompletionItems]", "file: ", document.fileName);
      const sqlNodes = await refresh(document);
      const sqlNode = sqlNodes.find(({ code_range: { start, end } }) => {
        // in range
        return (
          (start.line < position.line && position.line < end.line) ||
          (start.line === position.line &&
            start.character <= position.character) ||
          (end.line === position.line && position.character <= end.character)
        );
      });
      if (!sqlNode) return [];

      // Delegate LSP
      // update virtual content
      const offset = document.offsetAt(
        new vscode.Position(
          sqlNode.code_range.start.line,
          sqlNode.code_range.start.character,
        ),
      );
      const prefix = document.getText().slice(0, offset).replace(/[^\n]/g, " ");
      const vContent = prefix + sqlNode.content;
      virtualDocuments.set(sqlNode.vFileName, vContent);

      // trigger completion on virtual file
      const vDocUriString = `${ORIGINAL_SCHEME}:${sqlNode.vFileName}`;
      const vDocUri = vscode.Uri.parse(vDocUriString);

      logger.debug("[provideCompletionItems] Finished completion.");
      return vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        vDocUri,
        position,
        context.triggerCharacter,
      );
    },
  };
}
