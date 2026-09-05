const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();

  const dylan = await prisma.user.create({
    data: {
      googleId: "seed-dylan",
      email: "dylan@example.com",
      name: "Dylan",
    },
  });

  const bob = await prisma.user.create({
    data: {
      googleId: "seed-bob",
      email: "bob@example.com",
      name: "Bob",
    },
  });

  const sarah = await prisma.user.create({
    data: {
      googleId: "seed-sarah",
      email: "sarah@example.com",
      name: "Sarah",
    },
  });

  const engineering = await prisma.conversation.create({
    data: {
      name: "Engineering",
      messages: {
        create: [
          {
            senderId: dylan.id,
            text: "Hey everyone",
          },
          {
            senderId: bob.id,
            text: "What's up?",
          },
        ],
      },
    },
  });

  const general = await prisma.conversation.create({
    data: {
      name: "General",
      messages: {
        create: [
          {
            senderId: sarah.id,
            text: "Good morning!",
          },
          {
            senderId: dylan.id,
            text: "Morning!",
          },
        ],
      },
    },
  });

  const random = await prisma.conversation.create({
    data: {
      name: "Random",
      messages: {
        create: [
          {
            senderId: bob.id,
            text: "Anyone watching the game?",
          },
        ],
      },
    },
  });

  await prisma.conversationMember.createMany({
    data: [
      {
        userId: dylan.id,
        conversationId: engineering.id,
      },
      {
        userId: bob.id,
        conversationId: engineering.id,
      },
      {
        userId: dylan.id,
        conversationId: general.id,
      },
      {
        userId: sarah.id,
        conversationId: general.id,
      },
      {
        userId: bob.id,
        conversationId: random.id,
      },
    ],
  });

  console.log("Seed complete");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });