import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, ContactStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { hashPhone, normalizePhone } from '../../common/utils/phone-hash.util';

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
              // Note: phone number is not stored in DB (privacy-first design)
              // Mobile app maintains phone numbers locally
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

  /**
   * Match phone hashes against existing Plaza users and create contact relationships
   * Returns the matched users
   * 
   * Note: phoneNumbers parameter should be phone hashes (not raw phone numbers)
   */
  async matchContacts(userId: string, phoneHashes: string[]) {
    try {
      const matchedUsers: any[] = [];

      // Find all users matching these phone hashes
      const existingUsers = await prisma.user.findMany({
        where: {
          phoneHash: { in: phoneHashes },
        },
        select: {
          id: true,
          name: true,
          email: true,
          // Note: phone number is not stored in DB (privacy-first design)
        },
      });

      // Filter out self
      const otherUsers = existingUsers.filter(user => user.id !== userId);

      // Create contact relationships for matched users (bidirectional)
      for (const contactUser of otherUsers) {
        // Check if contact relationship already exists
        const existingContact = await prisma.contact.findFirst({
          where: {
            userId,
            contactUserId: contactUser.id,
          },
        });

        if (!existingContact) {
          // Create bidirectional contact relationship
          await prisma.$transaction([
            prisma.contact.create({
              data: {
                userId,
                contactUserId: contactUser.id,
                status: ContactStatus.ACTIVE,
              },
            }),
            prisma.contact.create({
              data: {
                userId: contactUser.id,
                contactUserId: userId,
                status: ContactStatus.ACTIVE,
              },
            }),
          ]);
        } else if (existingContact.status === ContactStatus.BLOCKED) {
          // If previously blocked, reactivate
          await prisma.$transaction([
            prisma.contact.update({
              where: { id: existingContact.id },
              data: { status: ContactStatus.ACTIVE },
            }),
            // Also reactivate reverse relationship if it exists
            prisma.contact.updateMany({
              where: {
                userId: contactUser.id,
                contactUserId: userId,
                status: ContactStatus.BLOCKED,
              },
              data: { status: ContactStatus.ACTIVE },
            }),
          ]);
        }

        matchedUsers.push(contactUser);
      }

      return {
        matched: matchedUsers.length,
        users: matchedUsers,
      };
    } catch (error) {
      console.error('Error matching contacts:', error);
      throw error;
    }
  }

  /**
   * Hash phone numbers (for mobile app - MVP approach)
   * TODO: Move to client-side hashing for better privacy
   */
  async hashPhones(phoneNumbers: string[]): Promise<string[]> {
    try {
      return phoneNumbers.map(phone => {
        const normalized = normalizePhone(phone);
        return hashPhone(normalized);
      });
    } catch (error) {
      console.error('Error hashing phone numbers:', error);
      throw error;
    }
  }

  /**
   * Check which of the provided phone hashes correspond to existing users in Plaza.
   * Returns two lists: existing users and phone hashes that are not users.
   * This is used by the UI to show different options (add contact vs invite).
   */
  async checkContacts(phoneHashes: string[]) {
    try {
      const existingUsers = await this.usersService.findByPhoneHashes(phoneHashes);
      const existingUserHashes = new Set(existingUsers.map(u => u.phoneHash));

      const nonUserHashes = phoneHashes.filter(hash => !existingUserHashes.has(hash));

      return {
        existingUsers: existingUsers.map(u => ({ 
          id: u.id, 
          name: u.name, 
          email: u.email,
          phoneHash: u.phoneHash 
        })),
        nonUserHashes,
      };
    } catch (error) {
      console.error('Error checking contacts:', error);
      throw error;
    }
  }
}

