import { useState, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraduationCap, LogOut, BookOpen, Trophy, User, Printer, Lock, Eye, EyeOff, CreditCard, DollarSign, Receipt, AlertCircle, Bell } from "lucide-react";
// Logo is now loaded dynamically via useLogo hook
import { apiRequest } from "@/lib/queryClient";
import type { StudentWithDetails, Assessment, Subject, Class } from "@shared/schema";
import { changePasswordSchema, calculateGrade } from "@shared/schema";
import type { z } from "zod";

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

type Notification = {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  createdAt: Date | string;
};

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const { logoUrl: currentLogoUrl } = useLogo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Queries
  const { data: profile } = useQuery<StudentWithDetails>({ 
    queryKey: ['/api/student/profile'] 
  });

  const { data: academicInfo } = useQuery<{
    currentSession: string | null;
    currentTerm: string | null;
  }>({
    queryKey: ['/api/current-academic-info'],
  });

  // Fetch all classes student has been enrolled in (current + historical)
  const { data: enrolledClasses = [] } = useQuery<Class[]>({
    queryKey: ['/api/student/classes'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/student/classes', {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch student classes');
      return response.json();
    },
    enabled: !!profile
  });

  const { data: assessments = [] } = useQuery<(Assessment & { subject: Subject })[]>({ 
    queryKey: ['/api/student/assessments', selectedTerm, selectedClass, selectedSession],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedClass) params.append('classId', selectedClass);
      if (selectedSession) params.append('session', selectedSession);
      
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/student/assessments?${params}`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch assessments');
      return response.json();
    },
    enabled: !!profile && !!selectedTerm && !!selectedClass && !!selectedSession
  });

  // Check if scores are published for selected class/term/session
  const { data: scoresPublicationStatus } = useQuery<{ published: boolean }>({ 
    queryKey: ['/api/scores/published-status', selectedClass, selectedTerm, selectedSession],
    queryFn: () => apiRequest(`/api/scores/published-status?classId=${selectedClass}&term=${selectedTerm}&session=${selectedSession}`),
    enabled: !!selectedClass && !!selectedTerm && !!selectedSession
  });

  // Get full published score info including next term resume date
  const { data: publishedScoreInfo } = useQuery<{
    id: string;
    classId: string;
    term: string;
    session: string;
    publishedBy: string;
    publishedAt: string;
    nextTermResumes: string | null;
  } | null>({ 
    queryKey: ['/api/scores/published-info', selectedClass, selectedTerm, selectedSession],
    queryFn: () => apiRequest(`/api/scores/published-info?classId=${selectedClass}&term=${selectedTerm}&session=${selectedSession}`),
    enabled: !!selectedClass && !!selectedTerm && !!selectedSession && scoresPublicationStatus?.published === true
  });

  // Student financial data
  const { data: studentFees = [] } = useQuery<any[]>({ 
    queryKey: ['/api/student/fees', selectedTerm, selectedClass, selectedSession],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedClass) params.append('classId', selectedClass);
      if (selectedSession) params.append('session', selectedSession);
      
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/student/fees?${params}`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch student fees');
      return response.json();
    },
    enabled: !!profile && !!selectedTerm && !!selectedClass && !!selectedSession
  });

  const { data: paymentHistory = [] } = useQuery<any[]>({ 
    queryKey: ['/api/student/payments', selectedTerm, selectedClass, selectedSession],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedClass) params.append('classId', selectedClass);
      if (selectedSession) params.append('session', selectedSession);
      
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/student/payments?${params}`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch payment history');
      return response.json();
    },
    enabled: !!profile && !!selectedTerm && !!selectedClass && !!selectedSession
  });

  // Fetch behavioral ratings
  const { data: behavioralRating = null } = useQuery<any>({ 
    queryKey: ['/api/student/behavioral-ratings', selectedTerm, selectedClass, selectedSession],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedClass) params.append('classId', selectedClass);
      if (selectedSession) params.append('session', selectedSession);
      
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/student/behavioral-ratings?${params}`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!profile && !!selectedTerm && !!selectedClass && !!selectedSession
  });

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({ 
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/notifications', {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    enabled: !!user
  });

  const calculateGrade = (total: number) => {
    if (total >= 75) return { grade: 'A1', color: 'bg-green-600', remark: 'Excellent' };
    if (total >= 70) return { grade: 'B2', color: 'bg-green-500', remark: 'Very Good' };
    if (total >= 65) return { grade: 'B3', color: 'bg-blue-600', remark: 'Good' };
    if (total >= 60) return { grade: 'C4', color: 'bg-blue-500', remark: 'Credit' };
    if (total >= 55) return { grade: 'C5', color: 'bg-blue-400', remark: 'Credit' };
    if (total >= 50) return { grade: 'C6', color: 'bg-yellow-600', remark: 'Credit' };
    if (total >= 45) return { grade: 'D7', color: 'bg-yellow-500', remark: 'Pass' };
    if (total >= 40) return { grade: 'E8', color: 'bg-orange-500', remark: 'Pass' };
    return { grade: 'F9', color: 'bg-red-500', remark: 'Fail' };
  };

  const calculateOverallAverage = () => {
    if (assessments.length === 0) return 0;
    const total = assessments.reduce((acc, assessment) => acc + Number(assessment.total), 0);
    return Math.round(total / assessments.length);
  };

  const overallAverage = calculateOverallAverage();
  const overallGrade = calculateGrade(overallAverage);

  // Helper function to calculate age from date of birth
  const calculateAge = (dateOfBirth: string | Date | null): number | string => {
    if (!dateOfBirth) return 'N/A';
    const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    return calculatedAge;
  };

  // Auto-select class when enrolled classes are loaded
  useEffect(() => {
    if (enrolledClasses.length > 0 && !selectedClass) {
      // Prefer current class if it exists in enrolled classes
      if (profile?.class?.id) {
        const currentClass = enrolledClasses.find(c => c.id === profile.class?.id);
        if (currentClass) {
          setSelectedClass(currentClass.id);
          return;
        }
      }
      // Default to first enrolled class
      setSelectedClass(enrolledClasses[0].id);
    }
  }, [enrolledClasses, profile?.class?.id, selectedClass]);
  
  useEffect(() => {
    if (academicInfo?.currentTerm) {
      setSelectedTerm(academicInfo.currentTerm);
    }
    if (academicInfo?.currentSession) {
      setSelectedSession(academicInfo.currentSession);
    }
  }, [academicInfo]);

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

  // Mark notification as read mutation
  const markNotificationAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const handlePrintDetailedReport = async () => {
    if (!profile) return;
    
    // Get the selected class details
    const selectedClassObj = enrolledClasses.find(c => c.id === selectedClass);
    
    // Calculate totals
    const totalMarks = assessments.reduce((sum, assessment) => {
      return sum + (Number(assessment.firstCA || 0) + Number(assessment.secondCA || 0) + Number(assessment.exam || 0));
    }, 0);

    const averagePercentage = assessments.length ? (totalMarks / (assessments.length * 100) * 100) : 0;

    // Helper functions
    const getPrincipalComment = (avgPercentage: number): string => {
      if (avgPercentage >= 90) {
        return "Outstanding performance! You have demonstrated excellent understanding and consistency. Keep up this remarkable standard.";
      } else if (avgPercentage >= 80) {
        return "A very good result! You are focused and hardworking. Maintain this level of commitment for even greater success.";
      } else if (avgPercentage >= 75) {
        return "Good performance! With a bit more effort and consistency, you can achieve excellence.";
      } else if (avgPercentage >= 70) {
        return "Fairly good performance. Continue to work hard and stay focused on your goals.";
      } else if (avgPercentage >= 65) {
        return "Average performance. You need to put in more effort to improve your grades.";
      } else if (avgPercentage >= 60) {
        return "Below average performance. Please dedicate more time to your studies.";
      } else if (avgPercentage >= 50) {
        return "You passed, but there is significant room for improvement. Work harder next term.";
      } else if (avgPercentage >= 45) {
        return "Weak performance. You need to be more serious with your studies.";
      } else if (avgPercentage >= 40) {
        return "Poor performance. Extra attention and effort are urgently needed.";
      } else {
        return "Very poor performance. Immediate action is required to improve your results.";
      }
    };

    const getBehavioralInterpretation = (behavioralRating: any): { averageRating: number; interpretation: string } | null => {
      if (!behavioralRating) return null;
      
      const ratings = [
        behavioralRating.attendancePunctuality || 3,
        behavioralRating.neatnessOrganization || 3,
        behavioralRating.respectPoliteness || 3,
        behavioralRating.participationTeamwork || 3,
        behavioralRating.responsibility || 3
      ];
      
      const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      
      let interpretation = '';
      if (averageRating >= 4.5) {
        interpretation = 'Excellent Behavior';
      } else if (averageRating >= 3.5) {
        interpretation = 'Very Good Behavior';
      } else if (averageRating >= 2.5) {
        interpretation = 'Good Behavior';
      } else if (averageRating >= 1.5) {
        interpretation = 'Fair Behavior - Needs Improvement';
      } else {
        interpretation = 'Poor Behavior - Urgent Attention Required';
      }
      
      return { averageRating: Math.round(averageRating * 10) / 10, interpretation };
    };

    const getRatingText = (rating: number | null | undefined): string => {
      if (!rating) return 'Not Rated';
      if (rating === 5) return 'Excellent';
      if (rating === 4) return 'Very Good';
      if (rating === 3) return 'Good';
      if (rating === 2) return 'Fair';
      if (rating === 1) return 'Poor';
      return 'Not Rated';
    };

    const formatNextTermDate = (dateString: string | null | undefined): string => {
      if (!dateString) return 'TBA';
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      const year = date.getFullYear();
      
      const getOrdinalSuffix = (n: number): string => {
        if (n > 3 && n < 21) return 'TH';
        switch (n % 10) {
          case 1: return 'ST';
          case 2: return 'ND';
          case 3: return 'RD';
          default: return 'TH';
        }
      };
      
      return `${day}${getOrdinalSuffix(day)} ${month}, ${year}`;
    };

    const principalComment = getPrincipalComment(averagePercentage);
    const behavioralInterpretation = behavioralRating ? getBehavioralInterpretation(behavioralRating) : null;

    // Generate the detailed report card
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) return;

    const reportHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Report Card - ${user?.firstName} ${user?.middleName ? user.middleName + ' ' : ''}${user?.lastName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: A4 portrait; margin: 5mm; }
            @media print {
              html, body {
                width: 210mm;
                height: 297mm;
                margin: 0;
                padding: 0;
              }
              .report-card {
                width: 100% !important;
                max-width: none !important;
                min-height: 287mm !important;
                margin: 0 !important;
                padding: 8mm !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                page-break-inside: avoid;
              }
              .print-button { display: none !important; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 0; 
              line-height: 1.2; 
              color: #1e3a8a;
              background: #eff6ff;
            }
            .report-card {
              width: 210mm;
              max-width: 210mm;
              min-height: 287mm;
              margin: 10px auto;
              background: #f8faff;
              box-shadow: 0 4px 6px rgba(37, 99, 235, 0.15);
              border-radius: 8px;
              overflow: hidden;
              padding: 15px;
            }
            .header {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              padding: 12px;
              text-align: center;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              margin-bottom: 8px;
              color: white;
            }
            .header-logo { 
              width: 55px; 
              height: 55px; 
              border-radius: 50%;
              border: 3px solid white;
              background: white;
              padding: 4px;
            }
            .header-text { flex: 1; }
            .school-name { 
              font-size: 20px; 
              font-weight: 800; 
              margin-bottom: 3px;
              letter-spacing: 0.5px;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            }
            .school-info {
              font-size: 8px;
              margin-bottom: 2px;
              opacity: 0.95;
              font-weight: 600;
            }
            .education-levels {
              font-size: 7px;
              margin-bottom: 2px;
              opacity: 0.9;
              font-weight: 500;
            }
            .school-motto { 
              font-size: 9px; 
              margin-bottom: 3px;
              opacity: 0.95;
              font-weight: 500;
            }
            .report-title { 
              font-size: 11px; 
              margin-top: 4px; 
              font-weight: 700;
              background: rgba(255,255,255,0.2);
              padding: 3px 8px;
              border-radius: 12px;
              display: inline-block;
            }
            .student-info {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 6px;
              padding: 10px;
              background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
              margin: 0 8px 8px 8px;
              font-size: 9px;
              border-radius: 6px;
              color: white;
            }
            .info-item { display: flex; gap: 4px; }
            .info-label { font-weight: 700; min-width: 45px; }
            .info-value { font-weight: 500; }
            .subjects-table {
              width: calc(100% - 16px);
              margin: 0 8px 8px 8px;
              border-collapse: collapse;
              border-radius: 6px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .subjects-table th {
              background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
              color: white;
              padding: 5px 3px;
              text-align: center;
              font-size: 8px;
              font-weight: 700;
              border: none;
            }
            .subjects-table td {
              padding: 4px;
              text-align: center;
              border: none;
              border-bottom: 1px solid #bfdbfe;
              font-size: 8px;
            }
            .subjects-table tr:nth-child(even) { background: #eff6ff; }
            .subjects-table tr:nth-child(odd) { background: #f8faff; }
            .subjects-table tr:hover { background: #dbeafe; }
            .subject-name { 
              text-align: left !important; 
              font-weight: 600; 
              text-transform: uppercase;
              color: #1e40af;
            }
            .grade { 
              font-weight: 800; 
              color: #2563eb;
            }
            .stats-section {
              padding: 8px;
              margin: 0 8px 8px 8px;
              background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
              border-radius: 6px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 6px;
            }
            .stat-card {
              background: #f8faff;
              padding: 6px;
              text-align: center;
              border-radius: 6px;
              box-shadow: 0 2px 4px rgba(37, 99, 235, 0.1);
            }
            .stat-label { 
              font-size: 7px; 
              font-weight: 700; 
              color: #60a5fa;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .stat-value { 
              font-size: 11px; 
              font-weight: 800; 
              margin-top: 3px;
              color: #1e40af;
            }
            .behavioral-section {
              padding: 8px;
              background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%);
              margin: 0 8px 8px 8px;
              border-radius: 6px;
            }
            .behavioral-section h3 {
              text-align: center;
              margin-bottom: 6px;
              font-size: 10px;
              font-weight: 800;
              color: #1e40af;
            }
            .behavioral-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 4px;
            }
            .behavioral-item {
              background: #f8faff;
              padding: 4px 6px;
              border-radius: 4px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .behavioral-label {
              font-size: 8px;
              font-weight: 600;
              color: #1e40af;
            }
            .behavioral-value {
              font-size: 8px;
              font-weight: 700;
              color: #2563eb;
            }
            .behavioral-interpretation-section {
              padding: 8px;
              margin: 8px 8px 0 8px;
              background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
              border-radius: 6px;
              text-align: center;
            }
            .behavioral-interpretation-section h4 {
              font-size: 9px;
              font-weight: 700;
              color: #1e40af;
              margin-bottom: 4px;
            }
            .behavioral-interpretation-text {
              font-size: 10px;
              font-weight: 800;
              color: #2563eb;
            }
            .principal-comment-section {
              padding: 8px;
              margin: 8px;
              background: linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%);
              border-radius: 6px;
            }
            .principal-comment-section h3 {
              text-align: center;
              margin-bottom: 6px;
              font-size: 10px;
              font-weight: 800;
              color: #1e3a8a;
            }
            .principal-comment-text {
              background: #f8faff;
              padding: 6px;
              border-radius: 4px;
              font-size: 8px;
              line-height: 1.4;
              color: #1e3a8a;
              font-style: italic;
              text-align: justify;
            }
            .grade-key {
              padding: 8px;
              margin: 0 8px 8px 8px;
              background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
              border-radius: 6px;
            }
            .grade-key-title {
              text-align: center;
              font-weight: 800;
              margin-bottom: 6px;
              color: #1e40af;
              font-size: 9px;
              letter-spacing: 0.5px;
            }
            .grade-key-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 4px;
              font-size: 7px;
              color: #1e40af;
            }
            .grade-key-grid div {
              background: #f8faff;
              padding: 3px;
              border-radius: 3px;
              text-align: center;
              font-weight: 600;
            }
            .footer {
              padding: 8px;
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              text-align: center;
              margin: 0 8px;
              border-radius: 6px;
            }
            .signature-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 6px;
            }
            .signature {
              text-align: center;
              border-top: 2px solid rgba(255,255,255,0.5);
              padding-top: 5px;
              font-size: 9px;
              font-weight: 600;
            }
            .signature-image {
              max-height: 40px;
              max-width: 150px;
              margin: 0 auto 5px auto;
              display: block;
            }
            .signature-name {
              font-size: 7px;
              color: rgba(255,255,255,0.9);
              margin-top: 2px;
            }
            .print-button {
              background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
              color: white;
              border: none;
              padding: 10px 20px;
              font-size: 14px;
              font-weight: 600;
              border-radius: 6px;
              cursor: pointer;
              margin: 10px 5px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            .print-button:hover {
              background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
            }
            @media print {
              * {
                print-color-adjust: exact !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body { background: white !important; margin: 0 !important; padding: 0 !important; }
              .report-card { 
                margin: 0 !important; 
                box-shadow: none !important;
                page-break-after: avoid;
                border-radius: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
              }
              .print-button {
                display: none !important;
              }
              @page { size: A4 portrait; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="report-card">
            <div class="header">
              <img src="/favicon.png" alt="School Logo" class="header-logo" />
              <div class="header-text">
                <div class="school-name">SEAT OF WISDOM ACADEMY</div>
                <div class="school-info">ASABA, DELTA STATE</div>
                <div class="education-levels">PRE NURSERY, NURSERY, PRIMARY & SECONDARY</div>
                <div class="school-motto">GOVERNMENT, WAEC AND NECO APPROVED</div>
                <div class="report-title">${selectedTerm} TERMLY PERFORMANCE REPORT - ${selectedSession} SESSION</div>
              </div>
            </div>
            
            <div class="student-info">
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">${user?.firstName} ${user?.middleName ? user.middleName + ' ' : ''}${user?.lastName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">ID:</span>
                <span class="info-value">${profile.studentId}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Class:</span>
                <span class="info-value">${selectedClassObj?.name || profile.class?.name || ''}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Gender:</span>
                <span class="info-value">${profile.gender || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Age:</span>
                <span class="info-value">${calculateAge(profile.dateOfBirth)} years</span>
              </div>
              <div class="info-item">
                <span class="info-label">Days School Opened:</span>
                <span class="info-value">---</span>
              </div>
              <div class="info-item">
                <span class="info-label">Days Present:</span>
                <span class="info-value">---</span>
              </div>
              <div class="info-item">
                <span class="info-label">Days Absent:</span>
                <span class="info-value">---</span>
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
                  <th>CLASS<br>AVG</th>
                  <th>SUBJ.<br>POS.</th>
                  <th>GRADE</th>
                  <th>REMARK</th>
                </tr>
              </thead>
              <tbody>
                ${assessments.map((assessment) => {
                  const firstCA = Number(assessment.firstCA || 0);
                  const secondCA = Number(assessment.secondCA || 0);
                  const exam = Number(assessment.exam || 0);
                  const total = firstCA + secondCA + exam;
                  
                  const { grade, remark } = calculateGrade(total);
                  
                  return `
                    <tr>
                      <td class="subject-name">${assessment.subject.name.toUpperCase()}</td>
                      <td>${firstCA}</td>
                      <td>${secondCA}</td>
                      <td>${exam}</td>
                      <td><strong>${total}</strong></td>
                      <td>---</td>
                      <td>---</td>
                      <td class="grade">${grade}</td>
                      <td>${remark}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="cumulative-section">
              <h3 style="text-align: center; margin-bottom: 10px; color: #1e3a5f; font-size: 12px; font-weight: bold;">CUMULATIVE REPORT</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: #f8fafc; border-radius: 4px;">
                  <span style="font-weight: 600;">1st Test Total:</span>
                  <span>${assessments.reduce((sum, a) => sum + Number(a.firstCA || 0), 0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: #f8fafc; border-radius: 4px;">
                  <span style="font-weight: 600;">No. of Subjects:</span>
                  <span>${assessments.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: #f8fafc; border-radius: 4px;">
                  <span style="font-weight: 600;">2nd Test Total:</span>
                  <span>${assessments.reduce((sum, a) => sum + Number(a.secondCA || 0), 0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: #f8fafc; border-radius: 4px;">
                  <span style="font-weight: 600;">Total Obtained:</span>
                  <span>${totalMarks}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: #f8fafc; border-radius: 4px;">
                  <span style="font-weight: 600;">Exam Total:</span>
                  <span>${assessments.reduce((sum, a) => sum + Number(a.exam || 0), 0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: #f8fafc; border-radius: 4px;">
                  <span style="font-weight: 600;">Total Obtainable:</span>
                  <span>${assessments.length * 100}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: #f8fafc; border-radius: 4px;">
                  <span style="font-weight: 600;">Total Score:</span>
                  <span style="font-weight: bold;">${totalMarks}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: #f8fafc; border-radius: 4px;">
                  <span style="font-weight: 600;">Average Mark:</span>
                  <span style="font-weight: bold;">${assessments.length ? ((totalMarks / (assessments.length * 100)) * 100).toFixed(1) : "0"}%</span>
                </div>
                <div style="grid-column: span 2; display: flex; justify-content: center; padding: 6px 8px; background: ${averagePercentage >= 50 ? '#dcfce7' : '#fee2e2'}; border-radius: 4px; margin-top: 4px;">
                  <span style="font-weight: bold; color: ${averagePercentage >= 50 ? '#166534' : '#991b1b'};">Result Status: ${averagePercentage >= 50 ? 'PASSED' : 'NEEDS IMPROVEMENT'}</span>
                </div>
              </div>
            </div>

            ${behavioralRating ? `
            <div class="behavioral-section">
              <h3>BEHAVIORAL ASSESSMENT</h3>
              <div class="behavioral-grid">
                <div class="behavioral-item">
                  <div class="behavioral-label">Attendance/Punctuality</div>
                  <div class="behavioral-value">${getRatingText(behavioralRating.attendancePunctuality)}</div>
                </div>
                <div class="behavioral-item">
                  <div class="behavioral-label">Neatness/Organization</div>
                  <div class="behavioral-value">${getRatingText(behavioralRating.neatnessOrganization)}</div>
                </div>
                <div class="behavioral-item">
                  <div class="behavioral-label">Respect/Politeness</div>
                  <div class="behavioral-value">${getRatingText(behavioralRating.respectPoliteness)}</div>
                </div>
                <div class="behavioral-item">
                  <div class="behavioral-label">Participation/Teamwork</div>
                  <div class="behavioral-value">${getRatingText(behavioralRating.participationTeamwork)}</div>
                </div>
                <div class="behavioral-item">
                  <div class="behavioral-label">Responsibility</div>
                  <div class="behavioral-value">${getRatingText(behavioralRating.responsibility)}</div>
                </div>
              </div>
            </div>
            
            ${behavioralInterpretation ? `
            <div class="behavioral-interpretation-section">
              <h4>Rating Scale: 5=Excellent, 4=Very Good, 3=Good, 2=Fair, 1=Poor</h4>
              <div class="behavioral-interpretation-text">${behavioralInterpretation.interpretation}</div>
            </div>
            ` : ''}
            ` : ''}

            <div class="principal-comment-section">
              <h3>PRINCIPAL'S COMMENT</h3>
              <p class="principal-comment-text">${principalComment}</p>
            </div>

            <div class="grade-key">
              <div class="grade-key-title">GRADE INTERPRETATION (WAEC STANDARD)</div>
              <div class="grade-key-grid">
                <div>A1 (75-100): Excellent</div>
                <div>B2 (70-74): Very Good</div>
                <div>B3 (65-69): Good</div>
                <div>C4 (60-64): Credit</div>
                <div>C5 (55-59): Credit</div>
                <div>C6 (50-54): Credit</div>
                <div>D7 (45-49): Pass</div>
                <div>E8 (40-44): Pass</div>
                <div>F9 (0-39): Fail</div>
              </div>
            </div>

            <div class="footer">
              <div style="text-align: center; margin-bottom: 8px; padding: 8px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 6px;">
                <span style="font-size: 11px; font-weight: bold; color: white;">NEXT TERM RESUMES: ${formatNextTermDate(publishedScoreInfo?.nextTermResumes)}</span>
              </div>
              <div class="signature-section">
                <div class="signature">
                  <div style="border-top: 2px solid rgba(255,255,255,0.5); padding-top: 5px; min-height: 30px;"></div>
                  Class Teacher
                </div>
                <div class="signature">
                  <img src="/principal-signature.png" alt="Principal Signature" class="signature-image" />
                  <div class="signature-name">Principal, Seat of Wisdom Academy Asaba</div>
                </div>
              </div>
              <div style="margin-top: 6px; font-size: 7px;">
                Generated: ${new Date().toLocaleDateString()}
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 10px;">
              <button class="print-button" onclick="window.print()">
                🖨️ Print Report Card
              </button>
              <button class="print-button" onclick="window.print()">
                ⬇️ Download Report Card
              </button>
            </div>

          </div>
          
          <script>
            function downloadReport() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
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
                    {user?.firstName} {user?.middleName ? `${user.middleName} ` : ''}{user?.lastName}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Notification Bell */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="relative flex items-center space-x-1 text-xs sm:text-sm"
                    data-testid="button-notifications"
                  >
                    <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center" data-testid="text-notification-count">
                        {notifications.filter(n => !n.isRead).length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold">Notifications</h3>
                    <p className="text-xs text-muted-foreground">
                      {notifications.filter(n => !n.isRead).length} unread
                    </p>
                  </div>
                  <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No notifications yet
                      </div>
                    ) : (
                      <div className="divide-y">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-4 hover:bg-accent cursor-pointer transition-colors ${
                              !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                            onClick={() => {
                              if (!notification.isRead) {
                                markNotificationAsReadMutation.mutate(notification.id);
                              }
                            }}
                            data-testid={`notification-${notification.id}`}
                          >
                            <p className="text-sm">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(notification.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <a 
                href="/profile"
                className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors text-xs sm:text-sm"
              >
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Profile</span>
              </a>
              <Button 
                onClick={logout} 
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
          <TabsList className="grid w-full grid-cols-3 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 py-2 h-auto">Overview</TabsTrigger>
            <TabsTrigger value="finance" className="text-xs sm:text-sm px-2 py-2 h-auto">Fees</TabsTrigger>
            <TabsTrigger value="profile" className="text-xs sm:text-sm px-2 py-2 h-auto">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Student Info Cards - Compact */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <Card className="p-2 sm:p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Subjects</p>
                    <p className="text-lg sm:text-xl font-bold">{assessments.filter(a => a.total > 0).length}</p>
                  </div>
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-2 sm:p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Class</p>
                    <p className="text-sm sm:text-lg font-bold truncate">{profile?.class?.name || 'N/A'}</p>
                  </div>
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>

              <Card className="p-2 sm:p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">ID</p>
                    <p className="text-xs sm:text-base font-bold truncate">{profile?.studentId || 'N/A'}</p>
                  </div>
                  <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>
            </div>

            {/* View Termly Performance */}
            <div className="mb-2">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">View Termly Performance</h3>
            </div>
            <Card className="p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                <div>
                  <label className="text-[10px] sm:text-xs font-medium mb-1 block text-muted-foreground">Class</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass} disabled={enrolledClasses.length === 0}>
                    <SelectTrigger data-testid="select-class" className="h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder={enrolledClasses.length > 0 ? "Select" : "..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {enrolledClasses.map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id}>
                          {classItem.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-medium mb-1 block text-muted-foreground">Session</label>
                  <Select value={selectedSession} onValueChange={setSelectedSession}>
                    <SelectTrigger data-testid="select-session" className="h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024/2025">2024/2025</SelectItem>
                      <SelectItem value="2025/2026">2025/2026</SelectItem>
                      <SelectItem value="2026/2027">2026/2027</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-medium mb-1 block text-muted-foreground">Term</label>
                  <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                    <SelectTrigger data-testid="select-term" className="h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="First Term">First Term</SelectItem>
                      <SelectItem value="Second Term">Second Term</SelectItem>
                      <SelectItem value="Third Term">Third Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Academic Performance & Report Card */}
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Performance - {selectedTerm}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {selectedSession}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {!scoresPublicationStatus?.published && selectedClass && selectedTerm && selectedSession ? (
                  <div className="text-center py-12 px-4">
                    <AlertCircle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Scores Not Yet Published
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                      Your scores for {selectedTerm}, {selectedSession} have not been published yet. 
                      Please check back later or contact your school administrator.
                    </p>
                  </div>
                ) : scoresPublicationStatus?.published && !publishedScoreInfo?.nextTermResumes ? (
                  <div className="text-center py-12 px-4">
                    <AlertCircle className="mx-auto h-16 w-16 text-orange-500 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Report Card Not Ready
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                      Your report card for {selectedTerm}, {selectedSession} is being prepared. 
                      Please check back later or contact your school administrator.
                    </p>
                  </div>
                ) : assessments.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="mb-4">
                      <svg
                        className="mx-auto h-16 w-16 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No Scores Available
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                      No scores have been recorded for {selectedTerm}, {selectedSession} yet. 
                      Please check back later or contact your school administrator.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Subject Scores List - Compact */}
                    <div className="space-y-2 mb-4">
                      {assessments.map((assessment) => {
                        const total = Number(assessment.total);
                        const { grade, color } = calculateGrade(total);
                        return (
                          <div key={assessment.id} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg">
                            <div className="flex flex-col min-w-0 flex-1 mr-2">
                              <span className="font-medium text-xs sm:text-sm truncate">{assessment.subject.name}</span>
                              <span className="text-[10px] sm:text-xs text-gray-500">
                                CA1:{assessment.firstCA} CA2:{assessment.secondCA} Ex:{assessment.exam}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              <span className="text-sm sm:text-lg font-bold">{total}%</span>
                              <Badge className={`${color} text-white text-[10px] sm:text-xs px-1 sm:px-2`}>
                                {grade}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Overall Performance Summary - Compact */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-lg mb-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Average</span>
                          <div className="text-xl sm:text-2xl font-bold">{overallAverage}%</div>
                        </div>
                        <Badge className={`${overallGrade.color} text-white text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2`}>
                          {overallGrade.grade} - {overallGrade.remark}
                        </Badge>
                      </div>
                    </div>

                    {/* Print Report Buttons - Responsive */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handlePrintDetailedReport}
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none text-xs sm:text-sm"
                        data-testid="button-view-report-content"
                      >
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        View Full Report
                      </Button>
                      <Button
                        onClick={handlePrintDetailedReport}
                        size="sm"
                        className="flex-1 sm:flex-none text-xs sm:text-sm"
                        data-testid="button-print-report-content"
                      >
                        <Printer className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Print Report Card</span>
                        <span className="sm:hidden">Print</span>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finance Tab - keeping existing content */}
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
                <CardTitle>My Fees - {selectedTerm}, {selectedSession}</CardTitle>
                <CardDescription>
                  View your assigned fees and payment status for the selected term
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select value={selectedClass} onValueChange={setSelectedClass} disabled={enrolledClasses.length === 0}>
                      <SelectTrigger>
                        <SelectValue placeholder={enrolledClasses.length > 0 ? "Select class" : "Loading..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {enrolledClasses.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedSession} onValueChange={setSelectedSession}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024/2025">2024/2025</SelectItem>
                        <SelectItem value="2025/2026">2025/2026</SelectItem>
                        <SelectItem value="2026/2027">2026/2027</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="First Term">First Term</SelectItem>
                        <SelectItem value="Second Term">Second Term</SelectItem>
                        <SelectItem value="Third Term">Third Term</SelectItem>
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
          </TabsContent>

          {/* Profile Tab - keeping existing content with password form */}
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
                      <p className="text-lg font-semibold">{user?.firstName} {user?.middleName ? `${user.middleName} ` : ''}{user?.lastName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-lg">{user?.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Student ID</label>
                      <p className="text-lg font-semibold">{profile?.studentId}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Age</label>
                      <p className="text-lg font-semibold">{calculateAge(profile?.dateOfBirth || null)} years</p>
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

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={changePasswordMutation.isPending}
                    >
                      {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
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