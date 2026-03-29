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

const PREFETCH_EVENTS = {
  START: 'sowa:prefetch-start',
  DONE: 'sowa:prefetch-done',
};

export function onPrefetchStart(cb: () => void) {
  const handler = () => cb();
  window.addEventListener(PREFETCH_EVENTS.START, handler);
  return () => window.removeEventListener(PREFETCH_EVENTS.START, handler);
}

export function onPrefetchDone(cb: () => void) {
  const handler = () => cb();
  window.addEventListener(PREFETCH_EVENTS.DONE, handler);
  return () => window.removeEventListener(PREFETCH_EVENTS.DONE, handler);
}

export async function prefetchAllData(
  queryClient: QueryClient,
  userRole: string
): Promise<void> {
  window.dispatchEvent(new Event(PREFETCH_EVENTS.START));

  try {
    const endpointsToPrefetch = [
      ...GLOBAL_ENDPOINTS,
      ...(userRole === 'admin' ? ADMIN_ONLY_ENDPOINTS : []),
    ];

    await Promise.allSettled(
      endpointsToPrefetch.map((url) =>
        queryClient.prefetchQuery({
          queryKey: [url],
          queryFn: () => fetchWithAuth(url),
          staleTime: 1000 * 60 * 60,
        })
      )
    );

    if (userRole === 'admin') {
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
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ['/api/admin/students', ''],
          queryFn: () => fetchWithAuth('/api/admin/students'),
          staleTime: 1000 * 60 * 60,
        }),
        queryClient.prefetchQuery({
          queryKey: ['/api/admin/classes', ''],
          queryFn: () => fetchWithAuth('/api/admin/classes'),
          staleTime: 1000 * 60 * 60,
        }),
      ]);
    }
  } finally {
    window.dispatchEvent(new Event(PREFETCH_EVENTS.DONE));
  }
}
