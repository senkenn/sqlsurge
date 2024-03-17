import { extractCodeBlocks } from "./markdown.mjs";
import { test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rollup, Plugin } from "rollup";
import ts from "typescript";
import { markdownRunner } from "./rollup.mjs";

test("extractCodeBlocks #1", () => {
  const case1 = fs.readFileSync(
    path.join(__dirname, "./__fixtures/case1.mdx"),
    "utf-8",
  );
  const blocks = extractCodeBlocks(case1);
  expect(blocks).toHaveLength(2);
});

test("extractCodeBlocks #3", async () => {
  const case3 = fs.readFileSync(
    path.join(__dirname, "./__fixtures/case3.mdx"),
    "utf-8",
  );
  const blocks = extractCodeBlocks(case3);
  expect(blocks).toHaveLength(2);

  const entry = path.join(__dirname, "__fixtures", 'case3.mdx')
  const bundle = await rollup({
    input: entry,
    external: ["node:test", "node:assert"],
    plugins: [
      markdownRunner(),
      {
        name: "ts",
        resolveId(id, importer) {
          if (importer && (id.endsWith(".ts"))) {
            const rid = path.join(path.dirname(importer), id);
            return rid;
          }
          return;
        },
        transform(code, id) {
          if (id.endsWith(".ts")) {
            const transpile = ts.transpileModule(code, {
              compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
                jsx: ts.JsxEmit.ReactJSX,
              },
            });
            return {
              code: transpile.outputText,
              map: transpile.sourceMapText,
            };
          }
          return undefined;
        }
      }
    ],
  });

  const { output } = await bundle.generate({
    format: "es",
  });
  const code = output[0].code;
  expect(code).toBe(`import { test } from 'node:test';
import { ok, equal } from 'node:assert';

const x = 1;

test("hello", () => {
    ok(true);
    equal(x, 1);
});
`);
});
