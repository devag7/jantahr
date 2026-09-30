import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { toDateOnly } from '../../../common/utils/dates';
import { PrismaService } from '../../../prisma/prisma.service';

export class HolidayItemDto {
  @IsString() name: string;
  @IsDateString() date: string;
  @IsOptional() @IsBoolean() isOptional?: boolean;
}

export class HolidayListDto {
  @IsString() name: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsArray() @ArrayMinSize(0) @ValidateNested({ each: true }) @Type(() => HolidayItemDto) holidays: HolidayItemDto[];
}

export class UpdateHolidayListDto extends PartialType(HolidayListDto) {}

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}

  lists(companyId: string, year?: number) {
    return this.prisma.holidayList.findMany({
      where: { companyId, ...(year ? { year } : {}) }, orderBy: [{ year: 'desc' }, { name: 'asc' }],
      include: { holidays: { orderBy: { date: 'asc' } } },
    });
  }

  /** Flat, de-duplicated calendar for one employee's state. */
  async calendar(companyId: string, state: string | null | undefined, year: number) {
    const lists = await this.prisma.holidayList.findMany({
      where: { companyId, year, OR: [{ state: null }, ...(state ? [{ state }] : [])] }, include: { holidays: true },
    });
    const byDate = new Map<string, { date: string; name: string; isOptional: boolean }>();
    for (const l of lists) for (const h of l.holidays) byDate.set(h.date.toISOString().slice(0, 10) + h.name, { date: h.date.toISOString().slice(0, 10), name: h.name, isOptional: h.isOptional });
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private mapHolidays(items: HolidayItemDto[]) {
    return items.map((h) => ({ name: h.name, date: toDateOnly(h.date), isOptional: !!h.isOptional }));
  }

  async create(companyId: string, dto: HolidayListDto) {
    const dupes = new Set<string>();
    for (const h of dto.holidays) {
      const k = h.date.slice(0, 10);
      if (dupes.has(k)) throw new BadRequestException(`Duplicate holiday date ${k}`);
      dupes.add(k);
    }
    return this.prisma.holidayList.create({
      data: { name: dto.name, year: dto.year, state: dto.state || null, isDefault: !!dto.isDefault, companyId, holidays: { create: this.mapHolidays(dto.holidays) } },
      include: { holidays: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateHolidayListDto) {
    if (!(await this.prisma.holidayList.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Holiday list not found');
    return this.prisma.$transaction(async (tx) => {
      if (dto.holidays) await tx.holiday.deleteMany({ where: { holidayListId: id } });
      return tx.holidayList.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}), ...(dto.year ? { year: dto.year } : {}), ...(dto.state !== undefined ? { state: dto.state || null } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}), ...(dto.holidays ? { holidays: { create: this.mapHolidays(dto.holidays) } } : {}),
        },
        include: { holidays: { orderBy: { date: 'asc' } } },
      });
    });
  }

  async remove(companyId: string, id: string) {
    if (!(await this.prisma.holidayList.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Holiday list not found');
    await this.prisma.$transaction([this.prisma.holiday.deleteMany({ where: { holidayListId: id } }), this.prisma.holidayList.delete({ where: { id } })]);
    return { ok: true };
  }
}
