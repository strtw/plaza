import { IsString } from 'class-validator';

export class AddContactDto {
  @IsString()
  contactUserId: string;
}

