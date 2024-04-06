use serde::Serialize;
use syn::visit::{self, Visit};
use syn::File;
use wasm_bindgen::prelude::wasm_bindgen;

// get function name: https://stackoverflow.com/a/63904992
#[allow(unused_macros)]
macro_rules! function {
    () => {{
        fn f() {}
        fn type_name_of<T>(_: T) -> &'static str {
            std::any::type_name::<T>()
        }
        let name = type_name_of(f);

        // Find and cut the rest of the path
        match &name[..name.len() - 3].rfind(':') {
            Some(pos) => &name[pos + 1..name.len() - 3],
            None => &name[..name.len() - 3],
        }
    }};
}

#[derive(Serialize, Debug)]
struct Position {
    line: usize,   // 1-indexed
    column: usize, // 1-indexed
}

#[derive(Serialize, Debug)]
struct Range {
    start: Position,
    end: Position,
}

#[derive(Serialize, Debug)]
struct SqlNode {
    code_range: Range,
    content: String,
}

type SerializedSqlNodeList = Vec<String>;

struct QueryVisitor {
    sql_node_list: SerializedSqlNodeList,
}

impl<'ast> QueryVisitor {
    fn into_sql_node_list(self) -> SerializedSqlNodeList {
        self.sql_node_list
    }
}

// NOTE: re-instructed to use the syn crate
impl<'ast> Visit<'ast> for QueryVisitor {
    // visit sqlx macro
    fn visit_macro(&mut self, mac: &'ast syn::Macro) {
        // print macro name
        for path_segment in &mac.path.segments {
            if path_segment.ident == "query" || path_segment.ident == "query_as" {
                // get tokens
                let tokens = &mac.tokens;
                #[cfg(debug_assertions)]
                println!("{} Found sqlx::query!: {}", function!(), tokens.to_string());

                // search literal and concat
                let mut sql_lit = String::new();
                let mut start = Position { line: 0, column: 0 };
                let mut end = Position { line: 0, column: 0 };
                for token in tokens.clone() {
                    // get only Literal(Literal) from TokenTree
                    let lit = match token {
                        proc_macro2::TokenTree::Literal(lit) => lit,
                        _ => continue,
                    };
                    #[cfg(debug_assertions)]
                    println!("{} lit: {:?}", function!(), lit);
                    println!("{} lit span start: {:?}", function!(), lit.span().start());
                    println!("{} lit span end: {:?}", function!(), lit.span().end());

                    start = Position {
                        line: lit.span().start().line,
                        column: lit.span().start().column,
                    };
                    end = Position {
                        line: lit.span().end().line,
                        column: lit.span().end().column,
                    };

                    // concat lit
                    sql_lit.push_str(&lit.to_string());
                }
                // If query is surrounded by "" or r#""# then remove it
                if sql_lit.starts_with("r#\"") {
                    sql_lit = sql_lit
                        .trim_start_matches("r#\"")
                        .trim_end_matches("\"#")
                        .to_string();

                    // adjust position and if "\n" is included in the sql_lit, then add 1 to start line
                    start.column += 3 + if let Some(_) = sql_lit.find("\n") {
                        1
                    } else {
                        0
                    };
                    end.column -= 2 - 1; // -2 for "#, +1 to convert 0-indexed into 1-indexed
                } else if sql_lit.starts_with("\"") {
                    sql_lit = sql_lit
                        .trim_start_matches("\"")
                        .trim_end_matches("\"")
                        .to_string();

                    // remove '"'
                    start.column += 1;
                    end.column -= 1 - 1; // -1 for '"', +1 to convert 0-indexed into 1-indexed
                }

                let sql_node = SqlNode {
                    code_range: Range {
                        start: Position {
                            line: start.line,
                            column: start.column,
                        },
                        end: Position {
                            line: end.line,
                            column: end.column,
                        },
                    },
                    content: sql_lit.clone(),
                };

                #[cfg(debug_assertions)]
                println!("{} lit_str: {}", function!(), sql_lit);
                println!("{} sql_node: {:?}", function!(), sql_node);

                // serialize sql_node to json and push
                let sql_node_str = serde_json::to_string(&sql_node).unwrap();
                self.sql_node_list.push(sql_node_str);
            }
        }

        // Delegate to the default impl to visit any nested functions.
        visit::visit_macro(self, mac);
    }

    fn visit_lit(&mut self, i: &'ast syn::Lit) {
        println!("Found lit str");
        // println!("{}", i.value());
        visit::visit_lit(self, i);
    }
}

