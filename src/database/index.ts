import { PrismaClient } from '@prisma/client';

// Create a single connection to our database
const prisma = new PrismaClient();

// Export it so the rest of our bot files can use it
export default prisma;