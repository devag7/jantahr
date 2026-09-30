/**
 * Two editions ship from one codebase:
 *  - self_hosted (default): runs on your own infrastructure (Docker / Supabase self-hosted). Every feature, no seat limit, no billing.
 *  - cloud: the hosted service. Plans, seats and payments apply.
 */
export type Edition = 'self_hosted' | 'cloud';
export const edition = (): Edition => (process.env.EDITION === 'cloud' ? 'cloud' : 'self_hosted');
export const isCloud = () => edition() === 'cloud';
