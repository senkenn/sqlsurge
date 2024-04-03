import * as path from "node:path";

import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "..", "..");

    const workspacePathTs = path.resolve(
      __dirname,
      "..",
      "..",
      "test-workspace-ts-prisma",
    );
    const workspacePathRs = path.resolve(
      __dirname,
      "..",
      "..",
      "test-workspace-rs-sqlx",
    );

    // Download VS Code, unzip it and run the integration test
    // ts
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath: path.resolve(__dirname, "suite-ts", "index"),
      launchArgs: ["--disable-extensions", workspacePathTs],
    });

    // rs
    // await runTests({
    //   extensionDevelopmentPath,
    //   extensionTestsPath: path.resolve(__dirname, "suite-rs", "index"),
    //   launchArgs: ["--disable-extensions", workspacePathRs],
    // });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  }
}

main();
