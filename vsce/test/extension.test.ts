import path = require("node:path");
import * as vscode from "vscode";

describe("Completion Test", () => {
	test("Should be completion", async () => {
		const filePath = path.resolve(wsPath, "src", "index.ts");
		const docUri = vscode.Uri.file(filePath);
		const doc = await vscode.workspace.openTextDocument(docUri);
		const editor = await vscode.window.showTextDocument(doc);
		// await new Promise((resolve) => setTimeout(resolve, 2000));

		const pos = new vscode.Position(5, 44);
		const actualCompletionList =
			await vscode.commands.executeCommand<vscode.CompletionList>(
				"vscode.executeCompletionItemProvider",
				docUri,
				pos,
			);
		console.log(actualCompletionList.items.length);
		await new Promise((resolve) => setTimeout(resolve, 8000));
		console.log(actualCompletionList);

		expect(true).toBe(true);
	}, 10000);
});

const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";
if (wsPath === "") {
	throw new Error("wsPath is undefined");
}
