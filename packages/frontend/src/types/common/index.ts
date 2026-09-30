export interface Paginated<T> { items: T[]; total: number; page: number; limit: number; totalPages: number }
export interface Ok { ok: boolean }
export type Id = string;
export interface Option { value: string; label: string }
