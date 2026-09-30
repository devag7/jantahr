import { get, patch, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { Ticket, TicketComment, TicketInput, TicketPriority, TicketStatus } from '@/types/helpdesk';

export const helpdeskService = {
  categories: () => get<string[]>(E.helpdesk.categories),
  list: (scope: 'mine' | 'all', status?: string) => get<Ticket[]>(E.helpdesk.tickets, { scope, status }),
  one: (id: string) => get<Ticket>(E.helpdesk.ticket(id)),
  create: (d: TicketInput) => post<Ticket>(E.helpdesk.tickets, d),
  comment: (id: string, message: string) => post<TicketComment>(E.helpdesk.comments(id), { message }),
  update: (id: string, d: { status?: TicketStatus; priority?: TicketPriority; resolution?: string }) => patch<Ticket>(E.helpdesk.ticket(id), d),
};
