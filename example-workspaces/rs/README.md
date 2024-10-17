# SQLx TODOs Example

This is a copy of the [SQLx TODOs Example](https://github.com/launchbadge/sqlx/tree/main/examples/postgres/todos)

## Pre Setup

```bash
# Install sqlx-cli
cargo install sqlx-cli
```

## Setup

1. Declare the database URL

   ```sh
   export DATABASE_URL="postgres://postgres:mysecretpassword1234@localhost:15432/todos"
   ```

2. Create the database.

   ```sh
   sqlx db create
   ```

3. Run sql migrations

   ```sh
   sqlx migrate run
   ```

## Usage

Add a todo

```sh
cargo run -- add "todo description"
```

Complete a todo.

```sh
cargo run -- done <todo id>
```

List all todos

```sh
cargo run
```
