import { BreachSeverity, BreachStatus, PrivacyRequestStatus, PrivacyRequestType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ConsentDto {
  @IsBoolean() granted: boolean;
}

export class PrivacyRequestDto {
  @IsEnum(PrivacyRequestType) type: PrivacyRequestType;
  @IsString() @MinLength(10) @MaxLength(4000) details: string;
}

export class PrivacyRequestUpdateDto {
  @IsOptional() @IsEnum(PrivacyRequestStatus) status?: PrivacyRequestStatus;
  @IsOptional() @IsString() @MaxLength(4000) resolution?: string;
}

export class BreachDto {
  @IsString() @MinLength(3) @MaxLength(255) title: string;
  @IsString() @MinLength(10) @MaxLength(6000) description: string;
  @IsEnum(BreachSeverity) severity: BreachSeverity;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsDateString() detectedAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) affectedCount?: number;
  @IsOptional() @IsString() @MaxLength(500) dataCategories?: string;
  @IsOptional() @IsString() @MaxLength(6000) containmentActions?: string;
}

export class BreachUpdateDto {
  @IsOptional() @IsEnum(BreachStatus) status?: BreachStatus;
  @IsOptional() @IsEnum(BreachSeverity) severity?: BreachSeverity;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) affectedCount?: number;
  @IsOptional() @IsString() @MaxLength(500) dataCategories?: string;
  @IsOptional() @IsString() @MaxLength(6000) containmentActions?: string;
  @IsOptional() @IsBoolean() boardNotified?: boolean;
}

export class EraseDto {
  /** Must equal the employee's code — guards against erasing the wrong record. */
  @IsString() confirmEmployeeCode: string;
  @IsOptional() @IsString() requestId?: string;
}

export class AnonymiseApplicantsDto {
  @Type(() => Number) @IsInt() @Min(6) @Max(120) olderThanMonths: number;
}
