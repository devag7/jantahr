/** Build-time edition for the web app (NEXT_PUBLIC_EDITION). The API's /meta/runtime is the runtime source of truth. */
export const WEB_EDITION: 'self_hosted' | 'cloud' = process.env.NEXT_PUBLIC_EDITION === 'cloud' ? 'cloud' : 'self_hosted';
export const isCloudWeb = WEB_EDITION === 'cloud';
export const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || 'sales@jantahr.in';
