import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function clearAuthOnly() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('firebase_token');
  localStorage.removeItem('user_data');
  localStorage.removeItem('auth_user');
  sessionStorage.clear();
}

export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
  }
): Promise<any> {
  const method = options?.method || 'GET';
  const token = localStorage.getItem('auth_token');
  
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {};
  
  if (!isFormData && options?.body) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? options.body as FormData : (options?.body ? JSON.stringify(options.body) : undefined),
    credentials: "include",
  });

  if (res.status === 401) {
    clearAuthOnly();
    window.location.href = '/portal/login?expired=1';
    throw new Error('401: Session expired - redirecting to login');
  }

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(queryKey.join("") as string, {
        headers,
        credentials: "include",
      });
    } catch {
      // Network error (offline) — return undefined so TanStack Query
      // falls back to its persisted stale cache instead of throwing.
      return undefined as T;
    }

    if (res.status === 401) {
      clearAuthOnly();
      
      if (unauthorizedBehavior === "returnNull") {
        setTimeout(() => {
          window.location.href = '/portal/login?expired=1';
        }, 100);
        return null;
      }
      
      window.location.href = '/portal/login?expired=1';
      throw new Error('401: Session expired - redirecting to login');
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 60,
      retry: false,
      gcTime: 1000 * 60 * 60 * 24,
    },
    mutations: {
      retry: false,
    },
  },
});

if (typeof window !== 'undefined') {
  const localStoragePersister = createSyncStoragePersister({
    storage: window.localStorage,
    key: 'sowa_query_cache',
    throttleTime: 1000,
  });

  persistQueryClient({
    queryClient,
    persister: localStoragePersister,
    maxAge: 1000 * 60 * 60 * 24,
    buster: 'sowa-v1',
  });
}
