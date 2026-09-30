'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Briefcase, MapPin } from 'lucide-react';
import { BrandMark } from '@/components/auth/brand-mark';
import { QueryBoundary } from '@/components/common/states';
import { usePublicCompany } from '@/hooks/recruitment/use-recruitment';
import { formatDate } from '@/lib/format';

export default function CareersPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const q = usePublicCompany(companyId);
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-8"><BrandMark /></div>
      <QueryBoundary query={q} empty={{ when: (d) => d.jobs.length === 0, title: 'No open positions right now', description: 'Please check back soon.' }}>
        {(d) => (
          <>
            <h1 className="text-display-sm font-semibold sm:text-title">Careers at {d.company.name}</h1>
            <p className="mt-2 text-muted-foreground">{d.jobs.length} open position{d.jobs.length > 1 ? 's' : ''}</p>
            <ul className="mt-8 space-y-3">{d.jobs.map((j) => (
              <li key={j.id}><Link href={`/careers/${companyId}/${j.slug}`} className="block rounded-md border bg-card p-5">
                <p className="text-tagline font-semibold">{j.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">{j.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{j.location}</span>}<span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{j.employmentType}{j.experience ? ` · ${j.experience}` : ''}</span>{j.publishedAt && <span>Posted {formatDate(j.publishedAt)}</span>}</p>
                <p className="mt-2 line-clamp-2 text-caption">{j.description}</p></Link></li>
            ))}</ul>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
