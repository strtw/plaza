import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, ContactStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';

const prisma = new PrismaClient();

@Injectable()
export class ContactsService {
  constructor(private readonly usersService: UsersService) {}
  async getContacts(userId: string) {
    try {
      const contacts = await prisma.contact.findMany({
        where: {
          userId,
          status: ContactStatus.ACCEPTED,
        },
        include: {
          contactUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      return contacts.map(c => c.contactUser);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return []; // Return empty array on error to prevent breaking the app
    }
  }

  async addContact(userId: string, contactUserId: string) {
    // Create bidirectional contact relationship
    await prisma.$transaction([
      prisma.contact.create({
        data: {
          userId,
          contactUserId,
          status: ContactStatus.ACCEPTED,
        },
      }),
      prisma.contact.create({
        data: {
          userId: contactUserId,
          contactUserId: userId,
          status: ContactStatus.ACCEPTED,
        },
      }),
    ]);

    return { success: true };
  }

  async getPendingInvites(userId: string) {
    return prisma.contact.findMany({
      where: {
        contactUserId: userId,
        status: ContactStatus.PENDING,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  async acceptContact(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        contactUserId: userId,
        status: ContactStatus.PENDING,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact invitation not found');
    }

    await prisma.$transaction([
      prisma.contact.update({
        where: { id: contactId },
        data: { status: ContactStatus.ACCEPTED },
      }),
      prisma.contact.create({
        data: {
          userId,
          contactUserId: contact.userId,
          status: ContactStatus.ACCEPTED,
        },
      }),
    ]);

    return { success: true };
  }
}

