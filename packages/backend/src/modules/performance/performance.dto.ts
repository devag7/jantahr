import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CycleDto {
  @IsString() @MinLength(2) name: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateCycleDto extends PartialType(CycleDto) {}

export class GoalDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsString() @MinLength(2) title: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) weightage: number;
  @IsOptional() @IsString() targetValue?: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}
export class UpdateGoalDto extends PartialType(GoalDto) {
  @IsOptional() @IsString() achievedValue?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) selfRating?: number;
  @IsOptional() @IsString() selfComment?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) managerRating?: number;
  @IsOptional() @IsString() managerComment?: string;
}

export class LaunchDto {
  @IsOptional() @IsString() departmentId?: string;
}

export class SelfReviewDto {
  @Type(() => Number) @IsNumber() @Min(1) @Max(5) selfRating: number;
  @IsString() @MinLength(3) selfComment: string;
}
export class ManagerReviewDto {
  @Type(() => Number) @IsNumber() @Min(1) @Max(5) managerRating: number;
  @IsString() @MinLength(3) managerComment: string;
  @IsOptional() @IsBoolean() promotionRecommended?: boolean;
}
export class HrFinalizeDto {
  @Type(() => Number) @IsNumber() @Min(1) @Max(5) finalRating: number;
  @IsOptional() @IsString() hrComment?: string;
  @IsOptional() @IsBoolean() promotionRecommended?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) salaryRevisionPercent?: number;
}
export class ApplyRevisionDto {
  @IsDateString() effectiveFrom: string;
}
export class GoalListDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) status?: string;
}
