# sqlsurge <!-- omit in toc -->

[sqlsurge](https://marketplace.visualstudio.com/items?itemName=senken.sqlsurge) is a Visual Studio Code extension for SQL language server using [sqls](https://github.com/lighttiger2505/sqls). It works just **NOT ONLY with SQL files, but also with RAW SQL QUERIES on other languages such as TypeScript and Rust**.

Prisma Example in TypeScript:
![Alt text](resources/screenshot-ts.png)

SQLx Example in Rust:
![Alt text](resources/screenshot-rs.png)

## Features <!-- omit in toc -->

- [Auto-Completion](#auto-completion)
- [Formatting](#formatting)
- [Supporting raw SQL query](#supporting-raw-sql-query)

### Auto-Completion

These are the auto-completion items sqlsurge provides:

- SQL keywords
- Tables and columns (Required to be configured by `sqls config`)

VSCode's quick suggestion(auto completion) in strings is disabled by default.
It can be enabled by adding the following setting to settings.json.

```json
"editor.quickSuggestions": {
    "strings": true
}
```

### Formatting

- VSCode Command: `sqlsurge: Format SQL`
- Settings
  - `sqlsurge.formatOnSave`: Format SQL on save. Default is `true`.
  - `sqlsurge.formatSql.indent`: Format SQL with indent. Default is `false`.
  - `sqlsurge.formatSql.tabSize`: Tab size for SQL formatting. Default is `4`.

As a formatter, sqlsurge use `sqls` for Vanilla SQL files, use [SQL Formatter](https://github.com/sql-formatter-org/sql-formatter) for raw SQL.

### Supporting raw SQL query

sqlsurge supports raw SQL queries in other languages such as TypeScript and Rust.
Now it supports:

- [Prisma](https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries) in TypeScript
- [SQLx](https://github.com/launchbadge/sqlx) in Rust

## Requirements <!-- omit in toc -->

- [**Golang**](https://golang.org/doc/install) v1.22.2 or later
- [**sqls**](https://github.com/sqls-server/sqls?tab=readme-ov-file#installation) v0.2.28 or later
  - There is sqls installation guide in the extension.

To use completion for tables and columns, you need to configure the database connection by `sqls config` command.

## TODOs <!-- omit in toc -->

- [x] Support for Prisma in TypeScript
- [x] Support for SQLx in Rust
- [x] Install guide for sqls
- [x] Format SQL (Vanilla SQL: sqls, Raw SQL: [SQL Formatter](https://github.com/sql-formatter-org/sql-formatter))
- [ ] Support to custom raw SQL queries, not just Prisma and SQLx
- [ ] Show quick info symbol
- [ ] Execute SQL query
- [ ] Show sqls config with tree view
