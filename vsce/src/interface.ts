import type { SqlNode } from "@senken/config";
import type * as vscode from "vscode";

export type RefreshFunc = (
  document: vscode.TextDocument,
) => Promise<(SqlNode & { vFileName: string })[]>;
