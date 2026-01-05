import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { AddContactDto } from './dto/add-contact.dto';
import { SyncContactsDto } from './dto/sync-contacts.dto';
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

  @Get('pending')
  getPendingInvites(@Request() req) {
    return this.contactsService.getPendingInvites(req.userId);
  }

  /**
   * Sync contacts - PRIVACY: Does NOT store the phone numbers list
   * Only returns which phone numbers belong to existing users
   * IMPORTANT: This route must come BEFORE @Post(':id/accept') to avoid route conflicts
   */
  @Post('sync')
  syncContacts(@Request() req, @Body() dto: SyncContactsDto) {
    return this.contactsService.syncContacts(req.userId, dto.phoneNumbers);
  }

  @Post(':id/accept')
  acceptContact(@Request() req, @Param('id') contactId: string) {
    return this.contactsService.acceptContact(req.userId, contactId);
  }
}

