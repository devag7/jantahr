import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min, MinLength, ValidateNested } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class PunchDto {
  @IsOptional() @IsIn(['IN', 'OUT']) logType?: 'IN' | 'OUT';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsString() selfie?: string; // data URL
  @IsOptional() @IsIn(['WEB', 'MOBILE']) source?: 'WEB' | 'MOBILE';
}

export class ManualMarkDto {
  @IsString() employeeId: string;
  @IsDateString() date: string;
  @IsIn(['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'WORK_FROM_HOME', 'HOLIDAY']) status: string;
  @IsOptional() @Matches(HHMM) inTime?: string;
  @IsOptional() @Matches(HHMM) outTime?: string;
  @IsOptional() @IsString() remarks?: string;
}

export class ImportAttendanceDto {
  @IsString() @MinLength(10) csv: string;
}

export class RegularizationDto {
  @IsDateString() fromDate: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsIn(['REGULARIZE', 'ON_DUTY', 'WFH']) requestType: 'REGULARIZE' | 'ON_DUTY' | 'WFH';
  @IsOptional() @IsBoolean() halfDay?: boolean;
  @IsString() @MinLength(3) reason: string;
}

export class DecisionDto {
  @IsOptional() @IsString() comment?: string;
}

export class RangeDto {
  @IsDateString() from: string;
  @IsDateString() to: string;
}

export class ShiftTypeDto {
  @IsString() @MinLength(2) name: string;
  @Matches(HHMM) startTime: string;
  @Matches(HHMM) endTime: string;
  @Type(() => Number) @IsNumber() @Min(1) @Max(24) workingHours: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(24) halfDayThresholdHours: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) lateEntryGraceMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) earlyExitGraceMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) allowCheckInBeforeMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) allowCheckOutAfterMinutes?: number;
  @IsOptional() @IsBoolean() isNightShift?: boolean;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
}
export class UpdateShiftTypeDto extends PartialType(ShiftTypeDto) {}

export class ShiftAssignmentDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) employeeIds: string[];
  @IsString() shiftTypeId: string;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class RosterDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) employeeIds: string[];
  /** Rotating pattern of shift type ids, one entry per week (e.g. [morning, evening, night]) */
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) pattern: string[];
  @IsDateString() startDate: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(52) weeks: number;
}

export class ShiftLocationDto {
  @IsString() @MinLength(2) name: string;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(20) @Max(5000) radiusMeters?: number;
}
export class UpdateShiftLocationDto extends PartialType(ShiftLocationDto) {}

export class DeviceDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(3) serialNo: string;
  @IsOptional() @IsIn(['ZKTECO', 'ESSL', 'BIOMAX', 'OTHER']) vendor?: string;
}

export class BiometricPunchItem {
  @IsString() employeeCode: string;
  @IsDateString() time: string;
  @IsOptional() @IsIn(['IN', 'OUT']) type?: 'IN' | 'OUT';
}
export class BiometricPushDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BiometricPunchItem) punches: BiometricPunchItem[];
}

export class DailyQueryDto extends PaginationDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() departmentId?: string;
}
