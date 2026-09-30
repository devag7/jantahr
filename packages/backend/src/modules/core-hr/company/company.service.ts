import { Injectable, NotFoundException } from '@nestjs/common';
import { Transform, Type, TransformFnParams } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { PrismaService } from '../../../prisma/prisma.service';

const upper = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @Transform(upper) @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'PAN is invalid' }) pan?: string;
  @IsOptional() @Transform(upper) @Matches(/^[A-Z]{4}[0-9]{5}[A-Z]$/, { message: 'TAN is invalid' }) tan?: string;
  @IsOptional() @IsString() pfNumber?: string;
  @IsOptional() @IsString() esiNumber?: string;
  @IsOptional() @IsString() ptRegistration?: string;
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsBoolean() pfEnabled?: boolean;
  @IsOptional() @IsBoolean() labourCodeWages?: boolean;
  @IsOptional() @IsBoolean() esiEnabled?: boolean;
  @IsOptional() @IsBoolean() ptEnabled?: boolean;
  @IsOptional() @IsBoolean() lwfEnabled?: boolean;
  @IsOptional() @IsBoolean() isMetroCity?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @Type(() => Number) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weeklyOffDays?: number[];
}

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async get(companyId: string) {
    const c = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!c) throw new NotFoundException('Company not found');
    return c;
  }

  update(companyId: string, dto: UpdateCompanyDto) {
    return this.prisma.company.update({ where: { id: companyId }, data: dto });
  }
}
