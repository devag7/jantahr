'use client';
import * as React from 'react';
import { hraMetros, taxForms } from '@/lib/india';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, FormGrid } from '@/components/common/field';
import { PageHeader } from '@/components/common/page-header';
import { ErrorState, LoadingBlock, QueryBoundary, Spinner } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { RegimeComparison } from '@/components/payroll/regime-comparison';
import { useMyDeclaration, useSaveDeclaration, useTaxCategories, useTaxComparison } from '@/hooks/payroll/use-payroll';
import { formatINR } from '@/lib/format';
import type { Declaration, TaxRegime } from '@/types/payroll';

function DeclarationForm({ fy, existing }: { fy: number; existing: Declaration | null }) {
  const cats = useTaxCategories();
  const save = useSaveDeclaration();
  const [regime, setRegime] = React.useState<TaxRegime>(existing?.taxRegime ?? 'NEW');
  const [rent, setRent] = React.useState(String(existing?.monthlyRent ?? 0));
  const [metro, setMetro] = React.useState(existing?.rentedInMetro ?? false);
  const [children, setChildren] = React.useState(String(existing?.childrenCount ?? 0));
  const [amounts, setAmounts] = React.useState<Record<string, string>>(() => Object.fromEntries((existing?.details ?? []).map((d) => [d.subCategoryId, String(d.declaredAmount)])));
  const locked = existing?.status === 'APPROVED';

  if (cats.isLoading) return <LoadingBlock />;
  if (cats.error) return <ErrorState error={cats.error} onRetry={() => cats.refetch()} />;
  const total = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const submit = (draft: boolean) => save.mutate({
    fyStartYear: fy, taxRegime: regime, monthlyRent: Number(rent) || 0, rentedInMetro: metro, childrenCount: Number(children) || 0, submit: !draft,
    details: Object.entries(amounts).filter(([, v]) => Number(v) > 0).map(([subCategoryId, v]) => ({ subCategoryId, declaredAmount: Number(v) })),
  }, { onSuccess: () => undefined });

  return (
    <div className="space-y-6">
      {existing && <div className="flex items-center gap-2 text-caption"><span className="text-muted-foreground">Status:</span><StatusBadge status={existing.isSubmitted ? existing.status : 'DRAFT'} label={existing.isSubmitted ? undefined : 'Draft'} />{locked && <span className="flex items-center gap-1 text-fine text-muted-foreground"><Lock className="h-3 w-3" />Locked by HR: contact HR to reopen</span>}</div>}
      <Card><CardHeader><CardTitle>Tax regime</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
        {([['NEW', 'New regime', 'Lower slab rates, ₹75,000 standard deduction, no investment deductions. Nil tax up to ₹12.75 L salary.'], ['OLD', 'Old regime', 'Higher rates but you can claim 80C, 80D, HRA, home-loan interest and more.']] as const).map(([v, t, d]) => (
          <label key={v} className={`cursor-pointer rounded-md border p-4 ${regime === v ? 'border-primary bg-accent' : ''} ${locked ? 'opacity-60' : ''}`}>
            <input type="radio" name="regime" className="sr-only" checked={regime === v} disabled={locked} onChange={() => setRegime(v)} /><p className="font-semibold">{t}</p><p className="mt-1 text-fine text-muted-foreground">{d}</p>
          </label>
        ))}
      </CardContent></Card>

      {regime === 'OLD' && (
        <>
          <Card><CardHeader><CardTitle>House rent (HRA exemption)</CardTitle></CardHeader><CardContent>
            <FormGrid><Field label="Monthly rent paid (₹)" htmlFor="rent" hint="Landlord PAN is required if annual rent exceeds ₹1 lakh"><Input id="rent" type="number" min="0" disabled={locked} value={rent} onChange={(e) => setRent(e.target.value)} /></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-caption"><Checkbox checked={metro} disabled={locked} onCheckedChange={setMetro} />Rented home is in {hraMetros(fy)} (50% HRA limit)</label></FormGrid>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Children</CardTitle></CardHeader><CardContent>
            <FormGrid><Field label="Number of children" htmlFor="kids" hint="Education (₹3,000) and hostel (₹9,000) allowance exemptions per child per month, for up to two children, if your salary has these components."><Input id="kids" type="number" min="0" max="10" disabled={locked} value={children} onChange={(e) => setChildren(e.target.value)} /></Field></FormGrid>
          </CardContent></Card>
          {cats.data?.map((c) => (
            <Card key={c.id}><CardHeader><CardTitle>{c.name}<span className="ml-2 text-fine font-normal text-muted-foreground">limit {formatINR(c.maxAmount)}</span></CardTitle></CardHeader><CardContent>
              <FormGrid>{c.subCategories.map((s) => <Field key={s.id} label={s.name} htmlFor={s.id} hint={`Max ${formatINR(s.maxAmount)}`}><Input id={s.id} type="number" min="0" max={s.maxAmount} disabled={locked} value={amounts[s.id] ?? ''} onChange={(e) => setAmounts({ ...amounts, [s.id]: e.target.value })} placeholder="0" /></Field>)}</FormGrid>
            </CardContent></Card>
          ))}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-4">
        <p className="text-caption">{regime === 'OLD' ? <>Total declared: <b className="tabular-nums">{formatINR(total)}</b></> : 'The new regime needs no declaration.'}</p>
        <div className="flex gap-2"><Button variant="outline" disabled={locked || save.isPending} onClick={() => submit(true)}>Save draft</Button><Button disabled={locked || save.isPending} onClick={() => submit(false)}>{save.isPending && <Spinner className="mr-2" />}Submit to HR</Button></div>
      </div>
    </div>
  );
}

export default function TaxPage() {
  const decl = useMyDeclaration();
  const compare = useTaxComparison();
  return (
    <>
      <PageHeader title="Tax & investments" description="Declare investments so TDS is projected correctly, and compare tax regimes." />
      <Tabs defaultValue="declaration">
        <TabsList><TabsTrigger value="declaration">Investment declaration</TabsTrigger><TabsTrigger value="compare">Regime comparison</TabsTrigger></TabsList>
        <TabsContent value="declaration" className="mt-4">
          <QueryBoundary query={decl}>{(d) => <><p className="mb-4 text-caption text-muted-foreground">{taxForms(d.fyStartYear).yearLabel} {d.fyStartYear}-{String(d.fyStartYear + 1).slice(2)}</p><DeclarationForm key={d.declaration?.id ?? 'new'} fy={d.fyStartYear} existing={d.declaration} /></>}</QueryBoundary>
        </TabsContent>
        <TabsContent value="compare" className="mt-4"><QueryBoundary query={compare}>{(d) => <RegimeComparison data={d} />}</QueryBoundary></TabsContent>
      </Tabs>
    </>
  );
}
