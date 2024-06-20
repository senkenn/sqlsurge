import type { SqlNode } from "@senken/config"; // TODO: #72 reference to src not out
import * as v from "valibot";

export const customRawSqlQueryRsSchema = v.array(
  v.object({
    functionName: v.string(),
    sqlArgNo: v.pipe(v.number(), v.minValue(1)),
    isMacro: v.boolean(),
  }),
);
export type CustomRawSqlQueryRs = v.InferOutput<
  typeof customRawSqlQueryRsSchema
>;

export async function extractSqlListRs(
  sourceTxt: string,
  configs?: CustomRawSqlQueryRs,
): Promise<SqlNode[]> {
  const { extract_sql_list } = await import("../pkg");
  return extract_sql_list(
    sourceTxt,
    configs?.map((c) => JSON.stringify(c)),
  ).map((sqlNode) => JSON.parse(sqlNode));
}
