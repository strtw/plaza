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
  hashPhones(@Request() req, @Body() dto: HashPhonesDto) {
    return this.contactsService.hashPhones(dto.phoneNumbers);
  }

  @Post('check')
  checkContacts(@Request() req, @Body() dto: CheckContactsDto) {
    return this.contactsService.checkContacts(dto.phoneHashes);
  }

  @Post('match')
  matchContacts(@Request() req, @Body() dto: MatchContactsDto) {
    return this.contactsService.matchContacts(req.userId, dto.phoneHashes);
  }

  @Post(':id/block')
  blockContact(@Request() req, @Param('id') contactId: string) {
    return this.contactsService.blockContact(req.userId, contactId);
  }
}

