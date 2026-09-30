'use client';
import * as React from 'react';
import Link from 'next/link';
import { LifeBuoy, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/common/states';
import { useChat } from '@/hooks/ai/use-ai';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/ai';

const STARTERS = ['What is my leave balance?', 'Show my latest payslip', 'Upcoming holidays', 'Which tax regime is better for me?'];

export function AssistantWidget() {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([{ role: 'assistant', text: 'Ask about your leave balance, payslips, attendance, holidays, tax or company policies. For anything else, raise a helpdesk ticket.', suggestions: STARTERS }]);
  const chat = useChat();
  const end = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, chat.isPending]);

  const send = (q: string) => {
    const message = q.trim();
    if (!message || chat.isPending) return;
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setText('');
    chat.mutate(message, {
      onSuccess: (r) => setMessages((m) => [...m, { role: 'assistant', text: r.reply, links: r.links, suggestions: r.suggestions }]),
      onError: (e) => setMessages((m) => [...m, { role: 'assistant', text: errorMessage(e) }]),
    });
  };

  return (
    <div className="no-print">
      {open && (
        <div role="dialog" aria-label="Help" className="frosted fixed bottom-16 right-4 z-40 flex h-[30rem] max-h-[70vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <div><p className="text-caption font-semibold">Help</p><p className="text-fine text-muted-foreground">Answers from your records and company policies</p></div>
            <button onClick={() => setOpen(false)} aria-label="Close help" className="rounded-sm p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex flex-col gap-1.5', m.role === 'user' ? 'items-end' : 'items-start')}>
                <p className={cn('max-w-[88%] whitespace-pre-line rounded-lg px-3.5 py-2 text-caption', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{m.text}</p>
                {m.links?.map((l) => <Link key={l.href} href={l.href} className="text-fine font-semibold text-primary hover:underline">{l.label} →</Link>)}
                {m.suggestions && i === messages.length - 1 && (
                  <div className="flex flex-wrap gap-1.5">{m.suggestions.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border bg-card px-3 py-1 text-fine text-primary">{s}</button>)}</div>
                )}
              </div>
            ))}
            {chat.isPending && <div className="flex items-center gap-2 text-fine text-muted-foreground"><Spinner />Looking that up…</div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 border-t p-3">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question" maxLength={500} aria-label="Message" />
            <Button type="submit" size="icon" disabled={!text.trim() || chat.isPending} aria-label="Send"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close help' : 'Open help'} aria-expanded={open}
        className="frosted fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center gap-1.5 rounded-full border text-caption text-foreground transition-transform active:scale-[0.95] sm:h-9 sm:w-auto sm:px-4">
        {/* phones: the 44px round control chip; wider screens add the label */}
        <LifeBuoy className="h-5 w-5 text-primary sm:h-4 sm:w-4" /><span className="sr-only sm:not-sr-only">Help</span>
      </button>
    </div>
  );
}
