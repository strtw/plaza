import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
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
          endedAt: null,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Soft-end any expired statuses for this user (maintains one-status-per-user rule)
      const softEnded = await prisma.status.updateMany({
        where: {
          userId,
          endTime: { lt: now },
          endedAt: null,
        },
        data: { endedAt: now, endReason: 'expired' },
      });
      if (softEnded.count > 0) {
        console.log('[StatusService] Soft-ended', softEnded.count, 'expired statuses for user');
      }
      
      const statusData = {
        status: dto.status as AvailabilityStatus,
        message: dto.message,
        location: dto.location as StatusLocation,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        sharedWith: filteredSharedWith, // Store filtered sharedWith array
      };

      const hasAttendees = (existingStatus?.onMyWayUserIds?.length ?? 0) > 0;

      if (existingStatus) {
        if (hasAttendees) {
          // When attendees exist: only allow message, endTime (extend only), and sharedWith (add-only)
          const newEndTime = new Date(dto.endTime);
          const currentEndTime = new Date(existingStatus.endTime);
          if (newEndTime.getTime() < currentEndTime.getTime()) {
            throw new HttpException(
              'When people are attending, you can only extend the end time, not shorten it.',
              HttpStatus.BAD_REQUEST
            );
          }
          if (newEndTime.getTime() < now.getTime()) {
            throw new HttpException(
              'End time must be in the future.',
              HttpStatus.BAD_REQUEST
            );
          }
          // sharedWith: merge existing + new (add-only; filter blocked and cap 100)
          const blockedForMerge = await prisma.friend.findMany({
            where: { friendUserId: userId, status: FriendStatus.BLOCKED },
            select: { userId: true },
          });
          const blockedSet = new Set(blockedForMerge.map(f => f.userId));
          const mergedSharedWith = [...new Set([...(existingStatus.sharedWith ?? []), ...filteredSharedWith])];
          const mergedFiltered = mergedSharedWith.filter(id => !blockedSet.has(id));
          const sharedWithCapped =
            mergedFiltered.length > 100 ? mergedFiltered.slice(0, 100) : mergedFiltered;

          console.log('[StatusService] Updating existing status with attendees: only message, endTime, sharedWith (add-only)');
          return await prisma.status.update({
            where: { id: existingStatus.id },
            data: {
              message: dto.message,
              endTime: newEndTime,
              sharedWith: sharedWithCapped,
            },
          });
        }
        // UPDATE existing active status (no attendees): full update
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
          endedAt: null,
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

  async getFriendsStatuses(userId: string) {
    try {
      // Validate userId
      if (!userId) {
        console.error('getFriendsStatuses: userId is required');
        return [];
      }

      // Query Friend table where friendUserId = current user (people who share with current user)
      // User A shares with User B → User B sees User A's status
      // Always return ACCEPTED and MUTED friends (frontend handles filtering)
      // Never show PENDING or BLOCKED
      const friends = await prisma.friend.findMany({
        where: { 
          friendUserId: userId,  // People who share with current user
          status: { in: [FriendStatus.ACCEPTED, FriendStatus.MUTED] },
        },
        select: { userId: true }, // Get the userId values (people who share with current user)
      });

      if (friends.length === 0) {
        return []; // No friends, no statuses to fetch
      }

      const friendUserIds = friends.map(f => f.userId).filter(Boolean);
      
      if (friendUserIds.length === 0) {
        return [];
      }

      const now = new Date();

      // Fetch statuses for those users (people who share with current user)
      // Only include statuses that were shared with the current user (via sharedWith array)
      // If sharedWith is empty, the status is not shared with anyone (legacy behavior: show all)
      const statuses = await prisma.status.findMany({
        where: {
          AND: [
            {
              userId: { in: friendUserIds },
              endedAt: null,
              startTime: { lte: now },
              endTime: { gte: now },
            },
            {
              // Only show statuses that were shared with the current user
              // OR statuses with empty sharedWith (legacy statuses before sharedWith was implemented)
              OR: [
                { sharedWith: { has: userId } },
                { sharedWith: { equals: [] } },
              ],
            },
          ],
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
   * Add current user to "on my way" for a status. Fails if status not found, not active, or user not in sharedWith.
   */
  async setOnMyWay(databaseUserId: string, statusId: string) {
    const now = new Date();
    const status = await prisma.status.findUnique({
      where: { id: statusId },
    });
    if (!status) {
      throw new HttpException('Status not found', HttpStatus.NOT_FOUND);
    }
    if (status.endedAt != null || status.startTime > now || status.endTime < now) {
      throw new HttpException('Status is not active', HttpStatus.BAD_REQUEST);
    }
    if (!status.sharedWith.includes(databaseUserId)) {
      throw new HttpException('You are not invited to this status', HttpStatus.FORBIDDEN);
    }
    const current = status.onMyWayUserIds ?? [];
    if (current.includes(databaseUserId)) {
      return prisma.status.findUnique({ where: { id: statusId } });
    }
    // User can only be "on my way" to one status at a time
    const alreadyOnMyWayElsewhere = await prisma.status.findFirst({
      where: {
        id: { not: statusId },
        endedAt: null,
        startTime: { lte: now },
        endTime: { gte: now },
        onMyWayUserIds: { has: databaseUserId },
      },
    });
    if (alreadyOnMyWayElsewhere) {
      throw new HttpException(
        "You're already on your way to someone else. Cancel that first.",
        HttpStatus.BAD_REQUEST
      );
    }
    return prisma.status.update({
      where: { id: statusId },
      data: { onMyWayUserIds: [...current, databaseUserId] },
    });
  }

  /**
   * Remove current user from "on my way" for a status. Same validation as setOnMyWay.
   */
  async cancelOnMyWay(databaseUserId: string, statusId: string) {
    const now = new Date();
    const status = await prisma.status.findUnique({
      where: { id: statusId },
    });
    if (!status) {
      throw new HttpException('Status not found', HttpStatus.NOT_FOUND);
    }
    if (status.endedAt != null || status.startTime > now || status.endTime < now) {
      throw new HttpException('Status is not active', HttpStatus.BAD_REQUEST);
    }
    if (!status.sharedWith.includes(databaseUserId)) {
      throw new HttpException('You are not invited to this status', HttpStatus.FORBIDDEN);
    }
    const current = status.onMyWayUserIds ?? [];
    if (!current.includes(databaseUserId)) {
      return prisma.status.findUnique({ where: { id: statusId } });
    }
    return prisma.status.update({
      where: { id: statusId },
      data: { onMyWayUserIds: current.filter((id) => id !== databaseUserId) },
    });
  }

  /**
   * Soft-end all active statuses for a user (used for status cancellation).
   * Sets endedAt and endReason = 'cancelled_by_host' instead of deleting.
   */
  async deleteStatus(userId: string) {
    try {
      const now = new Date();
      const result = await prisma.status.updateMany({
        where: {
          userId,
          endedAt: null,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        data: {
          endedAt: now,
          endReason: 'cancelled_by_host',
        },
      });
      console.log('[StatusService] Soft-ended', result.count, 'statuses for user:', userId);
      return { deletedCount: result.count };
    } catch (error: any) {
      console.error('[StatusService] Error soft-ending status:', error);
      throw error;
    }
  }

  /**
   * Soft-end expired statuses for all users (set endedAt, endReason = 'expired').
   * Runs every 15 minutes via cron job.
   */
  @Cron('*/15 * * * *', { name: 'cleanup-expired-statuses' }) // Every 15 minutes
  async cleanupExpiredStatuses() {
    try {
      const now = new Date();
      const result = await prisma.status.updateMany({
        where: {
          endTime: { lt: now },
          endedAt: null,
        },
        data: {
          endedAt: now,
          endReason: 'expired',
        },
      });
      console.log('[StatusService] Cleanup: Soft-ended', result.count, 'expired statuses');
      return { count: result.count };
    } catch (error: any) {
      console.error('[StatusService] Error in cleanup job:', error);
      // Don't throw - we don't want cron job failures to crash the app
    }
  }

  /**
   * Get statuses where current user was on their way and the status has ended.
   * For endReason === 'cancelled_by_host', exclude statuses the user has already acknowledged.
   * Include host user for display ("Name has cancelled their hang").
   */
  async getEndedAttendances(userId: string) {
    try {
      const statuses = await prisma.status.findMany({
        where: {
          onMyWayUserIds: { has: userId },
          endedAt: { not: null },
          endReason: { not: null },
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
        orderBy: { endedAt: 'desc' },
      });
      // Exclude cancelled_by_host that user has already acknowledged (Prisma has no "array does not contain")
      return statuses.filter(
        (s) => s.endReason !== 'cancelled_by_host' || !(s.acknowledgedByUserIds ?? []).includes(userId)
      );
    } catch (error: any) {
      console.error('[StatusService] Error getEndedAttendances:', error);
      return [];
    }
  }

  /**
   * Add current user to acknowledgedByUserIds for a status (dismiss "host cancelled" message).
   * Validates: user was in onMyWayUserIds, status is ended with cancelled_by_host.
   */
  async acknowledgeCancelled(userId: string, statusId: string) {
    const status = await prisma.status.findUnique({
      where: { id: statusId },
    });
    if (!status) {
      throw new HttpException('Status not found', HttpStatus.NOT_FOUND);
    }
    if (status.endReason !== 'cancelled_by_host' || !status.endedAt) {
      throw new HttpException('Status was not cancelled by host', HttpStatus.BAD_REQUEST);
    }
    if (!status.onMyWayUserIds?.includes(userId)) {
      throw new HttpException('You were not on your way to this status', HttpStatus.FORBIDDEN);
    }
    const current = status.acknowledgedByUserIds ?? [];
    if (current.includes(userId)) {
      return prisma.status.findUnique({ where: { id: statusId }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } });
    }
    return prisma.status.update({
      where: { id: statusId },
      data: { acknowledgedByUserIds: [...current, userId] },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  /**
   * Physically delete statuses that ended more than 8 hours ago (keep table bounded).
   * Runs every 15 minutes via cron job.
   */
  @Cron('*/15 * * * *', { name: 'cleanup-ended-statuses' })
  async cleanupEndedStatuses() {
    try {
      const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const result = await prisma.status.deleteMany({
        where: {
          endedAt: { not: null, lt: cutoff },
        },
      });
      if (result.count > 0) {
        console.log('[StatusService] Cleanup: Deleted', result.count, 'old ended statuses');
      }
      return { count: result.count };
    } catch (error: any) {
      console.error('[StatusService] Error in cleanupEndedStatuses:', error);
    }
  }
}

