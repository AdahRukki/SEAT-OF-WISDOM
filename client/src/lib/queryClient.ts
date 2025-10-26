import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
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
  
  // Check if body is FormData - if so, don't set Content-Type (browser will set it with boundary)
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

  // If we get 401, immediately clear all auth data and redirect
  if (res.status === 401) {
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Force immediate redirect
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

    const res = await fetch(queryKey.join("") as string, {
      headers,
      credentials: "include",
    });

    if (res.status === 401) {
      // Immediately clear all auth data on 401
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
      
      if (unauthorizedBehavior === "returnNull") {
        // Force redirect even if returning null
        setTimeout(() => {
          window.location.href = '/portal/login?expired=1';
        }, 100);
        return null;
      }
      
      // Force immediate redirect
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
