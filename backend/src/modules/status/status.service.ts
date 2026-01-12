import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient, AvailabilityStatus, ContactStatus, StatusLocation } from '@prisma/client';
import { CreateStatusDto } from './dto/create-status.dto';

const prisma = new PrismaClient();

@Injectable()
export class StatusService {
  async createStatus(userId: string, dto: CreateStatusDto) {
    try {
      const now = new Date();
      
      console.log('[StatusService] Creating status for userId:', userId);
      console.log('[StatusService] DTO:', JSON.stringify(dto, null, 2));
      
      // Delete ALL statuses for this user before creating new one (ensures only one status exists)
      const deletedCount = await prisma.status.deleteMany({
        where: {
          userId,
        },
      });
      console.log('[StatusService] Deleted', deletedCount.count, 'existing statuses for user');
      
      const statusData = {
        userId,
        status: dto.status as AvailabilityStatus,
        message: dto.message,
        location: dto.location as StatusLocation,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      };
      
      console.log('[StatusService] Creating status with data:', JSON.stringify(statusData, null, 2));
      
      return await prisma.status.create({
        data: statusData,
      });
    } catch (error: any) {
      console.error('[StatusService] Error creating status:', error);
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

  async getContactsStatuses(userId: string) {
    try {
      // Validate userId
      if (!userId) {
        console.error('getContactsStatuses: userId is required');
        return [];
      }

      const contacts = await prisma.contact.findMany({
        where: { userId, status: ContactStatus.ACTIVE },
        select: { contactUserId: true },
      });

      if (contacts.length === 0) {
        return []; // No contacts, no statuses to fetch
      }

      const contactIds = contacts.map(c => c.contactUserId).filter(Boolean);
      
      if (contactIds.length === 0) {
        return [];
      }

      const now = new Date();

      const statuses = await prisma.status.findMany({
        where: {
          userId: { in: contactIds },
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
      console.error('Error fetching contacts statuses:', error);
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

