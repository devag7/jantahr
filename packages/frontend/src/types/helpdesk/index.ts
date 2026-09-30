export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export interface TicketComment { id: string; authorName: string; message: string; createdAt: string }
export interface Ticket { id: string; subject: string; description: string; category: string; priority: TicketPriority; status: TicketStatus; resolution: string | null; createdAt: string; employee: { firstName: string; lastName: string; employeeCode: string }; comments?: TicketComment[]; _count?: { comments: number } }
export interface TicketInput { subject: string; description: string; category?: string; priority?: TicketPriority }
