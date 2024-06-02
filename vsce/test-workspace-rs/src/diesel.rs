use diesel::prelude::*;
use diesel::sql_query;
mod model;
//do change database-url if you don't want your code to break
fn getdbconn() -> PgConnection {
    let database_url = "Database-URL";
    PgConnection::establish(&database_url).unwrap()
}

fn main() {
    let conn = getdbconn();

    let results = sql_query(
        r#"
SELECT id, description, done
FROM todos
ORDER BY id
        "#,
    )
    .load::<model::User>(&conn)
    .unwrap();
    println!("{:?}", results);
}
