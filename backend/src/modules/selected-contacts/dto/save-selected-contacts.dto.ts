import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ContactDto {
  @IsString()
  phone: string;

  @IsString()
  name: string;
}

export class SaveSelectedContactsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts: ContactDto[];
}



