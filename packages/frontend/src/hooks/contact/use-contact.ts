'use client';
import * as React from 'react';
import { contactService } from '@/services/contact/contact.service';
import type { ContactMessage } from '@/types/contact';

type State = { status: 'idle' | 'pending' | 'success' | 'error'; error: Error | null };

/**
 * Sends a contact-form message. Plain React state rather than React Query: the marketing pages do not load the
 * app's providers, and one request with an inline result needs no cache.
 */
export function useSendContact() {
  const [state, setState] = React.useState<State>({ status: 'idle', error: null });
  const mutate = React.useCallback((body: ContactMessage) => {
    setState({ status: 'pending', error: null });
    contactService.send(body).then(
      () => setState({ status: 'success', error: null }),
      (error: unknown) => setState({ status: 'error', error: error instanceof Error ? error : new Error('Your message could not be sent. Please try again.') }),
    );
  }, []);
  return {
    mutate,
    reset: () => setState({ status: 'idle', error: null }),
    isPending: state.status === 'pending', isSuccess: state.status === 'success', isError: state.status === 'error', error: state.error ?? new Error(''),
  };
}
