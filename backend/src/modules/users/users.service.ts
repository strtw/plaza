import { Injectable } from '@nestjs/common';
import { PrismaClient, FriendStatus } from '@prisma/client';
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
   * Note: Related records (statuses, invites, friends) are automatically deleted
   * due to onDelete: Cascade in the schema
   * Returns true if user was deleted, false if user didn't exist
   */
  async deleteAccount(clerkId: string): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: { clerkId },
      });
      return true;
    } catch (error: any) {
      // P2025 = Record not found - user doesn't exist in Plaza DB
      if (error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Search users by name or email
   * Excludes users who have blocked the current user
   */
  async searchUsers(userId: string, query: string) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const searchTerm = query.trim().toLowerCase();

      // Query Friend records where friendUserId=currentUser AND status=BLOCKED
      // These are users who have blocked the current user
      const blockedFriends = await prisma.friend.findMany({
        where: {
          friendUserId: userId, // Current user is the recipient
          status: FriendStatus.BLOCKED,
        },
        select: { userId: true }, // Get the userId values (users who blocked current user)
      });

      const blockedUserIds = new Set(blockedFriends.map(f => f.userId));

      // Search users by firstName, lastName, or email (case-insensitive, partial match)
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      // Filter out blocked users
      const filteredUsers = users.filter(user => !blockedUserIds.has(user.id));

      return filteredUsers;
    } catch (error: any) {
      console.error('[UsersService] Error searching users:', error);
      return [];
    }
  }
}

