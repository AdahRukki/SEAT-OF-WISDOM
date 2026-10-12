// Translate API failures without displaying raw SQL, connection or server errors.
export function analyticsFailure(error: unknown): { title: string; message: string; reference?: string } {
  const message = error instanceof Error ? error.message : '';
  const match = /^(\d{3}):\s*([\s\S]*)$/.exec(message);
  const status = match ? Number(match[1]) : undefined;
  let payload: { code?: string; error?: string; offline?: boolean; reference?: string } = {};
  if (match) { try { const value: unknown = JSON.parse(match[2]); if (value && typeof value === 'object' && !Array.isArray(value)) payload = value; } catch { /* Non-JSON responses use a safe fallback. */ } }
  if (payload.code === 'STUDENT_HISTORY_NOT_READY') return { title: 'History setup required', message: 'The report database setup is incomplete. Complete the approved student history setup, then refresh reports.' };
  if (status === 403) return { title: 'Main administrator access required', message: 'Sign in with a main administrator account to view management reports.' };
  if (status === 400 || status === 404 && payload.code === 'INVALID_REPORT_SCOPE') return { title: 'Check the reporting filters', message: 'The selected school, class or academic period is invalid. Reset the filters and try again.' };
  if (error instanceof TypeError || payload.offline === true || payload.error === 'offline') return { title: 'Connection unavailable', message: 'Reconnect to the internet, then refresh reports.' };
  if (status === 503) return { title: 'Reports temporarily unavailable', message: 'The reporting service is unavailable. Try again shortly.' };
  return { title: 'Report request failed', message: 'The server could not load this report. Retry; if it continues, share the error reference with the portal administrator.', ...(typeof payload.reference === 'string' && /^[a-f0-9-]{36}$/i.test(payload.reference) ? { reference: payload.reference } : {}) };
}
