import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class GoogleIdModule extends NativeModule {
  /** Shows Android's "Sign in with Google" sheet; resolves with an ID token issued for `webClientId`. */
  signIn(webClientId: string, hashedNonce: string): Promise<{ idToken: string; email: string; name: string | null }>;
}

/** Null where the native module is not built in (the web preview, iPhone for now). */
export default requireOptionalNativeModule<GoogleIdModule>('GoogleId');
