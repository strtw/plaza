/**
 * DEV CONTROLLER - MOCK USER CREATION
 * 
 * This controller is for development only. It allows creating mock users
 * from selected phone contacts for testing purposes.
 * 
 * All endpoints are protected by environment checks and will not work in production.
 * 
 * To remove later: Delete this file and remove DevModule from app.module.ts
 */

import { Controller, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { DevService } from './dev.service';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('dev')
export class DevController {
  constructor(private readonly devService: DevService) {}

  /**
   * Create mock users from phone numbers and names
   * POST /dev/mock-users
   * Body: { contacts: Array<{ phone: string, name: string }> }
   */
  @Post('mock-users')
  @UseGuards(AuthGuard)
  async createMockUsers(@Request() req, @Body() body: { contacts: Array<{ phone: string; name: string }> }) {
    // Environment check - only allow in development
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev endpoints are not available in production');
    }

    if (!body.contacts || !Array.isArray(body.contacts) || body.contacts.length === 0) {
      throw new ForbiddenException('contacts array is required');
    }

    return this.devService.createMockUsers(body.contacts);
  }
}

