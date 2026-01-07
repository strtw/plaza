import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StatusModule } from './modules/status/status.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { InvitesModule } from './modules/invites/invites.module';
import { UsersModule } from './modules/users/users.module';
import { DevModule } from './modules/dev/dev.module';

@Module({
  imports: [
    StatusModule,
    ContactsModule,
    InvitesModule,
    UsersModule,
    // DevModule - Only active in development, endpoints check NODE_ENV
    DevModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
