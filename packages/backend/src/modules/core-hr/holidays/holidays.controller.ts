import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ADMIN_ROLES, AuthUser } from '../../../common/types';
import { todayIST } from '../../../common/utils/dates';
import { PrismaService } from '../../../prisma/prisma.service';
import { HolidayListDto, HolidaysService, UpdateHolidayListDto } from './holidays.service';

@Controller('holidays')
export class HolidaysController {
  constructor(private service: HolidaysService, private prisma: PrismaService) {}

  @Get('calendar')
  async calendar(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    const emp = user.employeeId ? await this.prisma.employee.findUnique({ where: { id: user.employeeId }, select: { professionalTaxState: true, state: true } }) : null;
    return this.service.calendar(user.companyId, emp?.state || emp?.professionalTaxState, year ? Number(year) : todayIST().getUTCFullYear());
  }

  @Roles(...ADMIN_ROLES)
  @Get('lists')
  lists(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    return this.service.lists(user.companyId, year ? Number(year) : undefined);
  }

  @Roles(...ADMIN_ROLES)
  @Post('lists')
  create(@CurrentUser() user: AuthUser, @Body() dto: HolidayListDto) {
    return this.service.create(user.companyId, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Patch('lists/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateHolidayListDto) {
    return this.service.update(user.companyId, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Delete('lists/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
