import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class GroupsService {
  async getMyGroups(ownerId: string) {
    const groups = await prisma.group.findMany({
      where: { ownerId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description ?? undefined,
      ownerId: g.ownerId,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      memberCount: g._count.members,
    }));
  }

  async getGroup(ownerId: string, groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!group || group.ownerId !== ownerId) {
      throw new NotFoundException('Group not found');
    }
    return {
      id: group.id,
      name: group.name,
      description: group.description ?? undefined,
      ownerId: group.ownerId,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members: group.members.map((m) => ({
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        addedAt: m.addedAt,
      })),
    };
  }

  async createGroup(ownerId: string, name: string, description?: string) {
    return prisma.group.create({
      data: { name, ownerId, ...(description != null && { description }) },
    });
  }

  async updateGroup(ownerId: string, groupId: string, dto: { name?: string; description?: string }) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group || group.ownerId !== ownerId) {
      throw new NotFoundException('Group not found');
    }
    return prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description || null }),
      },
    });
  }

  async addMember(ownerId: string, groupId: string, userId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group || group.ownerId !== ownerId) {
      throw new NotFoundException('Group not found');
    }
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing) {
      return existing;
    }
    return prisma.groupMember.create({
      data: { groupId, userId },
    });
  }

  async removeMember(ownerId: string, groupId: string, userId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group || group.ownerId !== ownerId) {
      throw new NotFoundException('Group not found');
    }
    await prisma.groupMember.deleteMany({
      where: { groupId, userId },
    });
    return { removed: true };
  }

  async getGroupsForUser(ownerId: string, userId: string) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          select: { id: true, name: true, ownerId: true },
        },
      },
    });
    return memberships
      .filter((m) => m.group.ownerId === ownerId)
      .map((m) => ({ id: m.group.id, name: m.group.name }));
  }
}
