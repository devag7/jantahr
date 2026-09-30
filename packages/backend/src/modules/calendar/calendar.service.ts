import { Global, Injectable, Module } from '@nestjs/common';
import { eachDay, isoDate, toDateOnly } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';

export interface NonWorkingDays {
  holidays: Map<string, string>;
  weeklyOffDays: number[];
  isHoliday(d: Date): boolean;
  isWeeklyOff(d: Date): boolean;
  isNonWorking(d: Date): boolean;
}

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  /** Weekly offs + (non-optional) holidays applicable to an employee's state, for a date window. */
  async nonWorkingDays(companyId: string, state: string | null | undefined, from: Date, to: Date): Promise<NonWorkingDays> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { weeklyOffDays: true } });
    const lists = await this.prisma.holidayList.findMany({
      where: { companyId, year: { gte: from.getUTCFullYear(), lte: to.getUTCFullYear() }, OR: [{ state: null }, ...(state ? [{ state }] : [])] },
      include: { holidays: { where: { date: { gte: toDateOnly(from), lte: toDateOnly(to) }, isOptional: false } } },
    });
    const holidays = new Map<string, string>();
    for (const l of lists) for (const h of l.holidays) holidays.set(isoDate(h.date), h.name);
    const weeklyOffDays = company.weeklyOffDays;
    const isHoliday = (d: Date) => holidays.has(isoDate(d));
    const isWeeklyOff = (d: Date) => weeklyOffDays.includes(d.getUTCDay());
    return { holidays, weeklyOffDays, isHoliday, isWeeklyOff, isNonWorking: (d) => isHoliday(d) || isWeeklyOff(d) };
  }

  async workingDaysBetween(companyId: string, state: string | null | undefined, from: Date, to: Date): Promise<number> {
    const nw = await this.nonWorkingDays(companyId, state, from, to);
    return eachDay(from, to).filter((d) => !nw.isNonWorking(d)).length;
  }
}

@Global()
@Module({ providers: [CalendarService], exports: [CalendarService] })
export class CalendarModule {}
