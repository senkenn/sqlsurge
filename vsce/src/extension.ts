import type { SqlNode } from "@senken/config";
import { extractSqlListRs } from "@senken/sql-extraction-rs";
import { extractSqlListTs } from "@senken/sql-extraction-ts";
import * as ts from "typescript";
import * as vscode from "vscode";
import {
  type IncrementalLanguageService,
  createIncrementalLanguageService,
  createIncrementalLanguageServiceHost,
} from "./service";
import { client, findSqlsInPath, startSqlsClient } from "./startSqlsClient";

export async function activate(context: vscode.ExtensionContext) {
  startSqlsClient().catch(console.error);

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

  const commands = [
    vscode.commands.registerCommand("sqlsurge.installSqls", async () => {
      let sqlsInPATH: vscode.Uri | undefined = undefined;
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Installing sqls...",
        },
        async () => {
          vscode.window
            .createOutputChannel("sqlsurge")
            .appendLine("Installing sqls...");

          // install sqls with command and wait for it
          const terminal = vscode.window.createTerminal("install sqls");
          terminal.show();
          terminal.sendText("go install github.com/sqls-server/sqls@latest");
          const timeout = 60 * 1000;
          const start = Date.now();
          while (Date.now() - start < timeout) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            sqlsInPATH = await findSqlsInPath();
            if (sqlsInPATH) {
              break;
            }
          }
        },
      );
      if (!sqlsInPATH) {
        vscode.window.showErrorMessage("Failed to install sqls");
        return;
      }

      // after installation
      vscode.window
        .createOutputChannel("sqlsurge")
        .appendLine("sqls is installed.");
      const actions = await vscode.window.showInformationMessage(
        "sqls was successfully installed! Reload window to enable SQL language features.",
        "Reload Window",
      );
      if (actions === "Reload Window") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    }),
  ];

  const completion = {
    async provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken,
      context: vscode.CompletionContext,
    ) {
      const service = getOrCreateLanguageService(document.uri)!;
      console.log(document.fileName); // TODO: to output channel
      const sqlNodes = await refresh(service, document);
      const sqlNode = sqlNodes.find(({ code_range: { start, end } }) => {
        // in range
        return (
          (start.line < position.line && position.line < end.line) ||
          (start.line === position.line &&
            start.character <= position.character) ||
          (end.line === position.line && position.character <= end.character)
        );
      });
      if (!sqlNode) return [];

      // Delegate LSP
      // update virtual content
      const offset = document.offsetAt(
        new vscode.Position(
          sqlNode.code_range.start.line,
          sqlNode.code_range.start.character,
        ),
      );
      const prefix = document.getText().slice(0, offset).replace(/[^\n]/g, " ");
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
    },
  };

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      ["typescript", "rust"],
      completion,
    ),
    ...commands,
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

  async function refresh(
    service: IncrementalLanguageService,
    document: vscode.TextDocument,
  ): Promise<(SqlNode & { vFileName: string })[]> {
    console.time(refresh.name); // TODO: to output channel
    const fileName = document.fileName;
    const rawContent = document.getText();
    try {
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
      console.timeEnd(refresh.name); // TODO: to output channel
      return sqlNodes.map((block, idx) => {
        return {
          ...block,
          vFileName: vFileNames[idx],
          index: idx,
        };
      });
    } catch (e: any) {
      console.error(e); // TODO: to output channel

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
