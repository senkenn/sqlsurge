import { delimiter } from "path";
import * as vscode from "vscode";
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
} from "vscode-languageclient/node";

interface LanguageServerConfig {
	flags: string[];
}

export let client: LanguageClient;

export async function startSqlsClient() {
	const sqlsConfig = vscode.workspace.getConfiguration("sqls");
	const config: LanguageServerConfig = {
		flags: sqlsConfig.languageServerFlags || [],
	};
	const sqlsInPATH = await findSqlsInPath();
	const serverOptions: ServerOptions = {
		command: sqlsInPATH.fsPath,
		args: [...config.flags],
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ language: "sql", pattern: "**/*.sql" }], // TODO: scheme: "file" is needed?
	};

	client = new LanguageClient("sqls", serverOptions, clientOptions);
	client.start();
}

async function findSqlsInPath(): Promise<vscode.Uri | undefined> {
	const path = process.env.PATH;

	if (!path) {
		return;
	}

	for (const dir of path.split(delimiter)) {
		const sqls = vscode.Uri.joinPath(vscode.Uri.file(dir), "sqls");
		if (await fileExists(sqls)) {
			return sqls;
		}
	}
}

async function fileExists(path: vscode.Uri) {
	try {
		await vscode.workspace.fs.stat(path);
		return true;
	} catch (err) {
		if (err.code === "ENOENT" || err.code === "FileNotFound") {
			return false;
		}
		throw err;
	}
}
