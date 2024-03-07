import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	const city = await prisma.$queryRaw`SELECT * FROM city WHERE id = 1;`;
	// const city2 = await prisma.city.findMany();
	console.log(city);
	// console.log(city2);
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
