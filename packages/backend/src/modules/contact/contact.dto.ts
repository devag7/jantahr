import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);

export const CONTACT_TOPICS = ['sales', 'billing', 'support', 'privacy', 'other'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** A message from the public contact form. `website` is a honeypot: people never see it, so it must stay empty. */
export class ContactDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) name: string;
  @Transform(trim) @IsEmail() @MaxLength(200) email: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) company?: string;
  @IsOptional() @Transform(trim) @Matches(/^$|^\+?[0-9 ()-]{6,20}$/, { message: 'Enter a phone number with digits only, for example +91 98765 43210' }) phone?: string;
  @IsIn(CONTACT_TOPICS) topic: ContactTopic;
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(4000) message: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
