import * as ts from "typescript";
import * as vscode from "vscode";
import { extractSqlList, getVirtualFileName } from "./getSqlList";
import {
	IncrementalLanguageService,
	createIncrementalLanguageService,
	createIncrementalLanguageServiceHost,
} from "./service";
import { client, startSqlsClient } from "./startSqlsClient";

export async function activate(context: vscode.ExtensionContext) {
	startSqlsClient().then(console.log).catch(console.error);

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
			const blocks = refresh(service, document.fileName, document.getText(), [
				{
					start: offset,
					end: offset + 1,
				},
			]);
			const block = blocks.find(({ lang, codeRange: [start, end] }) => {
				if (!lang) return false;
				// in range
				return start <= offset && offset <= end;
			});
			if (!block) return [];
			// const block = {
			// 	codeRange: [128, 128 + 19],
			// 	content: "SELECT * FROM city;",
			// 	vfileName:
			// 		"/home/senken/personal/markdown-code-features/vscode-extension/test-workspace/index.ts@1.sql",
			// };

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

		const getWorkspaceContent = (fpath: string) => {
			return vscode.workspace.textDocuments
				.find((doc) => doc.uri.fsPath.endsWith(fpath))
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
		_ranges: { start: number; end: number }[] | undefined,
	) {
		console.time(refresh.name);
		const sqlList = extractSqlList(rawContent);
		const lastVirtualFileNames = virtualContents.get(fileName) ?? [];
		// update virtual files
		const vfileNames = sqlList.map((block) => {
			const virtualFileName = `${fileName}@${getVirtualFileName(block)}`;
			const prefix = rawContent
				.slice(0, block.codeRange[0])
				.replace(/[^\n]/g, " ");
			service.writeSnapshot(
				virtualFileName,
				ts.ScriptSnapshot.fromString(prefix + block.content),
			);
			return virtualFileName;
		});
		// remove unused virtual files
		const vFileNames = lastVirtualFileNames.filter(
			(vfileName) => !vfileNames.includes(vfileName),
		);
		for (const vfileName of vFileNames) {
			service.deleteSnapshot(vfileName);
		}
		virtualContents.set(fileName, vfileNames);
		console.timeEnd(refresh.name);
		return sqlList.map((block, idx) => {
			return {
				...block,
				// vfileName:  getVirtualFileName(block),
				vfileName: vfileNames[idx],
				index: idx,
			};
		});
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
