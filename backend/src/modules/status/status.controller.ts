import { Controller, Post, Get, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { StatusService } from './status.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('status')
@UseGuards(AuthGuard)
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Post()
  async createStatus(@Request() req, @Body() dto: CreateStatusDto) {
    try {
      console.log('[StatusController] Creating status for user:', req.userId);
      console.log('[StatusController] DTO received:', JSON.stringify(dto, null, 2));
      return await this.statusService.createStatus(req.userId, dto);
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

