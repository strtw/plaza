import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { StatusService } from './status.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('status')
@UseGuards(AuthGuard)
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Post()
  createStatus(@Request() req, @Body() dto: CreateStatusDto) {
    return this.statusService.createStatus(req.userId, dto);
  }

  @Get('me')
  getMyStatus(@Request() req) {
    return this.statusService.getCurrentStatus(req.userId);
  }

  @Get('contacts')
  async getContactsStatuses(@Request() req) {
    try {
      return await this.statusService.getContactsStatuses(req.userId);
    } catch (error: any) {
      console.error('Error in getContactsStatuses controller:', error);
      // Return empty array instead of throwing to prevent 500 errors
      return [];
    }
  }
}

