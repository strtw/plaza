import { IsArray, IsString } from 'class-validator';

export class CheckContactsDto {
  @IsArray()
  @IsString({ each: true })
  phoneHashes: string[]; // Phone hashes (not raw phone numbers) for privacy
}

