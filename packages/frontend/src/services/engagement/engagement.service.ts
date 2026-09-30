import { del, get, patch, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { Ok } from '@/types/common';
import type { Announcement, AppNotification, NotificationList, Policy, PolicyAck } from '@/types/engagement';

export const engagementService = {
  announcements: () => get<Announcement[]>(E.engagement.announcements),
  createAnnouncement: (d: { title: string; body: string; pinned?: boolean }) => post<Announcement>(E.engagement.announcements, d),
  deleteAnnouncement: (id: string) => del<Ok>(E.engagement.announcement(id)),
  policies: () => get<Policy[]>(E.engagement.policies),
  createPolicy: (d: { title: string; category?: string; content: string }) => post<Policy>(E.engagement.policies, d),
  updatePolicy: (id: string, d: Partial<Policy>) => patch<Policy>(E.engagement.policy(id), d),
  acknowledge: (id: string) => post<Ok>(E.engagement.ack(id)),
  acknowledgements: (id: string) => get<PolicyAck[]>(E.engagement.acks(id)),
  notifications: () => get<NotificationList>(E.notifications.list),
  markAllRead: () => post<Ok>(E.notifications.readAll),
  markRead: (id: string) => patch<Ok>(E.notifications.read(id)),
};
export type { AppNotification };
