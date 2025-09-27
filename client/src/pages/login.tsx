import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLogo } from "@/hooks/use-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { GraduationCap, ArrowLeft, Mail, Eye, EyeOff, Home } from "lucide-react";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login({ email, password });
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      navigate("/");
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
      // Try Firebase password reset first
      if (resetEmail === "adahrukki@gmail.com") {
        await sendPasswordResetEmail(auth, resetEmail);
        toast({
          title: "Password Reset Email Sent",
          description: "Check your Gmail inbox for password reset instructions.",
        });
      } else {
        // For local accounts, send reset request to backend
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: resetEmail }),
        });

        if (!response.ok) {
          throw new Error('Failed to send reset email');
        }

        toast({
          title: "Password Reset",
          description: "If this email exists in our system, you'll receive reset instructions.",
        });
      }
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error) {
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
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
              
              <div className="mt-4 text-center">
                <Button
                  variant="link"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Forgot your password?
                </Button>
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="font-semibold text-sm mb-2">Available Accounts:</h3>
                <div className="text-xs space-y-1">
                  <p><strong>Main Admin:</strong> adahrukki@gmail.com (Firebase Auth)</p>
                  <p><strong>Sub-Admin:</strong> kanayojoy@gmail.com</p>
                  <p><strong>Sub-Admin:</strong> okaforeunice@gmail.com</p>
                  <p><strong>Student:</strong> ike@gmail.com</p>
                  <p><strong>Student:</strong> Bassey@gmail.com</p>
                  <p><strong>Student:</strong> SUPERMAN@GMAIL.COM</p>
                </div>
                <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border-l-4 border-amber-400">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>Note:</strong> Contact your administrator for login credentials. 
                    Some accounts may use Firebase Authentication or local passwords.
                  </p>
                </div>
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