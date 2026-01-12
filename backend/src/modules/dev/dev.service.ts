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
    const createdUsers: Array<{ id: string; firstName: string | null; lastName: string | null }> = [];

    for (const contact of contacts) {
      const { phone, name } = contact;
      
      // Hash the phone number (privacy-first design)
      const phoneHash = hashPhone(phone);

      // Generate a fake Clerk ID for test users
      const normalizedPhone = phone.replace(/\D/g, '');
      const testClerkId = `test_${normalizedPhone}`;

      // Parse name into firstName and lastName
      // If name is provided, split on first space; otherwise use fallback
      let firstName: string;
      let lastName: string | null = null;
      
      if (name && name.trim()) {
        const nameParts = name.trim().split(/\s+/);
        firstName = nameParts[0];
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
      } else {
        firstName = `User${normalizedPhone.slice(-4)}`;
      }

      // Create or update user with firstName and lastName
      const existingUser = await prisma.user.findFirst({
        where: { phoneHash },
      });

      const user = existingUser
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              firstName,
              lastName,
              clerkId: testClerkId,
            },
          })
        : await prisma.user.create({
            data: {
              clerkId: testClerkId,
              phoneHash,
              firstName,
              lastName,
              email: `test.${normalizedPhone}@example.com`,
            },
          });

      createdUsers.push({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        // Note: phone number not returned (privacy-first design)
      });
    }

    return {
      created: createdUsers.length,
      users: createdUsers,
    };
  }
}

