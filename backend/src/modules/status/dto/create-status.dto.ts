import { IsEnum, IsString, IsOptional, IsISO8601 } from 'class-validator';

export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  QUESTIONABLE = 'QUESTIONABLE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export class CreateStatusDto {
  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;

  @IsOptional()
  @IsString()
  message?: string;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;
}

