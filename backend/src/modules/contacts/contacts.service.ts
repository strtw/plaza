import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, ContactStatus } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class ContactsService {
  async getContacts(userId: string) {
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
          },
        },
      },
    });

    return contacts.map(c => c.contactUser);
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

