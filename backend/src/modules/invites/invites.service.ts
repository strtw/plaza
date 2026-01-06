import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, ContactStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

@Injectable()
export class InvitesService {
  async generateInvite(inviterId: string) {
    const code = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invite = await prisma.invite.create({
      data: {
        code,
        inviterId,
        expiresAt,
      },
    });

    return {
      code: invite.code,
      url: `${process.env.APP_URL}/invite/${invite.code}`,
    };
  }

  async getInvite(code: string) {
    const invite = await prisma.invite.findUnique({
      where: { code },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
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

  async useInvite(code: string, userId: string) {
    const invite = await this.getInvite(code);

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

