use proc_macro2::TokenTree;
use serde::{Deserialize, Serialize};
use syn::spanned::Spanned;
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
    line: usize,      // 0-indexed
    character: usize, // 0-indexed
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
    method_line: usize, // 0-indexed
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[allow(non_snake_case)]
struct Config {
    functionName: String,
    sqlArgNo: usize,
    isMacro: bool,
}

type SerializedSqlNodeList = Vec<String>;

#[derive(Clone)]
struct QueryVisitor {
    sql_node_list: SerializedSqlNodeList,
    configs: Vec<Config>,
}

// NOTE: re-instructed to use the syn crate
impl<'ast> Visit<'ast> for QueryVisitor {
    // visit sqlx macro
    fn visit_macro(&mut self, mac: &'ast syn::Macro) {
        for config in &self.configs {
            if !config.isMacro {
                let mut clone_self = self.clone();
                return visit::visit_macro(&mut clone_self, mac);
            }
            // path_segment ex) sqlx::query!
            // path_segments[0]: sqlx
            // path_segments[1]: query!
            for path_segment in &mac.path.segments {
                let mut sql_lit = String::new();
                let mut sql_token: Option<TokenTree> = None;
                if path_segment.ident == config.functionName {
                    for (i, token) in mac.tokens.clone().into_iter().enumerate() {
                        // if arguments: "INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id", description
                        // tokens[0]: "INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id" (arg1 == i / 2 + 1)
                        // tokens[1]: ,
                        // tokens[2]: description (arg2 == i / 2 + 1)
                        #[cfg(debug_assertions)]
                        println!("{} config: {:?}, argNo: {}", function!(), config, i / 2 + 1);
                        println!("{} token[{}]: {:?}", function!(), i, token.to_string());
                        if i / 2 + 1 == config.sqlArgNo {
                            sql_token = Some(token);
                            break;
                        }
                    }
                }

                // get only Literal(Literal) from TokenTree
                let lit = match sql_token {
                    Some(proc_macro2::TokenTree::Literal(lit)) => lit,
                    _ => continue,
                };
                #[cfg(debug_assertions)]
                println!(
                    "{} path_segment line: {:?}",
                    function!(),
                    path_segment.span().start().line
                );
                println!("{} lit: {:?}", function!(), lit);
                println!("{} lit span start: {:?}", function!(), lit.span().start());
                println!("{} lit span end: {:?}", function!(), lit.span().end());

                let mut start = Position {
                    line: lit.span().start().line - 1, // -1 for 1-indexed to 0-indexed
                    character: lit.span().start().column, // column is 0-indexed
                };
                let mut end = Position {
                    line: lit.span().end().line - 1,    // -1 for 1-indexed to 0-indexed
                    character: lit.span().end().column, // column is 0-indexed
                };

                // concat lit
                sql_lit.push_str(&lit.to_string());
                // If query is surrounded by "" or r#""# then remove it
                if sql_lit.starts_with("r#\"") {
                    sql_lit = sql_lit
                        .trim_start_matches("r#\"")
                        .trim_end_matches("\"#")
                        .to_string();

                    // remove 'r#""#'
                    // adjust position and if "\n" is included in the sql_lit, then add "\n" length to start line
                    let r_sharp_quote_len = "r#\"".len();
                    let sharp_quote_len = "\"#".len();
                    start.character += r_sharp_quote_len - 1 // -1 for 1-indexed to 0-indexed
                        + if let Some(_) = sql_lit.find("\n") {
                            "\n".len()
                        } else {
                            0
                        };
                    end.character -= sharp_quote_len;
                } else if sql_lit.starts_with("\"") {
                    sql_lit = sql_lit
                        .trim_start_matches("\"")
                        .trim_end_matches("\"")
                        .to_string();

                    // remove '""'
                    start.character += 1;
                    end.character -= 1;
                }

                let sql_node = SqlNode {
                    code_range: Range {
                        start: Position {
                            line: start.line,
                            character: start.character,
                        },
                        end: Position {
                            line: end.line,
                            character: end.character,
                        },
                    },
                    content: sql_lit.clone(),
                    method_line: path_segment.span().start().line - 1, // -1 for 1-indexed to 0-indexed
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

    fn visit_expr_call(&mut self, expr_call: &'ast syn::ExprCall) {
        println!("Found expr call {:?}", expr_call.func.span().start());
        visit::visit_expr_call(self, expr_call);
    }
}

#[wasm_bindgen]
pub fn extract_sql_list(source_txt: &str, configs: Option<Vec<String>>) -> SerializedSqlNodeList {
    // default is sqlx
    let default_configs: Vec<Config> = vec![
        Config {
            functionName: "query".to_string(),
            sqlArgNo: 1,
            isMacro: true,
        },
        Config {
            functionName: "query_as".to_string(),
            sqlArgNo: 2,
            isMacro: true,
        },
    ];

    let configs: Vec<Config> = match configs {
        Some(c) => {
            match c
                .iter()
                .map(|c| serde_json::from_str(c))
                .collect::<Result<Vec<_>, _>>()
            {
                Ok(c) => c,
                Err(err) => {
                    eprintln!("Failed to parse config: {:?}", err);
                    return Vec::<String>::new();
                }
            }
        }
        None => default_configs,
    };

    let ast: File = match syn::parse_file(source_txt) {
        Ok(ast) => ast,
        Err(err) => {
            eprintln!("Failed to parse source code: {:?}", err);
            return Vec::<String>::new();
        }
    };
    let mut query_visitor = QueryVisitor {
        sql_node_list: Vec::<String>::new(),
        configs,
    };
    query_visitor.visit_file(&ast);

    query_visitor.sql_node_list
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn found_sqlx_query_one_query_single_line_default_config() {
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
            None,
        );
        println!("{} result: {:?}", function!(), result);
        let expected = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 2,
                    character: 28,
                },
                end: Position {
                    line: 2,
                    character: 88,
                },
            },
            content: "INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id".to_string(),
            method_line: 2,
        })
        .unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], expected);
    }

    #[test]
    fn found_sqlx_query_as_one_query_multi_line_default_config() {
        let result = extract_sql_list(
            r##"
async fn list_todos(pool: &PgPool) -> anyhow::Result<()> {
    let recs = sqlx::query_as!(
        Todo,
        r#"
SELECT id, description, done
FROM todos
WHERE id = ?
ORDER BY id
        "#, 1
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
            None,
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 1);
        let expected = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 4,
                    character: 11,
                },
                end: Position {
                    line: 9,
                    character: 8,
                },
            },
            content:
                "\nSELECT id, description, done\nFROM todos\nWHERE id = ?\nORDER BY id\n        "
                    .to_string(),
            method_line: 2,
        })
        .unwrap();
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
                    line: 2,
                    character: 28,
                },
                end: Position {
                    line: 2,
                    character: 86,
                },
            },
            content: "SELECT id \\\"id\\\", description, done FROM todos ORDER BY id".to_string(),
            method_line: 2,
        })
        .unwrap();

        let expected2 = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 7,
                    character: 28,
                },
                end: Position {
                    line: 7,
                    character: 88,
                },
            },
            content: "INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id".to_string(),
            method_line: 7,
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
                    line: 3,
                    character: 11,
                },
                end: Position {
                    line: 7,
                    character: 8,
                },
            },
            content: "\nUPDATE todos\nSET done = TRUE\nWHERE id = $1\n        ".to_string(),
            method_line: 2,
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
                    line: 2,
                    character: 30,
                },
                end: Position {
                    line: 6,
                    character: 8,
                },
            },
            content:
                "\nINSERT INTO \"todos\" ( description )\nVALUES ( $1 )\nRETURNING id\n        "
                    .to_string(),
            method_line: 2,
        })
        .unwrap();
        assert_eq!(result[0], expected1);

        let expected2 = serde_json::to_string(&SqlNode {
            code_range: Range {
                start: Position {
                    line: 13,
                    character: 30,
                },
                end: Position { line: 17, character: 12 },
            },
            content: "\n            UPDATE todos\n            SET done = TRUE\n            WHERE id = $1\n            ".to_string(),
            method_line: 13,
        }).unwrap();
        assert_eq!(result[1], expected2);
    }

    #[test]
    fn found_sqlx_query_as_one_query_multi_line() {
        let result = extract_sql_list(
            r##"
async fn list_todos(pool: &PgPool) -> anyhow::Result<()> {
    let recs = sqlx::query_as!(
        Todo,
        r#"
SELECT id, description, done
FROM todos
WHERE id = ?
ORDER BY id
        "#, 1
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
                    line: 4,
                    character: 11,
                },
                end: Position {
                    line: 9,
                    character: 8,
                },
            },
            content:
                "\nSELECT id, description, done\nFROM todos\nWHERE id = ?\nORDER BY id\n        "
                    .to_string(),
            method_line: 2,
        })
        .unwrap();
        assert_eq!(result[0], expected);
    }

    #[test]
    fn not_found_sqlx_query_with_parsing_failure() {
        let result = extract_sql_list(
            // missing closing parenthesis
            r##"
async fn add_todo(pool: &PgPool, description: String) -> anyhow::Result<i64> {
    let rec = sqlx::query!("INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id",
        description
    )
    .fetch_one(pool)
    .await?;

    Ok(rec.id)
        "##,
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 0);
    }
}
