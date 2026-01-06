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
          status: ContactStatus.ACTIVE,
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
          status: ContactStatus.ACTIVE,
        },
      }),
      prisma.contact.create({
        data: {
          userId: contactUserId,
          contactUserId: userId,
          status: ContactStatus.ACTIVE,
        },
      }),
    ]);

    return { success: true };
  }

  async blockContact(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        status: ContactStatus.ACTIVE,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Block the contact (both directions)
    await prisma.$transaction([
      prisma.contact.update({
        where: { id: contactId },
        data: { status: ContactStatus.BLOCKED },
      }),
      // Also block the reverse relationship if it exists
      prisma.contact.updateMany({
        where: {
          userId: contact.contactUserId,
          contactUserId: userId,
          status: ContactStatus.ACTIVE,
        },
        data: { status: ContactStatus.BLOCKED },
      }),
    ]);

    return { success: true };
  }
}

