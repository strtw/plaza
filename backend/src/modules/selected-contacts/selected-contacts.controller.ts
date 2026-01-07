import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { SelectedContactsService } from './selected-contacts.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SaveSelectedContactsDto } from './dto/save-selected-contacts.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('selected-contacts')
@UseGuards(AuthGuard)
export class SelectedContactsController {
  constructor(private readonly selectedContactsService: SelectedContactsService) {}

  @Post()
  async saveSelectedContacts(@Request() req, @Body() dto: SaveSelectedContactsDto) {
    // Look up Plaza user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: req.userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error('User not found. Please ensure the user exists in the database.');
    }

    return this.selectedContactsService.saveSelectedContacts(user.id, dto.contacts);
  }

  @Get()
  async getSelectedContacts(@Request() req) {
    // Look up Plaza user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: req.userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error('User not found. Please ensure the user exists in the database.');
    }

    return this.selectedContactsService.getSelectedContacts(user.id);
  }
}

