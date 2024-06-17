// see https://github.com/microsoft/vscode-test/issues/37#issuecomment-700167820
module.exports =
  process.env.TEST_KIND === "ut"
    ? require("jest-mock-vscode").createVSCodeMock(jest)
    : global.vscode;
