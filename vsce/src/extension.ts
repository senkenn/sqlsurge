import { type SqlNodes, extractSqlListTs } from "sql-extraction-ts";
import * as ts from "typescript";
import * as vscode from "vscode";
import {
	type IncrementalLanguageService,
	createIncrementalLanguageService,
	createIncrementalLanguageServiceHost,
} from "./service";
import { client, startSqlsClient } from "./startSqlsClient";

import * as zod from "zod";

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
			const service = getOrCreateLanguageService(document.uri)!;
			if (document.languageId === "typescript") {
				const offset = document.offsetAt(position);
				console.log(document.fileName);
				const sqlNodes = refresh(
					service,
					document.fileName,
					document.getText(),
				);
				const sqlNode = sqlNodes.find(({ codeRange: [start, end] }) => {
					// in range
					return start <= offset && offset <= end;
				});
				if (!sqlNode) return [];
				// Delegate LSP
				// update virtual content
				const prefix = document
					.getText()
					.slice(0, sqlNode.codeRange[0])
					.replace(/[^\n]/g, " ");
				const vContent = prefix + sqlNode.content;
				virtualDocuments.set(sqlNode.vFileName, vContent);

				// trigger completion on virtual file
				const vDocUriString = `${originalScheme}://${sqlNode.vFileName}`;
				const vDocUri = vscode.Uri.parse(vDocUriString);
				return vscode.commands.executeCommand<vscode.CompletionList>(
					"vscode.executeCompletionItemProvider",
					vDocUri,
					position,
					context.triggerCharacter,
				);
			}

			if (document.languageId === "rust") {
				const sqlNodes = refreshRust(
					getOrCreateLanguageService(document.uri)!,
					document,
				);
				console.log("cursor", position);
				console.log("sql", sqlNodes[0].code_range.start);
				const sqlNode = sqlNodes.find(({ code_range: { start, end } }) => {
					// position line and character is 0-based, but start and end are 1-based
					return (
						(start.line < position.line + 1 && position.line + 1 < end.line) ||
						(start.line === position.line + 1 &&
							start.column <= position.character + 1) ||
						(end.line === position.line + 1 &&
							position.character + 1 <= end.column)
					);
				});
				if (!sqlNode) return [];

				// Delegate LSP
				// update virtual content
				const offset = document.offsetAt(
					new vscode.Position(
						sqlNode.code_range.start.line - 1, // 1-based to 0-based
						sqlNode.code_range.start.column,
					),
				);
				const prefix = document
					.getText()
					.slice(0, offset)
					.replace(/[^\n]/g, " ");
				const vContent = prefix + sqlNode.content;
				console.log(sqlNode.content);
				virtualDocuments.set(sqlNode.vFileName, vContent);

				// trigger completion on virtual file
				const vDocUriString = `${originalScheme}://${sqlNode.vFileName}`;
				const vDocUri = vscode.Uri.parse(vDocUriString);
				return vscode.commands.executeCommand<vscode.CompletionList>(
					"vscode.executeCompletionItemProvider",
					vDocUri,
					position,
					context.triggerCharacter,
				);
			}
			return [];
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
			const sqlNodes = extractSqlListTs(rawContent);
			const lastVirtualFileNames = virtualContents.get(fileName) ?? [];
			// update virtual files
			const vFileNames = sqlNodes.map((sqlNode, index) => {
				const virtualFileName = `${fileName}@${index}.sql`;
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

	type SqlNodeRust = {
		code_range: {
			start: {
				line: number;
				column: number;
			};
			end: {
				line: number;
				column: number;
			};
		};
		content: string;
	};

	function refreshRust(
		service: IncrementalLanguageService,
		document: vscode.TextDocument,
	): (SqlNodeRust & { vFileName: string })[] {
		console.time(refresh.name);
		const fileName = document.fileName;
		const rawContent = document.getText();
		try {
			const sqlNodes = extract_sql_list(rawContent);
			console.log(JSON.parse(sqlNodes[0]));
			const lastVirtualFileNames = virtualContents.get(fileName) ?? [];
			// update virtual files
			const vFileNames = sqlNodes.map((sqlNodeStr, index) => {
				const sqlNode: SqlNodeRust = JSON.parse(sqlNodeStr);
				const virtualFileName = `${fileName}@${index}.sql`;
				const offset = document.offsetAt(
					new vscode.Position(
						sqlNode.code_range.start.line,
						sqlNode.code_range.start.column,
					),
				);
				const prefix = rawContent.slice(0, offset).replace(/[^\n]/g, " ");
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
					...JSON.parse(block),
					vFileName: vFileNames[idx],
					index: idx,
				};
			});
		} catch (e: any) {
			// show error notification
			console.log(e);
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
