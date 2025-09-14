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
    it("should work with Prisma with query alias", () => {
      const result = extractSqlListTs(
        `
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const query = prisma.$queryRaw;
  const todo = await query\`SELECT * FROM todos WHERE id = 1;\`;
  await query\`
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
        `,
        [{ functionName: "query", sqlArgNo: 0, isTemplateLiteral: true }],
      );

      expect(result).toStrictEqual([
        {
          code_range: {
            start: { line: 7, character: 27 },
            end: { line: 7, character: 60 },
          },
          content: "SELECT * FROM todos WHERE id = 1;",
          method_line: 7,
        },
        {
          code_range: {
            start: { line: 8, character: 14 },
            end: { line: 21, character: 4 },
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
          method_line: 8,
        },
      ]);
    });
    it("should work with Bun", () => {
      const result = extractSqlListTs(
        `
import { sql } from "bun";

async function main() {
  const todo = await sql\`SELECT * FROM todos WHERE id = 1;\`;
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
    \`;
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
`,
        [{ functionName: "sql", sqlArgNo: 0, isTemplateLiteral: true }],
      );

      expect(result).toStrictEqual([
        {
          code_range: {
            start: { line: 4, character: 25 },
            end: { line: 4, character: 58 },
          },
          content: "SELECT * FROM todos WHERE id = 1;",
          method_line: 4,
        },
        {
          code_range: {
            start: { line: 5, character: 12 },
            end: { line: 18, character: 4 },
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
          method_line: 5,
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
