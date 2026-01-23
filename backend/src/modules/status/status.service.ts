import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient, AvailabilityStatus, FriendStatus, StatusLocation } from '@prisma/client';
import { CreateStatusDto } from './dto/create-status.dto';

const prisma = new PrismaClient();

@Injectable()
export class StatusService {
  async createStatus(userId: string, dto: CreateStatusDto) {
    try {
      const now = new Date();
      
      console.log('[StatusService] Creating/updating status for userId:', userId);
      console.log('[StatusService] DTO:', JSON.stringify(dto, null, 2));
      
      // Filter out blocked users from sharedWith array
      let filteredSharedWith: string[] = [];
      if (dto.sharedWith && dto.sharedWith.length > 0) {
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
        
        // Filter out blocked users from sharedWith array (silently exclude)
        filteredSharedWith = dto.sharedWith.filter(id => !blockedUserIds.has(id));
        
        if (filteredSharedWith.length < dto.sharedWith.length) {
          console.log(`[StatusService] Filtered out ${dto.sharedWith.length - filteredSharedWith.length} blocked users from sharedWith`);
        }
      }

      // Enforce maximum 100 recipients limit
      if (filteredSharedWith.length > 100) {
        filteredSharedWith = filteredSharedWith.slice(0, 100);
        console.log('[StatusService] Limited sharedWith to 100 recipients');
      }
      
      // Check if user has existing ACTIVE status (within time window)
      const existingStatus = await prisma.status.findFirst({
        where: {
          userId,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Clean up any expired statuses for this user (maintains one-status-per-user rule)
      const deletedCount = await prisma.status.deleteMany({
        where: {
          userId,
          endTime: { lt: now },
        },
      });
      if (deletedCount.count > 0) {
        console.log('[StatusService] Deleted', deletedCount.count, 'expired statuses for user');
      }
      
      const statusData = {
        status: dto.status as AvailabilityStatus,
        message: dto.message,
        location: dto.location as StatusLocation,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        sharedWith: filteredSharedWith, // Store filtered sharedWith array
      };
      
      if (existingStatus) {
        // UPDATE existing active status (preserves id and createdAt, updates updatedAt)
        console.log('[StatusService] Updating existing status with id:', existingStatus.id);
        return await prisma.status.update({
          where: { id: existingStatus.id },
          data: statusData,
        });
      } else {
        // CREATE new status (no active status exists)
        // Important: Do NOT create Friend records when sharing statuses
        console.log('[StatusService] Creating new status');
        return await prisma.status.create({
          data: { userId, ...statusData },
        });
      }
    } catch (error: any) {
      console.error('[StatusService] Error creating/updating status:', error);
      console.error('[StatusService] Error details:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack,
      });
      throw error;
    }
  }

  async getCurrentStatus(userId: string) {
    try {
      const now = new Date();
      
      return prisma.status.findFirst({
        where: {
          userId,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('Error fetching current status:', error);
      return null; // Return null on error
    }
  }

  async getFriendsStatuses(userId: string, includeMuted: boolean = false) {
    try {
      // Validate userId
      if (!userId) {
        console.error('getFriendsStatuses: userId is required');
        return [];
      }

      // Query Friend table where friendUserId = current user (people who added current user)
      // User A adds User B → User B sees User A's status
      // Default: only ACCEPTED friends
      // With includeMuted: ACCEPTED or MUTED friends
      // Never show PENDING or BLOCKED
      const statusFilter = includeMuted 
        ? [FriendStatus.ACCEPTED, FriendStatus.MUTED]
        : [FriendStatus.ACCEPTED];

      const friends = await prisma.friend.findMany({
        where: { 
          friendUserId: userId,  // People who added current user
          status: { in: statusFilter },
        },
        select: { userId: true }, // Get the userId values (people who added current user)
      });

      if (friends.length === 0) {
        return []; // No friends, no statuses to fetch
      }

      const friendUserIds = friends.map(f => f.userId).filter(Boolean);
      
      if (friendUserIds.length === 0) {
        return [];
      }

      const now = new Date();

      // Fetch statuses for those users (people who added current user)
      const statuses = await prisma.status.findMany({
        where: {
          userId: { in: friendUserIds },
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
              // Note: phone number is not stored in DB (privacy-first design)
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Group by userId and take most recent
      const statusMap = new Map();
      for (const status of statuses) {
        if (status && status.userId && !statusMap.has(status.userId)) {
          statusMap.set(status.userId, status);
        }
      }

      return Array.from(statusMap.values());
    } catch (error: any) {
      console.error('Error fetching friends statuses:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      return []; // Return empty array on error to prevent breaking the app
    }
  }

  /**
   * Delete all statuses for a user (used for status cancellation)
   */
  async deleteStatus(userId: string) {
    try {
      const deletedCount = await prisma.status.deleteMany({
        where: {
          userId,
        },
      });
      console.log('[StatusService] Deleted', deletedCount.count, 'statuses for user:', userId);
      return { deletedCount: deletedCount.count };
    } catch (error: any) {
      console.error('[StatusService] Error deleting status:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired statuses for all users
   * Runs every 15 minutes via cron job
   */
  @Cron('*/15 * * * *', { name: 'cleanup-expired-statuses' }) // Every 15 minutes
  async cleanupExpiredStatuses() {
    try {
      const now = new Date();
      const deletedCount = await prisma.status.deleteMany({
        where: {
          endTime: { lt: now },
        },
      });
      console.log('[StatusService] Cleanup: Deleted', deletedCount.count, 'expired statuses');
      return { deletedCount: deletedCount.count };
    } catch (error: any) {
      console.error('[StatusService] Error in cleanup job:', error);
      // Don't throw - we don't want cron job failures to crash the app
    }
  }
}

