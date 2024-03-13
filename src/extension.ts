import { ExtensionContext, Uri, workspace } from "vscode";

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
} from "vscode-languageclient/node";

import { delimiter } from "path";
import * as vscode from "vscode";
let client: LanguageClient;

export async function activate(context: ExtensionContext) {
	const config = parseLanguageServerConfig();
	const sqlsInPATH = await findSqlsInPath();
	const serverOptions: ServerOptions = {
		command: sqlsInPATH.fsPath,
		args: [...config.flags],
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: "file", language: "sql", pattern: "**/*.sql" },
		],
	};

	client = new LanguageClient("sqls", serverOptions, clientOptions);
	client.start();

	// virtual html/css files
	const virtualDocuments = new Map<string, string>();
	vscode.workspace.registerTextDocumentContentProvider("mdcf", {
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
				blockRange: [457, 481],
				codeRange: [465, 477],
				content: "<div>\n</div>",
				vfileName:
					"/home/senken/personal/markdown-code-features/vscode-extension/test-workspace/md.md@3.html",
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
			const vdocUriString = `mdcf://${block.vfileName}`;
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
		vscode.languages.registerCompletionItemProvider("markdown", completion),
	);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

interface LanguageServerConfig {
	flags: string[];
}

export function parseLanguageServerConfig(): LanguageServerConfig {
	const sqlsConfig = vscode.workspace.getConfiguration("sqls");
	const config = {
		flags: sqlsConfig.languageServerFlags || [],
	};
	return config;
}

async function findSqlsInPath(): Promise<Uri | undefined> {
	const path = process.env.PATH;

	if (!path) {
		return;
	}

	for (const dir of path.split(delimiter)) {
		const sqls = Uri.joinPath(Uri.file(dir), "sqls");
		if (await fileExists(sqls)) {
			return sqls;
		}
	}
}

async function fileExists(path: Uri) {
	try {
		await workspace.fs.stat(path);
		return true;
	} catch (err) {
		if (err.code === "ENOENT" || err.code === "FileNotFound") {
			return false;
		}
		throw err;
	}
}
