export type DayStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'WORK_FROM_HOME' | 'HOLIDAY' | 'WEEKLY_OFF' | 'NOT_MARKED' | 'FUTURE';
export interface PunchStatus {
  date: string; checkedIn: boolean; firstIn: string | null; lastPunch: { time: string; type: 'IN' | 'OUT' } | null; elapsedSeconds: number;
  punches: { time: string; type: 'IN' | 'OUT'; source: string }[]; attendance: { status: DayStatus; lateEntry: boolean; workingHours: number } | null;
}
export interface PunchInput { logType?: 'IN' | 'OUT'; latitude?: number; longitude?: number; selfie?: string; source?: 'WEB' | 'MOBILE' }
export interface DayRecord {
  date: string; weekday: number; kind: 'WORKING' | 'HOLIDAY' | 'WEEKLY_OFF'; holidayName: string | null; status: DayStatus; inTime: string | null; outTime: string | null; workingHours: number | null;
  lateEntry: boolean; earlyExit: boolean; overtime: number; shift: string | null; remarks: string | null; source: string | null;
}
export interface MonthSummary { present: number; wfh: number; halfDay: number; absent: number; onLeave: number; lateMarks: number; workingHours: number; overtimeHours: number; holidays: number; weeklyOffs: number; notMarked: number }
export interface MonthLog { employeeId: string; year: number; month: number; days: DayRecord[]; summary: MonthSummary }
export interface DailyRow { employeeId: string; employeeCode: string; name: string; department: string | null; status: DayStatus; inTime: string | null; outTime: string | null; workingHours: number | null; lateEntry: boolean; source: string | null }
export interface DailyAttendance { date: string; items: DailyRow[]; totals: { total: number; present: number; absent: number; halfDay: number; onLeave: number; notMarked: number; late: number } }
export interface AttendanceSummaryRow { employeeId: string; employeeCode: string; name: string; department: string | null; present: number; wfh: number; halfDay: number; absent: number; onLeave: number; lateMarks: number; hours: number; overtime: number }
export type RequestType = 'REGULARIZE' | 'ON_DUTY' | 'WFH';
export interface AttendanceRequest { id: string; fromDate: string; toDate: string; requestType: RequestType; reason: string; halfDay: boolean; status: 'PENDING' | 'APPROVED' | 'REJECTED'; approverComment: string | null; employee: { employeeCode: string; firstName: string; lastName: string } }
export interface ShiftType { id: string; name: string; startTime: string; endTime: string; workingHours: number; halfDayThresholdHours: number; lateEntryGraceMinutes: number; earlyExitGraceMinutes: number; isNightShift: boolean; status: 'ACTIVE' | 'INACTIVE' }
export interface ShiftAssignment { id: string; startDate: string; endDate: string | null; employee: { employeeCode: string; firstName: string; lastName: string }; shiftType: { name: string; startTime: string; endTime: string } }
export interface GeoLocation { id: string; name: string; latitude: number; longitude: number; radiusMeters: number }
export interface BiometricDevice { id: string; name: string; vendor: string; serialNo: string; isActive: boolean; lastSyncAt: string | null }
export interface DeviceCreated { id: string; serialNo: string; apiKey: string; note: string }
