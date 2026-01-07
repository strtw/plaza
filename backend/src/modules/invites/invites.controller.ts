import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('generate')
  @UseGuards(AuthGuard)
  async generateInvite(@Request() req) {
    try {
      console.log('[InvitesController] generateInvite called with userId:', req.userId);
      if (!req.userId) {
        throw new Error('User not authenticated');
      }
      const result = await this.invitesService.generateInvite(req.userId);
      console.log('[InvitesController] Invite generated successfully:', result.code);
      return result;
    } catch (error: any) {
      console.error('[InvitesController] Error generating invite:', error);
      console.error('[InvitesController] Error details:', {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
      });
      throw error;
    }
  }

  @Get(':code')
  getInvite(@Param('code') code: string) {
    return this.invitesService.getInvite(code);
  }

  @Post(':code/use')
  @UseGuards(AuthGuard)
  useInvite(@Param('code') code: string, @Request() req) {
    return this.invitesService.useInvite(code, req.userId);
  }
}

