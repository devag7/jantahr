/**
 * The message of anything thrown. Nest HTTP exceptions carry the client-facing text in `response.message` (a string,
 * or the list of validation messages); library errors are not always Error instances.
 */
export function errorMessage(e: unknown): string {
  if (typeof e === 'object' && e) {
    const response = (e as { response?: { message?: unknown } }).response;
    if (typeof response?.message === 'string') return response.message;
    if (Array.isArray(response?.message)) return response.message.join('. ');
    if (typeof (e as { message?: unknown }).message === 'string') return (e as { message: string }).message;
  }
  return String(e);
}
