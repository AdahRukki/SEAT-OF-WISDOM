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
    // Check if we're within logout window
    const logoutTimestamp = localStorage.getItem('logout_timestamp');
    if (logoutTimestamp && (Date.now() - parseInt(logoutTimestamp)) < 600000) {
      localStorage.clear();
      return null;
    }
    return localStorage.getItem('auth_token');
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
    
    // Clear all client-side storage immediately
    localStorage.clear();
    sessionStorage.clear();
    setToken(null);
    queryClient.clear();
    
    // Clear browser cache aggressively
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Clear IndexedDB if present
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
    
    // Comprehensive history manipulation
    const loginUrl = '/login';
    window.history.replaceState(null, '', loginUrl);
    
    // Add multiple security layers
    const timestamp = Date.now();
    const preventBack = (event: PopStateEvent) => {
      event.preventDefault();
      event.stopPropagation();
      window.history.replaceState(null, '', loginUrl);
      window.location.href = loginUrl;
    };
    
    const preventKeyboardBack = (event: KeyboardEvent) => {
      if ((event.altKey && event.key === 'ArrowLeft') || 
          (event.metaKey && event.key === 'ArrowLeft') || 
          (event.ctrlKey && event.key === 'ArrowLeft')) {
        event.preventDefault();
        event.stopPropagation();
        window.location.href = loginUrl;
      }
    };
    
    const preventVisibilityRestore = () => {
      if (document.visibilityState === 'visible') {
        window.location.href = loginUrl;
      }
    };
    
    // Add event listeners
    window.addEventListener('popstate', preventBack, true);
    window.addEventListener('keydown', preventKeyboardBack, true);
    window.addEventListener('beforeunload', () => {
      localStorage.setItem('logout_timestamp', timestamp.toString());
    }, true);
    window.addEventListener('pagehide', () => {
      localStorage.setItem('logout_timestamp', timestamp.toString());
    }, true);
    document.addEventListener('visibilitychange', preventVisibilityRestore, true);
    
    // Store logout timestamp
    localStorage.setItem('logout_timestamp', timestamp.toString());
    
    // Force immediate redirect with no cache
    window.location.href = loginUrl + '?t=' + timestamp;
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