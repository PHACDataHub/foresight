import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const alice = await prisma.persona.upsert({
    where: { id: "alice" },
    update: {},
    create: {
      id: "alice",
      name: "Alice",
      image: "/Alice2.jpg",
      description: "Disease Outbreaks",
    },
  });
  const anthony = await prisma.persona.upsert({
    where: { id: "anthony" },
    update: {},
    create: {
      id: "anthony",
      name: "Anthony",
      image: "/Anthony.jpg",
      description: "Climate Change Impacts",
    },
  });
  const aimee = await prisma.persona.upsert({
    where: { id: "aimee" },
    update: {},
    create: {
      id: "aimee",
      name: "Aimee",
      image: "/Aimee.jpg",
      description: "Substance Abuse",
    },
  });

  const anita = await prisma.persona.upsert({
    where: { id: "anita" },
    update: {},
    create: {
      id: "anita",
      name: "Anita",
      image: "/Anita.jpg",
      description: "",
    },
  });

  const arjun = await prisma.persona.upsert({
    where: { id: "arjun" },
    update: {},
    create: {
      id: "arjun",
      name: "Arjun",
      image: "/Arjun.jpg",
      description: "",
    },
  });

  const tom = await prisma.persona.upsert({
    where: { id: "tom" },
    update: {},
    create: {
      id: "tom",
      name: "Tom",
      image: "/Tom.jpg",
      description: "",
    },
  });

  console.log( { alice, anthony, aimee, anita, arjun, tom });

}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
