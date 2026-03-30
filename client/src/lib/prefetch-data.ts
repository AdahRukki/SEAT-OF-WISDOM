import { QueryClient } from "@tanstack/react-query";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWithAuth(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

const STALE_1H = 1000 * 60 * 60;

const GLOBAL_ENDPOINTS = [
  '/api/current-academic-info',
  '/api/admin/academic-sessions',
  '/api/admin/academic-terms',
  '/api/admin/subjects',
  '/api/news',
];

const ADMIN_ONLY_ENDPOINTS = [
  '/api/admin/schools',
  '/api/admin/users?adminOnly=true',
];

const PREFETCH_START = 'sowa:prefetch-start';
const PREFETCH_DONE = 'sowa:prefetch-done';

let _prefetchRunning = false;
export function isPrefetchRunning() { return _prefetchRunning; }

export function onPrefetchStart(cb: () => void) {
  const handler = () => cb();
  window.addEventListener(PREFETCH_START, handler);
  return () => window.removeEventListener(PREFETCH_START, handler);
}

export function onPrefetchDone(cb: () => void) {
  const handler = () => cb();
  window.addEventListener(PREFETCH_DONE, handler);
  return () => window.removeEventListener(PREFETCH_DONE, handler);
}

export interface PrefetchUserInfo {
  role: string;
  schoolId?: string | null;
}

export async function prefetchAllData(
  queryClient: QueryClient,
  userInfo: PrefetchUserInfo
): Promise<void> {
  _prefetchRunning = true;
  window.dispatchEvent(new Event(PREFETCH_START));

  try {
    const { role, schoolId } = userInfo;

    const globalEndpoints = [
      ...GLOBAL_ENDPOINTS,
      ...(role === 'admin' ? ADMIN_ONLY_ENDPOINTS : []),
    ];

    await Promise.allSettled(
      globalEndpoints.map((url) =>
        queryClient.prefetchQuery({
          queryKey: [url],
          queryFn: () => fetchWithAuth(url),
          staleTime: STALE_1H,
        })
      )
    );

    if (role === 'student') {
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ['/api/notifications'],
          queryFn: () => fetchWithAuth('/api/notifications'),
          staleTime: STALE_1H,
        }),
      ]);
    }

    const academicInfo = queryClient.getQueryData<{
      currentTerm: string | null;
      currentSession: string | null;
    }>(['/api/current-academic-info']);
    const currentTerm = academicInfo?.currentTerm ?? null;
    const currentSession = academicInfo?.currentSession ?? null;

    if (role === 'admin') {
      const schools =
        queryClient.getQueryData<{ id: string }[]>(['/api/admin/schools']) ?? [];

      await Promise.allSettled(
        schools.flatMap((school) => [
          queryClient.prefetchQuery({
            queryKey: ['/api/admin/students', school.id],
            queryFn: () => fetchWithAuth(`/api/admin/students?schoolId=${school.id}`),
            staleTime: STALE_1H,
          }),
          queryClient.prefetchQuery({
            queryKey: ['/api/admin/classes', school.id],
            queryFn: () => fetchWithAuth(`/api/admin/classes?schoolId=${school.id}`),
            staleTime: STALE_1H,
          }),
          queryClient.prefetchQuery({
            queryKey: ['/api/admin/fee-types', school.id],
            queryFn: () => fetchWithAuth(`/api/admin/fee-types?schoolId=${school.id}`),
            staleTime: STALE_1H,
          }),
          ...(currentTerm && currentSession
            ? [
                queryClient.prefetchQuery({
                  queryKey: ['/api/admin/payments', school.id, currentTerm, currentSession],
                  queryFn: () =>
                    fetchWithAuth(
                      `/api/admin/payments?schoolId=${school.id}` +
                      `&term=${encodeURIComponent(currentTerm)}&session=${encodeURIComponent(currentSession)}`
                    ),
                  staleTime: STALE_1H,
                }),
                queryClient.prefetchQuery({
                  queryKey: ['/api/admin/student-fees', school.id, currentTerm, currentSession],
                  queryFn: () =>
                    fetchWithAuth(
                      `/api/admin/student-fees?schoolId=${school.id}` +
                      `&term=${encodeURIComponent(currentTerm)}&session=${encodeURIComponent(currentSession)}`
                    ),
                  staleTime: STALE_1H,
                }),
                queryClient.prefetchQuery({
                  queryKey: ['/api/admin/financial-summary', school.id, currentTerm, currentSession],
                  queryFn: () =>
                    fetchWithAuth(
                      `/api/admin/financial-summary?schoolId=${school.id}` +
                      `&term=${encodeURIComponent(currentTerm)}&session=${encodeURIComponent(currentSession)}`
                    ),
                  staleTime: STALE_1H,
                }),
              ]
            : []),
        ])
      );
    } else if (role !== 'student') {
      const key = schoolId ?? '';

      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ['/api/admin/students', key],
          queryFn: () => fetchWithAuth('/api/admin/students'),
          staleTime: STALE_1H,
        }),
        queryClient.prefetchQuery({
          queryKey: ['/api/admin/classes', key],
          queryFn: () => fetchWithAuth('/api/admin/classes'),
          staleTime: STALE_1H,
        }),
        queryClient.prefetchQuery({
          queryKey: ['/api/admin/fee-types', key],
          queryFn: () => fetchWithAuth('/api/admin/fee-types'),
          staleTime: STALE_1H,
        }),
        ...(currentTerm && currentSession
          ? [
              queryClient.prefetchQuery({
                queryKey: ['/api/admin/payments', key, currentTerm, currentSession],
                queryFn: () =>
                  fetchWithAuth(
                    `/api/admin/payments?term=${encodeURIComponent(currentTerm)}` +
                    `&session=${encodeURIComponent(currentSession)}`
                  ),
                staleTime: STALE_1H,
              }),
              queryClient.prefetchQuery({
                queryKey: ['/api/admin/student-fees', key, currentTerm, currentSession],
                queryFn: () =>
                  fetchWithAuth(
                    `/api/admin/student-fees?term=${encodeURIComponent(currentTerm)}` +
                    `&session=${encodeURIComponent(currentSession)}`
                  ),
                staleTime: STALE_1H,
              }),
              queryClient.prefetchQuery({
                queryKey: ['/api/admin/financial-summary', key, currentTerm, currentSession],
                queryFn: () =>
                  fetchWithAuth(
                    `/api/admin/financial-summary?term=${encodeURIComponent(currentTerm)}` +
                    `&session=${encodeURIComponent(currentSession)}`
                  ),
                staleTime: STALE_1H,
              }),
            ]
          : []),
      ]);
    }
  } finally {
    _prefetchRunning = false;
    window.dispatchEvent(new Event(PREFETCH_DONE));
  }
}
