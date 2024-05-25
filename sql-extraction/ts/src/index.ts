import type { SqlNode } from "@senken/config";
import * as ts from "typescript";

export function extractSqlListTs(sourceTxt: string): SqlNode[] {
  const sourceFile = ts.createSourceFile(
    "unusedFileName",
    sourceTxt,
    ts.ScriptTarget.Latest, // TODO: re-consider this it should be the same as the vscode lsp
  );
  const sqlNodes: SqlNode[] = [];
  ts.forEachChild<void>(sourceFile, visit);
  return sqlNodes;

  /**
   * visit nodes
   * If find a tagged template expression with name "$queryRaw", push it to blocksNode
   */
  function visit(node: ts.Node): void {
    if (
      ts.isTaggedTemplateExpression(node) &&
      ts.isPropertyAccessExpression(node.tag) &&
      node.tag.name.text === "$queryRaw" &&
      ts.isNoSubstitutionTemplateLiteral(node.template)
    ) {
      const { line: startLine, character: startCharacter } =
        sourceFile.getLineAndCharacterOfPosition(node.template.pos + 1); // +1 is to remove the first back quote
      const { line: endLine, character: endCharacter } =
        sourceFile.getLineAndCharacterOfPosition(node.template.end - 1); // -1 is to remove the last back quote
      sqlNodes.push({
        code_range: {
          start: {
            line: startLine,
            character: startCharacter,
          },
          end: {
            line: endLine,
            character: endCharacter,
          },
        },
        content: node.template.rawText ?? "",
        quotation: "`",
      });
    }
    ts.forEachChild<void>(node, visit);
  }
}
