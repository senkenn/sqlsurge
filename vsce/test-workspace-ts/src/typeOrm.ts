import { getManager } from "typeorm";

(async () => {
  const entityManager = getManager();
  const someQuery = await entityManager.query(
    "SELECT * FROM todos WHERE id = $1;",
    [1],
  );

  await entityManager.query(
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
