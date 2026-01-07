import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashPhone } from '../../common/utils/phone-hash.util';

const prisma = new PrismaClient();

@Injectable()
export class SelectedContactsService {
  /**
   * Save selected contacts for a user
   * Contacts are stored even if they're not Plaza users yet
   */
  async saveSelectedContacts(
    userId: string,
    contacts: Array<{ phone: string; name: string }>
  ) {
    try {
      console.log('[SelectedContactsService] Saving', contacts.length, 'selected contacts for user:', userId);

      const savedContacts = [];

      for (const contact of contacts) {
        // Hash the phone number
        const phoneHash = hashPhone(contact.phone);

        // Check if this phone hash corresponds to a Plaza user
        const plazaUser = await prisma.user.findUnique({
          where: { phoneHash },
          select: { id: true },
        });

        // Upsert the selected contact
        const selectedContact = await prisma.selectedContact.upsert({
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

        savedContacts.push(selectedContact);
      }

      console.log('[SelectedContactsService] Saved', savedContacts.length, 'selected contacts');

      return {
        saved: savedContacts.length,
        contacts: savedContacts,
      };
    } catch (error: any) {
      console.error('[SelectedContactsService] Error saving selected contacts:', error);
      throw error;
    }
  }

  /**
   * Get all selected contacts for a user
   * Returns both Plaza users and non-Plaza users
   */
  async getSelectedContacts(userId: string) {
    try {
      const selectedContacts = await prisma.selectedContact.findMany({
        where: { userId },
        include: {
          plazaUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneHash: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Transform to a unified format
      return selectedContacts.map((sc) => ({
        id: sc.id,
        name: sc.name,
        phoneHash: sc.phoneHash,
        isOnPlaza: !!sc.plazaUserId,
        plazaUser: sc.plazaUser,
        createdAt: sc.createdAt,
      }));
    } catch (error: any) {
      console.error('[SelectedContactsService] Error fetching selected contacts:', error);
      return [];
    }
  }
}


