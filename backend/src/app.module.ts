import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StatusModule } from './modules/status/status.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { InvitesModule } from './modules/invites/invites.module';
import { UsersModule } from './modules/users/users.module';
import { DevModule } from './modules/dev/dev.module';
import { FriendsModule } from './modules/friends/friends.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule available throughout the app
    }),
    ScheduleModule.forRoot(),
    StatusModule,
    ContactsModule,
    InvitesModule,
    UsersModule,
    FriendsModule,
    // DevModule - Only active in development, endpoints check NODE_ENV
    DevModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
