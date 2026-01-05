import { IsArray, IsString, ArrayMinSize, MaxLength } from 'class-validator';

export class SyncContactsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  phoneNumbers: string[];
}