#[wasm_bindgen]
pub fn extract_sql_list(source_txt: &str) -> SerializedSqlNodeList {
    let ast: File = syn::parse_file(source_txt).unwrap();
    let mut query_visitor = QueryVisitor {
        sql_node_list: Vec::<String>::new(),
    };
    query_visitor.visit_file(&ast);

    query_visitor.into_sql_node_list()
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn found_sqlx_query_one_query_single_line() {
        let result = extract_sql_list(
            r#"
async fn add_todo(pool: &PgPool, description: String) -> anyhow::Result<i64> {
    let rec = sqlx::query!("INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id",
        description
    )
    .fetch_one(pool)
    .await?;

    Ok(rec.id)
}
        "#,
        );
        println!("{} result: {:?}", function!(), result);
        let expected = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 3,
                    column: 28,
                },
                end: Position {
                    line: 3,
                    column: 89,
                },
            },
            content: "INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id".to_string(),
        })
        .unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], expected);
    }

    #[test]
    fn found_sqlx_query_multi_queries_with_single_line() {
        let result = extract_sql_list(
            r#"
async fn add_todo(pool: &PgPool, description: String) -> anyhow::Result<i64> {
    let rec = sqlx::query!("SELECT id \"id\", description, done FROM todos ORDER BY id")
        .fetch_one(pool)
        .await?;

    // write test insert query
    let rec = sqlx::query!("INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id", description)
        .fetch_one(pool)
        .await?;

    Ok(rec.id)
}
            "#,
        );
        println!("{} result: {:?}", function!(), result);
        let expected1 = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 3,
                    column: 28,
                },
                end: Position {
                    line: 3,
                    column: 87,
                },
            },
            content: "SELECT id \\\"id\\\", description, done FROM todos ORDER BY id".to_string(),
        })
        .unwrap();

        let expected2 = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 8,
                    column: 28,
                },
                end: Position {
                    line: 8,
                    column: 89,
                },
            },
            content: "INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id".to_string(),
        })
        .unwrap();

        assert_eq!(result.len(), 2);
        assert_eq!(result[0], expected1);
        assert_eq!(result[1], expected2);
    }

    #[test]
    fn found_sqlx_query_one_queries_with_multi_line() {
        let result = extract_sql_list(
            r##"
async fn complete_todo(pool: &PgPool, id: i64) -> anyhow::Result<bool> {
    let rows_affected = sqlx::query!(
        r#"
UPDATE todos
SET done = TRUE
WHERE id = $1
        "#,
        id
    )
    .execute(pool)
    .await?
    .rows_affected();

    Ok(rows_affected > 0)
}
            "##,
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 1);

        let expected = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 4,
                    column: 12,
                },
                end: Position { line: 8, column: 9 },
            },
            content: "\nUPDATE todos\nSET done = TRUE\nWHERE id = $1\n        ".to_string(),
        })
        .unwrap();
        assert_eq!(result[0], expected,);
    }

    #[test]
    fn found_sqlx_query_multi_queries_with_multi_line() {
        let result = extract_sql_list(
            r##"
async fn add_todo(pool: &PgPool, description: String) -> anyhow::Result<i64> {
    let rec = sqlx::query!(r#"
INSERT INTO "todos" ( description )
VALUES ( $1 )
RETURNING id
        "#,
            description
        )
        .fetch_one(pool)
        .await?;

    // write test insert query
    let rec = sqlx::query!(r#"
            UPDATE todos
            SET done = TRUE
            WHERE id = $1
            "#,
            description
        )
        .fetch_one(pool)
        .await?;

    Ok(rec.id)
}
            "##,
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 2);
        let expected1 = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 3,
                    column: 31,
                },
                end: Position { line: 7, column: 9 },
            },
            content:
                "\nINSERT INTO \"todos\" ( description )\nVALUES ( $1 )\nRETURNING id\n        "
                    .to_string(),
        })
        .unwrap();
        assert_eq!(result[0], expected1);

        let expected2 = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 14,
                    column: 31,
                },
                end: Position { line: 18, column: 13 },
            },
            content: "\n            UPDATE todos\n            SET done = TRUE\n            WHERE id = $1\n            ".to_string(),
        }).unwrap();
        assert_eq!(result[1], expected2);
    }

    #[test]
    fn found_sqlx_query_as_one_query_single_line() {
        let result = extract_sql_list(
            r##"
async fn list_todos(pool: &PgPool) -> anyhow::Result<()> {
    let recs = sqlx::query_as!(
        Todo,
        r#"
SELECT id, description, done
FROM todos
ORDER BY id
        "#
    )
    .fetch_all(pool)
    .await?;

    for rec in recs {
        println!(
            "- [{}] {}: {}",
            if rec.done { "x" } else { " " },
            rec.id,
            &rec.description,
        );
    }
}
            "##,
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 1);
        let expected = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 5,
                    column: 12,
                },
                end: Position { line: 9, column: 9 },
            },
            content: "\nSELECT id, description, done\nFROM todos\nORDER BY id\n        "
                .to_string(),
        })
        .unwrap();
        assert_eq!(result[0], expected);
    }
}
