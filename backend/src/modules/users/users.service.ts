import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class UsersService {
  async findOrCreateByClerkId(clerkId: string, phone: string, email?: string, name?: string) {
    return prisma.user.upsert({
      where: { clerkId },
      update: {
        phone, // Update phone if it changed
        email,
        name,
      },
      create: {
        clerkId,
        phone,
        email,
        name,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  }
}

