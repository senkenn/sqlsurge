import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const city = await prisma.$queryRaw`SELECT * FROM city WHERE ID = 1;`;
  const city2 =
    await prisma.$queryRaw`INSERT INTO city (Name, CountryCode, District, Population) VALUES ('Test', 'TST', 'Test', 1000);`;
  console.log(city);
  console.log(city2);
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
