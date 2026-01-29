import { IsBoolean, IsOptional, IsInt, Min, IsArray, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  showMuted?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedLocations?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minDurationMinutes?: number;
}
