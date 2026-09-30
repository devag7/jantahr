'use client';
import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DecisionButtons } from '@/components/approvals/decision-buttons';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { MonthPicker } from '@/components/common/month-picker';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { QueryBoundary } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { StatusBadge } from '@/components/common/status-badge';
import { useAssignShift, useAttendanceRequests, useAttendanceSummary, useCreateDevice, useCreateLocation, useDailyAttendance, useDecideRequest, useDeleteLocation, useDeleteShift, useDevices, useGeoLocations, useImportAttendance, useMarkAbsent, useMarkAttendance, useProcessAttendance, useRemoveAssignment, useRoster, useSaveShift, useSetDeviceActive, useShiftAssignments, useShifts } from '@/hooks/attendance/use-attendance';
import { useAuth } from '@/hooks/auth/use-auth';
import { useEmployees } from '@/hooks/employees/use-employees';
import { useDepartments } from '@/hooks/org/use-org';
import { formatDate, formatTime, todayISO } from '@/lib/format';
import { ADMIN } from '@/lib/permissions';
import type { DeviceCreated, ShiftType } from '@/types/attendance';

export default function HrAttendancePage() {
  const { hasRole } = useAuth();
  const admin = hasRole(ADMIN);
  return (
    <>
      <PageHeader title="Attendance" description="Daily status, monthly summaries, regularisation requests, shifts and devices." />
      <Tabs defaultValue="daily">
        <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="daily">Daily</TabsTrigger><TabsTrigger value="monthly">Monthly summary</TabsTrigger><TabsTrigger value="requests">Requests</TabsTrigger>{admin && <><TabsTrigger value="shifts">Shifts & roster</TabsTrigger><TabsTrigger value="geo">Geo-fence & devices</TabsTrigger><TabsTrigger value="tools">Tools</TabsTrigger></>}</TabsList>
        <TabsContent value="daily" className="mt-4"><DailyTab /></TabsContent>
        <TabsContent value="monthly" className="mt-4"><MonthlyTab /></TabsContent>
        <TabsContent value="requests" className="mt-4"><RequestsTab canDecide={admin} /></TabsContent>
        {admin && <><TabsContent value="shifts" className="mt-4"><ShiftsTab /></TabsContent><TabsContent value="geo" className="mt-4"><GeoTab /></TabsContent><TabsContent value="tools" className="mt-4"><ToolsTab /></TabsContent></>}
      </Tabs>
    </>
  );
}

