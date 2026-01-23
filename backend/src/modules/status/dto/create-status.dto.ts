import { IsEnum, IsString, IsISO8601, IsArray, IsOptional, ArrayMaxSize, IsUUID } from 'class-validator';

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

  @IsString()
  message: string;

  @IsEnum(StatusLocation)
  location: StatusLocation;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100, { message: 'Maximum 100 recipients allowed per status' })
  @IsUUID('4', { each: true, message: 'Each recipient ID must be a valid UUID' })
  sharedWith?: string[];
}

