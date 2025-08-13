import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import UserManagement from "@/pages/user-management";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function AppRoutes() {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Ultimate authentication and security protection
  useEffect(() => {
    // Check for logout timestamp to prevent cached access
    const logoutTimestamp = localStorage.getItem('logout_timestamp');
    const now = Date.now();
    
    // If logged out recently (within 10 minutes), force login page
    if (logoutTimestamp && (now - parseInt(logoutTimestamp)) < 600000) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login?cache_cleared=1';
      return;
    }
    
    // Check if token exists but authentication failed
    const token = localStorage.getItem('auth_token');
    if (token && !isLoading && !isAuthenticated) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login?token_invalid=1';
      return;
    }
    
    if (!isLoading && !isAuthenticated) {
      // Set strict cache control headers if possible
      if (document.head) {
        const metaCache = document.createElement('meta');
        metaCache.setAttribute('http-equiv', 'Cache-Control');
        metaCache.setAttribute('content', 'no-cache, no-store, must-revalidate');
        document.head.appendChild(metaCache);
        
        const metaPragma = document.createElement('meta');
        metaPragma.setAttribute('http-equiv', 'Pragma');
        metaPragma.setAttribute('content', 'no-cache');
        document.head.appendChild(metaPragma);
      }
      
      // Clear navigation history aggressively
      window.history.replaceState(null, '', '/login');
      
      const preventBackNavigation = (event: PopStateEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.history.replaceState(null, '', '/login');
        window.location.href = '/login?back=prevented';
      };
      
      const preventKeyboardNavigation = (event: KeyboardEvent) => {
        if ((event.altKey && event.key === 'ArrowLeft') || 
            (event.metaKey && event.key === 'ArrowLeft') || 
            (event.ctrlKey && event.key === 'ArrowLeft') ||
            (event.key === 'Backspace' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName))) {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.location.href = '/login?kb=prevented';
        }
      };
      
      const preventVisibilityRestore = () => {
        if (document.visibilityState === 'visible' && !isAuthenticated) {
          window.location.href = '/login?vis=restored';
        }
      };
      
      const preventFocus = () => {
        if (!isAuthenticated) {
          window.location.href = '/login?focus=prevented';
        }
      };
      
      // Add comprehensive event listeners
      window.addEventListener('popstate', preventBackNavigation, { passive: false, capture: true });
      window.addEventListener('keydown', preventKeyboardNavigation, { passive: false, capture: true });
      window.addEventListener('focus', preventFocus, { passive: false, capture: true });
      document.addEventListener('visibilitychange', preventVisibilityRestore, { passive: false, capture: true });
      
      // Prevent context menu on unauthenticated pages
      const preventContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        return false;
      };
      
      document.addEventListener('contextmenu', preventContextMenu);
      
      return () => {
        window.removeEventListener('popstate', preventBackNavigation, { capture: true });
        window.removeEventListener('keydown', preventKeyboardNavigation, { capture: true });
        window.removeEventListener('focus', preventFocus, { capture: true });
        document.removeEventListener('visibilitychange', preventVisibilityRestore, { capture: true });
        document.removeEventListener('contextmenu', preventContextMenu);
      };
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      {(user?.role === 'admin' || user?.role === 'sub-admin') ? (
        <>
          <Route path="/" component={AdminDashboard} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/users" component={UserManagement} />
          <Route path="/profile" component={Profile} />
        </>
      ) : (
        <>
          <Route path="/" component={StudentDashboard} />
          <Route path="/student" component={StudentDashboard} />
          <Route path="/profile" component={Profile} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppRoutes />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
