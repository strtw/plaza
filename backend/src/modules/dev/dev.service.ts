/**
 * DEV SERVICE - MOCK USER CREATION
 * 
 * Service for creating test users in development environment.
 * All users are labeled with [TEST] prefix for easy identification.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashPhone } from '../../common/utils/phone-hash.util';

const prisma = new PrismaClient();

@Injectable()
export class DevService {
  /**
   * Create mock users for the given phone numbers
   * All users will have [TEST] prefix in their name
   * Phone numbers are hashed before storing (privacy-first design)
   */
  async createMockUsers(phoneNumbers: string[]): Promise<{ created: number; users: any[] }> {
    const createdUsers: Array<{ id: string; name: string }> = [];

    for (const phone of phoneNumbers) {
      // Hash the phone number (privacy-first design)
      const phoneHash = hashPhone(phone);

      // Generate a fake Clerk ID for test users
      const normalizedPhone = phone.replace(/\D/g, '');
      const testClerkId = `test_${normalizedPhone}`;

      // Create or update user with [TEST] prefix
      const existingUser = await prisma.user.findFirst({
        where: { phoneHash },
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
              phoneHash,
              name: `[TEST] User ${normalizedPhone.slice(-4)}`,
              email: `test.${normalizedPhone}@example.com`,
            },
          });

      const userName: string = user.name || `[TEST] User ${normalizedPhone.slice(-4)}`;
      createdUsers.push({
        id: user.id,
        name: userName,
        // Note: phone number not returned (privacy-first design)
      });
    }

    return {
      created: createdUsers.length,
      users: createdUsers,
    };
  }
}

