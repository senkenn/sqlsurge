import { ORIGINAL_SCHEME, type SqlNode } from "@senken/config";
import { extractSqlListRs } from "@senken/sql-extraction-rs";
import { extractSqlListTs } from "@senken/sql-extraction-ts";

import * as ts from "typescript";
import * as vscode from "vscode";

import { commandFormatSqlProvider } from "./commands/formatSql";
import { command as commandInstallSqls } from "./commands/installSqls";
import { completionProvider } from "./completion";
import { extConfig as extConfigStore, getWorkspaceConfig } from "./extConfig";
import { createOutputChannel, logger } from "./outputChannel";
import {
  type IncrementalLanguageService,
  createIncrementalLanguageService,
  createIncrementalLanguageServiceHost,
} from "./service";
import { client, startSqlsClient } from "./startSqlsClient";

export async function activate(context: vscode.ExtensionContext) {
  createOutputChannel();

  startSqlsClient().catch((err) => {
    logger.error("[activate]", `Failed to start sqls client: ${err}`);
  });

  const virtualContents = new Map<string, string[]>(); // TODO: May not be needed
  const services = new Map<string, IncrementalLanguageService>();
  const registry = ts.createDocumentRegistry();

  // virtual sql files
  const virtualDocuments = new Map<string, string>();
  vscode.workspace.registerTextDocumentContentProvider(ORIGINAL_SCHEME, {
    provideTextDocumentContent: (uri) => {
      return virtualDocuments.get(uri.fsPath);
    },
  });

  const completion = await completionProvider(virtualDocuments, refresh);

  const commandFormatSql = await commandFormatSqlProvider(refresh);
  const commands = [commandInstallSqls, commandFormatSql];

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      ["typescript", "rust"],
      completion,
    ),
    ...commands,
    logger,
  );

  // on save event
  vscode.workspace.onWillSaveTextDocument((event) => {
    // formatting
    if (!event.document.languageId.match(/^(typescript|rust)$/g)) {
      return;
    }
    if (!extConfigStore.formatOnSave) {
      logger.info("[onWillSaveTextDocument]", "`formatOnSave` is false.");
      return;
    }
    event.waitUntil(vscode.commands.executeCommand("sqlsurge.formatSql"));
    logger.info("[onWillSaveTextDocument]", "formatted on save.");
  });

  // update config store on change config
  vscode.workspace.onDidChangeConfiguration(() => {
    const config = getWorkspaceConfig();
    extConfigStore.formatOnSave = config.formatOnSave;
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
      switch (document.languageId) {
        case "typescript": {
          sqlNodes = extractSqlListTs(rawContent);
          break;
        }
        case "rust": {
          const sqlNodesRust = await extractSqlListRs(rawContent);
          sqlNodes = sqlNodesRust.map((sqlNode) => {
            return {
              code_range: {
                start: {
                  line: sqlNode.code_range.start.line,
                  character: sqlNode.code_range.start.character,
                },
                end: {
                  line: sqlNode.code_range.end.line,
                  character: sqlNode.code_range.end.character,
                },
              },
              content: sqlNode.content,
              quotation: sqlNode.quotation,
            };
          });
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
