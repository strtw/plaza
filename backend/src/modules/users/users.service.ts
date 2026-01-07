import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashPhone } from '../../common/utils/phone-hash.util';

const prisma = new PrismaClient();

@Injectable()
export class UsersService {
  /**
   * Find or create user by Clerk ID
   * Phone number is hashed before storing
   */
  async findOrCreateByClerkId(clerkId: string, phone: string, email?: string, name?: string) {
    const phoneHash = hashPhone(phone);
    
    return prisma.user.upsert({
      where: { clerkId },
      update: {
        phoneHash, // Update phone hash if phone changed
        email,
        name,
      },
      create: {
        clerkId,
        phoneHash,
        email,
        name,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  /**
   * Find user by phone hash
   * Use this for contact matching
   */
  async findByPhoneHash(phoneHash: string) {
    return prisma.user.findUnique({ where: { phoneHash } });
  }

  /**
   * Find users by phone hashes (for bulk contact matching)
   */
  async findByPhoneHashes(phoneHashes: string[]) {
    return prisma.user.findMany({
      where: {
        phoneHash: { in: phoneHashes },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneHash: true,
      },
    });
  }
}

