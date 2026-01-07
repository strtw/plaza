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
    const matchedUsers: any[] = []; // Declare outside try block for error handler access
    
    try {
      console.log('[ContactsService] matchContacts called with userId:', userId, 'phoneHashes count:', phoneHashes?.length);
      
      if (!userId) {
        throw new Error('userId is required');
      }

      if (!phoneHashes || phoneHashes.length === 0) {
        console.log('[ContactsService] No phone hashes provided, returning empty result');
        return {
          matched: 0,
          users: [],
        };
      }

      // Find all users matching these phone hashes (use service method for consistency)
      console.log('[ContactsService] Finding users by phone hashes...');
      const existingUsers = await this.usersService.findByPhoneHashes(phoneHashes);
      console.log('[ContactsService] Found', existingUsers.length, 'users matching hashes');

      // Filter out self
      const otherUsers = existingUsers.filter(user => user.id !== userId);
      console.log('[ContactsService] After filtering self,', otherUsers.length, 'users to add as contacts');

      // Create contact relationships for matched users (bidirectional)
      for (const contactUser of otherUsers) {
        try {
          // Check if contact relationship already exists (both directions)
          const existingContact = await prisma.contact.findFirst({
            where: {
              userId,
              contactUserId: contactUser.id,
            },
          });

          const existingReverseContact = await prisma.contact.findFirst({
            where: {
              userId: contactUser.id,
              contactUserId: userId,
            },
          });

          // Create or update forward relationship (userId -> contactUserId)
          if (!existingContact) {
            try {
              await prisma.contact.create({
                data: {
                  userId,
                  contactUserId: contactUser.id,
                  status: ContactStatus.ACTIVE,
                },
              });
            } catch (createError: any) {
              // If it's a duplicate constraint error, contact was created between check and create (race condition)
              if (createError.code === 'P2002') {
                console.log('[ContactsService] Forward contact relationship already exists (race condition), continuing...');
              } else {
                throw createError; // Re-throw if it's a different error
              }
            }
          } else if (existingContact.status === ContactStatus.BLOCKED) {
            // Reactivate if previously blocked
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: { status: ContactStatus.ACTIVE },
            });
          }

          // Create or update reverse relationship (contactUserId -> userId)
          if (!existingReverseContact) {
            try {
              await prisma.contact.create({
                data: {
                  userId: contactUser.id,
                  contactUserId: userId,
                  status: ContactStatus.ACTIVE,
                },
              });
            } catch (createError: any) {
              // If it's a duplicate constraint error, contact was created between check and create (race condition)
              if (createError.code === 'P2002') {
                console.log('[ContactsService] Reverse contact relationship already exists (race condition), continuing...');
              } else {
                throw createError; // Re-throw if it's a different error
              }
            }
          } else if (existingReverseContact.status === ContactStatus.BLOCKED) {
            // Reactivate if previously blocked
            await prisma.contact.update({
              where: { id: existingReverseContact.id },
              data: { status: ContactStatus.ACTIVE },
            });
          }

          matchedUsers.push(contactUser);
        } catch (contactError: any) {
          console.error(`[ContactsService] Error creating contact relationship with user ${contactUser.id}:`, contactError);
          console.error(`[ContactsService] Error details:`, {
            message: contactError?.message,
            code: contactError?.code,
            stack: contactError?.stack,
          });
          // Continue with other contacts even if one fails
          // This prevents one failed contact from blocking all others
        }
      }

      console.log('[ContactsService] Successfully processed', otherUsers.length, 'users, matched', matchedUsers.length, 'contacts');
      
      // Return result even if some contacts failed (matchedUsers might be less than otherUsers)
      return {
        matched: matchedUsers.length,
        users: matchedUsers,
      };
    } catch (error: any) {
      console.error('[ContactsService] Fatal error matching contacts:', error);
      console.error('[ContactsService] Error stack:', error?.stack);
      console.error('[ContactsService] Error message:', error?.message);
      console.error('[ContactsService] Error code:', error?.code);
      
      // If we've matched some users before the error, return partial success
      if (matchedUsers.length > 0) {
        console.log('[ContactsService] Returning partial success with', matchedUsers.length, 'matched users');
        return {
          matched: matchedUsers.length,
          users: matchedUsers,
        };
      }
      
      // Otherwise, throw the error
      throw error;
    }
  }

  /**
   * Hash phone numbers (for mobile app - MVP approach)
   * TODO: Move to client-side hashing for better privacy
   */
  async hashPhones(phoneNumbers: string[]): Promise<string[]> {
    try {
      if (!process.env.PHONE_HASH_SECRET) {
        throw new Error('PHONE_HASH_SECRET environment variable is not set. Please configure it in Railway.');
      }
      
      return phoneNumbers.map(phone => {
        const normalized = normalizePhone(phone);
        return hashPhone(normalized);
      });
    } catch (error: any) {
      console.error('Error hashing phone numbers:', error);
      // Re-throw with a more user-friendly message
      if (error.message?.includes('PHONE_HASH_SECRET')) {
        throw new Error('Server configuration error: PHONE_HASH_SECRET is not set. Please contact support.');
      }
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

