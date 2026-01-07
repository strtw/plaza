/**
 * DEV SERVICE - MOCK USER CREATION
 * 
 * Service for creating test users in development environment.
 * All users are labeled with [TEST] prefix for easy identification.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class DevService {
  /**
   * Create mock users for the given phone numbers
   * All users will have [TEST] prefix in their name
   */
  async createMockUsers(phoneNumbers: string[]): Promise<{ created: number; users: any[] }> {
    const createdUsers: Array<{ id: string; phone: string; name: string }> = [];

    for (const phone of phoneNumbers) {
      // Normalize phone number (remove non-digits, ensure it starts with +)
      const normalizedPhone = phone.replace(/\D/g, '');
      const formattedPhone = normalizedPhone.startsWith('1') && normalizedPhone.length === 11
        ? `+${normalizedPhone}`
        : `+1${normalizedPhone}`;

      // Generate a fake Clerk ID for test users
      const testClerkId = `test_${normalizedPhone}`;

      // Create or update user with [TEST] prefix
      const existingUser = await prisma.user.findFirst({
        where: { phone: formattedPhone },
      });

      const user = existingUser
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: `[TEST] User ${normalizedPhone.slice(-4)}`, // Last 4 digits as identifier
              clerkId: testClerkId,
            },
          })
        : await prisma.user.create({
            data: {
              clerkId: testClerkId,
              phone: formattedPhone,
              name: `[TEST] User ${normalizedPhone.slice(-4)}`,
              email: `test.${normalizedPhone}@example.com`,
            },
          });

      const userName: string = user.name || `[TEST] User ${normalizedPhone.slice(-4)}`;
      createdUsers.push({
        id: user.id,
        phone: user.phone,
        name: userName,
      });
    }

    return {
      created: createdUsers.length,
      users: createdUsers,
    };
  }
}

