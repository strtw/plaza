import { IsArray, IsString } from 'class-validator';

export class HashPhonesDto {
  @IsArray()
  @IsString({ each: true })
  phoneNumbers: string[]; // Raw phone numbers to hash
}

