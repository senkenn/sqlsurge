import {
	type SqlNodes,
	extractSqlList,
	getVirtualFileName,
} from "sql-extraction-ts";
import * as ts from "typescript";
import * as vscode from "vscode";
import {
	type IncrementalLanguageService,
	createIncrementalLanguageService,
	createIncrementalLanguageServiceHost,
} from "./service";
import { client, startSqlsClient } from "./startSqlsClient";

export async function activate(context: vscode.ExtensionContext) {
	startSqlsClient().catch(console.error);
	const { extract_sql_list } = await import("../sql-extraction-rs");
	const originalScheme = "sqlsurge";
	const virtualContents = new Map<string, string[]>(); // TODO: May not be needed
	const services = new Map<string, IncrementalLanguageService>();
	const registry = ts.createDocumentRegistry();

	// virtual sql files
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
			const offset = document.offsetAt(position);
			const service = getOrCreateLanguageService(document.uri)!;
			console.log(document.fileName);
			const blocks = refresh(service, document.fileName, document.getText());
			const block = blocks.find(({ codeRange: [start, end] }) => {
				// in range
				return start <= offset && offset <= end;
			});
			if (!block) return [];

			// Delegate LSP
			// update virtual content
			const prefix = document
				.getText()
				.slice(0, block.codeRange[0])
				.replace(/[^\n]/g, " ");
			const vContent = prefix + block.content;
			virtualDocuments.set(block.vFileName, vContent);

			// trigger completion on virtual file
			const vDocUriString = `${originalScheme}://${block.vFileName}`;
			const vDocUri = vscode.Uri.parse(vDocUriString);
			return vscode.commands.executeCommand<vscode.CompletionList>(
				"vscode.executeCompletionItemProvider",
				vDocUri,
				position,
				context.triggerCharacter,
			);
		},
	};

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			["typescript", "rust"],
			completion,
		),
	);

	function getOrCreateLanguageService(uri: vscode.Uri) {
		const workspace = vscode.workspace.getWorkspaceFolder(uri);
		const roodDir = workspace?.uri.fsPath!;
		if (services.has(roodDir)) {
			return services.get(roodDir);
		}
		const service = createLanguageService(roodDir);
		services.set(roodDir, service);
		return service;
	}

	function createLanguageService(rootDir: string) {
		const configFile = ts.findConfigFile(rootDir, ts.sys.fileExists);

		let fileNames: string[] = [];
		if (configFile) {
			const tsconfig = ts.readConfigFile(configFile, ts.sys.readFile);
			const options = ts.parseJsonConfigFileContent(
				tsconfig.config,
				ts.sys,
				rootDir,
			);
			fileNames = options.fileNames;
		}

		const getWorkspaceContent = (filePath: string) => {
			return vscode.workspace.textDocuments
				.find((doc) => doc.uri.fsPath.endsWith(filePath))
				?.getText();
		};
		const host = createIncrementalLanguageServiceHost(
			rootDir,
			fileNames,
			undefined,
			getWorkspaceContent,
		);
		return createIncrementalLanguageService(host, registry);
	}

	function refresh(
		service: IncrementalLanguageService,
		fileName: string,
		rawContent: string,
	): (SqlNodes & { vFileName: string })[] {
		console.time(refresh.name);
		try {
			let sqlNodes: SqlNodes[] = [];
			if (fileName.endsWith(".ts")) {
				sqlNodes = extractSqlList(rawContent);
			} else if (fileName.endsWith(".rs")) {
				const sqlNodes = extract_sql_list(rawContent);
				console.log(sqlNodes);
			}
			const lastVirtualFileNames = virtualContents.get(fileName) ?? [];
			// update virtual files
			const vFileNames = sqlNodes.map((sqlNode) => {
				const virtualFileName = `${fileName}@${getVirtualFileName(sqlNode)}`;
				const prefix = rawContent
					.slice(0, sqlNode.codeRange[0])
					.replace(/[^\n]/g, " ");
				service.writeSnapshot(
					virtualFileName,
					ts.ScriptSnapshot.fromString(prefix + sqlNode.content),
				);
				return virtualFileName;
			});

			// remove unused virtual files
			lastVirtualFileNames
				.filter((vFileName) => !vFileNames.includes(vFileName))
				.map((vFileName) => {
					service.deleteSnapshot(vFileName);
				});
			virtualContents.set(fileName, vFileNames);
			console.timeEnd(refresh.name);
			return sqlNodes.map((block, idx) => {
				return {
					...block,
					vFileName: vFileNames[idx],
					index: idx,
				};
			});
		} catch (e: any) {
			// show error notification
			vscode.window.showErrorMessage(`Error on refresh: ${e.message}`);
			return [];
		}
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
