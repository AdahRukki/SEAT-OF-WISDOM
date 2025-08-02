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
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('auth_token')
  );
  const queryClient = useQueryClient();

  // Get current user
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: !!token,
    retry: false,
  });

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

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    queryClient.clear();
    window.location.href = '/login';
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