function DailyTab() {
  const [date, setDate] = React.useState(todayISO());
  const [dept, setDept] = React.useState('');
  const [search, setSearch] = React.useState('');
  const depts = useDepartments();
  const q = useDailyAttendance(date, dept || undefined, search || undefined);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><Input type="date" aria-label="Date" className="w-44" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /><NativeSelect aria-label="Department" className="w-48" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect><SearchInput onSearch={setSearch} placeholder="Search employee" className="w-60" /></div>
      <QueryBoundary query={q}>
        {(d) => (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6"><StatCard label="Total" value={d.totals.total} /><StatCard label="Present" value={d.totals.present} tone="success" /><StatCard label="Half day" value={d.totals.halfDay} tone="warning" /><StatCard label="Absent" value={d.totals.absent} tone="destructive" /><StatCard label="On leave" value={d.totals.onLeave} tone="info" /><StatCard label="Not marked" value={d.totals.notMarked} /></div>
            <DataTable rows={d.items} rowKey={(r) => r.employeeId} dense emptyTitle="No employees" columns={[
              { key: 'n', header: 'Employee', cell: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-fine text-muted-foreground">{r.employeeCode} · {r.department ?? '-'}</p></div> },
              { key: 's', header: 'Status', cell: (r) => <div className="flex items-center gap-2"><StatusBadge status={r.status} />{r.lateEntry && <Badge variant="warning">Late</Badge>}</div> },
              { key: 'i', header: 'In', cell: (r) => formatTime(r.inTime) }, { key: 'o', header: 'Out', cell: (r) => formatTime(r.outTime) }, { key: 'h', header: 'Hours', cell: (r) => r.workingHours ?? '-', align: 'right' },
              { key: 'src', header: 'Source', cell: (r) => <span className="text-fine text-muted-foreground">{r.source ?? '-'}</span>, hideOnMobile: true },
            ]} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function MonthlyTab() {
  const now = new Date();
  const [ym, setYm] = React.useState({ m: now.getMonth() + 1, y: now.getFullYear() });
  const q = useAttendanceSummary(ym.y, ym.m);
  return (
    <div className="space-y-4">
      <MonthPicker month={ym.m} year={ym.y} onChange={(m, y) => setYm({ m, y })} />
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(r) => r.employeeId} dense emptyTitle="No data" columns={[
        { key: 'n', header: 'Employee', cell: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-fine text-muted-foreground">{r.employeeCode}</p></div> }, { key: 'd', header: 'Department', cell: (r) => r.department ?? '-', hideOnMobile: true },
        { key: 'p', header: 'Present', cell: (r) => r.present + r.wfh, align: 'right' }, { key: 'h', header: 'Half', cell: (r) => r.halfDay, align: 'right' }, { key: 'a', header: 'Absent', cell: (r) => <span className={r.absent ? 'font-semibold text-destructive' : ''}>{r.absent}</span>, align: 'right' },
        { key: 'l', header: 'Leave', cell: (r) => r.onLeave, align: 'right' }, { key: 'lm', header: 'Late', cell: (r) => r.lateMarks, align: 'right' }, { key: 'hr', header: 'Hours', cell: (r) => r.hours, align: 'right' }, { key: 'ot', header: 'OT', cell: (r) => r.overtime, align: 'right', hideOnMobile: true },
      ]} />
    </div>
  );
}

function RequestsTab({ canDecide }: { canDecide: boolean }) {
  const [status, setStatus] = React.useState('PENDING');
  const q = useAttendanceRequests(status || undefined);
  const decide = useDecideRequest();
  return (
    <div className="space-y-4">
      <NativeSelect aria-label="Status" className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="">All</option></NativeSelect>
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(r) => r.id} emptyTitle="No requests" columns={[
        { key: 'e', header: 'Employee', cell: (r) => `${r.employee.firstName} ${r.employee.lastName}` }, { key: 't', header: 'Type', cell: (r) => <span className="capitalize">{r.requestType.replace('_', ' ').toLowerCase()}</span> },
        { key: 'd', header: 'Dates', cell: (r) => `${formatDate(r.fromDate, false)}${r.toDate !== r.fromDate ? ` → ${formatDate(r.toDate, false)}` : ''}` }, { key: 'r', header: 'Reason', cell: (r) => <span className="line-clamp-2 max-w-64">{r.reason}</span>, hideOnMobile: true },
        { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
        { key: 'a', header: '', cell: (r) => (canDecide && r.status === 'PENDING' ? <DecisionButtons subject={`${r.employee.firstName}: ${r.requestType.toLowerCase()}`} busy={decide.isPending} onApprove={(c) => decide.mutate({ id: r.id, action: 'approve', comment: c })} onReject={(c) => decide.mutate({ id: r.id, action: 'reject', comment: c })} /> : null) },
      ]} />
    </div>
  );
}

function ShiftsTab() {
  const shifts = useShifts();
  const assignments = useShiftAssignments();
  const remove = useDeleteShift();
  const removeAssign = useRemoveAssignment();
  const [edit, setEdit] = React.useState<Partial<ShiftType> | null>(null);
  const [assign, setAssign] = React.useState(false);
  const [roster, setRoster] = React.useState(false);
  return (
    <div className="space-y-6">
      <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Shift types</CardTitle><Button size="sm" onClick={() => setEdit({ name: '', startTime: '09:30', endTime: '18:30', workingHours: 8, halfDayThresholdHours: 4, lateEntryGraceMinutes: 15, earlyExitGraceMinutes: 0 })}><Plus className="mr-1 h-4 w-4" />New shift</Button></CardHeader>
        <CardContent><DataTable bare rows={shifts.data} loading={shifts.isLoading} error={shifts.error} rowKey={(s) => s.id} columns={[
          { key: 'n', header: 'Shift', cell: (s) => <span className="font-semibold">{s.name}</span> }, { key: 't', header: 'Timing', cell: (s) => `${s.startTime} - ${s.endTime}` }, { key: 'h', header: 'Hours (half-day)', cell: (s) => `${s.workingHours} (${s.halfDayThresholdHours})` },
          { key: 'g', header: 'Late grace', cell: (s) => `${s.lateEntryGraceMinutes} min`, hideOnMobile: true }, { key: 's', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
          { key: 'a', header: '', align: 'right', cell: (s) => <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button><Button size="icon" variant="ghost" aria-label="Delete shift" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button></div> },
        ]} /></CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Assignments & rosters</CardTitle><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setRoster(true)}>Rotating roster</Button><Button size="sm" onClick={() => setAssign(true)}>Assign shift</Button></div></CardHeader>
        <CardContent><DataTable bare rows={assignments.data} loading={assignments.isLoading} error={assignments.error} rowKey={(a) => a.id} emptyTitle="No shift assignments" emptyDescription="Employees use the default shift unless assigned." columns={[
          { key: 'e', header: 'Employee', cell: (a) => `${a.employee.firstName} ${a.employee.lastName}` }, { key: 's', header: 'Shift', cell: (a) => `${a.shiftType.name} (${a.shiftType.startTime}-${a.shiftType.endTime})` },
          { key: 'f', header: 'From', cell: (a) => formatDate(a.startDate, false) }, { key: 't', header: 'To', cell: (a) => (a.endDate ? formatDate(a.endDate, false) : 'Open') },
          { key: 'x', header: '', align: 'right', cell: (a) => <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => removeAssign.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button> },
        ]} /></CardContent></Card>
      <ShiftModal shift={edit} onClose={() => setEdit(null)} />
      <AssignModal open={assign} onOpenChange={setAssign} />
      <RosterModal open={roster} onOpenChange={setRoster} />
    </div>
  );
}

function ShiftModal({ shift, onClose }: { shift: Partial<ShiftType> | null; onClose: () => void }) {
  const save = useSaveShift();
  const [f, setF] = React.useState<Partial<ShiftType>>({});
  React.useEffect(() => { if (shift) setF(shift); }, [shift]);
  const num = (k: keyof ShiftType) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });
  return (
    <Modal open={!!shift} onOpenChange={(o) => !o && onClose()} title={shift?.id ? 'Edit shift' : 'New shift'}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const { name, startTime, endTime, workingHours, halfDayThresholdHours, lateEntryGraceMinutes, earlyExitGraceMinutes } = f; save.mutate({ id: shift?.id, data: { name, startTime, endTime, workingHours, halfDayThresholdHours, lateEntryGraceMinutes, earlyExitGraceMinutes } }, { onSuccess: onClose }); }}>
        <Field label="Name" htmlFor="sn" required><Input id="sn" required value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <FormGrid><Field label="Start" htmlFor="ss"><Input id="ss" type="time" required value={f.startTime ?? ''} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></Field><Field label="End" htmlFor="se"><Input id="se" type="time" required value={f.endTime ?? ''} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></Field>
          <Field label="Working hours" htmlFor="sw"><Input id="sw" type="number" step="0.5" min="1" max="24" required value={f.workingHours ?? ''} onChange={num('workingHours')} /></Field><Field label="Half-day threshold (hrs)" htmlFor="sh"><Input id="sh" type="number" step="0.5" min="0" required value={f.halfDayThresholdHours ?? ''} onChange={num('halfDayThresholdHours')} /></Field>
          <Field label="Late grace (min)" htmlFor="sl"><Input id="sl" type="number" min="0" value={f.lateEntryGraceMinutes ?? 0} onChange={num('lateEntryGraceMinutes')} /></Field><Field label="Early exit grace (min)" htmlFor="sx"><Input id="sx" type="number" min="0" value={f.earlyExitGraceMinutes ?? 0} onChange={num('earlyExitGraceMinutes')} /></Field></FormGrid>
        <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}

function EmployeePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const emps = useEmployees({ limit: 200, status: 'ACTIVE' });
  return (
    <div className="max-h-44 overflow-y-auto rounded-md border p-2 text-caption">
      {emps.data?.items.map((e) => <label key={e.id} className="flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-muted"><input type="checkbox" className="accent-primary" checked={value.includes(e.id)} onChange={(ev) => onChange(ev.target.checked ? [...value, e.id] : value.filter((x) => x !== e.id))} />{e.fullName} <span className="text-fine text-muted-foreground">{e.employeeCode}</span></label>)}
    </div>
  );
}

function AssignModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const shifts = useShifts();
  const assign = useAssignShift();
  const [ids, setIds] = React.useState<string[]>([]);
  const [shiftId, setShiftId] = React.useState('');
  const [start, setStart] = React.useState(todayISO());
  const [end, setEnd] = React.useState('');
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Assign shift">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); assign.mutate({ employeeIds: ids, shiftTypeId: shiftId || shifts.data?.[0]?.id || '', startDate: start, endDate: end || undefined }, { onSuccess: () => { setIds([]); onOpenChange(false); } }); }}>
        <Field label="Shift"><NativeSelect value={shiftId} onChange={(e) => setShiftId(e.target.value)}>{shifts.data?.filter((s) => s.status === 'ACTIVE').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
        <FormGrid><Field label="From" htmlFor="af"><Input id="af" type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="To (optional)" htmlFor="at"><Input id="at" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></Field></FormGrid>
        <Field label={`Employees (${ids.length} selected)`}><EmployeePicker value={ids} onChange={setIds} /></Field>
        <div className="flex justify-end"><Button type="submit" disabled={!ids.length || assign.isPending}>Assign</Button></div>
      </form>
    </Modal>
  );
}

function RosterModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const shifts = useShifts();
  const roster = useRoster();
  const [ids, setIds] = React.useState<string[]>([]);
  const [pattern, setPattern] = React.useState<string[]>([]);
  const [start, setStart] = React.useState(todayISO());
  const [weeks, setWeeks] = React.useState('4');
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Rotating roster" description="Pick shifts in rotation order: one per week, repeating for the number of weeks.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); roster.mutate({ employeeIds: ids, pattern, startDate: start, weeks: Number(weeks) }, { onSuccess: () => { setIds([]); setPattern([]); onOpenChange(false); } }); }}>
        <Field label="Rotation (week 1 → week N)" hint="Click a shift to append it to the pattern"><div className="flex flex-wrap gap-2">{shifts.data?.filter((s) => s.status === 'ACTIVE').map((s) => <Button key={s.id} type="button" size="sm" variant="outline" onClick={() => setPattern([...pattern, s.id])}>+ {s.name}</Button>)}</div>
          <p className="mt-2 text-caption">{pattern.length ? pattern.map((p) => shifts.data?.find((s) => s.id === p)?.name).join(' → ') : <span className="text-muted-foreground">No shifts picked</span>} {pattern.length > 0 && <button type="button" className="ml-2 text-fine text-primary hover:underline" onClick={() => setPattern([])}>clear</button>}</p></Field>
        <FormGrid><Field label="Start (week 1)" htmlFor="rs"><Input id="rs" type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="Weeks" htmlFor="rw"><Input id="rw" type="number" min="1" max="52" required value={weeks} onChange={(e) => setWeeks(e.target.value)} /></Field></FormGrid>
        <Field label={`Employees (${ids.length})`}><EmployeePicker value={ids} onChange={setIds} /></Field>
        <div className="flex justify-end"><Button type="submit" disabled={!ids.length || !pattern.length || roster.isPending}>Create roster</Button></div>
      </form>
    </Modal>
  );
}

