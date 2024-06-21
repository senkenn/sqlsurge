import * as path from "node:path";
import type { Config } from "@jest/types";
import { runCLI } from "jest";

export async function run(
  testsRoot: string,
  reportTestResults: (error?: Error, failures?: number) => void,
): Promise<void> {
  const projectRootPath = path.resolve(__dirname, "../..");

  console.info(`Running Jest tests from ${projectRootPath} ...`);

  const config = {
    testMatch: ["<rootDir>/out/suite-rs/*.test.js"],
    testEnvironment: "./test/vscode-environment.ts",
  } as Config.Argv;

  const test = await runCLI(config, [projectRootPath]);

  // exit 1 if tests failed
  if (test.results.numFailedTestSuites > 0) {
    process.exit(1);
  }
}
