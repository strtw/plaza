import { Injectable } from '@nestjs/common';
import { PrismaClient, AvailabilityStatus, ContactStatus } from '@prisma/client';
import { CreateStatusDto } from './dto/create-status.dto';

const prisma = new PrismaClient();

@Injectable()
export class StatusService {
  async createStatus(userId: string, dto: CreateStatusDto) {
    return prisma.status.create({
      data: {
        userId,
        status: dto.status as AvailabilityStatus,
        message: dto.message,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      },
    });
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
              name: true,
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
}

