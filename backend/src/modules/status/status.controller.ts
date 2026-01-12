import { Controller, Post, Get, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { StatusService } from './status.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('status')
@UseGuards(AuthGuard)
export class StatusController {
  constructor(
    private readonly statusService: StatusService
  ) {}

  @Post()
  async createStatus(@Request() req, @Body() dto: CreateStatusDto) {
    try {
      const clerkId = req.userId;
      console.log('[StatusController] Creating status for Clerk ID:', clerkId);
      console.log('[StatusController] DTO received:', JSON.stringify(dto, null, 2));
      
      // Get database user ID (throws error if user doesn't exist)
      const databaseUserId = await this.getDatabaseUserId(clerkId);
      console.log('[StatusController] Using database user ID:', databaseUserId);

      // Use the database user ID (not Clerk ID) to create the status
      return await this.statusService.createStatus(databaseUserId, dto);
    } catch (error: any) {
      console.error('[StatusController] Error creating status:', error);
      console.error('[StatusController] Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        name: error?.name,
      });
      
      // Return proper error response
      throw new HttpException(
        error?.message || 'Failed to create status',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Helper method to get database user ID from Clerk ID
   * Throws error if user doesn't exist (user must complete sign-up)
   */
  private async getDatabaseUserId(clerkId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      throw new HttpException(
        'User not found. Please complete sign-up to create your account.',
        HttpStatus.NOT_FOUND
      );
    }

    return user.id;
  }

  @Get('me')
  async getMyStatus(@Request() req) {
    try {
      const databaseUserId = await this.getDatabaseUserId(req.userId);
      return await this.statusService.getCurrentStatus(databaseUserId);
    } catch (error: any) {
      console.error('Error in getMyStatus controller:', error);
      return null;
    }
  }

  @Get('contacts')
  async getContactsStatuses(@Request() req) {
    try {
      const databaseUserId = await this.getDatabaseUserId(req.userId);
      return await this.statusService.getContactsStatuses(databaseUserId);
    } catch (error: any) {
      console.error('Error in getContactsStatuses controller:', error);
      // Return empty array instead of throwing to prevent 500 errors
      return [];
    }
  }
}

