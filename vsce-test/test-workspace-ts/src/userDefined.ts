import { getConnection, query } from "./lib/db";

(async () => {
  const connection = getConnection();
  const someQuery = await query(
    connection,
    "SELECT * FROM todos WHERE id = $1;",
    [1],
  );

  await query(
    connection,
    `
    INSERT INTO todos
    (
        id,
        description,
        done
    )
    VALUES
    (
        $1,
        "todo description",
        TRUE
    );
    `,
    [1],
  );
})();
