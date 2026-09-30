export interface Announcement { id: string; title: string; body: string; pinned: boolean; publishAt: string; expiresAt: string | null }
export interface Policy { id: string; title: string; category: string; content: string; version: number; isActive: boolean; acknowledged: boolean; acknowledgedCount: number; updatedAt: string }
export interface PolicyAck { employeeId: string; employeeCode: string; name: string; acknowledgedAt: string | null }
export interface AppNotification { id: string; title: string; message: string; type: string; link: string | null; isRead: boolean; createdAt: string }
export interface NotificationList { items: AppNotification[]; unreadCount: number }
