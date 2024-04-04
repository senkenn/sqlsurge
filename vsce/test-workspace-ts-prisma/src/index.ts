import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const todo = await prisma.$queryRaw`SELECT * FROM todos WHERE id = 1;`;
  await prisma.$queryRaw`
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
    await prisma.$disconnect();
    console.log("Disconnected");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
