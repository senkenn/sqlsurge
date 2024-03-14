import * as vscode from "vscode";
import { client, startSqlsClient } from "./startSqlsClient";

export async function activate(context: vscode.ExtensionContext) {
	startSqlsClient();

	// virtual sql files
	const originalScheme = "sqlsurge";
	const virtualDocuments = new Map<string, string>();
	vscode.workspace.registerTextDocumentContentProvider(originalScheme, {
		provideTextDocumentContent: (uri) => {
			return virtualDocuments.get(uri.fsPath);
		},
	});

	const completion = {
		provideCompletionItems(
			document: vscode.TextDocument,
			position: vscode.Position,
			_token: vscode.CancellationToken,
			context: vscode.CompletionContext,
		) {
			const block = {
				codeRange: [128, 128 + 19],
				content: "SELECT * FROM city;",
				vfileName:
					"/home/senken/personal/markdown-code-features/vscode-extension/test-workspace/index.ts@1.sql",
			};

			// Delegate LSP
			// update virtual content
			const prefix = document
				.getText()
				.slice(0, block.codeRange[0])
				.replace(/[^\n]/g, " ");
			const vContent = prefix + block.content;
			virtualDocuments.set(block.vfileName, vContent);

			// trigger completion on virtual file
			const vdocUriString = `${originalScheme}://${block.vfileName}`;
			const vdocUri = vscode.Uri.parse(vdocUriString);
			console.log(vdocUri);
			return vscode.commands.executeCommand<vscode.CompletionList>(
				"vscode.executeCompletionItemProvider",
				vdocUri,
				position,
				context.triggerCharacter,
			);
		},
	};

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider("typescript", completion),
	);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
