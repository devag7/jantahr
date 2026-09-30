'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormGrid } from '@/components/common/field';
import { Spinner } from '@/components/common/states';
import { useAuth } from '@/hooks/auth/use-auth';
import { useDepartments, useDesignations, useStates } from '@/hooks/org/use-org';
import { useEmployees } from '@/hooks/employees/use-employees';
import { EMPLOYMENT_TYPES, INDIAN_STATES } from '@/lib/india';
import { todayISO } from '@/lib/format';
import type { Role } from '@/types/auth';
import type { Employee, EmployeeInput, Gender } from '@/types/employees';

const ROLES: { value: Role; label: string }[] = [
  { value: 'EMPLOYEE', label: 'Employee' }, { value: 'MANAGER', label: 'Manager' }, { value: 'PAYROLL_ADMIN', label: 'Payroll admin' }, { value: 'AUDITOR', label: 'Auditor (read-only)' },
  { value: 'HR_ADMIN', label: 'HR admin' }, { value: 'SUPER_ADMIN', label: 'Super admin' },
];

type FormState = Record<string, string> & { pfApplicable: string; esiApplicable: string; ptApplicable: string };
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function initialState(e?: Employee): FormState {
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));
  return {
    firstName: s(e?.firstName), middleName: s(e?.middleName), lastName: s(e?.lastName), email: s(e?.email), phone: s(e?.phone), gender: s(e?.gender) || 'MALE', dateOfBirth: s(e?.dateOfBirth).slice(0, 10), maritalStatus: s(e?.maritalStatus) || 'SINGLE',
    dateOfJoining: s(e?.dateOfJoining).slice(0, 10) || todayISO(), employmentType: s(e?.employmentType) || 'Full-time', departmentId: s(e?.departmentId), designationId: s(e?.designationId), reportingManagerId: s(e?.reportingManagerId),
    workLocation: s(e?.workLocation), state: s(e?.state) || 'Maharashtra', city: s(e?.city), currentAddress: s(e?.currentAddress), noticeperiodDays: s(e?.noticeperiodDays ?? 60),
    panNumber: s(e?.panNumber).includes('*') ? '' : s(e?.panNumber), aadhaarNumber: s(e?.aadhaarNumber).includes('*') ? '' : s(e?.aadhaarNumber), uanNumber: s(e?.uanNumber), bankName: s(e?.bankName),
    bankAccountNumber: s(e?.bankAccountNumber).includes('*') ? '' : s(e?.bankAccountNumber), ifscCode: s(e?.ifscCode), professionalTaxState: s(e?.professionalTaxState) || s(e?.state) || 'Maharashtra', ctc: s(e?.ctc), role: s(e?.user?.role) || 'EMPLOYEE',
    pfApplicable: String(e?.pfApplicable ?? true), esiApplicable: String(e?.esiApplicable ?? true), ptApplicable: String(e?.ptApplicable ?? true),
  };
}

