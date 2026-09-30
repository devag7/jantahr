import { PartialType } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { Transform, Type, TransformFnParams } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateNested } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const emptyToUndef = ({ value }: TransformFnParams) => (value === '' ? undefined : value);

export class LeaveTypeDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxDaysAllowed?: number;
  @IsOptional() @IsBoolean() isCarryForward?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxCarryForwardDays?: number;
  @IsOptional() @IsBoolean() isEncashable?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxEncashableDays?: number;
  @IsOptional() @IsBoolean() isEarnedLeave?: boolean;
  @IsOptional() @IsIn(['MONTHLY']) earnedLeaveFrequency?: string;
  @IsOptional() @IsBoolean() isLWP?: boolean;
  @IsOptional() @IsBoolean() isCompensatory?: boolean;
  @IsOptional() @IsBoolean() includeHolidays?: boolean;
  @IsOptional() @IsBoolean() sandwichRule?: boolean;
  @IsOptional() @IsBoolean() allowNegativeBalance?: boolean;
  @IsOptional() @IsBoolean() isPaid?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxContinuousDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) applicableAfterDays?: number;
  @IsOptional() @Transform(emptyToUndef) @IsEnum(Gender) applicableGender?: Gender;
}
export class UpdateLeaveTypeDto extends PartialType(LeaveTypeDto) {}

export class PolicyDetailDto {
  @IsString() leaveTypeId: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(400) annualAllocation: number;
}
export class LeavePolicyDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PolicyDetailDto) details: PolicyDetailDto[];
}
export class UpdateLeavePolicyDto extends PartialType(LeavePolicyDto) {}

export class AssignPolicyDto {
  @IsOptional() @IsArray() @IsString({ each: true }) employeeIds?: string[];
  @IsOptional() @IsBoolean() allEmployees?: boolean;
  @IsOptional() @IsDateString() effectiveFrom?: string;
}

export class ManualAllocationDto {
  @IsString() employeeId: string;
  @IsString() leaveTypeId: string;
  @Type(() => Number) @IsNumber() @Min(0.5) @Max(400) days: number;
  @IsDateString() fromDate: string;
  @IsDateString() toDate: string;
  @IsOptional() @IsString() reason?: string;
}

export class ApplyLeaveDto {
  @IsString() leaveTypeId: string;
  @IsDateString() fromDate: string;
  @IsDateString() toDate: string;
  @IsOptional() @IsBoolean() halfDay?: boolean;
  @IsOptional() @IsDateString() halfDayDate?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() employeeId?: string; // HR applying on behalf
}

export class DecisionDto {
  @IsOptional() @IsString() comment?: string;
}

export class LeaveListDto extends PaginationDto {
  @IsOptional() @IsIn(['mine', 'team', 'all']) scope?: 'mine' | 'team' | 'all';
  @IsOptional() @IsIn(['OPEN', 'APPROVED', 'REJECTED', 'CANCELLED']) status?: string;
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class EncashmentDto {
  @IsString() leaveTypeId: string;
  @Type(() => Number) @IsNumber() @Min(0.5) days: number;
}

export class CompOffDto {
  @IsDateString() workFromDate: string;
  @IsOptional() @IsDateString() workEndDate?: string;
  @IsOptional() @IsBoolean() halfDay?: boolean;
  @IsString() @MinLength(3) reason: string;
}
