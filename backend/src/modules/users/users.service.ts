import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class UsersService {
  async findOrCreateByClerkId(clerkId: string, phone: string, email?: string, name?: string) {
    return prisma.user.upsert({
      where: { clerkId },
      update: {
        phone, // Update phone if it changed
        email,
        name,
      },
      create: {
        clerkId,
        phone,
        email,
        name,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  }

  /**
   * Find users by phone numbers - PRIVACY: Does NOT store the phone numbers list
   * Only returns which phone numbers belong to existing users
   */
  async findUsersByPhoneNumbers(phoneNumbers: string[]) {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return {};
    }

    try {
      // Normalize phone numbers (remove spaces, dashes, etc.)
      const normalized = phoneNumbers
        .map(phone => phone.replace(/\D/g, '')) // Remove non-digits
        .filter(phone => phone.length >= 10); // Valid phone numbers only

      if (normalized.length === 0) {
        return {};
      }

      // Query users - handle both cases: phone might be required or optional in DB
      let users;
      try {
        users = await prisma.user.findMany({
          where: {
            phone: {
              in: normalized,
            },
          },
          select: {
            id: true,
            phone: true,
            name: true,
            email: true,
          },
        });
      } catch (queryError: any) {
        // If phone column doesn't exist or has issues, return empty array
        console.error('Error querying users by phone:', queryError);
        return {};
      }

      // Return map of phone -> user for easy lookup
      return users.reduce((acc, user) => {
        if (user.phone) {
          acc[user.phone] = user;
        }
        return acc;
      }, {} as Record<string, typeof users[0]>);
    } catch (error) {
      console.error('Error finding users by phone numbers:', error);
      // Return empty object on error to prevent breaking the sync
      return {};
    }
  }
}

