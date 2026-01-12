import { Injectable } from '@nestjs/common';
import { PrismaClient, AppContact } from '@prisma/client';
import { hashPhone } from '../../common/utils/phone-hash.util';

const prisma = new PrismaClient();

@Injectable()
export class AppContactsService {
  /**
   * Save app contacts for a user
   * Only Plaza users can be saved as app contacts
   */
  async saveAppContacts(
    userId: string,
    contacts: Array<{ phone: string; name: string }>
  ) {
    try {
      console.log('[AppContactsService] Saving', contacts.length, 'app contacts for user:', userId);

      const savedContacts: AppContact[] = [];

      for (const contact of contacts) {
        // Hash the phone number
        const phoneHash = hashPhone(contact.phone);

        // Check if this phone hash corresponds to a Plaza user
        const plazaUser = await prisma.user.findUnique({
          where: { phoneHash },
          select: { id: true },
        });

        // Upsert the app contact
        const appContact = await prisma.appContact.upsert({
          where: {
            userId_phoneHash: {
              userId,
              phoneHash,
            },
          },
          update: {
            name: contact.name, // Update name in case it changed
            plazaUserId: plazaUser?.id || null, // Update plazaUserId if they joined
          },
          create: {
            userId,
            phoneHash,
            name: contact.name,
            plazaUserId: plazaUser?.id || null,
          },
        });

        savedContacts.push(appContact);
      }

      console.log('[AppContactsService] Saved', savedContacts.length, 'app contacts');

      return {
        saved: savedContacts.length,
        contacts: savedContacts,
      };
    } catch (error: any) {
      console.error('[AppContactsService] Error saving app contacts:', error);
      throw error;
    }
  }

  /**
   * Get all app contacts for a user
   * Returns Plaza users that have been saved as app contacts
   */
  async getAppContacts(userId: string) {
    try {
      const appContacts = await prisma.appContact.findMany({
        where: { userId },
        include: {
          plazaUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneHash: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Transform to a unified format
      return appContacts.map((ac) => ({
        id: ac.id,
        name: ac.name,
        phoneHash: ac.phoneHash,
        isOnPlaza: !!ac.plazaUserId,
        plazaUser: ac.plazaUser,
        createdAt: ac.createdAt,
      }));
    } catch (error: any) {
      console.error('[AppContactsService] Error fetching app contacts:', error);
      return [];
    }
  }
}
