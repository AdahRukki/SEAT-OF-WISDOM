import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { firebaseSync } from "@/lib/offline-firebase-sync";
import { useFirebaseSync } from "@/hooks/use-firebase-sync";
import { checkFirebaseData } from "@/utils/check-firebase";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Plus, 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileText,
  Building,
  Building2,
  LogOut,
  User,
  School,
  Wifi,
  WifiOff,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";
import logoImage from "@assets/4oWHptM_1754171230437.gif";
import type { 
  Class, 
  Subject, 
  StudentWithDetails,
  School as SchoolType 
} from "@shared/schema";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Firebase sync status
  const [syncStatus, setSyncStatus] = useState(firebaseSync.getSyncStatus());
  
  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // State for dialogs
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [isClassDetailsDialogOpen, setIsClassDetailsDialogOpen] = useState(false);
  const [selectedClassForDetails, setSelectedClassForDetails] = useState<Class | null>(null);

  // Form states
  const [className, setClassName] = useState("");
  const [classDescription, setClassDescription] = useState("");

  // Student form states
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  // School selection for main admin
  const [selectedSchoolId, setSelectedSchoolId] = useState("");

  // Enable Firebase real-time sync for the selected school
  useFirebaseSync(selectedSchoolId);

  // Check Firebase data on mount
  useEffect(() => {
    checkFirebaseData();
  }, []);

  // Scores management states
  const [scoresClassId, setScoresClassId] = useState("");
  const [scoresSubjectId, setScoresSubjectId] = useState("");
  const [scoresTerm, setScoresTerm] = useState("First Term");
  const [scoresSession, setScoresSession] = useState("2024/2025");
  const [scoreInputs, setScoreInputs] = useState<{[key: string]: {firstCA: string, secondCA: string, exam: string}}>({});

  // Set initial school for sub-admin or first school for main admin
  useEffect(() => {
    if (user?.role === 'sub-admin' && user.schoolId) {
      setSelectedSchoolId(user.schoolId);
    }
  }, [user]);

  // Update sync status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatus(firebaseSync.getSyncStatus());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // School-aware queries
  const queryParams = user?.role === 'admin' && selectedSchoolId ? `?schoolId=${selectedSchoolId}` : '';
  
  const { data: schools = [] } = useQuery<SchoolType[]>({ 
    queryKey: ['/api/admin/schools'],
    enabled: user?.role === 'admin'
  });

  const { data: classes = [] } = useQuery<Class[]>({ 
    queryKey: ['/api/admin/classes', selectedSchoolId],
    queryFn: () => {
      const url = user?.role === 'admin' && selectedSchoolId 
        ? `/api/admin/classes?schoolId=${selectedSchoolId}`
        : '/api/admin/classes';
      return apiRequest(url);
    },
    enabled: !!selectedSchoolId || user?.role === 'sub-admin'
  });

  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ['/api/admin/subjects'] });
  const { data: allStudents = [] } = useQuery<StudentWithDetails[]>({ 
    queryKey: ['/api/admin/students', selectedSchoolId],
    queryFn: () => {
      const url = user?.role === 'admin' && selectedSchoolId 
        ? `/api/admin/students?schoolId=${selectedSchoolId}`
        : '/api/admin/students';
      return apiRequest(url);
    },
    enabled: !!selectedSchoolId || user?.role === 'sub-admin'
  });
  
  // Class subjects query
  const { data: classSubjects = [] } = useQuery<Subject[]>({ 
    queryKey: ['/api/admin/classes', scoresClassId, 'subjects'],
    queryFn: () => apiRequest(`/api/admin/classes/${scoresClassId}/subjects`),
    enabled: !!scoresClassId 
  });

  // Class assessments query
  const { data: classAssessments = [] } = useQuery<any[]>({ 
    queryKey: ['/api/admin/assessments', scoresClassId, scoresSubjectId, scoresTerm, scoresSession],
    queryFn: () => apiRequest(`/api/admin/assessments?classId=${scoresClassId}&subjectId=${scoresSubjectId}&term=${scoresTerm}&session=${scoresSession}`),
    enabled: !!scoresClassId && !!scoresSubjectId
  });

  // Class students query for details view
  const { data: classStudents = [] } = useQuery<StudentWithDetails[]>({ 
    queryKey: ['/api/admin/classes', selectedClassForDetails?.id, 'students'],
    queryFn: () => apiRequest(`/api/admin/classes/${selectedClassForDetails?.id}/students`),
    enabled: !!selectedClassForDetails?.id
  });

  // Mutations
  const createClassMutation = useMutation({
    mutationFn: async (classData: any) => {
      const newClass = await apiRequest('/api/admin/classes', {
        method: 'POST',
        body: { 
          ...classData, 
          schoolId: selectedSchoolId || user?.schoolId 
        }
      });
      
      // Sync to Firebase
      await firebaseSync.saveClass(newClass);
      
      return newClass;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Class created and synced to Firebase" });
      setIsClassDialogOpen(false);
      setClassName("");
      setClassDescription("");
      queryClient.invalidateQueries({ queryKey: ['/api/admin/classes'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create class", variant: "destructive" });
    }
  });

  const createStudentMutation = useMutation({
    mutationFn: async (studentData: any) => {
      const newStudent = await apiRequest('/api/admin/students', {
        method: 'POST',
        body: studentData
      });
      
      // Sync to Firebase
      await firebaseSync.saveStudent(newStudent);
      
      return newStudent;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Student created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/classes', selectedClassForDetails?.id, 'students'] });
      handleStudentCreated();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create student", variant: "destructive" });
    }
  });

  const updateScoresMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/admin/assessments', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Scores updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/assessments'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update scores", variant: "destructive" });
    }
  });

  const resetStudentForm = () => {
    setStudentFirstName("");
    setStudentLastName("");
    setStudentEmail("");
    setStudentPassword("");
    setStudentId("");
    setSelectedClassId("");
  };

  const handleStudentCreated = () => {
    resetStudentForm();
    setIsStudentDialogOpen(false);
    // If we came from class details, return to class details
    if (selectedClassForDetails) {
      setIsClassDetailsDialogOpen(true);
    }
  };

  // Auto-generate student ID in SOWA format
  const generateStudentId = async () => {
    try {
      // Get count of existing students to determine next ID
      const nextNumber = (allStudents.length + 1).toString().padStart(4, '0');
      const newId = `SOWA/${nextNumber}`;
      setStudentId(newId);
    } catch (error) {
      console.error('Error generating student ID:', error);
      // Fallback to timestamp-based ID
      const timestamp = Date.now().toString().slice(-4);
      setStudentId(`SOWA/${timestamp}`);
    }
  };

  // Auto-generate student ID when dialog opens
  useEffect(() => {
    if (isStudentDialogOpen && !studentId) {
      generateStudentId();
    }
  }, [isStudentDialogOpen, allStudents.length]);

  const handleScoreChange = (studentId: string, field: string, value: string) => {
    setScoreInputs(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSaveAllScores = () => {
    const scoresData = Object.entries(scoreInputs).map(([studentId, scores]) => ({
      studentId,
      subjectId: scoresSubjectId,
      classId: scoresClassId,
      term: scoresTerm,
      session: scoresSession,
      firstCA: parseInt(scores.firstCA) || 0,
      secondCA: parseInt(scores.secondCA) || 0,
      exam: parseInt(scores.exam) || 0
    }));

    updateScoresMutation.mutate(scoresData);
  };

  const calculateGrade = (total: number) => {
    if (total >= 80) return 'A';
    if (total >= 70) return 'B';
    if (total >= 60) return 'C';
    if (total >= 50) return 'D';
    return 'F';
  };

  const openClassDetails = (classItem: Class) => {
    setSelectedClassForDetails(classItem);
    setIsClassDetailsDialogOpen(true);
  };

  // Report card generation function
  const generateReportCard = (student: any) => {
    // Create a printable report card
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) return;

    const reportHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Report Card - ${student.user.firstName} ${student.user.lastName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .school-name { color: #2563eb; font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-section { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
            .grades-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .grades-table th, .grades-table td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            .grades-table th { background-color: #f5f5f5; font-weight: bold; }
            .footer { text-align: center; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; }
            .signature-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 40px; }
            .signature { text-align: center; border-top: 1px solid #333; padding-top: 5px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">SEAT OF WISDOM ACADEMY</div>
            <div>COMPREHENSIVE ACADEMIC REPORT CARD</div>
            <div style="font-size: 14px; color: #666;">${scoresTerm} - Academic Session ${scoresSession}</div>
          </div>

          <div class="student-info">
            <div class="info-section">
              <h3 style="margin-top: 0;">Student Information</h3>
              <p><strong>Name:</strong> ${student.user.firstName} ${student.user.lastName}</p>
              <p><strong>Student ID:</strong> ${student.studentId}</p>
              <p><strong>Class:</strong> ${student.class.name}</p>
              <p><strong>Email:</strong> ${student.user.email}</p>
            </div>
            <div class="info-section">
              <h3 style="margin-top: 0;">Academic Session</h3>
              <p><strong>Term:</strong> ${scoresTerm}</p>
              <p><strong>Session:</strong> ${scoresSession}</p>
              <p><strong>School:</strong> ${student.class.school?.name || 'Seat of Wisdom Academy'}</p>
              <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <table class="grades-table">
            <thead>
              <tr>
                <th>SUBJECT</th>
                <th>1st CA<br>(20 marks)</th>
                <th>2nd CA<br>(20 marks)</th>
                <th>EXAM<br>(60 marks)</th>
                <th>TOTAL<br>(100 marks)</th>
                <th>GRADE</th>
                <th>REMARK</th>
              </tr>
            </thead>
            <tbody>
              ${subjects.map(subject => {
                const assessment = classAssessments.find(a => a.studentId === student.id && a.subjectId === subject.id);
                const firstCA = assessment?.firstCA || 0;
                const secondCA = assessment?.secondCA || 0;
                const exam = assessment?.exam || 0;
                const total = firstCA + secondCA + exam;
                const grade = total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : total >= 50 ? 'D' : 'F';
                const remark = total >= 80 ? 'Excellent' : total >= 70 ? 'Very Good' : total >= 60 ? 'Good' : total >= 50 ? 'Pass' : 'Fail';
                
                return `
                  <tr>
                    <td>${subject.name}</td>
                    <td>${firstCA}</td>
                    <td>${secondCA}</td>
                    <td>${exam}</td>
                    <td><strong>${total}</strong></td>
                    <td><strong>${grade}</strong></td>
                    <td>${remark}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <div style="margin-bottom: 20px;">
              <p><strong>Grading Scale:</strong> A (80-100) | B (70-79) | C (60-69) | D (50-59) | F (0-49)</p>
              <p><strong>Assessment Structure:</strong> 1st CA: 20 marks | 2nd CA: 20 marks | Examination: 60 marks</p>
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
            
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              This report card is generated electronically by Seat of Wisdom Academy Management System
            </p>
          </div>
        </body>
      </html>
    `;

    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
    
    // Auto-print after a short delay
    setTimeout(() => {
      reportWindow.print();
    }, 500);
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  // Show school selector screen for main admin who hasn't selected a school yet
  if (user.role === 'admin' && !selectedSchoolId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <img 
                  src={logoImage} 
                  alt="Seat of Wisdom Academy Logo" 
                  className="h-16 w-16 object-contain rounded-md" 
                />
              </div>
              <CardTitle className="text-2xl font-bold">Seat of Wisdom Academy</CardTitle>
              <CardDescription>
                Welcome back, {user.firstName}! Choose which school branch you'd like to manage today.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="school-select" className="text-sm font-medium">
                  Available School Branches
                </Label>
                <div className="grid gap-2">
                  {schools.map((school) => (
                    <Button
                      key={school.id}
                      variant="outline"
                      className="w-full justify-start h-auto p-4 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      onClick={() => setSelectedSchoolId(school.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <Building className="h-5 w-5 text-blue-600" />
                        <div className="text-left">
                          <div className="font-medium">{school.name}</div>
                          <div className="text-xs text-gray-500">Click to manage this branch</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    // Logout functionality
                    window.location.href = '/api/logout';
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo and School Info */}
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <div className="flex items-center space-x-2 min-w-0">
                <img 
                  src={logoImage} 
                  alt="Seat of Wisdom Academy Logo" 
                  className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded-md flex-shrink-0" 
                />
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                    Seat of Wisdom Academy
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                    {user.role === 'admin' ? 'Main Administrator' : 'Branch Administrator'}
                  </p>
                </div>
              </div>
              
              {/* Active School Display for Main Admin - Hidden on mobile */}
              {user.role === 'admin' && selectedSchoolId && (
                <div className="hidden lg:flex items-center space-x-2">
                  <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                    <SelectTrigger className="w-48">
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Right side - Status and User Actions */}
            <div className="flex items-center space-x-1 sm:space-x-4">
              {/* Firebase Sync Status - Simplified on mobile */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className={`flex items-center space-x-1 px-1 sm:px-2 py-1 rounded-full text-xs ${
                  syncStatus.isOnline 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                }`}>
                  {syncStatus.isOnline ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">
                    {syncStatus.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                {syncStatus.queueLength > 0 && (
                  <div className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1 sm:px-2 py-1 rounded-full text-xs hidden sm:block">
                    {syncStatus.queueLength} pending
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => firebaseSync.forcSync()}
                  disabled={!syncStatus.isOnline || syncStatus.syncInProgress}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${syncStatus.syncInProgress ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              {/* Navigation to User Management - Icon only on mobile */}
              {user.role === 'admin' && (
                <a
                  href="/users"
                  className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Users</span>
                </a>
              )}

              {/* User Info - Simplified on mobile */}
              <div className="flex items-center space-x-1 sm:space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <User className="h-4 w-4" />
                <span className="hidden md:inline">{user.firstName} {user.lastName}</span>
                <span className="md:hidden text-xs">{user.firstName}</span>
              </div>
              
              {/* Logout Button - Icon only on mobile */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/api/auth/logout'}
                className="px-2 sm:px-4"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline sm:ml-2">Logout</span>
              </Button>
            </div>
          </div>
          
          {/* Mobile School Selector - Shown below header on mobile for admin */}
          {user.role === 'admin' && selectedSchoolId && (
            <div className="lg:hidden pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
              <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="students" className="text-xs sm:text-sm">Students</TabsTrigger>
            <TabsTrigger value="scores" className="text-xs sm:text-sm">Scores</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{allStudents.length}</div>
                  <p className="text-xs text-muted-foreground">Across all classes</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{classes.length}</div>
                  <p className="text-xs text-muted-foreground">Active classes</p>
                </CardContent>
              </Card>
            </div>

            {/* Classes Overview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Classes Overview</CardTitle>
                  <CardDescription>
                    Manage classes and view student distribution
                  </CardDescription>
                </div>
                <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Class</DialogTitle>
                      <DialogDescription>
                        Add a new class to the system
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="class-name">Class Name</Label>
                        <Input
                          id="class-name"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                          placeholder="e.g., Grade 5A"
                        />
                      </div>
                      <div>
                        <Label htmlFor="class-description">Description (Optional)</Label>
                        <Textarea
                          id="class-description"
                          value={classDescription}
                          onChange={(e) => setClassDescription(e.target.value)}
                          placeholder="Optional description for this class..."
                        />
                      </div>
                      <Button 
                        onClick={() => createClassMutation.mutate({ name: className, description: classDescription })}
                        disabled={!className || createClassMutation.isPending}
                        className="w-full"
                      >
                        {createClassMutation.isPending ? "Creating..." : "Create Class"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((classItem) => {
                    const studentsInClass = allStudents.filter(s => s.classId === classItem.id);
                    return (
                      <Card key={classItem.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{classItem.name}</CardTitle>
                            <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {classItem.id}
                            </span>
                          </div>
                          <CardDescription>
                            {classItem.description || `Class in ${classItem.school?.name || 'Unknown School'}`}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">{studentsInClass.length} students</span>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openClassDetails(classItem)}
                            >
                              View Details
                            </Button>
                          </div>
                          {studentsInClass.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-gray-500 mb-1">Students:</p>
                              <div className="space-y-1">
                                {studentsInClass.slice(0, 3).map((student) => (
                                  <div key={student.id} className="text-xs text-gray-700 dark:text-gray-300">
                                    {student.user.firstName} {student.user.lastName} ({student.studentId})
                                  </div>
                                ))}
                                {studentsInClass.length > 3 && (
                                  <div className="text-xs text-gray-500">
                                    +{studentsInClass.length - 3} more...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Student Management</CardTitle>
                  <CardDescription>
                    Add and manage student accounts and information
                  </CardDescription>
                </div>
                <Dialog open={isStudentDialogOpen} onOpenChange={setIsStudentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Student</DialogTitle>
                      <DialogDescription>
                        Add a new student to the system
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="student-firstname">First Name</Label>
                          <Input
                            id="student-firstname"
                            value={studentFirstName}
                            onChange={(e) => setStudentFirstName(e.target.value)}
                            placeholder="John"
                          />
                        </div>
                        <div>
                          <Label htmlFor="student-lastname">Last Name</Label>
                          <Input
                            id="student-lastname"
                            value={studentLastName}
                            onChange={(e) => setStudentLastName(e.target.value)}
                            placeholder="Doe"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="student-email">Email</Label>
                        <Input
                          id="student-email"
                          type="email"
                          value={studentEmail}
                          onChange={(e) => setStudentEmail(e.target.value)}
                          placeholder="john.doe@student.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="student-password">Password</Label>
                        <div className="relative">
                          <Input
                            id="student-password"
                            type={showPassword ? "text" : "password"}
                            value={studentPassword}
                            onChange={(e) => setStudentPassword(e.target.value)}
                            placeholder="Enter password"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="student-id">Student ID (Auto-generated)</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="student-id"
                            value={studentId}
                            readOnly
                            placeholder="SOWA/0001"
                            className="bg-gray-50"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={generateStudentId}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="student-class">Class</Label>
                        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((classItem) => (
                              <SelectItem key={classItem.id} value={classItem.id}>
                                {classItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={() => createStudentMutation.mutate({
                          firstName: studentFirstName,
                          lastName: studentLastName,
                          email: studentEmail,
                          password: studentPassword,
                          studentId: studentId,
                          classId: selectedClassId
                        })}
                        disabled={!studentFirstName || !studentLastName || !studentEmail || !studentPassword || !selectedClassId || createStudentMutation.isPending}
                        className="w-full"
                      >
                        {createStudentMutation.isPending ? "Creating..." : "Create Student"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Student ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Class</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {allStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {student.user.firstName} {student.user.lastName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {student.studentId}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {student.user.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {student.class.name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scores Management Tab */}
          <TabsContent value="scores" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Score Entry System</CardTitle>
                <CardDescription>
                  Enter and manage student assessment scores (1st CA: 20 marks, 2nd CA: 20 marks, Exam: 60 marks)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <Label>Select Class</Label>
                    <Select value={scoresClassId} onValueChange={setScoresClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Select Subject</Label>
                    <Select value={scoresSubjectId} onValueChange={setScoresSubjectId} disabled={!scoresClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {classSubjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Term & Session</Label>
                    <Select value={`${scoresTerm}-${scoresSession}`} onValueChange={(value) => {
                      const [term, session] = value.split('-');
                      setScoresTerm(term.replace('_', ' '));
                      setScoresSession(session);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="First Term-2024/2025">First Term 2024/2025</SelectItem>
                        <SelectItem value="Second Term-2024/2025">Second Term 2024/2025</SelectItem>
                        <SelectItem value="Third Term-2024/2025">Third Term 2024/2025</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {scoresClassId && scoresSubjectId ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Student</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Student ID</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">1st CA (20)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">2nd CA (20)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Exam (60)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Total (100)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {allStudents
                          .filter(student => student.classId === scoresClassId)
                          .map((student) => {
                            const assessment = classAssessments.find(a => a.studentId === student.id);
                            const currentScores = scoreInputs[student.id] || {};
                            
                            const firstCA = parseInt(currentScores.firstCA) || assessment?.firstCA || 0;
                            const secondCA = parseInt(currentScores.secondCA) || assessment?.secondCA || 0;
                            const exam = parseInt(currentScores.exam) || assessment?.exam || 0;
                            const total = firstCA + secondCA + exam;
                            const grade = calculateGrade(total);
                            
                            return (
                              <tr key={student.id}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {student.user.firstName} {student.user.lastName}
                                </td>
                                <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                                  {student.studentId}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="20"
                                    className="w-16 h-8 text-center"
                                    value={currentScores.firstCA || assessment?.firstCA || ''}
                                    onChange={(e) => handleScoreChange(student.id, 'firstCA', e.target.value)}
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="20"
                                    className="w-16 h-8 text-center"
                                    value={currentScores.secondCA || assessment?.secondCA || ''}
                                    onChange={(e) => handleScoreChange(student.id, 'secondCA', e.target.value)}
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="60"
                                    className="w-16 h-8 text-center"
                                    value={currentScores.exam || assessment?.exam || ''}
                                    onChange={(e) => handleScoreChange(student.id, 'exam', e.target.value)}
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900 dark:text-white">
                                  {total}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                    grade === 'A' ? 'bg-green-500' : 
                                    grade === 'B' ? 'bg-blue-500' : 
                                    grade === 'C' ? 'bg-yellow-500' : 
                                    grade === 'D' ? 'bg-orange-500' : 'bg-red-500'
                                  } text-white`}>
                                    {grade}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        }
                      </tbody>
                    </table>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800">
                      <Button 
                        className="w-full"
                        onClick={handleSaveAllScores}
                        disabled={updateScoresMutation.isPending}
                      >
                        {updateScoresMutation.isPending ? "Saving..." : "Save All Scores"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Select Class and Subject
                    </h3>
                    <p className="text-gray-500">
                      Choose a class and subject above to view and manage student scores.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report Cards Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Report Card Generation</CardTitle>
                <CardDescription>
                  Generate and print comprehensive report cards for students
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <Label>Select Class</Label>
                    <Select value={scoresClassId} onValueChange={setScoresClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Term</Label>
                    <Select value={scoresTerm} onValueChange={setScoresTerm}>
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
                  <div>
                    <Label>Session</Label>
                    <Select value={scoresSession} onValueChange={setScoresSession}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024/2025">2024/2025</SelectItem>
                        <SelectItem value="2023/2024">2023/2024</SelectItem>
                        <SelectItem value="2022/2023">2022/2023</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {scoresClassId ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Available Report Cards</h3>
                      <Button 
                        onClick={() => {
                          // Generate bulk report cards
                          const studentsInClass = allStudents.filter(s => s.classId === scoresClassId);
                          studentsInClass.forEach(student => {
                            generateReportCard(student);
                          });
                        }}
                        disabled={!scoresClassId}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Generate All Reports
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allStudents
                        .filter(student => student.classId === scoresClassId)
                        .map((student) => (
                          <Card key={student.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">
                                {student.user.firstName} {student.user.lastName}
                              </CardTitle>
                              <CardDescription>
                                ID: {student.studentId}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span>Class:</span>
                                  <span className="font-medium">{student.class.name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Term:</span>
                                  <span className="font-medium">{scoresTerm}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Session:</span>
                                  <span className="font-medium">{scoresSession}</span>
                                </div>
                                <Button 
                                  variant="outline" 
                                  className="w-full"
                                  onClick={() => generateReportCard(student)}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Generate Report
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      Select a class to view available report cards
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Class Details Dialog */}
        <Dialog open={isClassDetailsDialogOpen} onOpenChange={setIsClassDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Class Details: {selectedClassForDetails?.name}</DialogTitle>
              <DialogDescription>
                {selectedClassForDetails?.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Students in this Class</h3>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm text-gray-600">{classStudents.length} students</span>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setSelectedClassId(selectedClassForDetails?.id || "");
                      setIsStudentDialogOpen(true);
                      setIsClassDetailsDialogOpen(false);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Student
                  </Button>
                </div>
              </div>
              
              {classStudents.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Student ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Parent Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {classStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {student.studentId}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {student.user.firstName} {student.user.lastName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {student.user.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {student.parentContact || 'Not provided'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No students enrolled in this class yet.</p>
                  <p className="text-sm">Add students to see them here.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}