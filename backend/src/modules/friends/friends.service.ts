import { Injectable } from '@nestjs/common';
import { PrismaClient, Friend, FriendStatus } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class FriendsService {
  /**
   * Get all friends for a user with relationship type indicators
   * Returns both incoming and outgoing relationships, excluding BLOCKED
   * Relationship types:
   * - Outgoing (→): Only Friend(userId=me, friendUserId=them) exists
   * - Incoming (←): Only Friend(userId=them, friendUserId=me) exists
   * - Mutual (↔): Both Friend records exist
   */
  async getFriends(userId: string) {
    try {
      // Query Friend records where userId=currentUser OR friendUserId=currentUser
      // Exclude BLOCKED friends
      const outgoingFriends = await prisma.friend.findMany({
        where: { 
          userId, // I share with them
          status: { not: FriendStatus.BLOCKED }, // Exclude BLOCKED
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
      });

      const incomingFriends = await prisma.friend.findMany({
        where: { 
          friendUserId: userId, // They share with me
          status: { not: FriendStatus.BLOCKED }, // Exclude BLOCKED
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Create maps for quick lookup
      const outgoingMap = new Map();
      outgoingFriends.forEach(f => {
        outgoingMap.set(f.friendUser.id, {
          id: f.friendUser.id,
          firstName: f.friendUser.firstName,
          lastName: f.friendUser.lastName,
          email: f.friendUser.email,
          relationshipType: 'outgoing' as const, // → (I share with them)
        });
      });

      const incomingMap = new Map();
      incomingFriends.forEach(f => {
        incomingMap.set(f.user.id, {
          id: f.user.id,
          firstName: f.user.firstName,
          lastName: f.user.lastName,
          email: f.user.email,
          relationshipType: 'incoming' as const, // ← (They share with me)
        });
      });

      // Merge and determine relationship types
      const allFriendIds = new Set([...outgoingMap.keys(), ...incomingMap.keys()]);
      const result = Array.from(allFriendIds).map(friendId => {
        const hasOutgoing = outgoingMap.has(friendId);
        const hasIncoming = incomingMap.has(friendId);

        if (hasOutgoing && hasIncoming) {
          // Mutual: both directions exist
          const friend = outgoingMap.get(friendId);
          return {
            ...friend,
            relationshipType: 'mutual' as const, // ↔ (We both share with each other)
          };
        } else if (hasOutgoing) {
          // Outgoing only
          return outgoingMap.get(friendId);
        } else {
          // Incoming only
          return incomingMap.get(friendId);
        }
      });

      // Sort by relationship type, then by name
      result.sort((a, b) => {
        const typeOrder = { mutual: 0, incoming: 1, outgoing: 2 };
        const typeDiff = typeOrder[a.relationshipType] - typeOrder[b.relationshipType];
        if (typeDiff !== 0) return typeDiff;
        
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      console.log('[FriendsService] Returning', result.length, 'friends with relationship types');
      if (result.length > 0) {
        console.log('[FriendsService] Sample friend data:', JSON.stringify(result[0], null, 2));
      }
      
      return result;
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
            data: { status: FriendStatus.ACCEPTED },
          });
        }
        return existing;
      }

      // Create new friendship
      return await prisma.friend.create({
        data: {
          userId,
          friendUserId,
          status: FriendStatus.ACCEPTED,
        },
      });
    } catch (error: any) {
      console.error('[FriendsService] Error adding friend:', error);
      throw error;
    }
  }

  /**
   * Mute a friend (recipient perspective)
   * Can be done anytime - no validation required for active status
   * Creates Friend record if it doesn't exist, or updates existing one to MUTED
   */
  async muteFriend(userId: string, sharerId: string) {
    try {
      // Check if Friend record exists where userId=sharerId AND friendUserId=currentUser
      const existingFriend = await prisma.friend.findUnique({
        where: {
          userId_friendUserId: {
            userId: sharerId, // Sharer is the userId
            friendUserId: userId, // Current user is the friendUserId (recipient)
          },
        },
      });

      if (existingFriend) {
        // Update existing Friend record to MUTED
        return await prisma.friend.update({
          where: { id: existingFriend.id },
          data: { status: FriendStatus.MUTED },
        });
      } else {
        // Create new Friend record with MUTED status
        return await prisma.friend.create({
          data: {
            userId: sharerId, // Sharer is the userId
            friendUserId: userId, // Current user is the friendUserId (recipient)
            status: FriendStatus.MUTED,
          },
        });
      }
    } catch (error: any) {
      console.error('[FriendsService] Error muting friend:', error);
      throw error;
    }
  }

  /**
   * Block a friend (recipient perspective)
   * Works from any state: pending, accepted, or preemptive (no prior interaction)
   * Creates Friend record if it doesn't exist, or updates existing one to BLOCKED
   */
  async blockFriend(userId: string, sharerId: string) {
    try {
      // Check if Friend record exists where userId=sharerId AND friendUserId=currentUser
      const existingFriend = await prisma.friend.findUnique({
        where: {
          userId_friendUserId: {
            userId: sharerId, // Sharer is the userId
            friendUserId: userId, // Current user is the friendUserId (recipient)
          },
        },
      });

      if (existingFriend) {
        // Update existing Friend record to BLOCKED (works from any state)
        return await prisma.friend.update({
          where: { id: existingFriend.id },
          data: { status: FriendStatus.BLOCKED },
        });
      } else {
        // Create new Friend record with BLOCKED status (preemptive block)
        return await prisma.friend.create({
          data: {
            userId: sharerId, // Sharer is the userId
            friendUserId: userId, // Current user is the friendUserId (recipient)
            status: FriendStatus.BLOCKED,
          },
        });
      }
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
        data: { status: FriendStatus.ACCEPTED },
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
        data: { status: FriendStatus.ACCEPTED },
      });
    } catch (error: any) {
      console.error('[FriendsService] Error unblocking friend:', error);
      throw error;
    }
  }

  /**
   * Accept a pending friendship
   * Validates that sharer has an active status with current user in sharedWith
   * Creates or updates Friend record with ACCEPTED status
   */
  async acceptFriend(userId: string, sharerId: string) {
    try {
      const now = new Date();

      // Validate that sharer has at least one active status where current user is in sharedWith array
      const activeStatus = await prisma.status.findFirst({
        where: {
          userId: sharerId,
          sharedWith: {
            has: userId, // Current user is in sharedWith array
          },
          endTime: { gt: now }, // Status hasn't expired yet
          startTime: { lte: now }, // Status has started
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!activeStatus) {
        throw new Error('This invitation has expired');
      }

      // Check if Friend record exists where userId=sharerId AND friendUserId=currentUser
      const existingFriend = await prisma.friend.findUnique({
        where: {
          userId_friendUserId: {
            userId: sharerId, // Sharer is the userId
            friendUserId: userId, // Current user is the friendUserId (recipient)
          },
        },
      });

      if (existingFriend) {
        // Update existing Friend record to ACCEPTED
        return await prisma.friend.update({
          where: { id: existingFriend.id },
          data: {
            status: FriendStatus.ACCEPTED,
            acceptedFromStatusId: activeStatus.id, // Store which status was accepted
          },
        });
      } else {
        // Create new Friend record with ACCEPTED status
        return await prisma.friend.create({
          data: {
            userId: sharerId, // Sharer is the userId
            friendUserId: userId, // Current user is the friendUserId (recipient)
            status: FriendStatus.ACCEPTED,
            acceptedFromStatusId: activeStatus.id, // Store which status was accepted
          },
        });
      }
    } catch (error: any) {
      console.error('[FriendsService] Error accepting friend:', error);
      throw error;
    }
  }

  /**
   * Get pending friends (people who shared status with current user but haven't been accepted/muted/blocked)
   * Queries Status.sharedWith array to find pending invitations
   */
  async getPendingFriends(userId: string) {
    try {
      const now = new Date();

      // Query Status records where current user's ID is in sharedWith array (using GIN index)
      // Filter to only active statuses (startTime <= now < endTime)
      const statusesWithUser = await prisma.status.findMany({
        where: {
          sharedWith: {
            has: userId, // PostgreSQL array contains operator
          },
          startTime: { lte: now },
          endTime: { gte: now },
        },
        include: {
          user: {
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

      if (statusesWithUser.length === 0) {
        return [];
      }

      // Get all sharer IDs (status.userId)
      const sharerIds = statusesWithUser.map(s => s.userId).filter(Boolean);

      // Query Friend records to exclude sharers who already have ACCEPTED, MUTED, or BLOCKED status
      const existingFriends = await prisma.friend.findMany({
        where: {
          userId: { in: sharerIds }, // Sharer is the userId
          friendUserId: userId, // Current user is the friendUserId (recipient)
          status: {
            in: [FriendStatus.ACCEPTED, FriendStatus.MUTED, FriendStatus.BLOCKED],
          },
        },
        select: { userId: true },
      });

      // Collect sharer IDs that already have Friend records (exclude these)
      const excludedSharerIds = new Set(existingFriends.map(f => f.userId));

      // Filter out sharers who already have Friend records
      // Group by sharer ID and take most recent status for each sharer
      const pendingMap = new Map();
      for (const status of statusesWithUser) {
        const sharerId = status.userId;
        if (!excludedSharerIds.has(sharerId) && !pendingMap.has(sharerId)) {
          pendingMap.set(sharerId, {
            sharer: {
              id: status.user.id,
              firstName: status.user.firstName,
              lastName: status.user.lastName,
              email: status.user.email,
            },
            status: {
              id: status.id,
              status: status.status,
              message: status.message,
              location: status.location,
              startTime: status.startTime,
              endTime: status.endTime,
              createdAt: status.createdAt,
            },
          });
        }
      }

      return Array.from(pendingMap.values());
    } catch (error: any) {
      console.error('[FriendsService] Error fetching pending friends:', error);
      return [];
    }
  }
}
