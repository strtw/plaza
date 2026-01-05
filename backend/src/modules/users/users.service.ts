import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class UsersService {
  async findOrCreateByClerkId(clerkId: string, email: string, name?: string) {
    return prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: {
        clerkId,
        email,
        name,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
}

