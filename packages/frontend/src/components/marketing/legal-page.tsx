import { MarketingNav } from '@/components/marketing/marketing-nav';
import { LEGAL_UPDATED } from '@/lib/operator';

/** Links inside running text are underlined: blue alone is not enough against body text (WCAG 1.4.1). */
export const INLINE_LINK = 'text-primary underline underline-offset-2 hover:decoration-2';

/** Long pages get an "On this page" list; short ones read faster without it. */
const TOC_WORDS = 1500;
const words = (node: React.ReactNode): number => (typeof node === 'string' ? node.split(/\s+/).filter(Boolean).length : 0);
const slug = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Shared layout for the policy and long-form pages: title, last-updated line, headed sections, optional closing
 * block. The column is 70 characters wide at 17px so lines stay readable (about 68 to 72 characters).
 */
export function LegalPage({ title, nav, intro, sections, children, dated = true }: {
  title: string; nav?: string; intro?: string; sections: [string, React.ReactNode][]; children?: React.ReactNode; dated?: boolean;
}) {
  const long = sections.reduce((n, [, body]) => n + words(body), words(intro)) > TOC_WORDS;
  return (
    <>
      <MarketingNav title={nav ?? title} />
      <main className="bg-background px-4 py-16">
        <article className="mx-auto max-w-[70ch] text-body">
          <h1 className="text-display-sm font-semibold sm:text-title">{title}</h1>
          {dated && <p className="mt-2 text-caption text-muted-foreground">Last updated {LEGAL_UPDATED}.</p>}
          {intro && <p className="mt-6 text-body text-secondary-foreground">{intro}</p>}
          {long && (
            <nav aria-label="On this page" className="mt-8 rounded-lg border bg-card px-6 py-5">
              <p className="text-caption-strong">On this page</p>
              <ol className="mt-2 space-y-1">{sections.map(([heading]) => <li key={heading}><a className={`${INLINE_LINK} text-caption`} href={`#${slug(heading)}`}>{heading}</a></li>)}</ol>
            </nav>
          )}
          {sections.map(([heading, body]) => (
            <section key={heading} id={slug(heading)} aria-labelledby={`${slug(heading)}-title`} className="mt-12 scroll-mt-28 first-of-type:mt-10">
              <h2 id={`${slug(heading)}-title`} className="text-tagline font-semibold">{heading}</h2>
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
  return <p className="mt-12 text-body">Questions: <a className={INLINE_LINK} href={`mailto:${email}`}>{email}</a>, or see <a className={INLINE_LINK} href="/contact">Contact us</a>.</p>;
}
