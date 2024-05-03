import { ORIGINAL_SCHEME, type SqlNode } from "@senken/config";
import * as vscode from "vscode";

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
      console.log(document.fileName); // TODO: to output channel
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
      const vDocUriString = `${ORIGINAL_SCHEME}://${sqlNode.vFileName}`;
      const vDocUri = vscode.Uri.parse(vDocUriString);

      return vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        vDocUri,
        position,
        context.triggerCharacter,
      );
    },
  };
}
