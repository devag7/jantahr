'use client';
import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Field, FormGrid } from '@/components/common/field';
import { Spinner } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useSendContact } from '@/hooks/contact/use-contact';
import type { ContactTopic } from '@/types/contact';
import { MESSAGE_MAX, TOPICS, checkContact, type ContactErrors, type ContactFields } from './contact-form.rules';

const EMPTY: ContactFields = { name: '', email: '', company: '', phone: '', topic: '', message: '' };

/**
 * Public contact form: labels above, hints and errors below each field, checked on submit and then as the person
 * corrects it. The message is mailed to the business's support address with Reply-To set to the sender.
 */
export function ContactForm({ email }: { email: string }) {
  const [f, setF] = React.useState<ContactFields>(EMPTY);
  const [errors, setErrors] = React.useState<ContactErrors>({});
  const [checked, setChecked] = React.useState(false);
  const honeypot = React.useRef<HTMLInputElement>(null);
  const send = useSendContact();

  const set = (key: keyof ContactFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const next = { ...f, [key]: e.target.value };
    setF(next);
    if (checked) setErrors(checkContact(next));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = checkContact(f);
    setChecked(true);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) { document.getElementById(`contact-${first}`)?.focus(); return; }
    send.mutate({ ...f, topic: f.topic as ContactTopic, website: honeypot.current?.value ?? '' });
  };

  if (send.isSuccess) {
    return (
      <div role="status" className="rounded-lg border bg-card p-6 sm:p-8">
        <CheckCircle2 className="h-6 w-6 text-success" aria-hidden />
        <p className="mt-3 text-body-strong">Thanks, {f.name.trim().split(/\s+/)[0]}. Your message is with us.</p>
        <p className="mt-2 text-body text-secondary-foreground">We reply within 2 working days, to {f.email.trim()}.</p>
        <Button variant="outline" className="mt-6" onClick={() => { send.reset(); setF(EMPTY); setChecked(false); setErrors({}); }}>Send another message</Button>
      </div>
    );
  }

  const describedBy = (key: keyof ContactFields, hint?: boolean) => (errors[key] ? `contact-${key}-error` : hint ? `contact-${key}-hint` : undefined);
  return (
    <form noValidate onSubmit={onSubmit} aria-label="Contact form" className="rounded-lg border bg-card p-6 sm:p-8">
      <div className="space-y-5">
        <FormGrid>
          <Field label="Name" htmlFor="contact-name" required error={errors.name} errorId="contact-name-error">
            <Input id="contact-name" name="name" autoComplete="name" value={f.name} onChange={set('name')} aria-invalid={!!errors.name} aria-describedby={describedBy('name')} aria-required />
          </Field>
          <Field label="Work email" htmlFor="contact-email" required error={errors.email} errorId="contact-email-error" hint="We reply to this address." hintId="contact-email-hint">
            <Input id="contact-email" name="email" type="email" autoComplete="email" inputMode="email" value={f.email} onChange={set('email')} aria-invalid={!!errors.email} aria-describedby={describedBy('email', true)} aria-required />
          </Field>
          <Field label="Company" htmlFor="contact-company" error={errors.company} errorId="contact-company-error" hint="Optional" hintId="contact-company-hint">
            <Input id="contact-company" name="company" autoComplete="organization" value={f.company} onChange={set('company')} aria-invalid={!!errors.company} aria-describedby={describedBy('company', true)} />
          </Field>
          <Field label="Phone" htmlFor="contact-phone" error={errors.phone} errorId="contact-phone-error" hint="Optional, if you would like a call back" hintId="contact-phone-hint">
            <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={set('phone')} aria-invalid={!!errors.phone} aria-describedby={describedBy('phone', true)} />
          </Field>
        </FormGrid>
        <Field label="What is it about?" htmlFor="contact-topic" required error={errors.topic} errorId="contact-topic-error">
          <NativeSelect id="contact-topic" name="topic" value={f.topic} onChange={set('topic')} aria-invalid={!!errors.topic} aria-describedby={describedBy('topic')} aria-required>
            <option value="" disabled>Choose a topic</option>
            {TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Message" htmlFor="contact-message" required error={errors.message} errorId="contact-message-error"
          hint={`For billing, include the invoice number shown under Billing. ${f.message.length.toLocaleString('en-IN')} of ${MESSAGE_MAX.toLocaleString('en-IN')} characters.`} hintId="contact-message-hint">
          <Textarea id="contact-message" name="message" rows={6} maxLength={MESSAGE_MAX} value={f.message} onChange={set('message')} aria-invalid={!!errors.message} aria-describedby={describedBy('message', true)} aria-required />
        </Field>
        {/* honeypot: hidden from people and assistive technology; a bot that fills it is accepted and ignored */}
        <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="contact-website">Website</label>
          <input ref={honeypot} id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>
      </div>
      {send.isError && (
        <p role="alert" className="mt-5 rounded-lg border bg-muted px-4 py-3 text-caption">
          {send.error.message} You can also write to <a className="text-primary underline underline-offset-2" href={`mailto:${email}`}>{email}</a>.
        </p>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-fine text-muted-foreground">We use these details only to reply to you. See the <a className="text-primary underline underline-offset-2" href="/legal/privacy">privacy notice</a>.</p>
        <Button type="submit" disabled={send.isPending} aria-disabled={send.isPending} className="shrink-0">
          {send.isPending && <Spinner className="mr-2" />}{send.isPending ? 'Sending' : 'Send message'}
        </Button>
      </div>
    </form>
  );
}
