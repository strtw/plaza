import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { AddContactDto } from './dto/add-contact.dto';
import { MatchContactsDto } from './dto/match-contacts.dto';
import { CheckContactsDto } from './dto/check-contacts.dto';
import { HashPhonesDto } from './dto/hash-phones.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('contacts')
@UseGuards(AuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  getContacts(@Request() req) {
    return this.contactsService.getContacts(req.userId);
  }

  @Post()
  addContact(@Request() req, @Body() dto: AddContactDto) {
    return this.contactsService.addContact(req.userId, dto.contactUserId);
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
      console.log('[ContactsController] userId:', req.userId);
      console.log('[ContactsController] phoneHashes count:', dto.phoneHashes?.length);
      
      if (!req.userId) {
        console.error('[ContactsController] No userId in request');
        throw new Error('User not authenticated');
      }
      
      const result = await this.contactsService.matchContacts(req.userId, dto.phoneHashes);
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
  blockContact(@Request() req, @Param('id') contactId: string) {
    return this.contactsService.blockContact(req.userId, contactId);
  }
}

