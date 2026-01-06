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

  /**
   * Sync contacts - PRIVACY: Does NOT store the phone numbers list
   * Only returns which phone numbers belong to existing users
   * 
   * @param userId - The current user's ID
   * @param phoneNumbers - Array of phone numbers from user's device contacts
   * @returns Object with:
   *   - existingUsers: Users that match the phone numbers
   *   - notUsers: Phone numbers that don't belong to any user
   */
  async syncContacts(userId: string, phoneNumbers: string[]) {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return {
        existingUsers: [],
        notUsers: [],
      };
    }

    try {
      // Find which phone numbers belong to existing users
      // NOTE: We do NOT store the phoneNumbers array - this is privacy-first
      const userMap = await this.usersService.findUsersByPhoneNumbers(phoneNumbers);

      // Get current user's existing contacts to avoid duplicates
      const existingContacts = await prisma.contact.findMany({
        where: { userId },
        select: { contactUserId: true },
      });
      const existingContactIds = new Set(existingContacts.map(c => c.contactUserId));

      // Separate into existing users and non-users
      const existingUsers: any[] = [];
      const notUsers: string[] = [];

      phoneNumbers.forEach(phone => {
        const normalized = phone.replace(/\D/g, ''); // Normalize
        const user = userMap[normalized];
        
        if (user && user.id !== userId) {
          // User exists and is not the current user
          // Check if already a contact
          const isAlreadyContact = existingContactIds.has(user.id);
          existingUsers.push({
            ...user,
            isAlreadyContact,
          });
        } else {
          // Not a user (or is current user)
          notUsers.push(phone);
        }
      });

      return {
        existingUsers,
        notUsers,
        // Privacy note: We do NOT store the phoneNumbers list
      };
    } catch (error) {
      console.error('Error syncing contacts:', error);
      // Return empty result instead of throwing to prevent breaking the app
      return {
        existingUsers: [],
        notUsers: [],
      };
    }
  }
}

