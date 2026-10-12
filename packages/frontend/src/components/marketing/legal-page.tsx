import { MarketingNav } from '@/components/marketing/marketing-nav';
import { LEGAL_UPDATED } from '@/lib/operator';

/** Shared layout for the policy pages: title, last-updated line, headed sections, optional closing block. */
export function LegalPage({ title, nav, intro, sections, children, dated = true }: {
  title: string; nav?: string; intro?: string; sections: [string, React.ReactNode][]; children?: React.ReactNode; dated?: boolean;
}) {
  return (
    <>
      <MarketingNav title={nav ?? title} />
      <main className="bg-background px-4 py-16">
        <article className="mx-auto max-w-[760px]">
          <h1 className="text-title font-semibold">{title}</h1>
          {dated && <p className="mt-2 text-caption text-muted-foreground">Last updated {LEGAL_UPDATED}.</p>}
          {intro && <p className="mt-6 text-body text-secondary-foreground">{intro}</p>}
          {sections.map(([heading, body]) => (
            <section key={heading} className="mt-10">
              <h2 className="text-tagline font-semibold">{heading}</h2>
              <div className="mt-3 text-body text-secondary-foreground">{body}</div>
            </section>
          ))}
          {children}
        </article>
      </main>
    </>
  );
}

/** "Write to us" line used at the end of each policy. */
export function ContactLine({ email }: { email: string }) {
  return <p className="mt-10 text-body">Questions: <a className="text-primary hover:underline" href={`mailto:${email}`}>{email}</a>, or see <a className="text-primary hover:underline" href="/contact">Contact us</a>.</p>;
}
