import type { SqlNode } from "@senken/config"; // TODO: #72 reference to src not out

export async function extractSqlListRs(
  sourceTxt: string,
  config?: string[],
): Promise<SqlNode[]> {
  const { extract_sql_list } = await import("../pkg");
  return extract_sql_list(sourceTxt, config).map((sqlNode) =>
    JSON.parse(sqlNode),
  );
}
