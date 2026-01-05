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
  getContactsStatuses(@Request() req) {
    return this.statusService.getContactsStatuses(req.userId);
  }
}

