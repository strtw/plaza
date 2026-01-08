import { Module } from '@nestjs/common';
import { AppContactsController } from './app-contacts.controller';
import { AppContactsService } from './app-contacts.service';

@Module({
  controllers: [AppContactsController],
  providers: [AppContactsService],
})
export class AppContactsModule {}
