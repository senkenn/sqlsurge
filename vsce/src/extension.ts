import { ORIGINAL_SCHEME, type SqlNode } from "@senken/config";
import { extractSqlListRs } from "@senken/sql-extraction-rs";
import { extractSqlListTs } from "@senken/sql-extraction-ts";

import * as ts from "typescript";
import * as vscode from "vscode";

import { commandFormatSqlProvider } from "./commands/formatSql";
import { command as commandInstallSqls } from "./commands/installSqls";
import { command as commandRestartLS } from "./commands/restartLS";
import { completionProvider } from "./completion";
import { getWorkspaceConfig } from "./extConfig";
import {
  type IncrementalLanguageService,
  createIncrementalLanguageService,
  createIncrementalLanguageServiceHost,
} from "./languageService";
import { createLogger } from "./outputChannel";
import { client, startSqlsClient } from "./startSqlsClient";

export async function activate(context: vscode.ExtensionContext) {
  const logger = createLogger();

  await startSqlsClient().catch((err) => {
    logger.error(err, "[startSqlsClient] Failed to start sqls client.");
    vscode.window.showErrorMessage("sqlsurge: Failed to start sqls client.");
  });

  const virtualContents = new Map<string, string[]>(); // TODO: #58 May not be needed
  const services = new Map<string, IncrementalLanguageService>();
  const registry = ts.createDocumentRegistry();

  // virtual sql files
  const virtualDocuments = new Map<string, string>();
  vscode.workspace.registerTextDocumentContentProvider(ORIGINAL_SCHEME, {
    provideTextDocumentContent: (uri) => {
      return virtualDocuments.get(uri.fsPath);
    },
  });

  const completion = vscode.languages.registerCompletionItemProvider(
    ["typescript", "rust"],
    await completionProvider(virtualDocuments, refresh),
  );
  const commandFormatSql = await commandFormatSqlProvider(refresh);

  context.subscriptions.push(
    logger,
    completion,
    commandInstallSqls,
    commandFormatSql,
    commandRestartLS,
  );

  // on save event
  vscode.workspace.onWillSaveTextDocument((event) => {
    // formatting
    if (!event.document.languageId.match(/^(typescript|rust)$/g)) {
      return;
    }
    if (getWorkspaceConfig("formatOnSave") === false) {
      logger.info("[onWillSaveTextDocument]", "`formatOnSave` is false.");
      return;
    }
    event.waitUntil(vscode.commands.executeCommand("sqlsurge.formatSql"));
    logger.info("[onWillSaveTextDocument]", "formatted on save.");
  });

  vscode.workspace.onDidChangeConfiguration(() => {
    // validate customRawSqlQuery
    getWorkspaceConfig("customRawSqlQuery");
  });

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

  async function refresh(
    document: vscode.TextDocument,
  ): Promise<(SqlNode & { vFileName: string })[]> {
    logger.info("[refresh]", "Refreshing...");
    try {
      const service = getOrCreateLanguageService(document.uri)!;
      const fileName = document.fileName;
      const rawContent = document.getText();
      let sqlNodes: SqlNode[] = [];
      let config = getWorkspaceConfig("customRawSqlQuery");
      switch (document.languageId) {
        case "typescript": {
          if (config?.language !== document.languageId) {
            config = undefined;
          }
          sqlNodes = extractSqlListTs(rawContent, config?.configs);
          break;
        }
        case "rust": {
          if (config?.language !== document.languageId) {
            config = undefined;
          }
          sqlNodes = await extractSqlListRs(rawContent, config?.configs);
          break;
        }
        default:
          return [];
      }

      const lastVirtualFileNames = virtualContents.get(fileName) ?? [];
      // update virtual files
      const vFileNames = sqlNodes.map((sqlNode, index) => {
        const virtualFileName = `${fileName}@${index}.sql`;
        const offset = document.offsetAt(
          new vscode.Position(
            sqlNode.code_range.start.line,
            sqlNode.code_range.start.character,
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
      const sqlNodesWithVirtualDoc = sqlNodes.map((block, idx) => {
        return {
          ...block,
          vFileName: vFileNames[idx],
          index: idx,
        };
      });
      logger.info("[refresh]", "Refreshed.");
      return sqlNodesWithVirtualDoc;
    } catch (e) {
      logger.error("[refresh]", `${e}`);

      // show error notification
      vscode.window.showErrorMessage(`[refresh] ${e}`);
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
