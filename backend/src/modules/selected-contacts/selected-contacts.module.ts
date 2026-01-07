import { Module } from '@nestjs/common';
import { SelectedContactsController } from './selected-contacts.controller';
import { SelectedContactsService } from './selected-contacts.service';

@Module({
  controllers: [SelectedContactsController],
  providers: [SelectedContactsService],
})
export class SelectedContactsModule {}

