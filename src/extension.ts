import { ExtensionContext, Uri, workspace } from "vscode";

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
} from "vscode-languageclient/node";

import vscode = require("vscode");
import { delimiter } from "path";

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
