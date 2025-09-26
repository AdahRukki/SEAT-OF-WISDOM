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

  // Simple authentication check for portal routes
  useEffect(() => {
    // Only prevent back navigation for logged out users accessing portal
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
        <Route path="/portal/login" component={Login} />
        <Route path="/portal" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/portal/login" component={Login} />
      {(user?.role === 'admin' || user?.role === 'sub-admin') ? (
        <>
          <Route path="/portal" component={AdminDashboard} />
          <Route path="/portal/admin" component={AdminDashboard} />
          <Route path="/portal/users" component={UserManagement} />
          <Route path="/portal/profile" component={Profile} />
        </>
      ) : (
        <>
          <Route path="/portal" component={StudentDashboard} />
          <Route path="/portal/student" component={StudentDashboard} />
          <Route path="/portal/profile" component={Profile} />
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