function GeoTab() {
  const locs = useGeoLocations();
  const devices = useDevices();
  const create = useCreateLocation();
  const del = useDeleteLocation();
  const createDev = useCreateDevice();
  const setActive = useSetDeviceActive();
  const [loc, setLoc] = React.useState({ name: '', latitude: '', longitude: '', radiusMeters: '200' });
  const [dev, setDev] = React.useState({ name: '', serialNo: '' });
  const [created, setCreated] = React.useState<DeviceCreated | null>(null);
  const useMyLocation = () => navigator.geolocation?.getCurrentPosition((p) => setLoc((l) => ({ ...l, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })), () => toast.error('Could not read your location'));
  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Geo-fenced offices</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-caption text-muted-foreground">When at least one location is defined, employees can only check in within its radius. With none defined, check-in works from anywhere.</p>
        <DataTable bare rows={locs.data} loading={locs.isLoading} error={locs.error} rowKey={(l) => l.id} emptyTitle="No geo-fence set" columns={[{ key: 'n', header: 'Location', cell: (l) => l.name }, { key: 'c', header: 'Coordinates', cell: (l) => `${l.latitude}, ${l.longitude}` }, { key: 'r', header: 'Radius', cell: (l) => `${l.radiusMeters} m` }, { key: 'x', header: '', align: 'right', cell: (l) => <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button> }]} />
        <form className="grid gap-3 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); create.mutate({ name: loc.name, latitude: Number(loc.latitude), longitude: Number(loc.longitude), radiusMeters: Number(loc.radiusMeters) }, { onSuccess: () => setLoc({ name: '', latitude: '', longitude: '', radiusMeters: '200' }) }); }}>
          <Input required placeholder="Name" aria-label="Name" value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} /><Input required type="number" step="any" placeholder="Latitude" aria-label="Latitude" value={loc.latitude} onChange={(e) => setLoc({ ...loc, latitude: e.target.value })} /><Input required type="number" step="any" placeholder="Longitude" aria-label="Longitude" value={loc.longitude} onChange={(e) => setLoc({ ...loc, longitude: e.target.value })} />
          <Input required type="number" min="20" placeholder="Radius (m)" aria-label="Radius" value={loc.radiusMeters} onChange={(e) => setLoc({ ...loc, radiusMeters: e.target.value })} /><div className="flex gap-2"><Button type="button" variant="outline" onClick={useMyLocation}>Use mine</Button><Button type="submit" disabled={create.isPending}>Add</Button></div>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Biometric devices</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-caption text-muted-foreground">Devices (ZKTeco, eSSL, BioMax) or an on-prem bridge push punches to <code className="rounded-sm bg-muted px-1 text-fine">POST /attendance/biometric/push</code> with <code className="rounded-sm bg-muted px-1 text-fine">x-device-serial</code> and <code className="rounded-sm bg-muted px-1 text-fine">x-device-key</code> headers. Employee codes must match.</p>
        <DataTable bare rows={devices.data} loading={devices.isLoading} error={devices.error} rowKey={(d) => d.id} emptyTitle="No devices registered" columns={[{ key: 'n', header: 'Device', cell: (d) => <div><p className="font-semibold">{d.name}</p><p className="text-fine text-muted-foreground">{d.vendor} · {d.serialNo}</p></div> }, { key: 'l', header: 'Last sync', cell: (d) => (d.lastSyncAt ? formatDate(d.lastSyncAt) : 'Never') }, { key: 's', header: 'Status', cell: (d) => <StatusBadge status={d.isActive ? 'ACTIVE' : 'INACTIVE'} /> }, { key: 'x', header: '', align: 'right', cell: (d) => <Button size="sm" variant="ghost" onClick={() => setActive.mutate({ id: d.id, isActive: !d.isActive })}>{d.isActive ? 'Disable' : 'Enable'}</Button> }]} />
        <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); createDev.mutate({ name: dev.name, serialNo: dev.serialNo }, { onSuccess: (r) => { setCreated(r); setDev({ name: '', serialNo: '' }); } }); }}>
          <Input required placeholder="Device name" aria-label="Device name" className="w-56" value={dev.name} onChange={(e) => setDev({ ...dev, name: e.target.value })} /><Input required placeholder="Serial number" aria-label="Serial number" className="w-56" value={dev.serialNo} onChange={(e) => setDev({ ...dev, serialNo: e.target.value })} /><Button type="submit" disabled={createDev.isPending}>Register device</Button>
        </form>
      </CardContent></Card>
      <Modal open={!!created} onOpenChange={(o) => !o && setCreated(null)} title="Device registered" description="Copy the API key now: it is shown only once." size="sm">
        {created && <div className="space-y-2 text-caption"><p>Serial: <b>{created.serialNo}</b></p><p className="break-all rounded-md bg-muted p-3 font-mono text-fine">{created.apiKey}</p><Button variant="outline" onClick={() => { navigator.clipboard.writeText(created.apiKey); toast.success('Copied'); }}>Copy key</Button></div>}
      </Modal>
    </div>
  );
}

