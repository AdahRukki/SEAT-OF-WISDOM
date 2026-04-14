import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { prefetchAllData } from "@/lib/prefetch-data";
import { cacheAuthCredentials, attemptOfflineLogin, updateCachedUser, clearOfflineAuth } from "@/lib/offline-auth";
import { SW_CACHE_NAME } from "@/lib/constants";
import type { User, LoginData } from "@shared/schema";

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  role: string;
  schoolId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOfflineMode: boolean;
  login: (data: LoginData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 4 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const now = Date.now();
    const forceLogout = localStorage.getItem('force_logout');
    const logoutTimestamp = localStorage.getItem('logout_timestamp');
    const loggedOutToken = localStorage.getItem('logged_out_token');
    
    if (forceLogout === 'true') {
      const offlineAuth = localStorage.getItem('sowa_offline_auth');
      localStorage.clear();
      if (offlineAuth) localStorage.setItem('sowa_offline_auth', offlineAuth);
      window.location.replace('/portal/login?provider_cleared=' + now);
      return null;
    }
    
    if (logoutTimestamp && (now - parseInt(logoutTimestamp)) < 1800000) {
      const offlineAuth = localStorage.getItem('sowa_offline_auth');
      localStorage.clear();
      if (offlineAuth) localStorage.setItem('sowa_offline_auth', offlineAuth);
      window.location.replace('/portal/login?window_cleared=' + now);
      return null;
    }
    
    const currentToken = localStorage.getItem('auth_token');
    
    if (currentToken && loggedOutToken && currentToken === loggedOutToken) {
      const offlineAuth = localStorage.getItem('sowa_offline_auth');
      localStorage.clear();
      if (offlineAuth) localStorage.setItem('sowa_offline_auth', offlineAuth);
      window.location.replace('/portal/login?reuse_blocked=' + now);
      return null;
    }
    
    return currentToken;
  });
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineUser, setOfflineUser] = useState<AuthUser | null>(null);
  const queryClient = useQueryClient();
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<number | null>(null);
  const loginIdentifierRef = useRef<string>('');

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: !!token && !isOfflineMode,
    retry: (failureCount, error) => {
      if (!navigator.onLine) return false;
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  });
  
  if (error && error.message.includes('401') && navigator.onLine) {
    const offlineAuth = localStorage.getItem('sowa_offline_auth');
    localStorage.clear();
    sessionStorage.clear();
    if (offlineAuth) localStorage.setItem('sowa_offline_auth', offlineAuth);
    setToken(null);
    setIsOfflineMode(false);
    setOfflineUser(null);
    queryClient.clear();
    window.location.href = '/portal/login?auth_error=1';
  }

  const effectiveUser = isOfflineMode ? offlineUser : (user as AuthUser | null);

  useEffect(() => {
    if (user && loginIdentifierRef.current) {
      const authUser = user as AuthUser;
      updateCachedUser(loginIdentifierRef.current, {
        id: authUser.id,
        email: authUser.email,
        firstName: authUser.firstName,
        middleName: authUser.middleName,
        lastName: authUser.lastName,
        role: authUser.role,
        schoolId: authUser.schoolId,
      });
    }
  }, [user]);

  useEffect(() => {
    if (isOfflineMode && navigator.onLine && token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(res => {
        if (res.ok) {
          setIsOfflineMode(false);
          setOfflineUser(null);
          queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        }
      }).catch(() => {});
    }
    const handleOnline = () => {
      if (isOfflineMode && token) {
        fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        }).then(res => {
          if (res.ok) {
            setIsOfflineMode(false);
            setOfflineUser(null);
            queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
          }
        }).catch(() => {});
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isOfflineMode, token]);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      loginIdentifierRef.current = data.email;

      if (navigator.onLine) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          let response: Response;
          try {
            response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
          } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            const isNetworkError = fetchErr?.name === 'AbortError' || fetchErr?.name === 'TypeError';
            if (isNetworkError) {
              const offlineResult = await attemptOfflineLogin(data.email, data.password);
              if (offlineResult) {
                return { token: offlineResult.token, user: offlineResult.user, offlineMode: true };
              }
            }
            throw fetchErr;
          }

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
          }

          const result = await response.json();

          cacheAuthCredentials(data.email, data.password, result.token, result.user).catch(() => {});

          return { ...result, offlineMode: false };
        } catch (err: any) {
          if (err.message === 'Login failed' || err.message === 'Invalid credentials') {
            throw err;
          }
          const offlineResult = await attemptOfflineLogin(data.email, data.password);
          if (offlineResult) {
            return { token: offlineResult.token, user: offlineResult.user, offlineMode: true };
          }
          throw err;
        }
      }

      const offlineResult = await attemptOfflineLogin(data.email, data.password);
      if (offlineResult) {
        return { token: offlineResult.token, user: offlineResult.user, offlineMode: true };
      }
      throw new Error('No internet connection and no cached credentials found. Please connect to the internet to log in.');
    },
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);

      if (data.offlineMode) {
        setIsOfflineMode(true);
        setOfflineUser(data.user);
      } else {
        setIsOfflineMode(false);
        setOfflineUser(null);

        queryClient.setQueryDefaults(['/api/auth/me'], {
          queryFn: async () => {
            const response = await fetch('/api/auth/me', {
              headers: { 'Authorization': `Bearer ${data.token}` },
            });
            if (!response.ok) throw new Error('Failed to fetch user');
            return response.json();
          },
        });

        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      }
    },
  });

  const logout = async (reason: 'manual' | 'offline' | 'inactivity' = 'manual') => {
    if (reason === 'offline' && !navigator.onLine) {
      return;
    }

    const timestamp = Date.now();
    
    console.log(`🔐 Security logout triggered: ${reason}`);
    
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Server logout failed:', error);
    }
    
    const offlineAuth = localStorage.getItem('sowa_offline_auth');
    
    localStorage.setItem('logout_timestamp', timestamp.toString());
    localStorage.setItem('force_logout', 'true');
    localStorage.setItem('logout_reason', reason);
    
    const authToken = localStorage.getItem('auth_token');
    localStorage.clear();
    sessionStorage.clear();
    
    localStorage.setItem('logout_timestamp', timestamp.toString());
    localStorage.setItem('force_logout', 'true');
    localStorage.setItem('logged_out_token', authToken || 'no_token');
    localStorage.setItem('logout_reason', reason);
    if (offlineAuth) localStorage.setItem('sowa_offline_auth', offlineAuth);
    
    setToken(null);
    setIsOfflineMode(false);
    setOfflineUser(null);
    queryClient.clear();
    
    if ('caches' in window) {
      caches.open(SW_CACHE_NAME).then(cache => {
        cache.keys().then(requests => {
          requests.forEach(request => {
            const url = new URL(request.url);
            if (url.pathname.startsWith('/api/')) {
              cache.delete(request);
            }
          });
        });
      }).catch(() => {});
    }
    
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases();
        databases.forEach(db => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      } catch (e) {
        console.log('IndexedDB clear failed:', e);
      }
    }
    
    if (window.performance && window.performance.navigation) {
      window.performance.mark('logout-' + timestamp);
    }
    
    const blockNavigation = () => {
      window.history.pushState(null, '', '/portal/login');
      window.location.replace(`/portal/login?logout=${timestamp}&reason=${reason}`);
    };
    
    ['popstate', 'beforeunload', 'pagehide', 'visibilitychange', 'focus', 'pageshow'].forEach(event => {
      window.addEventListener(event, blockNavigation, { capture: true, passive: false });
      document.addEventListener(event, blockNavigation, { capture: true, passive: false });
    });
    
    window.addEventListener('keydown', (e) => {
      if ((e.altKey && e.key === 'ArrowLeft') || 
          (e.metaKey && e.key === 'ArrowLeft') || 
          (e.ctrlKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        e.stopPropagation();
        blockNavigation();
      }
    }, { capture: true, passive: false });
    
    window.location.replace(`/portal/login?forced_logout=${timestamp}&reason=${reason}`);
  };

  const lastPrefetchedUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveUser?.id || !token) return;
    if (lastPrefetchedUserId.current === effectiveUser.id) return;
    lastPrefetchedUserId.current = effectiveUser.id;
    prefetchAllData(queryClient, { role: effectiveUser.role, schoolId: effectiveUser.schoolId }).catch(() => {});
  }, [effectiveUser?.id, token]);

  const runPrefetchForCurrentUser = useCallback(() => {
    if (effectiveUser?.id && token) {
      prefetchAllData(queryClient, { role: effectiveUser.role, schoolId: effectiveUser.schoolId }).catch(() => {});
    }
  }, [effectiveUser, token, queryClient]);

  useEffect(() => {
    window.addEventListener('online', runPrefetchForCurrentUser);
    return () => window.removeEventListener('online', runPrefetchForCurrentUser);
  }, [runPrefetchForCurrentUser]);

  useEffect(() => {
    if (!token || !effectiveUser) return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
      
      inactivityTimerRef.current = window.setTimeout(() => {
        if (navigator.onLine) {
          console.warn('⏰ Inactivity timeout - logging out for security');
          logout('inactivity');
        }
      }, INACTIVITY_TIMEOUT);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    resetActivity();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetActivity);
      });
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [token, effectiveUser]);

  useEffect(() => {
    if (token) {
      (window as any).__auth_token = token;
    }
  }, [token]);

  const value: AuthContextType = {
    user: effectiveUser,
    isLoading: isLoading && !isOfflineMode,
    isAuthenticated: !!effectiveUser,
    isOfflineMode,
    login: loginMutation.mutateAsync,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}