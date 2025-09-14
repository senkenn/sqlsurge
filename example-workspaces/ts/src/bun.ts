import { sql } from "bun";

async function main() {
  const todo = await sql`SELECT * FROM todos WHERE id = 1;\`;
  await sql\`
    INSERT INTO todos
    (
        id,
        description,
        done
    )
    VALUES
    (
        1,
        "todo description",
        TRUE
    );
    `;
  console.log(todo);
}

main()
  .then(async () => {
    console.log("Disconnected");
  })
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  });
