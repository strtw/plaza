import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { AddContactDto } from './dto/add-contact.dto';
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

  @Post(':id/block')
  blockContact(@Request() req, @Param('id') contactId: string) {
    return this.contactsService.blockContact(req.userId, contactId);
  }
}

