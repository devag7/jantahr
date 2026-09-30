import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** A valid Supabase session is enough: the route runs before a JantaHR account exists (company sign-up). */
export const SIGNED_IN_ONLY_KEY = 'signedInOnly';
export const SignedInOnly = () => SetMetadata(SIGNED_IN_ONLY_KEY, true);
