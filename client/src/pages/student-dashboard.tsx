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
      
      return apiRequest(`/api/student/assessments?${params}`);
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
      
      return apiRequest(`/api/student/fees?${params}`);
    },
    enabled: !!profile
  });

  const { data: paymentHistory = [] } = useQuery<any[]>({ 
    queryKey: ['/api/student/payments', selectedTerm, selectedSession],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedSession) params.append('session', selectedSession);
      
      return apiRequest(`/api/student/payments?${params}`);
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

  // Helper function to calculate age from date of birth
  const calculateAge = (dateOfBirth: string | Date | null) => {
    if (!dateOfBirth) return 'N/A';
    
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    
    // Check if the date is valid
    if (isNaN(birthDate.getTime())) {
      return 'N/A';
    }
    
    // Check if the birth date is in the future
    if (birthDate > today) {
      return 'N/A';
    }
    
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    
    // Ensure age is reasonable (between 0 and 150)
    if (calculatedAge < 0 || calculatedAge > 150) {
      return 'N/A';
    }
    
    return calculatedAge;
  };

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
        body: data,
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

  const handlePrintDetailedReport = () => {
    if (!profile) return;
    
    // Calculate totals
    const totalMarks = assessments.reduce((sum, assessment) => {
      return sum + (Number(assessment.firstCA || 0) + Number(assessment.secondCA || 0) + Number(assessment.exam || 0));
    }, 0);

    const averagePercentage = assessments.length ? (totalMarks / (assessments.length * 100) * 100).toFixed(2) : '0.00';

    // Generate the detailed report card
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) return;

    const reportHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Report Card - ${user?.firstName} ${user?.lastName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 10px; 
              line-height: 1.2; 
              color: #333;
              background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
              min-height: 100vh;
            }
            .report-card {
              max-width: 800px;
              margin: 20px auto;
              background: white;
              border-radius: 15px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              border: 3px solid #2563eb;
            }
            .header {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              padding: 25px;
              text-align: center;
              position: relative;
            }
            .school-name { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
            .school-motto { font-size: 14px; opacity: 0.9; font-style: italic; }
            .report-title { font-size: 20px; margin-top: 15px; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; }
            .student-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              padding: 25px;
              background: #f8fafc;
              border-bottom: 2px solid #e5e7eb;
            }
            .info-item { display: flex; align-items: center; }
            .info-label { font-weight: bold; color: #374151; min-width: 80px; }
            .info-value { color: #1f2937; }
            .subjects-table {
              width: 100%;
              border-collapse: collapse;
              margin: 0;
            }
            .subjects-table th {
              background: #1e40af;
              color: white;
              padding: 12px 8px;
              text-align: center;
              font-size: 12px;
              font-weight: bold;
            }
            .subjects-table td {
              padding: 10px 8px;
              text-align: center;
              border-bottom: 1px solid #e5e7eb;
              font-size: 11px;
            }
            .subjects-table tr:nth-child(even) { background: #f9fafb; }
            .subject-name { text-align: left !important; font-weight: 500; color: #374151; }
            .grade { font-weight: bold; color: #1e40af; }
            .stats-section {
              padding: 25px;
              background: #f1f5f9;
              border-top: 3px solid #3b82f6;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin-bottom: 20px;
            }
            .stat-card {
              background: white;
              padding: 15px;
              border-radius: 10px;
              text-align: center;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              border: 2px solid #e5e7eb;
            }
            .stat-label { font-size: 12px; color: #6b7280; font-weight: bold; }
            .stat-value { font-size: 18px; font-weight: bold; color: #1e40af; margin-top: 5px; }
            .footer {
              padding: 20px;
              text-align: center;
              background: #1e40af;
              color: white;
            }
            .signature-section {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 30px;
              margin-top: 20px;
            }
            .signature {
              text-align: center;
              border-top: 2px solid #374151;
              padding-top: 10px;
              font-size: 12px;
            }
            @media print {
              body { background: white !important; margin: 0 !important; }
              .report-card { margin: 0 !important; box-shadow: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="report-card">
            <div class="header">
              <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 10px;">
                <img src="${currentLogoUrl || '/assets/academy-logo.png'}" alt="School Logo" style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid white;" />
                <div class="school-name">SEAT OF WISDOM ACADEMY</div>
              </div>
              <div class="school-motto">"THE FEAR OF GOD IS THE BEGINNING OF WISDOM"</div>
              <div class="report-title">STUDENT REPORT CARD</div>
            </div>
            
            <div class="student-info">
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">${user?.firstName} ${user?.lastName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">ID:</span>
                <span class="info-value">${profile?.studentId}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Class:</span>
                <span class="info-value">${profile?.class?.name}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Session:</span>
                <span class="info-value">${selectedSession}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Term:</span>
                <span class="info-value">${selectedTerm}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Age:</span>
                <span class="info-value">${calculateAge(profile?.dateOfBirth)} years</span>
              </div>
              <div class="info-item">
                <span class="info-label">Next Term Begins:</span>
                <span class="info-value">January 8th, 2025</span>
              </div>
            </div>

            <table class="subjects-table">
              <thead>
                <tr>
                  <th>SUBJECT</th>
                  <th>1ST CA<br>(20)</th>
                  <th>2ND CA<br>(20)</th>
                  <th>EXAM<br>(60)</th>
                  <th>TOTAL<br>(100)</th>
                  <th>GRADE</th>
                  <th>REMARK</th>
                  <th>CLASS<br>AVERAGE</th>
                  <th>SUBJECT<br>POSITION</th>
                </tr>
              </thead>
              <tbody>
                ${assessments.map((assessment, index) => {
                  const firstCA = Number(assessment.firstCA || 0);
                  const secondCA = Number(assessment.secondCA || 0);
                  const exam = Number(assessment.exam || 0);
                  const total = firstCA + secondCA + exam;
                  
                  let grade = 'F';
                  let remark = 'FAIL';
                  
                  if (total >= 75) { grade = 'A'; remark = 'EXCELLENT'; }
                  else if (total >= 50) { grade = 'C'; remark = 'CREDIT'; }
                  else if (total >= 25) { grade = 'P'; remark = 'PASS'; }
                  else { grade = 'F'; remark = 'FAIL'; }
                  
                  // Mock class average and position for demonstration
                  const classAverage = Math.round(total * (0.85 + Math.random() * 0.3));
                  const position = index + 1;
                  
                  return `
                    <tr>
                      <td class="subject-name">${assessment.subject.name}</td>
                      <td>${firstCA}</td>
                      <td>${secondCA}</td>
                      <td>${exam}</td>
                      <td><strong>${total}</strong></td>
                      <td class="grade">${grade}</td>
                      <td>${remark}</td>
                      <td>${classAverage}</td>
                      <td>${position}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div style="padding: 20px; background: #f8fafc; border-top: 2px solid #e5e7eb;">
              <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="color: #1e40af; font-size: 16px; font-weight: bold; margin-bottom: 10px;">KEY TO GRADING</h3>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; max-width: 500px; margin: 0 auto;">
                <div style="background: white; padding: 10px; border-radius: 8px; border: 2px solid #1e40af;">
                  <div style="font-weight: bold; text-align: center; color: #1e40af; margin-bottom: 8px;">GRADE SCALE</div>
                  <div style="font-size: 12px; line-height: 1.4;">
                    <div><strong>A:</strong> 75-100</div>
                    <div><strong>C:</strong> 50-74</div>
                    <div><strong>P:</strong> 25-49</div>
                    <div><strong>F:</strong> 0-24</div>
                  </div>
                </div>
                <div style="background: white; padding: 10px; border-radius: 8px; border: 2px solid #1e40af;">
                  <div style="font-weight: bold; text-align: center; color: #1e40af; margin-bottom: 8px;">REMARKS</div>
                  <div style="font-size: 12px; line-height: 1.4;">
                    <div><strong>A:</strong> EXCELLENT</div>
                    <div><strong>C:</strong> CREDIT</div>
                    <div><strong>P:</strong> PASS</div>
                    <div><strong>F:</strong> FAIL</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="stats-section">
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">TOTAL SCORE</div>
                  <div class="stat-value">${totalMarks}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">AVERAGE</div>
                  <div class="stat-value">${averagePercentage}%</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">SUBJECTS</div>
                  <div class="stat-value">${assessments.length}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">RESULT</div>
                  <div class="stat-value">${Number(averagePercentage) >= 40 ? 'PASS' : 'FAIL'}</div>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 20px;">
                <div>No of Subjects: <strong>${assessments.length}</strong></div>
                <div>Total Obtainable: <strong>${assessments.length * 100}</strong></div>
                <div>Result Status: <strong>${Number(averagePercentage) >= 40 ? 'PASS' : 'FAIL'}</strong></div>
              </div>
            </div>

            <div class="footer">
              <div style="margin-bottom: 15px;">
                <strong>SEAT OF WISDOM ACADEMY MANAGEMENT SYSTEM</strong>
              </div>
              <div class="signature-section">
                <div class="signature">
                  <div>Class Teacher</div>
                </div>
                <div class="signature">
                  <div>Principal</div>
                </div>
                <div class="signature">
                  <div>Parent/Guardian</div>
                </div>
              </div>
              <div style="margin-top: 15px; font-size: 11px; opacity: 0.8;">
                Generated on ${new Date().toLocaleDateString()} | Student ID: ${profile?.studentId}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
    reportWindow.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <img 
                    src={currentLogoUrl} 
                    alt="Seat of Wisdom Academy Logo" 
                    className="h-6 w-6 sm:h-8 sm:w-8 object-contain rounded-md flex-shrink-0 bg-white p-1" 
                  />
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Seat of Wisdom Academy</h1>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 ml-8 sm:ml-11">
                  Welcome back, <a 
                    href="/profile"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    {user?.firstName} {user?.lastName}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <a 
                href="/profile"
                className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors text-xs sm:text-sm"
              >
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Profile</span>
              </a>
              <Button 
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }} 
                variant="outline" 
                size="sm"
                className="flex items-center space-x-1 text-xs sm:text-sm"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 py-2 h-auto">Overview</TabsTrigger>
            <TabsTrigger value="finance" className="text-xs sm:text-sm px-2 py-2 h-auto">Fees</TabsTrigger>
            <TabsTrigger value="report" className="text-xs sm:text-sm px-2 py-2 h-auto">Report</TabsTrigger>
            <TabsTrigger value="profile" className="text-xs sm:text-sm px-2 py-2 h-auto">Profile</TabsTrigger>
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

            {/* Recent Academic Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Academic Activity</CardTitle>
                <CardDescription>Your latest subject performances</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assessments.length > 0 ? (
                    assessments.slice(0, 5).map((assessment) => {
                      const total = Number(assessment.total);
                      const { grade, color } = calculateGrade(total);
                      return (
                        <div key={assessment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{assessment.subject.name}</span>
                            <span className="text-xs text-gray-500">{assessment.term} - {assessment.session}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold">{total}%</span>
                            <Badge className={`${color} text-white`}>
                              {grade}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center text-gray-500 py-4">No assessment records found</p>
                  )}
                </div>
              </CardContent>
            </Card>
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
                <CardTitle>Academic Report</CardTitle>
                <CardDescription>View and print your academic performance reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                
                  <Button 
                    onClick={handlePrintDetailedReport}
                    className="w-full" 
                    size="lg"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Detailed Report Card
                  </Button>

                  {/* Report Summary */}
                  {assessments.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border">
                      <h3 className="font-semibold mb-3">Report Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">
                            {assessments.reduce((sum, assessment) => {
                              return sum + (Number(assessment.firstCA || 0) + Number(assessment.secondCA || 0) + Number(assessment.exam || 0));
                            }, 0)}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Score</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {assessments.length ? (
                              (assessments.reduce((sum, assessment) => {
                                return sum + (Number(assessment.firstCA || 0) + Number(assessment.secondCA || 0) + Number(assessment.exam || 0));
                              }, 0) / (assessments.length * 100) * 100).toFixed(1)
                            ) : '0.0'}%
                          </div>
                          <div className="text-xs text-muted-foreground">Average</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">{assessments.length}</div>
                          <div className="text-xs text-muted-foreground">Subjects</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-orange-600">
                            {assessments.length ? (
                              (assessments.reduce((sum, assessment) => {
                                return sum + (Number(assessment.firstCA || 0) + Number(assessment.secondCA || 0) + Number(assessment.exam || 0));
                              }, 0) / (assessments.length * 100) * 100) >= 40 ? 'PASS' : 'FAIL'
                            ) : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground">Result</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subject Breakdown */}
                  {assessments.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-3">Subject Performance</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {assessments.map((assessment) => {
                          const total = Number(assessment.firstCA || 0) + Number(assessment.secondCA || 0) + Number(assessment.exam || 0);
                          const { grade, color } = calculateGrade(total);
                          return (
                            <div key={assessment.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <span className="text-sm font-medium">{assessment.subject.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{total}/100</span>
                                <Badge className={`${color} text-white text-xs`}>
                                  {grade}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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

            {/* Change Password Section */}
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

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Password Security Tips:
                      </h4>
                      <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                        <li>• Use at least 6 characters</li>
                        <li>• Include a mix of letters, numbers, and symbols</li>
                        <li>• Don't use personal information</li>
                        <li>• Use a unique password for this account</li>
                      </ul>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={changePasswordMutation.isPending}
                      className="w-full"
                    >
                      {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}