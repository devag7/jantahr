import type { FAQ } from './faq.constants';

/** Disclosure list of questions (native <details>: keyboard and screen-reader support without script). */
export function Faq({ items }: { items: typeof FAQ }) {
  return (
    <div className="divide-y rounded-lg border bg-card">
      {items.map(({ q, a }) => (
        <details key={q} className="group px-6 py-5 sm:px-8">
          <summary className="flex min-h-[24px] cursor-pointer list-none items-center justify-between gap-6 text-body font-semibold [&::-webkit-details-marker]:hidden">
            {q}<span className="text-primary transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden>+</span>
          </summary>
          <p className="mt-3 text-body text-secondary-foreground">{a}</p>
        </details>
      ))}
    </div>
  );
}
