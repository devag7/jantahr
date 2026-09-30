export interface ChatReply { reply: string; intent: string; links?: { label: string; href: string }[]; suggestions?: string[] }
export interface ChatMessage { role: 'user' | 'assistant'; text: string; links?: { label: string; href: string }[]; suggestions?: string[] }
export interface Anomaly { type: string; severity: 'high' | 'medium' | 'low'; employee: string; employeeCode: string; detail: string }
export interface AnomalyResult { windowDays: number; method: string; count: number; findings: Anomaly[] }
export interface AttritionEmployee { employeeId: string; employeeCode: string; name: string; department: string | null; designation: string | null; score: number; risk: 'LOW' | 'MEDIUM' | 'HIGH'; factors: { factor: string; points: number }[] }
export interface AttritionResult { method: string; summary: { high: number; medium: number; low: number }; employees: AttritionEmployee[] }
