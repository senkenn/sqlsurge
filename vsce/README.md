# sqlsurge

[sqlsurge](https://marketplace.visualstudio.com/items?itemName=senken.sqlsurge) is a Visual Studio Code extension for SQL language server using [sqls](https://github.com/lighttiger2505/sqls). It works just **NOT ONLY with SQL files, but also with RAW SQL QUERIES on other languages such as TypeScript and Rust**.

Prisma Example in TypeScript:
![Alt text](resources/screenshot-ts.png)

SQLx Example in Rust:
![Alt text](resources/screenshot-rs.png)

## Features

- Auto Completion tables and table columns
- Supporting raw SQL query
  - [Prisma](https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries) in TypeScript
  - [SQLx](https://github.com/launchbadge/sqlx) in Rust

VSCode's quick suggestion(auto completion) in strings is disabled by default.
It can be enabled by adding the following setting to settings.json.

```json
"editor.quickSuggestions": {
    "strings": true
}
```

## Requirements

- **sqls** ([Installation Guide](https://github.com/sqls-server/sqls?tab=readme-ov-file#installation))

You should verify the sqls's path is valid with `sqls -v`, and configure the database connection by `sqls config` command.

## TODOs

- [x] Support for Prisma in TypeScript
- [x] Support for SQLx in Rust
- [ ] Format SQL
- [ ] Show quick info symbol
- [ ] Support to custom raw SQL queries, not just Prisma and SQLx
- [ ] Install sqls automatically if not found
- [ ] Execute SQL query
- [ ] Show sqls config with tree view
