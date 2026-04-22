import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { enqueueOperation } from "./offline-queue";

export class OfflineQueuedError extends Error {
  queued = true;
  constructor(message = "Saved offline — will retry when connected.") {
    super(message);
    this.name = "OfflineQueuedError";
  }
}

function isWriteMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function dispatchOffline() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:api-offline'));
  }
}

function dispatchOnline() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:api-online'));
  }
}

// Detects the offline stub returned by the service worker (503 + JSON marker).
async function isOfflineStub(res: Response): Promise<boolean> {
  if (res.status !== 503) return false;
  try {
    const clone = res.clone();
    const data = await clone.json();
    return data && (data.offline === true || data.error === 'offline');
  } catch {
    return false;
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

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: isFormData ? options.body as FormData : (options?.body ? JSON.stringify(options.body) : undefined),
      credentials: "include",
    });
  } catch (err) {
    if (err instanceof TypeError) {
      dispatchOffline();
      if (isWriteMethod(method) && !isFormData) {
        enqueueOperation(url, method, options?.body, 'generic');
        throw new OfflineQueuedError();
      }
    }
    throw err;
  }

  if (await isOfflineStub(res)) {
    dispatchOffline();
    if (isWriteMethod(method) && !isFormData) {
      enqueueOperation(url, method, options?.body, 'generic');
      throw new OfflineQueuedError();
    }
  } else if (res.ok) {
    dispatchOnline();
  }

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
    } catch (err) {
      // Only swallow genuine network/offline errors (TypeError: Failed to fetch).
      // Rethrow anything unexpected so real bugs are not silently hidden.
      if (err instanceof TypeError) {
        dispatchOffline();
        return undefined as T;
      }
      throw err;
    }

    if (await isOfflineStub(res)) {
      dispatchOffline();
    } else if (res.ok) {
      dispatchOnline();
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
    buster: 'sowa-v2',
  });
}