function ToolsTab() {
  const emps = useEmployees({ limit: 200, status: 'ACTIVE' });
  const mark = useMarkAttendance();
  const imp = useImportAttendance();
  const process = useProcessAttendance();
  const absent = useMarkAbsent();
  const [m, setM] = React.useState({ employeeId: '', date: todayISO(), status: 'PRESENT', inTime: '', outTime: '', remarks: '' });
  const [csv, setCsv] = React.useState('');
  const [range, setRange] = React.useState({ from: todayISO(), to: todayISO() });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Mark attendance manually</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mark.mutate({ employeeId: m.employeeId, date: m.date, status: m.status, inTime: m.inTime || undefined, outTime: m.outTime || undefined, remarks: m.remarks || undefined }); }}>
          <Field label="Employee"><NativeSelect required value={m.employeeId} onChange={(e) => setM({ ...m, employeeId: e.target.value })}><option value="">Select…</option>{emps.data?.items.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}</NativeSelect></Field>
          <FormGrid><Field label="Date"><Input type="date" required max={todayISO()} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></Field><Field label="Status"><NativeSelect value={m.status} onChange={(e) => setM({ ...m, status: e.target.value })}>{['PRESENT', 'ABSENT', 'HALF_DAY', 'WORK_FROM_HOME', 'ON_LEAVE'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</NativeSelect></Field>
            <Field label="In time"><Input type="time" value={m.inTime} onChange={(e) => setM({ ...m, inTime: e.target.value })} /></Field><Field label="Out time"><Input type="time" value={m.outTime} onChange={(e) => setM({ ...m, outTime: e.target.value })} /></Field></FormGrid>
          <Field label="Remarks"><Textarea rows={2} value={m.remarks} onChange={(e) => setM({ ...m, remarks: e.target.value })} /></Field>
          <Button type="submit" disabled={mark.isPending || !m.employeeId}>Save</Button>
        </form>
      </CardContent></Card>
      <div className="space-y-6">
        <Card><CardHeader><CardTitle>Bulk import (CSV)</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-fine text-muted-foreground">Columns: <code>employeeCode,date,status,inTime,outTime</code> (times HH:MM in IST)</p>
          <Textarea rows={5} className="font-mono text-fine" value={csv} onChange={(e) => setCsv(e.target.value)} aria-label="CSV" placeholder={'employeeCode,date,status,inTime,outTime\nEMP005,2026-09-18,PRESENT,09:30,18:30'} />
          <Button disabled={csv.length < 10 || imp.isPending} onClick={() => imp.mutate(csv, { onSuccess: (r) => toast.success(`${r.imported} imported${r.failed ? `, ${r.failed} failed: ${r.errors[0]?.error}` : ''}`) })}>Import</Button>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Period tools</CardTitle></CardHeader><CardContent className="space-y-3">
          <FormGrid><Field label="From"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field><Field label="To"><Input type="date" min={range.from} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field></FormGrid>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={process.isPending} onClick={() => process.mutate(range)}>Re-process punches</Button><Button variant="outline" disabled={absent.isPending} onClick={() => absent.mutate(range)}>Mark unmarked days absent</Button></div>
          <p className="text-fine text-muted-foreground">“Mark unmarked days absent” creates ABSENT for working days with no punch, leave or record: run before payroll if you want unmarked days treated as loss of pay.</p>
        </CardContent></Card>
      </div>
    </div>
  );
}
