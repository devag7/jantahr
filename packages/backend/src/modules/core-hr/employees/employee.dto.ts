import { PartialType } from '@nestjs/swagger';
import { Transform, Type, TransformFnParams } from 'class-transformer';
import { Gender, MaritalStatus, EmployeeStatus, Role } from '@prisma/client';
import {
  IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const digits = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value);
const emptyToUndef = ({ value }: TransformFnParams) => (value === '' ? undefined : value);

export class CreateEmployeeDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) employeeCode?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(100) firstName: string;
  @IsOptional() @Transform(trim) @IsString() middleName?: string;
  @Transform(trim) @IsString() @MaxLength(100) lastName: string;
  @Transform(trim) @IsEmail() email: string;
  @IsOptional() @Transform(emptyToUndef) @IsEmail() personalEmail?: string;
  @IsOptional() @Transform(digits) @Matches(/^\+?[0-9]{10,13}$/, { message: 'phone must be a valid number' }) phone?: string;
  @IsOptional() @Transform(emptyToUndef) @IsDateString() dateOfBirth?: string;
  @IsEnum(Gender) gender: Gender;
  @IsOptional() @IsEnum(MaritalStatus) maritalStatus?: MaritalStatus;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsString() spouseName?: string;
  @IsOptional() @IsString() currentAddress?: string;
  @IsOptional() @IsString() permanentAddress?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @IsString() emergencyContactRelation?: string;
  @IsDateString() dateOfJoining: string;
  @IsOptional() @Transform(emptyToUndef) @IsDateString() dateOfConfirmation?: string;
  @IsOptional() @Transform(emptyToUndef) @IsDateString() probationEndDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) noticeperiodDays?: number;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @Transform(emptyToUndef) @IsString() departmentId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsString() designationId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsString() reportingManagerId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsString() leaveApproverId?: string;
  @IsOptional() @IsString() workLocation?: string;
  @IsOptional() @IsString() defaultShiftId?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @Transform(digits) @Matches(/^[0-9]{6,20}$/, { message: 'bankAccountNumber must be 6-20 digits' }) bankAccountNumber?: string;
  @IsOptional() @Transform(upper) @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'ifscCode is invalid' }) ifscCode?: string;
  @IsOptional() @IsString() bankBranch?: string;
  @IsOptional() @Transform(upper) @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'panNumber must look like ABCDE1234F' }) panNumber?: string;
  @IsOptional() @Transform(digits) @Matches(/^[0-9]{12}$/, { message: 'aadhaarNumber must be 12 digits' }) aadhaarNumber?: string;
  @IsOptional() @IsString() uanNumber?: string;
  @IsOptional() @IsString() esicNumber?: string;
  @IsOptional() @IsString() pfAccountNumber?: string;
  @IsOptional() @IsString() professionalTaxState?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) ctc?: number;
  @IsOptional() @IsBoolean() pfApplicable?: boolean;
  @IsOptional() @IsBoolean() esiApplicable?: boolean;
  @IsOptional() @IsBoolean() ptApplicable?: boolean;
  @IsOptional() @IsIn([Role.EMPLOYEE, Role.MANAGER, Role.PAYROLL_ADMIN, Role.HR_ADMIN, Role.AUDITOR, Role.SUPER_ADMIN]) role?: Role;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

/** Fields an employee may change on their own profile. */
export class UpdateSelfDto {
  @IsOptional() @Transform(digits) @Matches(/^\+?[0-9]{10,13}$/) phone?: string;
  @IsOptional() @Transform(emptyToUndef) @IsEmail() personalEmail?: string;
  @IsOptional() @IsString() currentAddress?: string;
  @IsOptional() @IsString() permanentAddress?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @IsString() emergencyContactRelation?: string;
  @IsOptional() @IsEnum(MaritalStatus) maritalStatus?: MaritalStatus;
}

export class EmployeeFilterDto extends PaginationDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() designationId?: string;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() managerId?: string;
}

export class ImportEmployeesDto {
  @IsString() @MinLength(10) csv: string;
}

export class UploadDocumentDto {
  @IsString() documentType: string;
  @IsOptional() @IsString() documentName?: string;
  @IsOptional() @Transform(emptyToUndef) @IsDateString() expiryDate?: string;
}

export class SetStatusDto {
  @IsEnum(EmployeeStatus) status: EmployeeStatus;
}
