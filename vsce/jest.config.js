// see https://github.com/microsoft/vscode-test/issues/37#issuecomment-700167820

module.exports = {
  testMatch: ["<rootDir>/out/test/**.test.js"],
  testEnvironment: "./test/vscode-environment.ts",
};
