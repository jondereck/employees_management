import prismadb from "./prismadb";

export const prisma = prismadb;

export type PrismaClient = typeof prisma;
