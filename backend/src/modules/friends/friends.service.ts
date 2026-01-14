import { Injectable } from '@nestjs/common';
import { PrismaClient, Friend, FriendStatus } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class FriendsService {
  /**
   * Get all friends for a user
   * Returns Plaza users that the user has added as friends
   */
  async getFriends(userId: string) {
    try {
      const friends = await prisma.friend.findMany({
        where: { 
          userId,
          status: FriendStatus.ACTIVE,
        },
        include: {
          friendUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return friends.map((f) => ({
        id: f.friendUser.id,
        firstName: f.friendUser.firstName,
        lastName: f.friendUser.lastName,
        email: f.friendUser.email,
      }));
    } catch (error: any) {
      console.error('[FriendsService] Error fetching friends:', error);
      return [];
    }
  }

  /**
   * Add a friend (unidirectional)
   * Creates Friend record: userId → friendUserId
   */
  async addFriend(userId: string, friendUserId: string) {
    try {
      // Check if friendship already exists
      const existing = await prisma.friend.findUnique({
        where: {
          userId_friendUserId: {
            userId,
            friendUserId,
          },
        },
      });

      if (existing) {
        // If blocked, reactivate
        if (existing.status === FriendStatus.BLOCKED) {
          return await prisma.friend.update({
            where: { id: existing.id },
            data: { status: FriendStatus.ACTIVE },
          });
        }
        return existing;
      }

      // Create new friendship
      return await prisma.friend.create({
        data: {
          userId,
          friendUserId,
          status: FriendStatus.ACTIVE,
        },
      });
    } catch (error: any) {
      console.error('[FriendsService] Error adding friend:', error);
      throw error;
    }
  }

  /**
   * Mute a friend
   */
  async muteFriend(userId: string, friendUserId: string) {
    try {
      const friend = await prisma.friend.findUnique({
        where: {
          userId_friendUserId: {
            userId,
            friendUserId,
          },
        },
      });

      if (!friend) {
        throw new Error('Friend not found');
      }

      return await prisma.friend.update({
        where: { id: friend.id },
        data: { status: FriendStatus.MUTED },
      });
    } catch (error: any) {
      console.error('[FriendsService] Error muting friend:', error);
      throw error;
    }
  }

  /**
   * Block a friend
   */
  async blockFriend(userId: string, friendUserId: string) {
    try {
      const friend = await prisma.friend.findUnique({
        where: {
          userId_friendUserId: {
            userId,
            friendUserId,
          },
        },
      });

      if (!friend) {
        throw new Error('Friend not found');
      }

      return await prisma.friend.update({
        where: { id: friend.id },
        data: { status: FriendStatus.BLOCKED },
      });
    } catch (error: any) {
      console.error('[FriendsService] Error blocking friend:', error);
      throw error;
    }
  }

  /**
   * Unmute a friend
   */
  async unmuteFriend(userId: string, friendUserId: string) {
    try {
      const friend = await prisma.friend.findUnique({
        where: {
          userId_friendUserId: {
            userId,
            friendUserId,
          },
        },
      });

      if (!friend) {
        throw new Error('Friend not found');
      }

      return await prisma.friend.update({
        where: { id: friend.id },
        data: { status: FriendStatus.ACTIVE },
      });
    } catch (error: any) {
      console.error('[FriendsService] Error unmuting friend:', error);
      throw error;
    }
  }

  /**
   * Unblock a friend
   */
  async unblockFriend(userId: string, friendUserId: string) {
    try {
      const friend = await prisma.friend.findUnique({
        where: {
          userId_friendUserId: {
            userId,
            friendUserId,
          },
        },
      });

      if (!friend) {
        throw new Error('Friend not found');
      }

      return await prisma.friend.update({
        where: { id: friend.id },
        data: { status: FriendStatus.ACTIVE },
      });
    } catch (error: any) {
      console.error('[FriendsService] Error unblocking friend:', error);
      throw error;
    }
  }
}
