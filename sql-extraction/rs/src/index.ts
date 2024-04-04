export async function extractSqlListRs(sourceTxt: string): Promise<string[]> {
  const { extract_sql_list } = await import("../pkg");
  return extract_sql_list(sourceTxt);
}
