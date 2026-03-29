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

const GLOBAL_ENDPOINTS = [
  '/api/current-academic-info',
  '/api/admin/academic-sessions',
  '/api/admin/academic-terms',
  '/api/admin/subjects',
];

const ADMIN_ONLY_ENDPOINTS = [
  '/api/admin/schools',
  '/api/admin/users?adminOnly=true',
];

const PREFETCH_START = 'sowa:prefetch-start';
const PREFETCH_DONE = 'sowa:prefetch-done';

// Module-level flag so components can read current state on mount, avoiding
// the race where a component mounts after the start event has already fired.
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
          staleTime: 1000 * 60 * 60,
        })
      )
    );

    if (role === 'admin') {
      const schools =
        queryClient.getQueryData<{ id: string }[]>(['/api/admin/schools']) ?? [];

      await Promise.allSettled(
        schools.flatMap((school) => [
          queryClient.prefetchQuery({
            queryKey: ['/api/admin/students', school.id],
            queryFn: () => fetchWithAuth(`/api/admin/students?schoolId=${school.id}`),
            staleTime: 1000 * 60 * 60,
          }),
          queryClient.prefetchQuery({
            queryKey: ['/api/admin/classes', school.id],
            queryFn: () => fetchWithAuth(`/api/admin/classes?schoolId=${school.id}`),
            staleTime: 1000 * 60 * 60,
          }),
          queryClient.prefetchQuery({
            queryKey: ['/api/admin/fee-types', school.id],
            queryFn: () => fetchWithAuth(`/api/admin/fee-types?schoolId=${school.id}`),
            staleTime: 1000 * 60 * 60,
          }),
        ])
      );
    } else {
      // sub-admin: queries use schoolId as the cache key but the URL has no filter
      // (the server infers school from the authenticated user's schoolId)
      const key = schoolId ?? '';
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ['/api/admin/students', key],
          queryFn: () => fetchWithAuth('/api/admin/students'),
          staleTime: 1000 * 60 * 60,
        }),
        queryClient.prefetchQuery({
          queryKey: ['/api/admin/classes', key],
          queryFn: () => fetchWithAuth('/api/admin/classes'),
          staleTime: 1000 * 60 * 60,
        }),
        queryClient.prefetchQuery({
          queryKey: ['/api/admin/fee-types', key],
          queryFn: () => fetchWithAuth('/api/admin/fee-types'),
          staleTime: 1000 * 60 * 60,
        }),
      ]);
    }
  } finally {
    _prefetchRunning = false;
    window.dispatchEvent(new Event(PREFETCH_DONE));
  }
}
