import { Controller, Get, Post, Body, Param, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { AddContactDto } from './dto/add-contact.dto';
import { MatchContactsDto } from './dto/match-contacts.dto';
import { CheckContactsDto } from './dto/check-contacts.dto';
import { HashPhonesDto } from './dto/hash-phones.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('contacts')
@UseGuards(AuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async getContacts(@Request() req) {
    // Look up Plaza user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: req.userId },
      select: { id: true },
    });

    if (!user) {
      throw new HttpException('User not found. Please ensure the user exists in the database.', HttpStatus.NOT_FOUND);
    }

    return this.contactsService.getContacts(user.id);
  }

  @Post()
  async addContact(@Request() req, @Body() dto: AddContactDto) {
    // Look up Plaza user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: req.userId },
      select: { id: true },
    });

    if (!user) {
      throw new HttpException('User not found. Please ensure the user exists in the database.', HttpStatus.NOT_FOUND);
    }

    return this.contactsService.addContact(user.id, dto.contactUserId);
  }

  @Post('hash-phones')
  async hashPhones(@Request() req, @Body() dto: HashPhonesDto) {
    try {
      return await this.contactsService.hashPhones(dto.phoneNumbers);
    } catch (error: any) {
      console.error('Error in hashPhones endpoint:', error);
      throw error;
    }
  }

  @Post('check')
  checkContacts(@Request() req, @Body() dto: CheckContactsDto) {
    return this.contactsService.checkContacts(dto.phoneHashes);
  }

  @Post('match')
  async matchContacts(@Request() req, @Body() dto: MatchContactsDto) {
    try {
      console.log('[ContactsController] matchContacts endpoint called');
      console.log('[ContactsController] clerkId:', req.userId);
      console.log('[ContactsController] phoneHashes count:', dto.phoneHashes?.length);
      
      if (!req.userId) {
        console.error('[ContactsController] No userId in request');
        throw new Error('User not authenticated');
      }
      
      // Look up Plaza user by Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId: req.userId },
        select: { id: true },
      });

      if (!user) {
        throw new HttpException('User not found. Please ensure the user exists in the database.', HttpStatus.NOT_FOUND);
      }
      
      console.log('[ContactsController] Found Plaza user:', user.id);
      const result = await this.contactsService.matchContacts(user.id, dto.phoneHashes);
      console.log('[ContactsController] matchContacts completed successfully:', result);
      return result;
    } catch (error: any) {
      console.error('[ContactsController] Error in matchContacts endpoint:', error);
      console.error('[ContactsController] Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        name: error?.name,
      });
      
      // Re-throw to let NestJS handle it with proper HTTP status
      throw error;
    }
  }

  @Post(':id/block')
  async blockContact(@Request() req, @Param('id') contactId: string) {
    // Look up Plaza user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: req.userId },
      select: { id: true },
    });

    if (!user) {
      throw new HttpException('User not found. Please ensure the user exists in the database.', HttpStatus.NOT_FOUND);
    }

    return this.contactsService.blockContact(user.id, contactId);
  }
}

