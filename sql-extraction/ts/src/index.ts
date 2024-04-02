import * as ts from "typescript";

type Range = [from: number, to: number];
export type SqlNodes = {
  codeRange: Range;
  content: string;
};

export function extractSqlListTs(sourceTxt: string): SqlNodes[] {
  const sourceFile = ts.createSourceFile(
    "unusedFileName",
    sourceTxt,
    ts.ScriptTarget.Latest, // TODO: re-consider this it should be the same as the vscode lsp
  );
  const sqlNodes: SqlNodes[] = [];
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
      sqlNodes.push({
        codeRange: [node.template.pos + 1, node.template.end], // +1 is to remove the first back quote
        content: node.template.rawText ?? "",
      });
    }
    ts.forEachChild<void>(node, visit);
  }
}
