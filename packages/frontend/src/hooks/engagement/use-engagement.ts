'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { NOTIFICATION_POLL_MS } from '@/lib/constants';
import { engagementService } from '@/services/engagement/engagement.service';
import type { Policy } from '@/types/engagement';

/** Polls every NOTIFICATION_POLL_MS; with a live Realtime channel it only re-checks every 5 minutes as a safety net. */
export const useNotifications = (enabled: boolean, live = false) => useQuery({ queryKey: ['notifications'], queryFn: engagementService.notifications, refetchInterval: live ? 300_000 : NOTIFICATION_POLL_MS, enabled });
export const useAnnouncements = () => useQuery({ queryKey: ['engagement', 'announcements'], queryFn: engagementService.announcements });
export const usePolicies = () => useQuery({ queryKey: ['engagement', 'policies'], queryFn: engagementService.policies });
export const usePolicyAcks = (id?: string) => useQuery({ queryKey: ['engagement', 'acks', id], queryFn: () => engagementService.acknowledgements(id!), enabled: !!id });

export const useMarkAllRead = () => useApiMutation(() => engagementService.markAllRead(), { invalidate: [['notifications']] });
export const useMarkRead = () => useApiMutation(engagementService.markRead, { invalidate: [['notifications']], silentError: true });
export const useCreateAnnouncement = () => useApiMutation(engagementService.createAnnouncement, { invalidate: [['engagement'], ['reports']], success: 'Announcement published' });
export const useDeleteAnnouncement = () => useApiMutation(engagementService.deleteAnnouncement, { invalidate: [['engagement'], ['reports']], success: 'Announcement removed' });
export const useCreatePolicy = () => useApiMutation(engagementService.createPolicy, { invalidate: [['engagement']], success: 'Policy published' });
export const useUpdatePolicy = () => useApiMutation((v: { id: string; data: Partial<Policy> }) => engagementService.updatePolicy(v.id, v.data), { invalidate: [['engagement']], success: 'Policy updated' });
export const useAcknowledgePolicy = () => useApiMutation(engagementService.acknowledge, { invalidate: [['engagement'], ['reports']], success: 'Acknowledged' });
