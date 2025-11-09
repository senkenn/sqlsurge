#!/usr/bin/env node

const esbuild = require("esbuild");
const path = require("node:path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`,
        );
      });
      console.log("[watch] build finished");
    });
  },
};

const ctx = esbuild
  .context({
    bundle: true,
    format: "cjs",
    target: "es2020",
    outfile: "out/extension.js",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    external: ["vscode"],
    plugins: [esbuildProblemMatcherPlugin],
    entryPoints: ["src/extension.ts"],
    loader: {
      ".wasm": "file",
    },
    alias: {
      "sql-extraction-ts": path.resolve(__dirname, "../sql-extraction/ts/src"),
    },
  })
  .catch(() => process.exit(1));

if (watch) {
  ctx.then((ctx) => ctx.watch());
} else {
  ctx.then((ctx) => ctx.rebuild()).then(() => process.exit(0));
}
