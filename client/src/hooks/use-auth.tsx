import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useNetworkStatus } from "./use-network-status";
import type { User, LoginData } from "@shared/schema";

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  schoolId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Security: Inactivity timeout (30 minutes)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const now = Date.now();
    const forceLogout = localStorage.getItem('force_logout');
    const logoutTimestamp = localStorage.getItem('logout_timestamp');
    const loggedOutToken = localStorage.getItem('logged_out_token');
    
    // If force logout flag exists, clear everything
    if (forceLogout === 'true') {
      localStorage.clear();
      window.location.replace('/portal/login?provider_cleared=' + now);
      return null;
    }
    
    // Check if we're within logout window (30 minutes)
    if (logoutTimestamp && (now - parseInt(logoutTimestamp)) < 1800000) {
      localStorage.clear();
      window.location.replace('/portal/login?window_cleared=' + now);
      return null;
    }
    
    const currentToken = localStorage.getItem('auth_token');
    
    // If this token was previously logged out, block it
    if (currentToken && loggedOutToken && currentToken === loggedOutToken) {
      localStorage.clear();
      window.location.replace('/portal/login?reuse_blocked=' + now);
      return null;
    }
    
    return currentToken;
  });
  const queryClient = useQueryClient();
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<number | null>(null);

  // Get current user with aggressive re-validation
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: !!token,
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always check server
    gcTime: 0, // Never cache
  });
  
  // If there's an auth error, immediately clear everything
  if (error && error.message.includes('401')) {
    localStorage.clear();
    sessionStorage.clear();
    setToken(null);
    queryClient.clear();
    
    // Force redirect
    window.location.href = '/portal/login?auth_error=1';
  }

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      
      // Set default authorization header for future requests
      queryClient.setQueryDefaults(['/api/auth/me'], {
        queryFn: async () => {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${data.token}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch user');
          return response.json();
        },
      });
      
      // Refetch user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const logout = async (reason: 'manual' | 'offline' | 'inactivity' = 'manual') => {
    const timestamp = Date.now();
    
    console.log(`🔐 Security logout triggered: ${reason}`);
    
    try {
      // Call server logout endpoint with token for server-side invalidation
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
    
    // Store logout timestamp first
    localStorage.setItem('logout_timestamp', timestamp.toString());
    localStorage.setItem('force_logout', 'true');
    localStorage.setItem('logout_reason', reason);
    
    // Clear all client-side storage
    const authToken = localStorage.getItem('auth_token');
    localStorage.clear();
    sessionStorage.clear();
    
    // Re-set the logout markers after clearing
    localStorage.setItem('logout_timestamp', timestamp.toString());
    localStorage.setItem('force_logout', 'true');
    localStorage.setItem('logged_out_token', authToken || 'no_token');
    localStorage.setItem('logout_reason', reason);
    
    setToken(null);
    queryClient.clear();
    
    // Clear all browser storage types
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
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
    
    // Disable page caching
    if (window.performance && window.performance.navigation) {
      window.performance.mark('logout-' + timestamp);
    }
    
    // Block all back navigation permanently
    const blockNavigation = () => {
      window.history.pushState(null, '', '/portal/login');
      window.location.replace(`/portal/login?logout=${timestamp}&reason=${reason}`);
    };
    
    // Comprehensive event blocking
    ['popstate', 'beforeunload', 'pagehide', 'visibilitychange', 'focus', 'pageshow'].forEach(event => {
      window.addEventListener(event, blockNavigation, { capture: true, passive: false });
      document.addEventListener(event, blockNavigation, { capture: true, passive: false });
    });
    
    // Block keyboard navigation
    window.addEventListener('keydown', (e) => {
      if ((e.altKey && e.key === 'ArrowLeft') || 
          (e.metaKey && e.key === 'ArrowLeft') || 
          (e.ctrlKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        e.stopPropagation();
        blockNavigation();
      }
    }, { capture: true, passive: false });
    
    // Nuclear option - completely refresh and redirect
    window.location.replace(`/portal/login?forced_logout=${timestamp}&reason=${reason}`);
  };

  // SECURITY: Network status monitoring - auto logout when offline
  useNetworkStatus(
    () => {
      // When user goes offline, immediately logout for security
      if (token && user) {
        console.warn('⚠️ Network offline detected - logging out for security');
        logout('offline');
      }
    },
    () => {
      // When back online, user must re-authenticate
      console.log('🌐 Network back online - please log in again');
    }
  );

  // SECURITY: Inactivity timeout monitoring
  useEffect(() => {
    if (!token || !user) return;

    // Reset activity on user interaction
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      
      // Clear existing timer
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
      
      // Set new inactivity timer
      inactivityTimerRef.current = window.setTimeout(() => {
        console.warn('⏰ Inactivity timeout - logging out for security');
        logout('inactivity');
      }, INACTIVITY_TIMEOUT);
    };

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    // Initial timer setup
    resetActivity();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetActivity);
      });
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [token, user]);

  // Set up API client with auth token
  useEffect(() => {
    if (token) {
      // Update the global API request function with token
      (window as any).__auth_token = token;
    }
  }, [token]);

  const value: AuthContextType = {
    user: user as AuthUser || null,
    isLoading,
    isAuthenticated: !!user,
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