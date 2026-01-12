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
}

