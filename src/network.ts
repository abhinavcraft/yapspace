// A timed-out send is unconfirmed, never assumed unsaved; callers retain its key.
export function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const inherited = init?.signal || (input instanceof Request ? input.signal : undefined);
  const timeout = AbortSignal.timeout(15000);
  return fetch(input, { ...init, signal: inherited ? AbortSignal.any([inherited, timeout]) : timeout });
}
export function friendlyError(error: unknown): string {
  if (error instanceof Error && /abort|timeout|fetch|network/i.test(error.name+' '+error.message)) return 'The connection took too long. Check your connection and try again.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
