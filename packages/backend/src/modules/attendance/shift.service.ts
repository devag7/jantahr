import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ShiftType } from '@prisma/client';
import * as crypto from 'crypto';
import { CryptoService } from '../../common/crypto/crypto.service';
import { addDays, toDateOnly } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceDto, RosterDto, ShiftAssignmentDto, ShiftLocationDto, ShiftTypeDto, UpdateShiftLocationDto, UpdateShiftTypeDto } from './attendance.dto';

import { Prisma } from '@prisma/client';
@Injectable()
export class ShiftService {
  constructor(private prisma: PrismaService, private crypto: CryptoService) {}

  // ---- shift types ----
  types(companyId: string) {
    return this.prisma.shiftType.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }
  createType(companyId: string, dto: ShiftTypeDto) {
    return this.prisma.shiftType.create({ data: { ...dto, companyId } });
  }
  async updateType(companyId: string, id: string, dto: UpdateShiftTypeDto) {
    if (!(await this.prisma.shiftType.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Shift not found');
    return this.prisma.shiftType.update({ where: { id }, data: dto });
  }
  async deleteType(companyId: string, id: string) {
    const s = await this.prisma.shiftType.findFirst({ where: { id, companyId }, include: { _count: { select: { attendances: true, shiftAssignments: true } } } });
    if (!s) throw new NotFoundException('Shift not found');
    if (s._count.attendances || s._count.shiftAssignments) throw new BadRequestException('Shift is in use; mark it inactive instead');
    await this.prisma.shiftType.delete({ where: { id } });
    return { ok: true };
  }

  /** Effective shift: latest assignment covering the date → employee default → first active company shift. */
  async shiftFor(companyId: string, employeeId: string, date: Date): Promise<ShiftType | null> {
    const a = await this.prisma.shiftAssignment.findFirst({
      where: { employeeId, status: 'APPROVED', startDate: { lte: date }, OR: [{ endDate: null }, { endDate: { gte: date } }] },
      orderBy: { startDate: 'desc' }, include: { shiftType: true },
    });
    if (a?.shiftType.status === 'ACTIVE') return a.shiftType;
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { defaultShiftId: true } });
    if (emp?.defaultShiftId) {
      const s = await this.prisma.shiftType.findFirst({ where: { id: emp.defaultShiftId, companyId, status: 'ACTIVE' } });
      if (s) return s;
    }
    return this.prisma.shiftType.findFirst({ where: { companyId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
  }

  // ---- assignments / roster ----
  assignments(companyId: string, employeeId?: string) {
    return this.prisma.shiftAssignment.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) }, orderBy: { startDate: 'desc' }, take: 300,
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, shiftType: { select: { name: true, startTime: true, endTime: true } } },
    });
  }

  private async assertShiftAndEmployees(companyId: string, shiftIds: string[], employeeIds: string[]) {
    const [s, e] = await Promise.all([
      this.prisma.shiftType.count({ where: { companyId, id: { in: [...new Set(shiftIds)] } } }),
      this.prisma.employee.count({ where: { companyId, id: { in: employeeIds } } }),
    ]);
    if (s !== new Set(shiftIds).size) throw new BadRequestException('Unknown shift');
    if (e !== employeeIds.length) throw new BadRequestException('One or more employees not found');
  }

  async assign(companyId: string, dto: ShiftAssignmentDto) {
    await this.assertShiftAndEmployees(companyId, [dto.shiftTypeId], dto.employeeIds);
    const start = toDateOnly(dto.startDate);
    const end = dto.endDate ? toDateOnly(dto.endDate) : null;
    if (end && end < start) throw new BadRequestException('End date is before start date');
    await this.prisma.$transaction(async (tx) => {
      for (const employeeId of dto.employeeIds) {
        // close an open-ended earlier assignment so ranges do not overlap
        await tx.shiftAssignment.updateMany({ where: { employeeId, endDate: null, startDate: { lt: start } }, data: { endDate: addDays(start, -1) } });
        await tx.shiftAssignment.create({ data: { employeeId, shiftTypeId: dto.shiftTypeId, companyId, startDate: start, endDate: end } });
      }
    });
    return { assigned: dto.employeeIds.length };
  }

  /** Rotating roster: pattern[i] applies to week i (cycling), created as one assignment per week. */
  async roster(companyId: string, dto: RosterDto) {
    await this.assertShiftAndEmployees(companyId, dto.pattern, dto.employeeIds);
    const start = toDateOnly(dto.startDate);
    const rows: Prisma.ShiftAssignmentCreateManyInput[] = [];
    for (const employeeId of dto.employeeIds) {
      for (let w = 0; w < dto.weeks; w++) {
        rows.push({ employeeId, companyId, shiftTypeId: dto.pattern[w % dto.pattern.length], startDate: addDays(start, w * 7), endDate: addDays(start, w * 7 + 6) });
      }
    }
    await this.prisma.$transaction([
      this.prisma.shiftAssignment.deleteMany({ where: { employeeId: { in: dto.employeeIds }, companyId, startDate: { gte: start, lte: addDays(start, dto.weeks * 7) } } }),
      this.prisma.shiftAssignment.createMany({ data: rows }),
    ]);
    return { created: rows.length };
  }

  async removeAssignment(companyId: string, id: string) {
    if (!(await this.prisma.shiftAssignment.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Assignment not found');
    await this.prisma.shiftAssignment.delete({ where: { id } });
    return { ok: true };
  }

  // ---- geo-fence locations ----
  locations(companyId: string) {
    return this.prisma.shiftLocation.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }
  createLocation(companyId: string, dto: ShiftLocationDto) {
    return this.prisma.shiftLocation.create({ data: { ...dto, companyId } });
  }
  async updateLocation(companyId: string, id: string, dto: UpdateShiftLocationDto) {
    if (!(await this.prisma.shiftLocation.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Location not found');
    return this.prisma.shiftLocation.update({ where: { id }, data: dto });
  }
  async deleteLocation(companyId: string, id: string) {
    if (!(await this.prisma.shiftLocation.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Location not found');
    await this.prisma.shiftLocation.delete({ where: { id } });
    return { ok: true };
  }

  // ---- biometric devices ----
  devices(companyId: string) {
    return this.prisma.biometricDevice.findMany({ where: { companyId }, select: { id: true, name: true, vendor: true, serialNo: true, isActive: true, lastSyncAt: true, createdAt: true } });
  }

  async createDevice(companyId: string, dto: DeviceDto) {
    if (await this.prisma.biometricDevice.findUnique({ where: { serialNo: dto.serialNo } })) throw new BadRequestException('A device with this serial number is already registered');
    const apiKey = `jhr_${crypto.randomBytes(24).toString('hex')}`;
    const d = await this.prisma.biometricDevice.create({ data: { companyId, name: dto.name, serialNo: dto.serialNo, vendor: dto.vendor || 'ZKTECO', apiKeyHash: this.crypto.sha256(apiKey) } });
    return { id: d.id, serialNo: d.serialNo, apiKey, note: 'Store this API key on the device now: it will not be shown again.' };
  }

  async setDeviceActive(companyId: string, id: string, isActive: boolean) {
    if (!(await this.prisma.biometricDevice.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Device not found');
    return this.prisma.biometricDevice.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
  }
}
