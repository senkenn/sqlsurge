import * as vscode from "vscode";

describe("Test", () => {
	test("refresh", async () => {
		expect(true).toBe(true);
	});
});

const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";
if (wsPath === "") {
	throw new Error("wsPath is undefined");
}
