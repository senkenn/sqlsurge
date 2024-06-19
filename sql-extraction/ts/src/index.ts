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

const defaultCustomRawSqlQueryTs: CustomRawSqlQueryTs = [
  {
    functionName: "$queryRaw",
    sqlArgNo: 1,
    isTemplateLiteral: true,
  },
];

export function extractSqlListTs(
  sourceTxt: string,
  configs = defaultCustomRawSqlQueryTs,
): SqlNode[] {
  const sourceFile = ts.createSourceFile(
    "unusedFileName",
    sourceTxt,
    ts.ScriptTarget.Latest, // TODO: #74 re-consider this it should be the same as the vscode lsp or project tsconfig.json
  );
  const sqlNodes: SqlNode[] = [];
  ts.forEachChild<void>(sourceFile, visit);
  return sqlNodes;

  /**
   * Visit nodes recursively
   * If find a tagged template expression with name "$queryRaw", push it to blocksNode
   */
  function visit(node: ts.Node): void {
    for (const c of configs) {
      // CallExpression
      if (
        !c.isTemplateLiteral &&
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === c.functionName
      ) {
        const method_line = sourceFile.getLineAndCharacterOfPosition(
          node.expression.pos,
        ).line;
        const sqlNode = node.arguments[c.sqlArgNo - 1] as
          | ts.StringLiteral
          | ts.NoSubstitutionTemplateLiteral;
        const { line: startLine, character: startCharacter } =
          sourceFile.getLineAndCharacterOfPosition(
            sqlNode.getStart(sourceFile) + 1, // +1 is to remove the first quote
          );
        const { line: endLine, character: endCharacter } =
          sourceFile.getLineAndCharacterOfPosition(sqlNode.end - 1); // -1 is to remove the last quote

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
          content: sqlNode.text,
          method_line,
        });
      }

      if (
        !c.isTemplateLiteral &&
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === c.functionName
      ) {
        // CallExpression && PropertyAccessExpression
        const method_line = sourceFile.getLineAndCharacterOfPosition(
          node.expression.pos,
        ).line;
        const sqlNode = node.arguments[c.sqlArgNo - 1] as
          | ts.StringLiteral
          | ts.NoSubstitutionTemplateLiteral;
        const { line: startLine, character: startCharacter } =
          sourceFile.getLineAndCharacterOfPosition(
            sqlNode.getStart(sourceFile) + 1, // +1 is to remove the first quote
          );
        const { line: endLine, character: endCharacter } =
          sourceFile.getLineAndCharacterOfPosition(sqlNode.end - 1); // -1 is to remove the last quote

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
          content: sqlNode.text,
          method_line,
        });
      }

      // TaggedTemplateExpression
      if (
        c.isTemplateLiteral &&
        ts.isTaggedTemplateExpression(node) &&
        ts.isPropertyAccessExpression(node.tag) &&
        node.tag.name.text === c.functionName &&
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
          content: node.template.text,
          method_line,
        });
      }
      ts.forEachChild<void>(node, visit);
    }
  }
}
