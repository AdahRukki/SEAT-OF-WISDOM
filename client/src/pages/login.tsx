import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLogo } from "@/hooks/use-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { GraduationCap, ArrowLeft, Mail, Eye, EyeOff, Home, Shield, HelpCircle, Key } from "lucide-react";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { SEO } from "@/components/SEO";

export default function Login() {
  const { logoUrl: currentLogoUrl } = useLogo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Show security logout message if redirected after auto-logout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reason = urlParams.get('reason');
    
    if (reason) {
      let message = '';
      let description = '';
      
      switch (reason) {
        case 'offline':
          message = 'Logged Out for Security';
          description = 'You were automatically logged out because your device went offline. Please log in again.';
          break;
        case 'inactivity':
          message = 'Session Expired';
          description = 'You were logged out due to 30 minutes of inactivity. Please log in again.';
          break;
        default:
          message = 'Logged Out';
          description = 'Please log in again.';
      }
      
      toast({
        title: message,
        description,
        variant: "default",
      });
      
      // Clear URL params
      window.history.replaceState({}, '', '/portal/login');
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login({ email, password });
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      navigate("/portal");
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    try {
      // Use Firebase password reset for all email addresses
      await sendPasswordResetEmail(auth, resetEmail);
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email inbox for password reset instructions. If you don't receive an email, the address may not be registered with Firebase authentication.",
      });
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error) {
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Please check the email address and try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <SEO
        title="Student & Staff Login"
        description="Sign in to Seat of Wisdom Academy portal to access your student dashboard, grades, report cards, and academic information. Secure login for students, teachers, and administrators."
        keywords="student login, school portal, academic dashboard, student grades, report cards, school management system"
      />
      {/* Back to Website Button */}
      <div className="absolute top-4 left-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href = '/'}
          className="flex items-center space-x-2 bg-white/90 hover:bg-white"
          data-testid="button-back-to-website"
        >
          <Home className="h-4 w-4" />
          <span>Back to Website</span>
        </Button>
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src={currentLogoUrl} 
              alt="Seat of Wisdom Academy Logo" 
              className="h-20 w-20 object-contain rounded-md border border-gray-200 bg-white p-2" 
            />
          </div>
          <CardTitle className="text-2xl font-bold">Seat of Wisdom Academy</CardTitle>
          <CardDescription>
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showForgotPassword ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email or Student ID</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="Enter your email or student ID (e.g., SOWA/1001)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      required
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      title="Toggle password visibility"  
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              
              <div className="mt-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <Key className="h-3 w-3" />
                  <span>Default password: <strong className="text-gray-800 dark:text-gray-200">password@123</strong></span>
                </div>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="link"
                      className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
                      data-testid="button-change-password-help"
                    >
                      <HelpCircle className="h-4 w-4" />
                      How to change your password
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5 text-blue-600" />
                        How to Change Your Password
                      </DialogTitle>
                      <DialogDescription>
                        Follow these simple steps after logging in
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-medium">1</div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">Log in using your Student ID (e.g., SOWA/1001) and the default password <strong>password@123</strong></p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-medium">2</div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">Once logged in, click on <strong>"Settings"</strong> in the sidebar menu</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-medium">3</div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">Find the <strong>"Change Password"</strong> section</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-medium">4</div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">Enter your new password and confirm it, then click <strong>"Update Password"</strong></p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>Tip:</strong> Choose a strong password that you can remember. We recommend using a mix of letters, numbers, and symbols.
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button
                  variant="link"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Forgot your password?
                </Button>
              </div>
              
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForgotPassword(false)}
                  className="p-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg font-semibold">Reset Password</h3>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter your email address and we'll send you instructions to reset your password.
              </p>
              
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-10"
                      required
                      disabled={isResetting}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isResetting}>
                  {isResetting ? "Sending..." : "Send Reset Instructions"}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}