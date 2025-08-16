import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User, LoginData } from "@shared/schema";

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const now = Date.now();
    const forceLogout = localStorage.getItem('force_logout');
    const logoutTimestamp = localStorage.getItem('logout_timestamp');
    const loggedOutToken = localStorage.getItem('logged_out_token');
    
    // If force logout flag exists, clear everything
    if (forceLogout === 'true') {
      localStorage.clear();
      window.location.replace('/login?provider_cleared=' + now);
      return null;
    }
    
    // Check if we're within logout window (30 minutes)
    if (logoutTimestamp && (now - parseInt(logoutTimestamp)) < 1800000) {
      localStorage.clear();
      window.location.replace('/login?window_cleared=' + now);
      return null;
    }
    
    const currentToken = localStorage.getItem('auth_token');
    
    // If this token was previously logged out, block it
    if (currentToken && loggedOutToken && currentToken === loggedOutToken) {
      localStorage.clear();
      window.location.replace('/login?reuse_blocked=' + now);
      return null;
    }
    
    return currentToken;
  });
  const queryClient = useQueryClient();

  // Get current user with aggressive re-validation
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: !!token,
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always check server
    cacheTime: 0, // Never cache
  });
  
  // If there's an auth error, immediately clear everything
  if (error && error.message.includes('401')) {
    localStorage.clear();
    sessionStorage.clear();
    setToken(null);
    queryClient.clear();
    
    // Force redirect
    window.location.href = '/login?auth_error=1';
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

  const logout = async () => {
    const timestamp = Date.now();
    
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
    
    // Clear all client-side storage
    const authToken = localStorage.getItem('auth_token');
    localStorage.clear();
    sessionStorage.clear();
    
    // Re-set the logout markers after clearing
    localStorage.setItem('logout_timestamp', timestamp.toString());
    localStorage.setItem('force_logout', 'true');
    localStorage.setItem('logged_out_token', authToken || 'no_token');
    
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
      window.history.pushState(null, '', '/login');
      window.location.replace('/login?logout=' + timestamp);
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
    window.location.replace('/login?forced_logout=' + timestamp);
  };

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