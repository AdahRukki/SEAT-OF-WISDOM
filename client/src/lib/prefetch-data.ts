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

async function prefetchPerClass(
  queryClient: QueryClient,
  classId: string,
  currentTerm: string | null,
  currentSession: string | null
): Promise<void> {
  // Step A: subjects for this class (must complete before assessments)
  await queryClient.prefetchQuery({
    queryKey: ['/api/admin/classes', classId, 'subjects'],
    queryFn: () => fetchWithAuth(`/api/admin/classes/${classId}/subjects`),
    staleTime: STALE_1H,
  });

  const subjects =
    (queryClient.getQueryData<{ id: string }[]>(
      ['/api/admin/classes', classId, 'subjects']
    ) ?? []);

  // Step B: students for this class + assessments per subject — run in parallel
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['/api/admin/classes', classId, 'students'],
      queryFn: () => fetchWithAuth(`/api/admin/classes/${classId}/students`),
      staleTime: STALE_1H,
    }),
    ...(currentTerm && currentSession
      ? subjects.map((subject) =>
          queryClient.prefetchQuery({
            queryKey: ['/api/admin/assessments', classId, subject.id, currentTerm, currentSession],
            queryFn: () =>
              fetchWithAuth(
                `/api/admin/assessments?classId=${classId}&subjectId=${subject.id}` +
                `&term=${encodeURIComponent(currentTerm)}&session=${encodeURIComponent(currentSession)}`
              ),
            staleTime: STALE_1H,
          })
        )
      : []),
  ]);
}

export async function prefetchAllData(
  queryClient: QueryClient,
  userInfo: PrefetchUserInfo
): Promise<void> {
  _prefetchRunning = true;
  window.dispatchEvent(new Event(PREFETCH_START));

  try {
    const { role, schoolId } = userInfo;

    // Phase 1: global endpoints (same for all roles) + admin-only extras
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

    // Phase 1b: notifications for student role
    if (role === 'student') {
      await queryClient.prefetchQuery({
        queryKey: ['/api/notifications'],
        queryFn: () => fetchWithAuth('/api/notifications'),
        staleTime: STALE_1H,
      });
    }

    // Resolve active term & session for assessments + payments prefetch
    const academicInfo = queryClient.getQueryData<{
      currentTerm: string | null;
      currentSession: string | null;
    }>(['/api/current-academic-info']);
    const currentTerm = academicInfo?.currentTerm ?? null;
    const currentSession = academicInfo?.currentSession ?? null;

    if (role === 'admin') {
      const schools =
        queryClient.getQueryData<{ id: string }[]>(['/api/admin/schools']) ?? [];

      // Phase 2 (admin): per-school flat data — students, classes, fee types, payments
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
              ]
            : []),
        ])
      );

      // Phase 3 (admin): per-class subjects, students, assessments
      // Must run after Phase 2 so classes are in cache
      await Promise.allSettled(
        schools.map(async (school) => {
          const classes =
            queryClient.getQueryData<{ id: string }[]>(['/api/admin/classes', school.id]) ?? [];
          await Promise.allSettled(
            classes.map((cls) =>
              prefetchPerClass(queryClient, cls.id, currentTerm, currentSession)
            )
          );
        })
      );
    } else {
      // sub-admin (or student): single school
      const key = schoolId ?? '';

      // Phase 2 (sub-admin): per-school flat data
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
                // sub-admin: server infers schoolId from JWT — use key as cache discriminator
                queryKey: ['/api/admin/payments', key, currentTerm, currentSession],
                queryFn: () =>
                  fetchWithAuth(
                    `/api/admin/payments?term=${encodeURIComponent(currentTerm)}` +
                    `&session=${encodeURIComponent(currentSession)}`
                  ),
                staleTime: STALE_1H,
              }),
            ]
          : []),
      ]);

      // Phase 3 (sub-admin): per-class subjects, students, assessments
      if (role !== 'student') {
        const classes =
          queryClient.getQueryData<{ id: string }[]>(['/api/admin/classes', key]) ?? [];
        await Promise.allSettled(
          classes.map((cls) =>
            prefetchPerClass(queryClient, cls.id, currentTerm, currentSession)
          )
        );
      }
    }
  } finally {
    _prefetchRunning = false;
    window.dispatchEvent(new Event(PREFETCH_DONE));
  }
}
