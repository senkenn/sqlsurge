// TODO: DI
type SqlNode = {
  code_range: {
    start: {
      line: number; // 0-based
      character: number; // 0-based
    };
    end: {
      line: number; // 0-based
      character: number; // 0-based
    };
  };
  content: string;
};

export async function extractSqlListRs(sourceTxt: string): Promise<SqlNode[]> {
  const { extract_sql_list } = await import("../pkg");
  return extract_sql_list(sourceTxt).map((sqlNode) => JSON.parse(sqlNode));
}
