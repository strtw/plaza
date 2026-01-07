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
      return await this.contactsService.matchContacts(req.userId, dto.phoneHashes);
    } catch (error: any) {
      console.error('Error in matchContacts endpoint:', error);
      throw error;
    }
  }

  @Post(':id/block')
  blockContact(@Request() req, @Param('id') contactId: string) {
    return this.contactsService.blockContact(req.userId, contactId);
  }
}

