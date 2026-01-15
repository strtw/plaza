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
  private lastSimulationRun: Date | null = null;

  /**
   * Create mock users for the given contacts (phone + name)
   * Uses the actual contact name from the phone
   * Phone numbers are hashed before storing (privacy-first design)
   * Automatically creates Friend relationships where mock users add the primary user as a friend
   */
  async createMockUsers(contacts: Array<{ phone: string; name: string }>): Promise<{ created: number; users: any[] }> {
    // Find primary user first (clerkId starting with 'user_')
    const primaryUser = await prisma.user.findFirst({
      where: {
        clerkId: {
          startsWith: 'user_',
        },
      },
      select: { id: true },
    });

    if (!primaryUser) {
      throw new Error('Primary user (clerkId starting with "user_") not found. Cannot create friend relationships.');
    }

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

      // Create Friend relationship: mock user adds primary user as friend
      const existingFriendship = await prisma.friend.findUnique({
        where: {
          userId_friendUserId: {
            userId: user.id,
            friendUserId: primaryUser.id,
          },
        },
      });

      if (!existingFriendship) {
        await prisma.friend.create({
          data: {
            userId: user.id, // Mock user is adding the primary user
            friendUserId: primaryUser.id, // Primary user is being added
            status: FriendStatus.ACTIVE,
          },
        });
        console.log(`[DevService] Created friendship: mock user ${user.id} added primary user as friend`);
      } else {
        // If friendship exists but is not ACTIVE, update it to ACTIVE
        if (existingFriendship.status !== FriendStatus.ACTIVE) {
          await prisma.friend.update({
            where: {
              userId_friendUserId: {
                userId: user.id,
                friendUserId: primaryUser.id,
              },
            },
            data: {
              status: FriendStatus.ACTIVE,
            },
          });
          console.log(`[DevService] Updated existing friendship to ACTIVE for mock user ${user.id}`);
        }
      }
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
   * Runs at configurable interval (default 5 minutes, set via STATUS_SIMULATION_INTERVAL_MINUTES env var)
   * Only runs if enabled via ENABLE_STATUS_SIMULATION env var
   */
  @Cron('* * * * *', { name: 'simulate-status-changes' })
  async simulateStatusChanges() {
    // Get interval from env var (default 5 minutes)
    const intervalMinutes = parseInt(process.env.STATUS_SIMULATION_INTERVAL_MINUTES || '5', 10);
    
    // Check if enough time has passed since last run
    const now = new Date();
    if (this.lastSimulationRun) {
      const timeSinceLastRun = now.getTime() - this.lastSimulationRun.getTime();
      const intervalMs = intervalMinutes * 60 * 1000;
      if (timeSinceLastRun < intervalMs) {
        // Not enough time has passed, return early
        return;
      }
    }

    // Debug logging
    console.log('[DevService] Cron job triggered', {
      NODE_ENV: process.env.NODE_ENV,
      ENABLE_STATUS_SIMULATION: process.env.ENABLE_STATUS_SIMULATION,
      STATUS_SIMULATION_INTERVAL_MINUTES: intervalMinutes,
      lastSimulationRun: this.lastSimulationRun?.toISOString() || 'never',
      timestamp: now.toISOString(),
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

      // Debug: List all users to help diagnose
      const allUsers = await prisma.user.findMany({
        select: { id: true, clerkId: true },
        take: 20, // Limit to first 20 for logging
      });
      console.log(`[DevService] Total users in database: ${allUsers.length}`);
      if (allUsers.length > 0) {
        console.log('[DevService] Sample user clerkIds:', allUsers.map(u => u.clerkId).join(', '));
      }

      // Find the primary user (you) by clerkId starting with 'user_'
      const primaryUser = await prisma.user.findFirst({
        where: {
          clerkId: {
            startsWith: 'user_',
          },
        },
        select: {
          id: true,
          clerkId: true,
        },
      });

      if (!primaryUser) {
        console.log('[DevService] Primary user (clerkId starting with "user_") not found for status simulation');
        // Update last run time even on early return to prevent constant retries
        this.lastSimulationRun = now;
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
        // Update last run time even on early return to prevent constant retries
        this.lastSimulationRun = now;
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
        // Update last run time even on early return to prevent constant retries
        this.lastSimulationRun = now;
        return;
      }

      console.log(`[DevService] Simulating status changes for ${testUsers.length} users who are broadcasting to primary user`);

      const locations: StatusLocation[] = [
        StatusLocation.HOME,
        StatusLocation.GREENSPACE,
        StatusLocation.THIRD_PLACE,
      ];

      // Helper function to round time to nearest 15 minutes (matching frontend logic)
      const roundToNearest15Minutes = (date: Date): Date => {
        const rounded = new Date(date);
        const minutes = rounded.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        rounded.setMinutes(roundedMinutes, 0, 0);
        return rounded;
      };

      // Helper function to round UP to next 15-minute interval, then add random 15-minute intervals
      const getEndTimeAt15MinuteInterval = (): Date => {
        const now = new Date();
        const minutes = now.getMinutes();
        // Round UP to next 15-minute interval
        const roundedUpMinutes = Math.ceil(minutes / 15) * 15;
        const roundedUp = new Date(now);
        roundedUp.setMinutes(roundedUpMinutes, 0, 0);
        
        // Add random number of 15-minute intervals (1-8 intervals = 15-120 minutes)
        const intervalsToAdd = Math.floor(Math.random() * 8) + 1; // 1 to 8 intervals
        roundedUp.setMinutes(roundedUp.getMinutes() + (intervalsToAdd * 15));
        
        return roundedUp;
      };

      for (const user of selectedUsers) {
        try {
          const now = new Date();
          
          // Check if user has existing ACTIVE status (within time window)
          const existingStatus = await prisma.status.findFirst({
            where: {
              userId: user.id,
              startTime: { lte: now },
              endTime: { gte: now },
            },
            orderBy: { createdAt: 'desc' },
          });

          // Delete expired statuses first (maintains one-status-per-user rule)
          await prisma.status.deleteMany({
            where: {
              userId: user.id,
              endTime: { lt: now },
            },
          });

          // Random action: 40% set, 30% update, 30% clear
          const random = Math.random();
          let action: 'set' | 'update' | 'clear';

          if (random < 0.4) {
            action = 'set';
          } else if (random < 0.7) {
            action = existingStatus ? 'update' : 'set'; // Fallback to set if no active status
          } else {
            action = 'clear';
          }

          const endTime = getEndTimeAt15MinuteInterval();

          if (action === 'set' || (action === 'update' && existingStatus)) {
            // Set or update status
            const randomMessage = this.statusMessages[Math.floor(Math.random() * this.statusMessages.length)];
            const randomLocation = locations[Math.floor(Math.random() * locations.length)];

            const statusData = {
              status: AvailabilityStatus.AVAILABLE,
              message: randomMessage,
              location: randomLocation,
              startTime: now,
              endTime: endTime,
            };

            if (existingStatus) {
              // UPDATE existing active status (preserves id and createdAt)
              await prisma.status.update({
                where: { id: existingStatus.id },
                data: statusData,
              });
              console.log(`[DevService] Updated status for user ${user.id}: "${randomMessage}" at ${randomLocation}`);
            } else {
              // CREATE new status (no active status exists)
              await prisma.status.create({
                data: {
                  userId: user.id,
                  ...statusData,
                },
              });
              console.log(`[DevService] Set status for user ${user.id}: "${randomMessage}" at ${randomLocation}`);
            }
          } else if (action === 'clear' && existingStatus) {
            // Clear status (delete it)
            await prisma.status.deleteMany({
              where: { userId: user.id },
            });
            console.log(`[DevService] Cleared status for user ${user.id}`);
          } else {
            // No-op: clear requested but no status exists, or update requested but no status exists
            console.log(`[DevService] Skipped ${action} for user ${user.id} (no active status exists)`);
          }
        } catch (userError: any) {
          console.error(`[DevService] Error simulating status for user ${user.id}:`, userError);
          // Continue with other users even if one fails
        }
      }

      console.log('[DevService] Status simulation completed');
      
      // Update last run time after successful execution
      this.lastSimulationRun = now;
    } catch (error: any) {
      console.error('[DevService] Error in status simulation:', error);
      // Don't throw - we don't want cron job failures to crash the app
      // Note: We don't update lastSimulationRun on error, so it will retry sooner
    }
  }
}

