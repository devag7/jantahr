'use client';
import { useMutation } from '@tanstack/react-query';
import { contactService } from '@/services/contact/contact.service';
import type { ContactMessage } from '@/types/contact';

/** Sends a contact-form message; the form shows errors inline, so there is no toast. */
export const useSendContact = () => useMutation<{ ok: true }, Error, ContactMessage>({ mutationFn: contactService.send });
