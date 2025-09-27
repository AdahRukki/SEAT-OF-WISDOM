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
import SchoolHomepage from "@/pages/school-homepage";
import SchoolAbout from "@/pages/school-about";
import SchoolPrograms from "@/pages/school-programs";
import SchoolAdmissions from "@/pages/school-admissions";
import SchoolContact from "@/pages/school-contact";
import { useEffect } from "react";

// Portal Routes Component for authenticated users
function PortalRoutes() {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Enhanced security for portal routes with session monitoring
  useEffect(() => {
    // Prevent back navigation for logged out users accessing portal
    if (!isLoading && !isAuthenticated) {
      const preventBackNavigation = (event: PopStateEvent) => {
        if (window.location.pathname.startsWith('/portal') && window.location.pathname !== '/portal/login') {
          event.preventDefault();
          window.location.href = '/portal/login';
        }
      };
      
      window.addEventListener('popstate', preventBackNavigation);
      
      return () => {
        window.removeEventListener('popstate', preventBackNavigation);
      };
    }

    // Monitor navigation away from portal - auto-logout for security
    if (isAuthenticated) {
      const handleNavigationAway = () => {
        // If user navigates away from /portal paths, trigger logout
        if (!window.location.pathname.startsWith('/portal')) {
          // Store flag to logout when they come back
          localStorage.setItem('portal_exit_timestamp', Date.now().toString());
        }
      };

      const handleFocus = () => {
        // Check if user came back to portal after navigating away
        const exitTimestamp = localStorage.getItem('portal_exit_timestamp');
        if (exitTimestamp && window.location.pathname.startsWith('/portal')) {
          const timeDiff = Date.now() - parseInt(exitTimestamp);
          // If more than 5 minutes passed, logout
          if (timeDiff > 300000) {
            localStorage.removeItem('portal_exit_timestamp');
            window.location.href = '/portal/login?session_expired=1';
          }
        }
      };

      window.addEventListener('beforeunload', handleNavigationAway);
      window.addEventListener('focus', handleFocus);
      
      return () => {
        window.removeEventListener('beforeunload', handleNavigationAway);
        window.removeEventListener('focus', handleFocus);
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
        <Route path="login" component={Login} />
        <Route path="" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="login" component={Login} />
      {(user?.role === 'admin' || user?.role === 'sub-admin') ? (
        <>
          <Route path="" component={AdminDashboard} />
          <Route path="admin" component={AdminDashboard} />
          <Route path="users" component={UserManagement} />
          <Route path="profile" component={Profile} />
        </>
      ) : (
        <>
          <Route path="" component={StudentDashboard} />
          <Route path="student" component={StudentDashboard} />
          <Route path="profile" component={Profile} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

// Main App Routes Component
function AppRoutes() {
  return (
    <Switch>
      {/* Public School Website Routes */}
      <Route path="/" component={SchoolHomepage} />
      <Route path="/about" component={SchoolAbout} />
      <Route path="/programs" component={SchoolPrograms} />
      <Route path="/admissions" component={SchoolAdmissions} />
      <Route path="/contact" component={SchoolContact} />
      
      {/* Portal Routes - All portal routes start with /portal */}
      <Route path="/portal" nest>
        <PortalRoutes />
      </Route>
      
      {/* Fallback */}
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
