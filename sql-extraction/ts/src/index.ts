import type { SqlNode } from "@senken/config";
import * as ts from "typescript";
import * as v from "valibot";

export const customRawSqlQueryTsSchema = v.array(
  v.object({
    functionName: v.string(),
    sqlArgNo: v.pipe(v.number(), v.minValue(1)),
    isTemplateLiteral: v.boolean(),
  }),
);
export type CustomRawSqlQueryTs = v.InferOutput<
  typeof customRawSqlQueryTsSchema
>;

export function extractSqlListTs(
  sourceTxt: string,
  configs?: CustomRawSqlQueryTs,
): SqlNode[] {
  const sourceFile = ts.createSourceFile(
    "unusedFileName",
    sourceTxt,
    ts.ScriptTarget.Latest, // TODO: re-consider this it should be the same as the vscode lsp
  );
  const sqlNodes: SqlNode[] = [];
  ts.forEachChild<void>(sourceFile, visit);
  return sqlNodes;

  /**
   * Visit nodes recursively
   * If find a tagged template expression with name "$queryRaw", push it to blocksNode
   */
  function visit(node: ts.Node): void {
    if (
      ts.isTaggedTemplateExpression(node) &&
      ts.isPropertyAccessExpression(node.tag) &&
      node.tag.name.text === "$queryRaw" &&
      ts.isNoSubstitutionTemplateLiteral(node.template)
    ) {
      const method_line = sourceFile.getLineAndCharacterOfPosition(
        node.tag.pos,
      ).line;
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
        method_line,
      });
    }
    ts.forEachChild<void>(node, visit);
  }
}
