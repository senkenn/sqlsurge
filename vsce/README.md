# sqlsurge

[sqlsurge](https://marketplace.visualstudio.com/items?itemName=senken.sqlsurge) is a Visual Studio Code extension designed to enhance the SQL development experience. It allows you to work with raw SQL queries within various file types, not just SQL files. This extension is built on the [sqls](https://github.com/lighttiger2505/sqls) language server.

![Alt text](resources/screenshot-for-readme.png)

## Features

- Auto Completion tables and table columns
- Quick info symbol
- Supporting raw SQL query
  - [Prisma](https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries) in TypeScript.
  - [SQLx](https://github.com/launchbadge/sqlx) in Rust.

## Requirements

- sqls ([Installation Guide](https://github.com/sqls-server/sqls?tab=readme-ov-file#installation))

```bash
$ sqls -v
sqls version Version:0.2.28, Revision:HEAD
```

And configure the database connection in the `sqls-config.yaml` file.

This is an example of PostgreSQL configuration:

```yaml
❯ cat ~/.config/sqls/config.yml
# Set to true to use lowercase keywords instead of uppercase.
lowercaseKeywords: false
connections:
   - alias: test
     driver: postgresql
     proto: tcp
     user: postgres
     passwd: mysecretpassword1234
     host: 127.0.0.1
     port: 15432
     dbName: todos
```

## TODOs

- [x] Add support for [SQLx](https://github.com/launchbadge/sqlx) in Rust
- [ ] Extend support to custom raw SQL queries, not just Prisma and SQLx
- [ ] Auto install sqls if not found
