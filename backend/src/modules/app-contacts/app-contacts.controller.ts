import { Controller, Get, Post, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { AppContactsService } from './app-contacts.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SaveAppContactsDto } from './dto/save-app-contacts.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('app-contacts')
@UseGuards(AuthGuard)
export class AppContactsController {
  constructor(private readonly appContactsService: AppContactsService) {}

  @Post()
  async saveAppContacts(@Request() req, @Body() dto: SaveAppContactsDto) {
    try {
      // Look up Plaza user by Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId: req.userId },
        select: { id: true },
      });

      if (!user) {
        throw new HttpException('User not found. Please ensure the user exists in the database.', HttpStatus.NOT_FOUND);
      }

      return this.appContactsService.saveAppContacts(user.id, dto.contacts);
    } catch (error: any) {
      console.error('[AppContactsController] Error in saveAppContacts:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Handle Prisma errors
      if (error?.code === 'P2002') {
        throw new HttpException('Contact already exists', HttpStatus.CONFLICT);
      }
      if (error?.code === 'P2003') {
        throw new HttpException('Invalid user reference', HttpStatus.BAD_REQUEST);
      }
      if (error?.code === 'P2025') {
        throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        error?.message || 'Internal server error',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  async getAppContacts(@Request() req) {
    // Look up Plaza user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: req.userId },
      select: { id: true },
    });

    if (!user) {
      throw new HttpException('User not found. Please ensure the user exists in the database.', HttpStatus.NOT_FOUND);
    }

    return this.appContactsService.getAppContacts(user.id);
  }
}
