/** Loads Razorpay Checkout on demand (only when a paying admin opens it). */
declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

export function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser only'));
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    document.body.appendChild(s);
  });
}

export interface RazorpaySuccess { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }

export async function openRazorpay(p: { key: string; subscriptionId: string; name: string; email: string; description: string }): Promise<RazorpaySuccess> {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: p.key, subscription_id: p.subscriptionId, name: 'JantaHR', description: p.description,
      prefill: { name: p.name, email: p.email }, theme: { color: '#0066cc' },
      handler: (r: RazorpaySuccess) => resolve(r),
      // Razorpay keeps its window open after a failed attempt so the customer can retry with another card; settle
      // only when it closes, and then say why the last attempt failed rather than just "cancelled".
      modal: { ondismiss: () => reject(new Error(lastFailure ? `Payment failed: ${lastFailure}` : 'Payment was cancelled')) },
    });
    let lastFailure = '';
    rz.on('payment.failed', (r: unknown) => { lastFailure = (r as { error?: { description?: string } })?.error?.description || 'the card was declined'; });
    rz.open();
  });
}
