import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

export function createPrismaClient() {
  return new PrismaClient();
}
