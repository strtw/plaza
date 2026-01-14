import { Controller, Get, Post, Param, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('friends')
@UseGuards(AuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  async getFriends(@Request() req) {
    try {
      // Look up Plaza user by Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId: req.userId },
        select: { id: true },
      });

      if (!user) {
        throw new HttpException('User not found. Please ensure the user exists in the database.', HttpStatus.NOT_FOUND);
      }

      return this.friendsService.getFriends(user.id);
    } catch (error: any) {
      console.error('[FriendsController] Error in getFriends:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        error?.message || 'Internal server error',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/mute')
  async muteFriend(@Request() req, @Param('id') friendUserId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.userId },
        select: { id: true },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return this.friendsService.muteFriend(user.id, friendUserId);
    } catch (error: any) {
      console.error('[FriendsController] Error muting friend:', error);
      throw new HttpException(
        error?.message || 'Failed to mute friend',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/block')
  async blockFriend(@Request() req, @Param('id') friendUserId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.userId },
        select: { id: true },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return this.friendsService.blockFriend(user.id, friendUserId);
    } catch (error: any) {
      console.error('[FriendsController] Error blocking friend:', error);
      throw new HttpException(
        error?.message || 'Failed to block friend',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/unmute')
  async unmuteFriend(@Request() req, @Param('id') friendUserId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.userId },
        select: { id: true },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return this.friendsService.unmuteFriend(user.id, friendUserId);
    } catch (error: any) {
      console.error('[FriendsController] Error unmuting friend:', error);
      throw new HttpException(
        error?.message || 'Failed to unmute friend',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/unblock')
  async unblockFriend(@Request() req, @Param('id') friendUserId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.userId },
        select: { id: true },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return this.friendsService.unblockFriend(user.id, friendUserId);
    } catch (error: any) {
      console.error('[FriendsController] Error unblocking friend:', error);
      throw new HttpException(
        error?.message || 'Failed to unblock friend',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