export function EmployeeForm({ initial, mode, submitting, onSubmit, onCancel }: { initial?: Employee; mode: 'create' | 'edit'; submitting: boolean; onSubmit: (d: EmployeeInput) => void; onCancel: () => void }) {
  const { user } = useAuth();
  const depts = useDepartments();
  const desigs = useDesignations();
  const states = useStates();
  const managers = useEmployees({ limit: 200, status: 'ACTIVE' });
  const [f, setF] = React.useState<FormState>(() => initialState(initial));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const canGrantAdmin = user?.role === 'SUPER_ADMIN';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.panNumber && !PAN.test(f.panNumber.toUpperCase())) errs.panNumber = 'PAN looks like ABCDE1234F';
    if (f.aadhaarNumber && !/^\d{12}$/.test(f.aadhaarNumber.replace(/\s/g, ''))) errs.aadhaarNumber = 'Aadhaar must be 12 digits';
    if (f.ifscCode && !IFSC.test(f.ifscCode.toUpperCase())) errs.ifscCode = 'IFSC looks like HDFC0001234';
    if (f.bankAccountNumber && !/^\d{6,20}$/.test(f.bankAccountNumber)) errs.bankAccountNumber = 'Digits only (6-20)';
    if (f.phone && !/^\+?\d{10,13}$/.test(f.phone.replace(/\s/g, ''))) errs.phone = 'Enter a valid mobile number';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const opt = (v: string) => (v.trim() === '' ? undefined : v.trim());
    const data: EmployeeInput = {
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), middleName: opt(f.middleName), email: f.email.trim(), phone: opt(f.phone), gender: f.gender as Gender, dateOfBirth: opt(f.dateOfBirth), maritalStatus: f.maritalStatus,
      dateOfJoining: f.dateOfJoining, employmentType: f.employmentType, departmentId: opt(f.departmentId), designationId: opt(f.designationId), reportingManagerId: opt(f.reportingManagerId), workLocation: opt(f.workLocation),
      state: opt(f.state), city: opt(f.city), currentAddress: opt(f.currentAddress), noticeperiodDays: f.noticeperiodDays ? Number(f.noticeperiodDays) : undefined,
      panNumber: opt(f.panNumber)?.toUpperCase(), aadhaarNumber: opt(f.aadhaarNumber)?.replace(/\s/g, ''), uanNumber: opt(f.uanNumber), bankName: opt(f.bankName), bankAccountNumber: opt(f.bankAccountNumber), ifscCode: opt(f.ifscCode)?.toUpperCase(),
      professionalTaxState: opt(f.professionalTaxState), ctc: f.ctc ? Number(f.ctc) : undefined, role: f.role as Role,
      pfApplicable: f.pfApplicable === 'true', esiApplicable: f.esiApplicable === 'true', ptApplicable: f.ptApplicable === 'true',
    };
    onSubmit(data);
  };

  const stateList = states.data ?? INDIAN_STATES;
  return (
    <form onSubmit={submit} className="space-y-6">
      <Card><CardHeader><CardTitle>Personal details</CardTitle></CardHeader><CardContent><FormGrid cols={3}>
        <Field label="First name" htmlFor="fn" required><Input id="fn" required value={f.firstName} onChange={set('firstName')} /></Field>
        <Field label="Middle name" htmlFor="mn"><Input id="mn" value={f.middleName} onChange={set('middleName')} /></Field>
        <Field label="Last name" htmlFor="ln" required><Input id="ln" required value={f.lastName} onChange={set('lastName')} /></Field>
        <Field label="Work email" htmlFor="em" required><Input id="em" type="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Mobile" htmlFor="ph" error={errors.phone}><Input id="ph" value={f.phone} onChange={set('phone')} placeholder="9876543210" /></Field>
        <Field label="Gender" htmlFor="ge" required><NativeSelect id="ge" value={f.gender} onChange={set('gender')}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></NativeSelect></Field>
        <Field label="Date of birth" htmlFor="dob"><Input id="dob" type="date" max={todayISO()} value={f.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
        <Field label="Marital status" htmlFor="ms"><NativeSelect id="ms" value={f.maritalStatus} onChange={set('maritalStatus')}>{['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'].map((m) => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}</NativeSelect></Field>
        <Field label="City" htmlFor="ci"><Input id="ci" value={f.city} onChange={set('city')} /></Field>
        <Field label="State" htmlFor="st"><NativeSelect id="st" value={f.state} onChange={set('state')}>{stateList.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
        <Field label="Current address" htmlFor="ad" className="sm:col-span-2"><Textarea id="ad" rows={2} value={f.currentAddress} onChange={set('currentAddress')} /></Field>
      </FormGrid></CardContent></Card>

      <Card><CardHeader><CardTitle>Employment</CardTitle></CardHeader><CardContent><FormGrid cols={3}>
        <Field label="Date of joining" htmlFor="doj" required><Input id="doj" type="date" required value={f.dateOfJoining} onChange={set('dateOfJoining')} /></Field>
        <Field label="Department" htmlFor="de"><NativeSelect id="de" value={f.departmentId} onChange={set('departmentId')}><option value="">-</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect></Field>
        <Field label="Designation" htmlFor="dg"><NativeSelect id="dg" value={f.designationId} onChange={set('designationId')}><option value="">-</option>{desigs.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect></Field>
        <Field label="Reporting manager" htmlFor="rm"><NativeSelect id="rm" value={f.reportingManagerId} onChange={set('reportingManagerId')}><option value="">-</option>{managers.data?.items.filter((m) => m.id !== initial?.id).map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.employeeCode})</option>)}</NativeSelect></Field>
        <Field label="Employment type" htmlFor="et"><NativeSelect id="et" value={f.employmentType} onChange={set('employmentType')}>{EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Field>
        <Field label="Work location" htmlFor="wl"><Input id="wl" value={f.workLocation} onChange={set('workLocation')} /></Field>
        <Field label="Notice period (days)" htmlFor="np"><Input id="np" type="number" min="0" value={f.noticeperiodDays} onChange={set('noticeperiodDays')} /></Field>
        <Field label="System role" htmlFor="ro" hint="Controls what this person can see and do"><NativeSelect id="ro" value={f.role} onChange={set('role')}>{ROLES.filter((r) => canGrantAdmin || !['HR_ADMIN', 'SUPER_ADMIN'].includes(r.value)).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</NativeSelect></Field>
        <Field label="Annual CTC (₹)" htmlFor="ctc" hint="Assign a salary structure separately in Payroll → Salary setup"><Input id="ctc" type="number" min="0" value={f.ctc} onChange={set('ctc')} /></Field>
      </FormGrid></CardContent></Card>

      <Card><CardHeader><CardTitle>Statutory & bank <span className="ml-2 text-fine font-normal text-muted-foreground">encrypted at rest</span></CardTitle></CardHeader><CardContent><FormGrid cols={3}>
        <Field label="PAN" htmlFor="pan" error={errors.panNumber} hint={mode === 'edit' && initial?.panNumber ? 'Leave blank to keep the current value' : undefined}><Input id="pan" value={f.panNumber} onChange={set('panNumber')} placeholder="ABCDE1234F" maxLength={10} className="uppercase" /></Field>
        <Field label="Aadhaar" htmlFor="aa" error={errors.aadhaarNumber} hint={mode === 'edit' && initial?.aadhaarNumber ? 'Leave blank to keep the current value' : undefined}><Input id="aa" value={f.aadhaarNumber} onChange={set('aadhaarNumber')} placeholder="12-digit number" maxLength={14} /></Field>
        <Field label="UAN (PF)" htmlFor="ua"><Input id="ua" value={f.uanNumber} onChange={set('uanNumber')} /></Field>
        <Field label="Bank name" htmlFor="bn"><Input id="bn" value={f.bankName} onChange={set('bankName')} /></Field>
        <Field label="Account number" htmlFor="ac" error={errors.bankAccountNumber} hint={mode === 'edit' && initial?.bankAccountNumber ? 'Leave blank to keep the current value' : undefined}><Input id="ac" value={f.bankAccountNumber} onChange={set('bankAccountNumber')} /></Field>
        <Field label="IFSC" htmlFor="if" error={errors.ifscCode}><Input id="if" value={f.ifscCode} onChange={set('ifscCode')} placeholder="HDFC0001234" maxLength={11} className="uppercase" /></Field>
        <Field label="Professional tax state" htmlFor="pts"><NativeSelect id="pts" value={f.professionalTaxState} onChange={set('professionalTaxState')}>{stateList.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pb-2 sm:col-span-2">
          {([['pfApplicable', 'PF applies'], ['esiApplicable', 'ESI applies'], ['ptApplicable', 'Professional tax applies']] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-caption"><Checkbox checked={f[k] === 'true'} onCheckedChange={(c) => setF({ ...f, [k]: String(c) })} />{l}</label>)}
        </div>
      </FormGrid></CardContent></Card>

      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting && <Spinner className="mr-2" />}{mode === 'create' ? 'Create employee' : 'Save changes'}</Button></div>
    </form>
  );
}
