import { Controller, Get, Post, UseGuards, Request, Body, BadRequestException } from '@nestjs/common';
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
      clerkUser.firstName || clerkUser.username || undefined
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      // Don't return phoneHash for security
    };
  }
}

