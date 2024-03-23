#![allow(unused_imports)]
use quote::quote;
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

struct QueryVisitor {
    sql_list: Vec<String>,
}

impl<'ast> QueryVisitor {
    // other methods...

    fn into_sql_list(self) -> Vec<String> {
        self.sql_list
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
                println!("Found sqlx::query!: {}", tokens.to_string());

                // search literal and concat
                let mut lit_str = String::new();
                for token in tokens.clone() {
                    // get only Literal(Literal) from TokenTree
                    let lit = match token {
                        proc_macro2::TokenTree::Literal(lit) => lit,
                        _ => continue,
                    };
                    #[cfg(debug_assertions)]
                    println!("{:?}", lit);

                    // concat lit
                    lit_str.push_str(&lit.to_string());
                }
                // If query is surrounded by "" or r#""# then remove it and trim the spaces
                if lit_str.starts_with("r#\"") {
                    lit_str = lit_str
                        .trim_start_matches("r#\"")
                        .trim_end_matches("\"#")
                        .to_string();
                } else if lit_str.starts_with("\"") {
                    lit_str = lit_str
                        .trim_start_matches("\"")
                        .trim_end_matches("\"")
                        .to_string();
                }

                // println!("{}", lit_str);
                self.sql_list.push(lit_str);
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
pub fn extract_sql_list(source_txt: &str) -> Vec<String> {
    let ast: File = syn::parse_file(source_txt).unwrap();
    let mut query_visitor = QueryVisitor {
        sql_list: Vec::new(),
    };
    query_visitor.visit_file(&ast);

    query_visitor.into_sql_list()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works_sqlx_query_one_query_single_line() {
        let result = extract_sql_list(
            &quote! {
                async fn add_todo(pool: &PgPool, description: String) -> anyhow::Result<i64> {
                    let rec = sqlx::query!("SELECT "id", name, population FROM city;", description)
                    .fetch_one(pool)
                    .await?;

                    Ok(rec.id)
                }
            }
            .to_string(),
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], "SELECT \"id\", name, population FROM city;");
    }

    #[test]
    fn it_works_sqlx_query_multi_queries_with_single_line() {
        let result = extract_sql_list(
            &quote! {
                async fn add_todo(pool: &PgPool, description: String) -> anyhow::Result<i64> {
                    let rec = sqlx::query!("SELECT "id", name, population FROM city id = $1;", id)
                    .fetch_one(pool)
                    .await?;

                    // write test insert query
                    let rec = sqlx::query!("INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id", description)
                    .fetch_one(pool)
                    .await?;

                    Ok(rec.id)
                }
            }
            .to_string(),
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 2);
        assert_eq!(
            result[0],
            "SELECT \"id\", name, population FROM city id = $1;"
        );
        assert_eq!(
            result[1],
            "INSERT INTO todos ( description ) VALUES ( $1 ) RETURNING id"
        );
    }

    #[test]
    fn it_works_sqlx_query_one_queries_with_multi_line() {
        let result = extract_sql_list(
            &quote! {
                    async fn add_todo(pool: &PgPool, description: String) -> anyhow::Result<i64> {
                        let rec = sqlx::query!(
            r#"
                INSERT INTO "todos" ( description )
                VALUES ( $1 )
                RETURNING id
                        "#,
                            description
                        )
                        .fetch_one(pool)
                        .await?;

                        Ok(rec.id)
                    }
                }
            .to_string(),
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 1);
        assert_eq!(
            result[0],
            r#"
                INSERT INTO "todos" ( description )
                VALUES ( $1 )
                RETURNING id
                        "#
        );
    }

    #[test]
    fn it_works_sqlx_query_multi_queries_with_multi_line() {
        let result = extract_sql_list(
            &quote! {
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
            }
            .to_string(),
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 2);
        assert_eq!(
            result[0],
            r#"
                INSERT INTO "todos" ( description )
                VALUES ( $1 )
                RETURNING id
                        "#
        );
        for (i, char) in result[1].chars().enumerate() {
            assert_eq!(char, result[1].chars().nth(i).unwrap());
        }
        assert_eq!(
            result[1],
            r#"
                UPDATE todos
                SET done = TRUE
                WHERE id = $1
                        "#
        );
    }

    #[test]
    fn it_works_sqlx_query_as_one_query_single_line() {
        let result = extract_sql_list(
            &quote! {
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
            }
            .to_string(),
        );
        println!("{} result: {:?}", function!(), result);
        assert_eq!(result.len(), 1);
        assert_eq!(
            result[0],
            r#"
                SELECT id, description, done
                FROM todos
                ORDER BY id
                        "#
        );
    }
}
