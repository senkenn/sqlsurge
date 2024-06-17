import * as vscode from "vscode";
import { getWorkspaceConfig } from "../src/extConfig";
import * as outputChannel from "../src/outputChannel";

describe("extConfig", () => {
  describe("getWorkspaceConfig", () => {
    it.each`
      key                    | expected
      ${"formatOnSave"}      | ${true}
      ${"formatSql.indent"}  | ${false}
      ${"formatSql.tabSize"} | ${4}
      ${"customRawSqlQuery"} | ${{ language: "typescript", configs: [{ functionName: "functionName", sqlArgNo: 1, isTemplateLiteral: true }] }}
      ${"customRawSqlQuery"} | ${{ language: "rust", configs: [{ functionName: "functionName", sqlArgNo: 1, isMacro: true }] }}
    `("Should return workspace config: sqlsurge.$key", ({ key, expected }) => {
      jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
        get: jest.fn().mockReturnValue(expected),
      } as unknown as vscode.WorkspaceConfiguration);

      const config = getWorkspaceConfig(key);
      expect(config).toStrictEqual(expected);
    });

    it.each`
      key                    | expected
      ${"formatOnSave"}      | ${"true"}
      ${"formatSql.indent"}  | ${"false"}
      ${"formatSql.tabSize"} | ${"4"}
      ${"customRawSqlQuery"} | ${{ language: "rust", configs: [{ functionName: "functionName", sqlArgNo: 0, isTemplateLiteral: true }] }}
    `(
      "Should return undefined with invalid config: sqlsurge.$key",
      ({ key, expected }) => {
        jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
          get: jest.fn().mockReturnValue(expected),
        } as unknown as vscode.WorkspaceConfiguration);
        jest.spyOn(outputChannel, "createLogger").mockReturnValue({
          error: jest.fn(),
        } as unknown as vscode.LogOutputChannel);

        const config = getWorkspaceConfig(key);
        expect(config).toBeUndefined();
      },
    );
  });
});
