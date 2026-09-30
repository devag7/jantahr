import { EXEMPTION_CODES, ExemptionCode } from './engine/allowances';
import { PartialType } from '@nestjs/swagger';
import { PayrollFrequency, SalaryComponentType, TaxRegime } from '@prisma/client';
import { Transform, Type, TransformFnParams } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateNested } from 'class-validator';

const emptyToUndef = ({ value }: TransformFnParams) => (value === '' ? undefined : value);

export class SalaryComponentDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(2) abbr: string;
  @IsEnum(SalaryComponentType) type: SalaryComponentType;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isTaxApplicable?: boolean;
  @IsOptional() @IsBoolean() dependsOnPaymentDays?: boolean;
  @IsOptional() @IsBoolean() isPfApplicable?: boolean;
  @IsOptional() @IsBoolean() isEsiApplicable?: boolean;
  @IsOptional() @IsBoolean() isPtApplicable?: boolean;
  @IsOptional() @IsString() componentType?: string;
  @IsOptional() @IsString() formula?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsIn([...EXEMPTION_CODES, null]) exemptionCode?: ExemptionCode | null;
}
export class UpdateSalaryComponentDto extends PartialType(SalaryComponentDto) {}

export class StructureComponentDto {
  @IsString() componentId: string;
  @IsOptional() @IsString() formula?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) amount?: number;
}

export class SalaryStructureDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(PayrollFrequency) payrollFrequency?: PayrollFrequency;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => StructureComponentDto) components: StructureComponentDto[];
}
export class UpdateSalaryStructureDto extends PartialType(SalaryStructureDto) {}

export class StructurePreviewDto {
  @IsString() salaryStructureId: string;
  @Type(() => Number) @IsNumber() @Min(1) ctc: number;
  @IsOptional() @IsString() employeeId?: string;
}

export class AssignmentDto {
  @IsString() employeeId: string;
  @IsString() salaryStructureId: string;
  @IsDateString() fromDate: string;
  @Type(() => Number) @IsNumber() @Min(1) base: number; // annual CTC
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) variable?: number;
  @IsOptional() @IsEnum(TaxRegime) taxRegime?: TaxRegime;
}

export class BulkAssignmentDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) employeeIds: string[];
  @IsString() salaryStructureId: string;
  @IsDateString() fromDate: string;
  @IsOptional() @IsEnum(TaxRegime) taxRegime?: TaxRegime;
}

export class AdditionalSalaryDto {
  @IsString() employeeId: string;
  @IsString() salaryComponentId: string;
  @Type(() => Number) @IsNumber() @Min(1) amount: number;
  @IsDateString() payrollDate: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsBoolean() isRecurring?: boolean;
  @IsOptional() @Transform(emptyToUndef) @IsDateString() fromDate?: string;
  @IsOptional() @Transform(emptyToUndef) @IsDateString() toDate?: string;
}

export class LoanDto {
  @IsString() employeeId: string;
  @IsOptional() @IsIn(['LOAN', 'ADVANCE']) loanType?: 'LOAN' | 'ADVANCE';
  @Type(() => Number) @IsNumber() @Min(1) principal: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(120) totalInstallments: number;
  @IsDateString() startDate: string;
  @IsOptional() @IsString() reason?: string;
}

export class RunDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month: number;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsBoolean() treatUnmarkedAsLop?: boolean;
}

export class PeriodQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month: number;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
  @IsOptional() @IsString() format?: string;
}

export class DeclarationDetailDto {
  @IsString() subCategoryId: string;
  @Type(() => Number) @IsNumber() @Min(0) declaredAmount: number;
}

export class DeclarationDto {
  @IsOptional() @Type(() => Number) @IsInt() fyStartYear?: number;
  @IsEnum(TaxRegime) taxRegime: TaxRegime;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) monthlyRent?: number;
  @IsOptional() @IsBoolean() rentedInMetro?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10) childrenCount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) homeLoanInterest?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DeclarationDetailDto) details?: DeclarationDetailDto[];
  @IsOptional() @IsBoolean() submit?: boolean;
}
