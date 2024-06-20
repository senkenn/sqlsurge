import { extractSqlListTs } from ".";

describe("index", () => {
  describe("extractSqlListTs", () => {
    it("should work with Prisma", () => {
      const result = extractSqlListTs(`
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const todo = await prisma.$queryRaw\`SELECT * FROM todos WHERE id = 1;\`;
  await prisma.$queryRaw\`
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
    \`;
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
        `);

      expect(result).toStrictEqual([
        {
          code_range: {
            start: { line: 6, character: 38 },
            end: { line: 6, character: 71 },
          },
          content: "SELECT * FROM todos WHERE id = 1;",
          method_line: 6,
        },
        {
          code_range: {
            start: { line: 7, character: 25 },
            end: { line: 20, character: 4 },
          },
          content: `
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
    `,
          method_line: 7,
        },
      ]);
    });
    it("should work with TypeORM", () => {
      const result = extractSqlListTs(
        `
import { getManager } from "typeorm";

(async () => {
  const entityManager = getManager();
  const someQuery = await entityManager.query(
    "SELECT * FROM todos WHERE id = $1;",
    [1],
  );

  await entityManager.query(
    \`
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
    \`,
    [1],
  );
})();
`,
        [
          {
            functionName: "query",
            sqlArgNo: 1,
            isTemplateLiteral: false,
          },
        ],
      );

      expect(result).toStrictEqual([
        {
          code_range: {
            start: { line: 6, character: 5 },
            end: { line: 6, character: 39 },
          },
          content: "SELECT * FROM todos WHERE id = $1;",
          method_line: 5,
        },
        {
          code_range: {
            start: { line: 11, character: 5 },
            end: { line: 24, character: 4 },
          },
          content: `
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
          method_line: 10,
        },
      ]);
    });

    it("should work with User-Defined function", () => {
      const result = extractSqlListTs(
        `
import { query, getConnection } from "./lib/db";

(async () => {
  const connection = getConnection();
  const someQuery = await query(
    connection,
    "SELECT * FROM todos WHERE id = $1;",
    [1],
  );

  await query(
    connection,
    \`
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
    \`,
    [1],
  );
})();
`,
        [
          {
            functionName: "query",
            sqlArgNo: 2,
            isTemplateLiteral: false,
          },
        ],
      );

      expect(result).toStrictEqual([
        {
          code_range: {
            start: { line: 7, character: 5 },
            end: { line: 7, character: 39 },
          },
          content: "SELECT * FROM todos WHERE id = $1;",
          method_line: 5,
        },
        {
          code_range: {
            start: { line: 13, character: 5 },
            end: { line: 26, character: 4 },
          },
          content: `
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
          method_line: 11,
        },
      ]);
    });
  });
});
