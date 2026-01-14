import { Injectable } from '@nestjs/common';
import { PrismaClient, FriendStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { hashPhone, normalizePhone } from '../../common/utils/phone-hash.util';

const prisma = new PrismaClient();

@Injectable()
export class ContactsService {
  constructor(private readonly usersService: UsersService) {}

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

      // Create friend relationships for matched users (unidirectional: userId -> contactUserId)
      for (const contactUser of otherUsers) {
        try {
          // Check if friend relationship already exists
          const existingFriend = await prisma.friend.findUnique({
            where: {
              userId_friendUserId: {
                userId,
                friendUserId: contactUser.id,
              },
            },
          });

          // Create or update friend relationship (userId -> friendUserId)
          if (!existingFriend) {
            try {
              await prisma.friend.create({
                data: {
                  userId,
                  friendUserId: contactUser.id,
                  status: FriendStatus.ACTIVE,
                },
              });
            } catch (createError: any) {
              // If it's a duplicate constraint error, friend was created between check and create (race condition)
              if (createError.code === 'P2002') {
                console.log('[ContactsService] Friend relationship already exists (race condition), continuing...');
              } else {
                throw createError; // Re-throw if it's a different error
              }
            }
          } else if (existingFriend.status === FriendStatus.BLOCKED) {
            // Reactivate if previously blocked
            await prisma.friend.update({
              where: { id: existingFriend.id },
              data: { status: FriendStatus.ACTIVE },
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
          firstName: u.firstName, 
          lastName: u.lastName,
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

