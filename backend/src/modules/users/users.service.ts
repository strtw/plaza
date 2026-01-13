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
  async findOrCreateByClerkId(clerkId: string, phone: string, email?: string, firstName?: string, lastName?: string) {
    const phoneHash = hashPhone(phone);
    
    return prisma.user.upsert({
      where: { clerkId },
      update: {
        phoneHash, // Update phone hash if phone changed
        email,
        firstName,
        lastName,
      },
      create: {
        clerkId,
        phoneHash,
        email,
        firstName,
        lastName,
      },
    });
  }

  /**
   * Create user account with firstName and lastName
   * Used during sign-up after phone verification
   * If user already exists (e.g., from a previous failed attempt), updates their firstName and lastName
   */
  async createAccount(clerkId: string, phone: string, firstName: string, lastName: string, email?: string) {
    const phoneHash = hashPhone(phone);
    
    // Use upsert to handle case where user already exists (from previous failed attempt)
    return prisma.user.upsert({
      where: { clerkId },
      update: {
        phoneHash, // Update phone hash in case it changed
        firstName,
        lastName,
        email: email || undefined, // Only update email if provided
      },
      create: {
        clerkId,
        phoneHash,
        email,
        firstName,
        lastName,
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
        firstName: true,
        lastName: true,
        email: true,
        phoneHash: true,
      },
    });
  }

  /**
   * Delete user account from Plaza database
   * Note: Related records (contacts, statuses, invites, appContacts) are automatically deleted
   * due to onDelete: Cascade in the schema
   */
  async deleteAccount(clerkId: string) {
    return prisma.user.delete({
      where: { clerkId },
    });
  }
}

