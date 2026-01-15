/**
 * DEV SERVICE - MOCK USER CREATION & STATUS SIMULATION
 * 
 * Service for creating test users and simulating status changes in development environment.
 * All users are labeled with [TEST] prefix for easy identification.
 */

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient, AvailabilityStatus, StatusLocation, FriendStatus } from '@prisma/client';
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

  /**
   * Predefined status messages for simulation
   */
  private readonly statusMessages = [
    'Making dinner',
    'Going to the beach',
    'Grabbing coffee',
    'At the park',
    'Working from home',
    'At a cafe',
    'Running errands',
    'At the gym',
    'Watching a movie',
    'Cooking lunch',
    'At the library',
    'Walking the dog',
    'At a restaurant',
    'Hanging out downtown',
    'At a friend\'s place',
    'Shopping',
    'At the pool',
    'Reading outside',
    'At a bar',
    'Playing sports',
  ];

  /**
   * Simulate status changes for test users
   * Runs every 5 minutes (if enabled via ENABLE_STATUS_SIMULATION env var)
   * Only runs in non-production environments
   */
  @Cron('*/5 * * * *', { name: 'simulate-status-changes' })
  async simulateStatusChanges() {
    // Debug logging
    console.log('[DevService] Cron job triggered', {
      NODE_ENV: process.env.NODE_ENV,
      ENABLE_STATUS_SIMULATION: process.env.ENABLE_STATUS_SIMULATION,
      timestamp: new Date().toISOString(),
    });

    // Safety check: only run if feature flag is explicitly enabled
    // Note: We rely on the feature flag for control, not NODE_ENV
    // This allows running in Railway production if needed for testing
    if (process.env.ENABLE_STATUS_SIMULATION !== 'true') {
      console.log('[DevService] Skipping: ENABLE_STATUS_SIMULATION is not "true"');
      return; // Feature flag not enabled, exit early to save compute
    }

    try {
      console.log('[DevService] Status simulation started');

      // Find the primary user (you) by clerkId
      const primaryUser = await prisma.user.findUnique({
        where: {
          clerkId: 'user_',
        },
        select: {
          id: true,
          clerkId: true,
        },
      });

      if (!primaryUser) {
        console.log('[DevService] Primary user (clerkId: "user_") not found for status simulation');
        return;
      }

      console.log(`[DevService] Found primary user: ${primaryUser.id}`);

      // Get people who have added the primary user as a friend
      // These are the users whose statuses will appear in the primary user's Activity tab
      const friendRecords = await prisma.friend.findMany({
        where: {
          friendUserId: primaryUser.id, // People who added the primary user
          status: FriendStatus.ACTIVE,
        },
        select: {
          userId: true, // The users who added the primary user
        },
        take: 10, // Max 10 users
      });

      if (friendRecords.length === 0) {
        console.log('[DevService] No users found who have added primary user as friend');
        return;
      }

      const userIds = friendRecords.map(f => f.userId).filter(Boolean);

      // Fetch user details for these IDs (people broadcasting to the primary user)
      const testUsers = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          clerkId: true,
        },
      });

      if (testUsers.length === 0) {
        console.log('[DevService] No valid users found for status simulation');
        return;
      }

      console.log(`[DevService] Simulating status changes for ${testUsers.length} users who are broadcasting to primary user`);

      const locations: StatusLocation[] = [
        StatusLocation.HOME,
        StatusLocation.GREENSPACE,
        StatusLocation.THIRD_PLACE,
      ];

      // 15-minute interval options (in minutes)
      const endTimeIntervals = [15, 30, 45, 60, 75, 90, 105, 120];

      for (const user of testUsers) {
        try {
          // Check if user has existing status
          const existingStatus = await prisma.status.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
          });

          // Random action: 40% set, 30% update, 30% clear
          const random = Math.random();
          let action: 'set' | 'update' | 'clear';

          if (random < 0.4) {
            action = 'set';
          } else if (random < 0.7) {
            action = existingStatus ? 'update' : 'set'; // Fallback to set if no status exists
          } else {
            action = 'clear';
          }

          const now = new Date();
          const randomInterval = endTimeIntervals[Math.floor(Math.random() * endTimeIntervals.length)];
          const endTime = new Date(now.getTime() + randomInterval * 60 * 1000);

          if (action === 'set' || (action === 'update' && existingStatus)) {
            // Set or update status
            const randomMessage = this.statusMessages[Math.floor(Math.random() * this.statusMessages.length)];
            const randomLocation = locations[Math.floor(Math.random() * locations.length)];

            // Delete existing status first (StatusService.createStatus does this, but we'll do it explicitly)
            if (existingStatus) {
              await prisma.status.deleteMany({
                where: { userId: user.id },
              });
            }

            // Create new status
            await prisma.status.create({
              data: {
                userId: user.id,
                status: AvailabilityStatus.AVAILABLE,
                message: randomMessage,
                location: randomLocation,
                startTime: now,
                endTime: endTime,
              },
            });

            console.log(`[DevService] ${action === 'set' ? 'Set' : 'Updated'} status for user ${user.id}: "${randomMessage}" at ${randomLocation}`);
          } else if (action === 'clear' && existingStatus) {
            // Clear status (delete it)
            await prisma.status.deleteMany({
              where: { userId: user.id },
            });
            console.log(`[DevService] Cleared status for user ${user.id}`);
          } else {
            // No-op: clear requested but no status exists, or update requested but no status exists (already handled above)
            console.log(`[DevService] Skipped ${action} for user ${user.id} (no status exists)`);
          }
        } catch (userError: any) {
          console.error(`[DevService] Error simulating status for user ${user.id}:`, userError);
          // Continue with other users even if one fails
        }
      }

      console.log('[DevService] Status simulation completed');
    } catch (error: any) {
      console.error('[DevService] Error in status simulation:', error);
      // Don't throw - we don't want cron job failures to crash the app
    }
  }
}

