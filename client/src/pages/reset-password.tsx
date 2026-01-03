import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle, Lock, Loader2, ArrowLeft } from "lucide-react";
import logoImage from "@assets/4oWHptM_1754171230437.gif";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    if (!resetToken) {
      toast({
        title: "Invalid Reset Link",
        description: "The password reset link is invalid or missing the token.",
        variant: "destructive",
      });
      navigate('/login');
    } else {
      setToken(resetToken);
    }
  }, [navigate, toast]);

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      return apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Password Reset Successful",
        description: "Your password has been reset successfully. Redirecting to login...",
      });
      setTimeout(() => navigate('/login'), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to reset password. The reset link may have expired.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill in both password fields.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "The passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({
        title: "Invalid Token",
        description: "The reset token is missing or invalid.",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({ token, newPassword: password });
  };

  const isFormValid = password.length >= 6 && password === confirmPassword;

  if (!token) {
    return null;
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Password Updated!</h2>
            <p className="text-green-100 mt-2">Your password has been successfully reset</p>
          </div>
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Redirecting you to login page...
            </p>
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <img 
                  src={logoImage} 
                  alt="Seat of Wisdom Academy" 
                  className="h-20 w-20 rounded-full border-4 border-white/30 shadow-lg"
                />
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-md">
                  <Lock className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              Create New Password
            </h1>
            <p className="text-blue-100 mt-2 text-sm">
              Your new password must be different from your previous password
            </p>
          </div>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-gray-500" />
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your new password"
                    className="pr-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-500 hover:text-gray-700"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gray-500" />
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    data-testid="input-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    className="pr-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-500 hover:text-gray-700"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Password Requirements</p>
                <div className="space-y-2">
                  <div className={`flex items-center gap-3 text-sm transition-colors ${password.length >= 6 ? 'text-green-600' : 'text-gray-500'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${password.length >= 6 ? 'bg-green-100' : 'bg-gray-200'}`}>
                      {password.length >= 6 ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <span>At least 6 characters</span>
                  </div>
                  <div className={`flex items-center gap-3 text-sm transition-colors ${password && confirmPassword && password === confirmPassword ? 'text-green-600' : 'text-gray-500'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${password && confirmPassword && password === confirmPassword ? 'bg-green-100' : 'bg-gray-200'}`}>
                      {password && confirmPassword && password === confirmPassword ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className={`w-full h-12 text-base font-semibold transition-all ${
                  isFormValid 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl' 
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                disabled={resetPasswordMutation.isPending || !isFormValid}
                data-testid="button-reset-password"
              >
                {resetPasswordMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Resetting Password...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Reset Password
                  </span>
                )}
              </Button>

              <div className="text-center pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/login')}
                  className="text-sm text-gray-600 hover:text-blue-600 gap-2"
                  data-testid="link-back-to-login"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-blue-200 text-sm mt-6">
          Seat of Wisdom Academy
        </p>
      </div>
    </div>
  );
}
