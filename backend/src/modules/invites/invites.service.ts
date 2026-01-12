import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, ContactStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';

const prisma = new PrismaClient();

@Injectable()
export class InvitesService {
  constructor(private readonly usersService: UsersService) {}

  async generateInvite(clerkId: string) {
    try {
      console.log('[InvitesService] generateInvite called with clerkId:', clerkId);
      
      if (!clerkId) {
        throw new Error('clerkId is required');
      }

      // Look up the Plaza user by Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, clerkId: true },
      });

      if (!user) {
        console.error('[InvitesService] User not found with clerkId:', clerkId);
        throw new Error(`User with Clerk ID ${clerkId} not found. Please ensure the user exists in the database. Call /users/me first to create the user.`);
      }

      const inviterId = user.id;
      console.log('[InvitesService] Found Plaza user:', inviterId, 'for Clerk ID:', clerkId);

      const code = randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      console.log('[InvitesService] Creating invite with code:', code);

      const invite = await prisma.invite.create({
        data: {
          code,
          inviterId,
          expiresAt,
        },
      });

      console.log('[InvitesService] Invite created successfully:', invite.id);

      return {
        code: invite.code,
        url: `${process.env.APP_URL || 'https://plaza.app'}/invite/${invite.code}`,
      };
    } catch (error: any) {
      console.error('[InvitesService] Error generating invite:', error);
      console.error('[InvitesService] Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        name: error?.name,
      });
      
      // Provide more helpful error messages
      if (error?.code === 'P2003') {
        throw new Error('Invalid user ID. The user does not exist in the database.');
      }
      
      throw error;
    }
  }

  async getInvite(code: string) {
    const invite = await prisma.invite.findUnique({
      where: { code },
      include: {
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.usedAt || new Date() > invite.expiresAt) {
      throw new NotFoundException('Invite expired or already used');
    }

    return invite;
  }

  async useInvite(code: string, clerkId: string) {
    const invite = await this.getInvite(code);

    // Look up the Plaza user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      throw new Error(`User with Clerk ID ${clerkId} not found. Please ensure the user exists in the database.`);
    }

    const userId = user.id;

    await prisma.$transaction([
      prisma.invite.update({
        where: { code },
        data: {
          usedById: userId,
          usedAt: new Date(),
        },
      }),
      // Create bidirectional contact
      prisma.contact.create({
        data: {
          userId: invite.inviterId,
          contactUserId: userId,
          status: ContactStatus.ACTIVE,
        },
      }),
      prisma.contact.create({
        data: {
          userId,
          contactUserId: invite.inviterId,
          status: ContactStatus.ACTIVE,
        },
      }),
    ]);

    return { success: true, inviter: invite.inviter };
  }
}

