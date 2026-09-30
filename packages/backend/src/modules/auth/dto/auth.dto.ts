import { Gender, MaritalStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_MSG = 'Password must be at least 8 characters and contain a letter and a number';

export class ChangePasswordDto {
  @IsString() @IsNotEmpty() currentPassword: string;
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) newPassword: string;
}

/** After an email link (password recovery or magic link) the user sets a new password without the old one. */
export class SetPasswordDto {
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) newPassword: string;
}

/** Company details for a new tenant; the email and password live in Supabase Auth. */
export class ProvisionCompanyDto {
  @IsString() @MinLength(2) @MaxLength(255) companyName: string;
  @IsOptional() @IsString() state?: string;
  @IsString() @MinLength(2) firstName: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsEnum(MaritalStatus) maritalStatus?: MaritalStatus;
}
