'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { helpdeskService } from '@/services/helpdesk/helpdesk.service';
import type { TicketPriority, TicketStatus } from '@/types/helpdesk';

const HD = [['helpdesk'], ['reports']] as const;
export const useTicketCategories = () => useQuery({ queryKey: ['helpdesk', 'categories'], queryFn: helpdeskService.categories, staleTime: Infinity });
export const useTickets = (scope: 'mine' | 'all', status?: string) => useQuery({ queryKey: ['helpdesk', 'tickets', scope, status], queryFn: () => helpdeskService.list(scope, status) });
export const useTicket = (id?: string) => useQuery({ queryKey: ['helpdesk', 'ticket', id], queryFn: () => helpdeskService.one(id!), enabled: !!id });
export const useCreateTicket = () => useApiMutation(helpdeskService.create, { invalidate: [...HD], success: 'Ticket raised: HR will get back to you' });
export const useCommentTicket = () => useApiMutation((v: { id: string; message: string }) => helpdeskService.comment(v.id, v.message), { invalidate: [...HD] });
export const useUpdateTicket = () => useApiMutation((v: { id: string; status?: TicketStatus; priority?: TicketPriority; resolution?: string }) => helpdeskService.update(v.id, v), { invalidate: [...HD], success: 'Ticket updated' });
