export type ContactTopic = 'sales' | 'billing' | 'support' | 'privacy' | 'other';
export interface ContactMessage { name: string; email: string; company: string; phone: string; topic: ContactTopic; message: string; website: string }
