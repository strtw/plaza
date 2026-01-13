import { Controller, Get, Post, Delete, UseGuards, Request, Body, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { clerkClient } from '@clerk/clerk-sdk-node';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get or create the current user
   * This endpoint is called after sign-up/sign-in to ensure the user exists in the database
   */
  @Get('me')
  async getOrCreateMe(@Request() req) {
    const clerkId = req.userId;

    // Get user info from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkId);
    
    // Extract phone number from Clerk user
    // Clerk stores phone numbers in primaryPhoneNumberId, need to get the actual number
    const phoneNumber = clerkUser.primaryPhoneNumber?.phoneNumber;
    
    if (!phoneNumber) {
      throw new BadRequestException('Phone number not found in Clerk user');
    }

    // Get or create user in Plaza database
    const user = await this.usersService.findOrCreateByClerkId(
      clerkId,
      phoneNumber,
      clerkUser.emailAddresses[0]?.emailAddress,
      clerkUser.firstName || undefined,
      clerkUser.lastName || undefined
    );

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      // Don't return phoneHash for security
    };
  }

  /**
   * Create user account with firstName and lastName
   * Called during sign-up after phone verification is complete
   */
  @Post('me/create')
  async createAccount(@Request() req, @Body() body: { firstName: string; lastName: string }) {
    const clerkId = req.userId;
    const { firstName, lastName } = body;

    if (!firstName || !firstName.trim()) {
      throw new BadRequestException('First name is required');
    }

    if (!lastName || !lastName.trim()) {
      throw new BadRequestException('Last name is required');
    }

    // Get user info from Clerk to get phone number
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const phoneNumber = clerkUser.primaryPhoneNumber?.phoneNumber;
    
    if (!phoneNumber) {
      throw new BadRequestException('Phone number not found in Clerk user');
    }

    // Create user account
    const user = await this.usersService.createAccount(
      clerkId,
      phoneNumber,
      firstName.trim(),
      lastName.trim(),
      clerkUser.emailAddresses[0]?.emailAddress
    );

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };
  }

  /**
   * Delete user account
   * Removes user from both Plaza database and Clerk
   */
  @Delete('me')
  async deleteAccount(@Request() req) {
    const clerkId = req.userId;

    try {
      // First, delete from Plaza database (cascades will handle related records)
      await this.usersService.deleteAccount(clerkId);

      // Then, delete from Clerk
      try {
        await clerkClient.users.deleteUser(clerkId);
      } catch (clerkError: any) {
        // Log but don't fail if Clerk deletion fails (user might already be deleted)
        console.error('[UsersController] Error deleting user from Clerk:', clerkError);
        // Continue - Plaza deletion already succeeded
      }

      return {
        success: true,
        message: 'Account deleted successfully',
      };
    } catch (error: any) {
      console.error('[UsersController] Error deleting account:', error);
      throw new HttpException(
        error?.message || 'Failed to delete account',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

