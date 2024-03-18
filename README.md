# sqlsurge

[sqlsurge](https://marketplace.visualstudio.com/items?itemName=senken.sqlsurge) is a Visual Studio Code extension designed to enhance the SQL development experience. It allows you to work with raw SQL queries within various file types, not just SQL files. This extension is built on the [sqls](https://github.com/lighttiger2505/sqls) language server.

## Features

- Auto Completion tables and table columns
- Quick info symbol
- Supporting raw SQL query of [Prisma](https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries) in TypeScript.

## Requirements

- sqls ([Installation Guide](https://github.com/sqls-server/sqls?tab=readme-ov-file#installation))

To verify the installation of sqls, run `sqls -v` in your terminal:

```bash
$ sqls -v
sqls version Version:0.2.28, Revision:HEAD
```

## Notes

- To get syntax highlighting for raw SQL queries from Prisma, install the Prisma official extension.

## TODOs

- [ ] Add support for [SQLx](https://github.com/launchbadge/sqlx) in Rust
- [ ] Extend support to custom raw SQL queries, not just Prisma and SQLx
