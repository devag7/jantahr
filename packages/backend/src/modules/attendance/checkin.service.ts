import { EntitlementsService } from '../billing/entitlements.service';
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccessService } from '../../common/access/access.service';
import { ConsentService } from '../../common/consent/consent.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { StorageService } from '../../common/storage/storage.service';
import { AuthUser } from '../../common/types';
import { haversineMeters, isoDate, istDateOf, istInstant, todayIST } from '../../common/utils/dates';
import { num } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from './attendance.service';
import { BiometricPushDto, PunchDto } from './attendance.dto';

import { Prisma } from '@prisma/client';
const DUPLICATE_WINDOW_MS = 60_000;

@Injectable()
export class CheckinService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private attendance: AttendanceService,
    private storage: StorageService,
    private crypto: CryptoService,
    private entitlements: EntitlementsService,
    private consent: ConsentService,
  ) {}

  /** Web/mobile check-in or check-out with geo-fence validation and optional selfie. */
  async punch(user: AuthUser, dto: PunchDto, ip?: string) {
    const empId = this.access.requireEmployee(user);
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: empId } });
    if (emp.status !== 'ACTIVE') throw new ForbiddenException('Only active employees can mark attendance');

    const [allowLocation, allowSelfie] = await Promise.all([this.consent.isAllowed(user.userId, 'LOCATION_AT_CHECKIN'), this.consent.isAllowed(user.userId, 'SELFIE_AT_CHECKIN')]);
    const locations = await this.prisma.shiftLocation.findMany({ where: { companyId: user.companyId } });
    if (locations.length) {
      if (!allowLocation) throw new ForbiddenException('You have withdrawn location consent, but your company uses geo-fenced attendance. Restore consent under Privacy, or ask HR to mark your attendance.');
      if (dto.latitude === undefined || dto.longitude === undefined) throw new BadRequestException('Location is required to mark attendance. Please allow location access.');
      const nearest = locations
        .map((l) => ({ l, d: haversineMeters(dto.latitude!, dto.longitude!, num(l.latitude), num(l.longitude)) }))
        .sort((a, b) => a.d - b.d)[0];
      if (nearest.d > nearest.l.radiusMeters) {
        throw new BadRequestException(`You are ${Math.round(nearest.d)} m from ${nearest.l.name}. Attendance can be marked within ${nearest.l.radiusMeters} m.`);
      }
    }

    const now = new Date();
    const today = istDateOf(now);
    const dayStart = istInstant(today, '00:00');
    const todays = await this.prisma.employeeCheckin.findMany({ where: { employeeId: empId, time: { gte: dayStart } }, orderBy: { time: 'asc' } });
    const last = todays[todays.length - 1];
    if (last && now.getTime() - last.time.getTime() < DUPLICATE_WINDOW_MS) throw new BadRequestException('You just punched: please wait a minute before punching again');
    const logType = dto.logType || (last?.logType === 'IN' ? 'OUT' : 'IN');
    if (logType === 'OUT' && !last) throw new BadRequestException('You have not checked in yet today');

    const selfieUrl = dto.selfie && allowSelfie ? await this.storage.saveDataUrl(`selfies/${empId}`, dto.selfie) : null;
    const shift = await this.prisma.shiftType.findFirst({ where: { companyId: user.companyId, status: 'ACTIVE' } });
    await this.prisma.employeeCheckin.create({
      data: {
        employeeId: empId, companyId: user.companyId, time: now, logType, source: dto.source || 'WEB', selfieUrl, ipAddress: ip?.slice(0, 60),
        latitude: allowLocation ? dto.latitude : undefined, longitude: allowLocation ? dto.longitude : undefined, shiftTypeId: shift?.id,
      },
    });
    await this.attendance.processDay(empId, today);
    return this.status(user);
  }

  async status(user: AuthUser) {
    const empId = this.access.requireEmployee(user);
    const now = new Date();
    const today = istDateOf(now);
    const dayStart = istInstant(today, '00:00');
    const [punches, rec] = await Promise.all([
      this.prisma.employeeCheckin.findMany({ where: { employeeId: empId, time: { gte: dayStart } }, orderBy: { time: 'asc' } }),
      this.prisma.attendance.findUnique({ where: { employeeId_attendanceDate: { employeeId: empId, attendanceDate: today } } }),
    ]);
    const last = punches[punches.length - 1];
    const firstIn = punches.find((p) => p.logType === 'IN');
    const checkedIn = last?.logType === 'IN';
    return {
      date: isoDate(today), checkedIn, firstIn: firstIn?.time ?? null, lastPunch: last ? { time: last.time, type: last.logType } : null,
      elapsedSeconds: checkedIn && firstIn ? Math.floor((now.getTime() - firstIn.time.getTime()) / 1000) : rec?.workingHours ? Math.round(num(rec.workingHours) * 3600) : 0,
      punches: punches.map((p) => ({ time: p.time, type: p.logType, source: p.source })), attendance: rec ? { status: rec.status, lateEntry: rec.lateEntry, workingHours: num(rec.workingHours) } : null,
    };
  }

  /**
   * Device push endpoint (ZKTeco/eSSL push SDK or a small on-prem bridge).
   * Auth: x-device-serial + x-device-key (per-device API key, stored hashed).
   */
  async biometricPush(serial: string, key: string, dto: BiometricPushDto) {
    if (!serial || !key) throw new UnauthorizedException('Device credentials required');
    const device = await this.prisma.biometricDevice.findUnique({ where: { serialNo: serial } });
    if (!device || !device.isActive || device.apiKeyHash !== this.crypto.sha256(key)) throw new UnauthorizedException('Invalid device credentials');
    await this.entitlements.assertFeature(device.companyId, 'biometric');
    const codes = [...new Set(dto.punches.map((p) => p.employeeCode.toUpperCase()))];
    const emps = await this.prisma.employee.findMany({ where: { companyId: device.companyId, employeeCode: { in: codes, mode: 'insensitive' } }, select: { id: true, employeeCode: true } });
    const byCode = new Map(emps.map((e) => [e.employeeCode.toUpperCase(), e.id]));
    const unknown: string[] = [];
    const rows: (Prisma.EmployeeCheckinCreateManyInput & { time: Date })[] = [];
    const touched = new Set<string>();
    for (const p of dto.punches) {
      const id = byCode.get(p.employeeCode.toUpperCase());
      if (!id) { unknown.push(p.employeeCode); continue; }
      const time = new Date(p.time);
      if (Number.isNaN(time.getTime()) || time > new Date(Date.now() + 5 * 60000)) continue;
      rows.push({ employeeId: id, companyId: device.companyId, time, logType: p.type || 'IN', deviceId: device.serialNo, source: 'BIOMETRIC' });
      touched.add(`${id}|${isoDate(istDateOf(time))}`);
    }
    // de-duplicate against already stored punches (devices commonly re-send)
    const existing = rows.length
      ? await this.prisma.employeeCheckin.findMany({ where: { deviceId: device.serialNo, employeeId: { in: [...new Set(rows.map((r) => r.employeeId))] }, time: { in: rows.map((r) => r.time) } }, select: { employeeId: true, time: true } })
      : [];
    const seen = new Set(existing.map((e) => `${e.employeeId}|${e.time.getTime()}`));
    const fresh = rows.filter((r) => !seen.has(`${r.employeeId}|${r.time.getTime()}`));
    if (fresh.length) await this.prisma.employeeCheckin.createMany({ data: fresh });
    for (const k of touched) {
      const [eid, d] = k.split('|');
      await this.attendance.processDay(eid, new Date(d + 'T00:00:00.000Z'), 'BIOMETRIC');
    }
    await this.prisma.biometricDevice.update({ where: { id: device.id }, data: { lastSyncAt: new Date() } });
    return { received: dto.punches.length, stored: fresh.length, duplicates: rows.length - fresh.length, unknownEmployees: [...new Set(unknown)] };
  }
}
