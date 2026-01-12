import { IsEnum, IsString, IsOptional, IsISO8601 } from 'class-validator';

export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum StatusLocation {
  HOME = 'HOME',
  GREENSPACE = 'GREENSPACE',
  THIRD_PLACE = 'THIRD_PLACE',
}

export class CreateStatusDto {
  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsEnum(StatusLocation)
  location?: StatusLocation;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;
}

