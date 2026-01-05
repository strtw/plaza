import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('generate')
  @UseGuards(AuthGuard)
  generateInvite(@Request() req) {
    return this.invitesService.generateInvite(req.userId);
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

