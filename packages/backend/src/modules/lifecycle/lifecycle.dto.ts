import { PartialType } from '@nestjs/swagger';
import { SeparationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class TemplateTaskDto {
  @IsString() @MinLength(2) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() assignedRole?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) dueInDays?: number;
}
export class OnboardingTemplateDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TemplateTaskDto) tasks: TemplateTaskDto[];
}
export class UpdateOnboardingTemplateDto extends PartialType(OnboardingTemplateDto) {}

export class TaskUpdateDto {
  @IsIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']) status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  @IsOptional() @IsString() remarks?: string;
}

export class ResignDto {
  @IsString() @MinLength(3) reason: string;
  @IsOptional() @IsDateString() lastWorkingDate?: string;
}

export class InitiateSeparationDto {
  @IsString() employeeId: string;
  @IsEnum(SeparationType) separationType: SeparationType;
  @IsDateString() lastWorkingDate: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) noticePeriodDays?: number;
}

export class SeparationDecisionDto {
  @IsOptional() @IsDateString() lastWorkingDate?: string;
  @IsOptional() @IsString() comment?: string;
}

export class ClearanceUpdateDto {
  @IsIn(['PENDING', 'CLEARED', 'NOT_APPLICABLE']) status: 'PENDING' | 'CLEARED' | 'NOT_APPLICABLE';
  @IsOptional() @IsString() remarks?: string;
}

export class ExitInterviewDto {
  @IsString() @MinLength(3) notes: string;
}

export class FnfDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) bonusAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherDeductions?: number;
}
