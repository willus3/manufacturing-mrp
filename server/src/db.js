const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Create a single Prisma client instance shared across the entire app.
// Every file that needs database access imports this instead of creating its own.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const connectDb = async () => {
  await prisma.$connect();
  console.log('Database connected');
};

const disconnectDb = async () => {
  await prisma.$disconnect();
};

module.exports = { prisma, connectDb, disconnectDb };
