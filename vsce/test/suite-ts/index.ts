import { runCLI } from "jest";

import * as path from "node:path";

export async function run(
  testsRoot: string,
  reportTestResults: (error?: Error, failures?: number) => void,
): Promise<void> {
  const projectRootPath = path.resolve(__dirname, "../../..");

  console.info(`Running Jest tests from ${projectRootPath} ...`);

  const test = await runCLI(
    {
      testMatch: ["<rootDir>/out/test/suite-ts/*.test.js"],
      testEnvironment: "./test/vscode-environment.ts",
    } as any,
    [projectRootPath],
  );
  if (test.results.numFailedTestSuites > 0) {
    process.exit(1);
  }
}
