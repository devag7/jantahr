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

  /**
   * First-run checklist: each step is derived from what the company has actually set up, so it ticks itself off
   * and never asks an established company to redo anything.
   */
  async setupStatus(companyId: string) {
    const c = await this.get(companyId);
    const year = new Date().getUTCFullYear();
    const [departments, holidayLists, employees, salaries, payrollRuns] = await Promise.all([
      this.prisma.department.count({ where: { companyId } }),
      this.prisma.holidayList.count({ where: { companyId, year: { gte: year } } }),
      this.prisma.employee.count({ where: { companyId } }),
      this.prisma.salaryStructureAssignment.count({ where: { companyId } }),
      this.prisma.payrollEntry.count({ where: { companyId } }),
    ]);
    const steps = [
      { key: 'company', done: !!(c.pan && c.tan && c.address) },
      { key: 'org', done: departments > 0 },
      { key: 'holidays', done: holidayLists > 0 },
      { key: 'employees', done: employees > 1 },
      { key: 'salary', done: salaries > 0 },
      { key: 'payroll', done: payrollRuns > 0 },
    ];
    return { steps, done: steps.filter((s) => s.done).length, total: steps.length, complete: steps.every((s) => s.done), companyCreatedAt: c.createdAt };
  }

  update(companyId: string, dto: UpdateCompanyDto) {
    return this.prisma.company.update({ where: { id: companyId }, data: dto });
  }
}
