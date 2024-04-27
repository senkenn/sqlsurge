import type { SqlNode } from "@senken/config";

export async function extractSqlListRs(sourceTxt: string): Promise<SqlNode[]> {
  const { extract_sql_list } = await import("../pkg");
  return extract_sql_list(sourceTxt).map((sqlNode) => JSON.parse(sqlNode));
}
