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
    const now = new Date();
    
    return prisma.status.findFirst({
      where: {
        userId,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getContactsStatuses(userId: string) {
    const contacts = await prisma.contact.findMany({
      where: { userId, status: ContactStatus.ACCEPTED },
      select: { contactUserId: true },
    });

    const contactIds = contacts.map(c => c.contactUserId);
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by userId and take most recent
    const statusMap = new Map();
    for (const status of statuses) {
      if (!statusMap.has(status.userId)) {
        statusMap.set(status.userId, status);
      }
    }

    return Array.from(statusMap.values());
  }
}

