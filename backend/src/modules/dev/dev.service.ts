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
   * Create mock users for the given contacts (phone + name)
   * Uses the actual contact name from the phone
   * Phone numbers are hashed before storing (privacy-first design)
   */
  async createMockUsers(contacts: Array<{ phone: string; name: string }>): Promise<{ created: number; users: any[] }> {
    const createdUsers: Array<{ id: string; name: string }> = [];

    for (const contact of contacts) {
      const { phone, name } = contact;
      
      // Hash the phone number (privacy-first design)
      const phoneHash = hashPhone(phone);

      // Generate a fake Clerk ID for test users
      const normalizedPhone = phone.replace(/\D/g, '');
      const testClerkId = `test_${normalizedPhone}`;

      // Use the actual contact name (or fallback if missing)
      const userName = name || `User ${normalizedPhone.slice(-4)}`;

      // Create or update user with actual contact name
      const existingUser = await prisma.user.findFirst({
        where: { phoneHash },
      });

      const user = existingUser
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: userName,
              clerkId: testClerkId,
            },
          })
        : await prisma.user.create({
            data: {
              clerkId: testClerkId,
              phoneHash,
              name: userName,
              email: `test.${normalizedPhone}@example.com`,
            },
          });

      createdUsers.push({
        id: user.id,
        name: user.name || userName,
        // Note: phone number not returned (privacy-first design)
      });
    }

    return {
      created: createdUsers.length,
      users: createdUsers,
    };
  }
}

