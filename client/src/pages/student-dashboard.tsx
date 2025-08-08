import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLogo } from "@/hooks/use-logo";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GraduationCap, LogOut, BookOpen, Trophy, User, Printer, Lock, Eye, EyeOff, CreditCard, DollarSign, Receipt, AlertCircle } from "lucide-react";
// Logo is now loaded dynamically via useLogo hook
import { apiRequest } from "@/lib/queryClient";
import type { StudentWithDetails, Assessment, Subject } from "@shared/schema";
import { changePasswordSchema } from "@shared/schema";
import type { z } from "zod";

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function StudentDashboard() {
  const { user } = useAuth();
  const { logoUrl: currentLogoUrl } = useLogo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTerm, setSelectedTerm] = useState("First Term");
  const [selectedSession, setSelectedSession] = useState("2024/2025");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Queries
  const { data: profile } = useQuery<StudentWithDetails>({ 
    queryKey: ['/api/student/profile'] 
  });

  const { data: assessments = [] } = useQuery<(Assessment & { subject: Subject })[]>({ 
    queryKey: ['/api/student/assessments', selectedTerm, selectedSession],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedSession) params.append('session', selectedSession);
      
      const response = await fetch(`/api/student/assessments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch assessments');
      return response.json();
    },
    enabled: !!profile
  });

  // Student financial data
  const { data: studentFees = [] } = useQuery<any[]>({ 
    queryKey: ['/api/student/fees', selectedTerm, selectedSession],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedSession) params.append('session', selectedSession);
      
      const response = await fetch(`/api/student/fees?${params}`);
      if (!response.ok) throw new Error('Failed to fetch student fees');
      return response.json();
    },
    enabled: !!profile
  });

  const { data: paymentHistory = [] } = useQuery<any[]>({ 
    queryKey: ['/api/student/payments', selectedTerm, selectedSession],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedSession) params.append('session', selectedSession);
      
      const response = await fetch(`/api/student/payments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch payment history');
      return response.json();
    },
    enabled: !!profile
  });

  const calculateGrade = (total: number) => {
    if (total >= 80) return { grade: 'A', color: 'bg-green-500' };
    if (total >= 60) return { grade: 'B', color: 'bg-blue-500' };
    if (total >= 50) return { grade: 'C', color: 'bg-yellow-500' };
    if (total >= 40) return { grade: 'D', color: 'bg-orange-500' };
    return { grade: 'F', color: 'bg-red-500' };
  };

  const calculateOverallAverage = () => {
    if (assessments.length === 0) return 0;
    const total = assessments.reduce((acc, assessment) => acc + Number(assessment.total), 0);
    return Math.round(total / assessments.length);
  };

  const overallAverage = calculateOverallAverage();
  const overallGrade = calculateGrade(overallAverage);

  // Password change form
  const passwordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordForm) => {
      return apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully!",
      });
      passwordForm.reset();
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const onPasswordSubmit = (data: ChangePasswordForm) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div>
                <div className="flex items-center space-x-3">
                  <img 
                    src={currentLogoUrl} 
                    alt="Seat of Wisdom Academy Logo" 
                    className="h-8 w-8 object-contain rounded-md flex-shrink-0 bg-white p-1" 
                  />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Seat of Wisdom Academy</h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 ml-11">
                  Welcome back, <a 
                    href="/profile"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    {user?.firstName} {user?.lastName}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <a 
                href="/profile"
                className="flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors text-sm"
              >
                <User className="h-4 w-4" />
                <span>Profile</span>
              </a>
              <Button 
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }} 
                variant="outline" 
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="scores" className="text-xs sm:text-sm">My Scores</TabsTrigger>
            <TabsTrigger value="finance" className="text-xs sm:text-sm">Fees</TabsTrigger>
            <TabsTrigger value="report" className="text-xs sm:text-sm">Report Card</TabsTrigger>
            <TabsTrigger value="profile" className="text-xs sm:text-sm">Profile</TabsTrigger>
            <TabsTrigger value="security" className="text-xs sm:text-sm">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overall Average</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overallAverage}%</div>
                  <Badge className={`${overallGrade.color} text-white mt-2`}>
                    Grade {overallGrade.grade}
                  </Badge>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assessments.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Class</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{profile?.class?.name || 'N/A'}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Student ID</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">{profile?.studentId || 'N/A'}</div>
                </CardContent>
              </Card>
            </div>

            {/* Academic Progress Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Academic Progress</CardTitle>
                <CardDescription>Your performance across all subjects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assessments.map((assessment) => {
                    const total = Number(assessment.total);
                    const { grade, color } = calculateGrade(total);
                    return (
                      <div key={assessment.id} className="flex items-center space-x-4">
                        <div className="w-24 text-sm font-medium">
                          {assessment.subject.name}
                        </div>
                        <div className="flex-1">
                          <Progress value={total} className="h-2" />
                        </div>
                        <div className="w-16 text-right text-sm font-medium">
                          {total}%
                        </div>
                        <Badge className={`${color} text-white w-8 text-center`}>
                          {grade}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scores" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">My Assessment Scores</h2>
              <div className="flex space-x-4">
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Term">First Term</SelectItem>
                    <SelectItem value="Second Term">Second Term</SelectItem>
                    <SelectItem value="Third Term">Third Term</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024/2025">2024/2025</SelectItem>
                    <SelectItem value="2023/2024">2023/2024</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6">
              {assessments.map((assessment) => {
                const total = Number(assessment.total);
                const { grade, color } = calculateGrade(total);
                return (
                  <Card key={assessment.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{assessment.subject.name}</CardTitle>
                          <CardDescription>Subject Code: {assessment.subject.code}</CardDescription>
                        </div>
                        <Badge className={`${color} text-white`}>
                          Grade {grade}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">First CA</p>
                          <p className="text-2xl font-bold">{assessment.firstCA || '0'}</p>
                          <p className="text-xs text-gray-500">out of 30</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Second CA</p>
                          <p className="text-2xl font-bold">{assessment.secondCA || '0'}</p>
                          <p className="text-xs text-gray-500">out of 30</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Exam</p>
                          <p className="text-2xl font-bold">{assessment.exam || '0'}</p>
                          <p className="text-xs text-gray-500">out of 70</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Total</p>
                          <p className="text-3xl font-bold text-blue-600">{total}</p>
                          <p className="text-xs text-gray-500">out of 100</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Progress value={total} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {assessments.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Scores Available
                    </h3>
                    <p className="text-gray-500">
                      Your assessment scores will appear here once they are recorded.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="finance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₦{studentFees.reduce((sum, fee) => sum + Number(fee.amount), 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">This term</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Amount Paid</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₦{paymentHistory.reduce((sum, payment) => sum + Number(payment.amount), 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Total payments</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₦{Math.max(0, studentFees.reduce((sum, fee) => sum + Number(fee.amount), 0) - paymentHistory.reduce((sum, payment) => sum + Number(payment.amount), 0)).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Balance due</p>
                </CardContent>
              </Card>
            </div>

            {/* Current Term Fees */}
            <Card>
              <CardHeader>
                <CardTitle>My Fees - {selectedTerm} {selectedSession}</CardTitle>
                <CardDescription>
                  View your assigned fees and payment status for the current term
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="First Term">First Term</SelectItem>
                        <SelectItem value="Second Term">Second Term</SelectItem>
                        <SelectItem value="Third Term">Third Term</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedSession} onValueChange={setSelectedSession}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024/2025">2024/2025</SelectItem>
                        <SelectItem value="2023/2024">2023/2024</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Fee Type</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Amount</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Paid</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Balance</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {studentFees.length === 0 ? (
                          <tr>
                            <td className="px-4 py-3 text-sm text-gray-500" colSpan={5}>
                              No fees assigned for the selected term and session.
                            </td>
                          </tr>
                        ) : (
                          studentFees.map((fee: any) => {
                            const paidAmount = paymentHistory
                              .filter((payment: any) => payment.studentFeeId === fee.id)
                              .reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
                            const balance = Number(fee.amount) - paidAmount;
                            const isPaid = balance <= 0;
                            
                            return (
                              <tr key={fee.id}>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                  {fee.feeType?.name || 'Unknown Fee'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                  ₦{Number(fee.amount).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                  ₦{paidAmount.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                  ₦{Math.max(0, balance).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <Badge variant={isPaid ? "default" : "destructive"}>
                                    {isPaid ? "Paid" : "Outstanding"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Payment History</CardTitle>
                  <CardDescription>
                    View all your fee payments and receipts
                  </CardDescription>
                </div>
                <Button variant="outline">
                  <Receipt className="h-4 w-4 mr-2" />
                  Print History
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Fee Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Amount</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Method</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Reference</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {paymentHistory.length === 0 ? (
                        <tr>
                          <td className="px-4 py-3 text-sm text-gray-500" colSpan={6}>
                            No payment history available yet.
                          </td>
                        </tr>
                      ) : (
                        paymentHistory.map((payment: any) => {
                          const studentFee = studentFees.find((fee: any) => fee.id === payment.studentFeeId);
                          return (
                            <tr key={payment.id}>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {new Date(payment.paymentDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {studentFee?.feeType?.name || 'Unknown Fee'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                ₦{Number(payment.amount).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {payment.paymentMethod?.charAt(0).toUpperCase() + payment.paymentMethod?.slice(1) || 'Cash'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {payment.reference || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <Button variant="outline" size="sm">
                                  <Receipt className="h-3 w-3 mr-1" />
                                  Receipt
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Payment Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
                <CardDescription>
                  How to make fee payments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Payment Methods Accepted</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Cash payments at the school office</li>
                    <li>• Bank transfers to school account</li>
                    <li>• Online payment portal (coming soon)</li>
                  </ul>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Important Notes</h4>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                    <li>• Always obtain a receipt for your payments</li>
                    <li>• Keep payment receipts for your records</li>
                    <li>• Contact the school office for payment assistance</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="report" className="space-y-6">
            {/* Term and Session Selection for Report Card */}
            <Card>
              <CardHeader>
                <CardTitle>Report Card Settings</CardTitle>
                <CardDescription>
                  Select the term and session to view your report card
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Academic Session</label>
                    <Select value={selectedSession} onValueChange={setSelectedSession}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024/2025">2024/2025</SelectItem>
                        <SelectItem value="2023/2024">2023/2024</SelectItem>
                        <SelectItem value="2022/2023">2022/2023</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Term</label>
                    <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="First Term">First Term</SelectItem>
                        <SelectItem value="Second Term">Second Term</SelectItem>
                        <SelectItem value="Third Term">Third Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Report Card</CardTitle>
                    <CardDescription>
                      Your comprehensive academic report for {selectedTerm}, {selectedSession}
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => window.print()} 
                    className="no-print"
                    variant="outline"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="report-card">
                <div className="space-y-6">
                  {/* School Header for Print */}
                  <div className="hidden print-only">
                    <div className="text-center mb-6">
                      <div className="flex items-center justify-center space-x-4 mb-4">
                        <img 
                          src={currentLogoUrl} 
                          alt="Seat of Wisdom Academy Logo" 
                          className="h-16 w-16 object-contain rounded-md bg-white p-2" 
                        />
                        <div>
                          <h1 className="text-2xl font-bold">SEAT OF WISDOM ACADEMY</h1>
                          <p className="text-lg font-semibold">STUDENT REPORT CARD</p>
                        </div>
                      </div>
                      <div className="border-t border-b border-gray-300 py-2 mb-4">
                        <p className="text-lg font-semibold">Academic Session: {selectedSession}</p>
                        <p className="text-lg font-semibold">Term: {selectedTerm}</p>
                      </div>
                    </div>
                  </div>

                  {/* Student Info */}
                  <div className="student-info grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">Student Name</p>
                      <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Student ID</p>
                      <p className="font-semibold">{profile?.studentId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Class</p>
                      <p className="font-semibold">{profile?.class?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Term</p>
                      <p className="font-semibold">{selectedTerm}, {selectedSession}</p>
                    </div>
                  </div>

                  {/* Grades Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Subject</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">1st CA</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">2nd CA</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Exam</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Total</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {assessments.map((assessment) => {
                          const total = Number(assessment.total);
                          const { grade } = calculateGrade(total);
                          return (
                            <tr key={assessment.id}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {assessment.subject.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                                {assessment.firstCA || '0'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                                {assessment.secondCA || '0'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                                {assessment.exam || '0'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900 dark:text-white">
                                {total}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`grade-badge inline-block px-2 py-1 rounded text-xs font-medium ${calculateGrade(total).color} text-white`}>
                                  {grade}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="summary grid grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Overall Average</p>
                      <p className="text-2xl font-bold text-blue-600">{overallAverage}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Overall Grade</p>
                      <Badge className={`${overallGrade.color} text-white text-lg`}>
                        {overallGrade.grade}
                      </Badge>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Subjects</p>
                      <p className="text-2xl font-bold text-blue-600">{assessments.length}</p>
                    </div>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Profile</CardTitle>
                <CardDescription>Your student information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Full Name</label>
                      <p className="text-lg font-semibold">{user?.firstName} {user?.lastName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-lg">{user?.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Student ID</label>
                      <p className="text-lg font-semibold">{profile?.studentId}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Class</label>
                      <p className="text-lg font-semibold">{profile?.class?.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Account Status</label>
                      <Badge className="bg-green-500 text-white">Active</Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Joined</label>
                      <p className="text-lg">
                        {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>Update your account password for security</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showCurrentPassword ? "text" : "password"}
                                placeholder="Enter current password"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              >
                                {showCurrentPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showNewPassword ? "text" : "password"}
                                placeholder="Enter new password (min 6 characters)"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                              >
                                {showNewPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm your new password"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2 pt-4">
                      <Button 
                        type="submit" 
                        disabled={changePasswordMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        {changePasswordMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Updating...
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4" />
                            Update Password
                          </>
                        )}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => {
                          passwordForm.reset();
                          setShowCurrentPassword(false);
                          setShowNewPassword(false);
                          setShowConfirmPassword(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Password Security Tips:</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Use at least 6 characters</li>
                    <li>• Include letters, numbers, and special characters</li>
                    <li>• Don't use personal information</li>
                    <li>• Keep your password confidential</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}