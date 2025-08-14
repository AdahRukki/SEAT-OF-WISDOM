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

  // Simple authentication check
  useEffect(() => {
    // Only prevent back navigation for logged out users
    if (!isLoading && !isAuthenticated) {
      const preventBackNavigation = (event: PopStateEvent) => {
        if (window.location.pathname !== '/login') {
          event.preventDefault();
          window.location.href = '/login';
        }
      };
      
      window.addEventListener('popstate', preventBackNavigation);
      
      return () => {
        window.removeEventListener('popstate', preventBackNavigation);
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
