import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLogo } from "@/hooks/use-logo";
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
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Save,
  Download,
  Users, 
  UserPlus,
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
  EyeOff,
  Upload,
  Edit,
  Trash2,
  X,
  DollarSign,
  Settings,
  CreditCard,
  TrendingUp,
  Calendar,
  Receipt,
  Wallet,
  History,
  UserCheck,
  ClipboardCheck,
  AlertCircle,
  Shield,
  Phone,
  Loader2,
  Camera
} from "lucide-react";
import { AttendanceManagement } from "@/components/attendance-management";
import { ReportCardManagement } from "@/components/report-card-management";
import { TeacherGradesInterface } from "@/components/teacher-grades-interface";
import { ObjectUploader } from "@/components/ObjectUploader";
import { NewsManagement } from "@/components/news-management";
import { NotificationsManagement } from "@/components/notifications-management";
// Logo is now loaded dynamically via useLogo hook
import type { 
  Class, 
  Subject, 
  StudentWithDetails,
  FeeType,
  StudentFee,
  Payment,
  School as SchoolType 
} from "@shared/schema";
import { 
  insertFeeTypeSchema, 
  recordPaymentSchema, 
  assignFeeSchema,
  type AssignFeeForm 
} from "@shared/schema";
import type { z } from "zod";
import * as XLSX from 'xlsx';

type FeeTypeForm = z.infer<typeof insertFeeTypeSchema>;
type PaymentForm = z.infer<typeof recordPaymentSchema>;

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { logoUrl: currentLogoUrl, isLoading: logoLoading } = useLogo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Firebase sync status
  const [syncStatus, setSyncStatus] = useState(firebaseSync.getSyncStatus());
  
  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // State for dialogs
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [isClassDetailsDialogOpen, setIsClassDetailsDialogOpen] = useState(false);
  const [isSubjectManagementDialogOpen, setIsSubjectManagementDialogOpen] = useState(false);
  const [isNewSubjectDialogOpen, setIsNewSubjectDialogOpen] = useState(false);
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

  // Active tab state
  const [activeTab, setActiveTab] = useState("overview");

  // Student editing states
  const [isEditStudentDialogOpen, setIsEditStudentDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentWithDetails | null>(null);
  
  // Student deletion states
  const [isDeleteStudentDialogOpen, setIsDeleteStudentDialogOpen] = useState(false);
  const [selectedStudentForDeletion, setSelectedStudentForDeletion] = useState<StudentWithDetails | null>(null);
  const [studentEditForm, setStudentEditForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    email: "",
    classId: "",
    dateOfBirth: "",
    gender: "",
    profileImage: "",
    parentContact: "",
    parentWhatsApp: "",
    address: "",
    newPassword: ""
  });
  
  // Profile image upload states
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");

  // Logo upload states
  const [isLogoUploadDialogOpen, setIsLogoUploadDialogOpen] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  // Principal signature upload states
  const [isSignatureUploadDialogOpen, setIsSignatureUploadDialogOpen] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string>("");
  const [selectedSchoolForSignature, setSelectedSchoolForSignature] = useState<string>("");

  // Export dialog states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedExportClass, setSelectedExportClass] = useState("");

  // New subject creation states
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectDescription, setNewSubjectDescription] = useState("");

  // Report generation and promotion states
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<any>(null);
  const [nextTermResumptionDate, setNextTermResumptionDate] = useState("");
  const [reportTerm, setReportTerm] = useState("");
  const [reportSession, setReportSession] = useState("");
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
  const [studentsToPromote, setStudentsToPromote] = useState<string[]>([]);

  // User Management states
  const [isCreateSubAdminDialogOpen, setIsCreateSubAdminDialogOpen] = useState(false);
  const [isCreateMainAdminDialogOpen, setIsCreateMainAdminDialogOpen] = useState(false);
  const [isUserProfileDialogOpen, setIsUserProfileDialogOpen] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<User | null>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  
  // User form states
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [selectedSchoolForAdmin, setSelectedSchoolForAdmin] = useState("");
  
  // Edit user form states
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editSchoolId, setEditSchoolId] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [editChangePassword, setEditChangePassword] = useState(false);
  
  // User management password visibility
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  // Fee type management states
  const [isFeeTypeDialogOpen, setIsFeeTypeDialogOpen] = useState(false);
  const [isRecordPaymentDialogOpen, setIsRecordPaymentDialogOpen] = useState(false);
  const [isAssignFeeDialogOpen, setIsAssignFeeDialogOpen] = useState(false);
  const [isPaymentHistoryDialogOpen, setIsPaymentHistoryDialogOpen] = useState(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<StudentWithDetails | null>(null);
  const [selectedFinanceTerm, setSelectedFinanceTerm] = useState("First Term");
  const [selectedFinanceSession, setSelectedFinanceSession] = useState("2024/2025");
  const [feeFilter, setFeeFilter] = useState("all"); // all, paid, pending, overdue
  
  // Bulk payment states
  const [selectedPaymentClass, setSelectedPaymentClass] = useState("");
  const [bulkPaymentDate, setBulkPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkPayments, setBulkPayments] = useState<Array<{
    studentId: string;
    feeTypeId: string;
    amount: number;
    notes: string;
  }>>([]);

  // Fee type form
  const feeTypeForm = useForm<FeeTypeForm>({
    resolver: zodResolver(insertFeeTypeSchema),
    defaultValues: {
      name: "",
      amount: "",
      category: "",
      description: "",
      isActive: true,
    },
  });

  // Payment form
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      studentFeeId: "",
      amount: 0,
      paymentMethod: "cash",
      reference: "",
      paymentDate: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });

  const assignFeeForm = useForm<Pick<AssignFeeForm, 'feeTypeId' | 'classId'>>({
    resolver: zodResolver(assignFeeSchema.pick({ feeTypeId: true, classId: true })),
    defaultValues: {
      feeTypeId: "",
      classId: "",
    },
  });

  // Enable Firebase real-time sync for the selected school
  useFirebaseSync(selectedSchoolId);

  // Queries - Move queries to the top to avoid initialization issues
  const { data: schools = [] } = useQuery<SchoolType[]>({ 
    queryKey: ['/api/admin/schools'],
    enabled: user?.role === 'admin'
  });

  const { data: academicInfo } = useQuery<{
    currentSession: string | null;
    currentTerm: string | null;
  }>({
    queryKey: ['/api/current-academic-info'],
  });

  // Fetch academic sessions for dropdown
  const { data: academicSessions = [] } = useQuery<{ id: string; sessionYear: string; isActive: boolean }[]>({
    queryKey: ['/api/admin/academic-sessions'],
  });

  // Fetch academic terms
  const { data: academicTerms = [] } = useQuery<{ id: string; termName: string; sessionId: string; isActive: boolean }[]>({
    queryKey: ['/api/admin/academic-terms'],
  });

  // Sync Settings form with actual academic calendar
  useEffect(() => {
    if (academicInfo?.currentTerm) {
      setGlobalTerm(academicInfo.currentTerm);
    }
    if (academicInfo?.currentSession) {
      setGlobalSession(academicInfo.currentSession);
    }
  }, [academicInfo]);

  // Sync scores term and session with actual academic calendar
  useEffect(() => {
    if (academicInfo?.currentTerm) {
      setScoresTerm(academicInfo.currentTerm);
    }
    if (academicInfo?.currentSession) {
      setScoresSession(academicInfo.currentSession);
    }
  }, [academicInfo]);

  // Check Firebase data on mount
  useEffect(() => {
    checkFirebaseData();
  }, []);

  // Scores management states
  const [scoresClassId, setScoresClassId] = useState("");
  const [scoresSubjectId, setScoresSubjectId] = useState("");
  const [scoresTerm, setScoresTerm] = useState("");
  const [scoresSession, setScoresSession] = useState("");
  const [scoreInputs, setScoreInputs] = useState<{[key: string]: {firstCA: string, secondCA: string, exam: string}}>({});
  
  // Class-based student viewing
  const [selectedClassForStudents, setSelectedClassForStudents] = useState("");
  
  // Multi-step student creation form
  const [currentStep, setCurrentStep] = useState(1);
  const [studentCreationForm, setStudentCreationForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    email: "",
    password: "",
    studentId: "",
    classId: "",
    dateOfBirth: "",
    gender: "",
    profileImage: "",
    parentContact: "",
    parentWhatsApp: "",
    address: ""
  });
  const [studentFormErrors, setStudentFormErrors] = useState<{[key: string]: string}>({});
  
  // Universal settings management
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [globalTerm, setGlobalTerm] = useState("");
  const [globalSession, setGlobalSession] = useState("");
  

  
  // Subject assignment to classes
  const [isAssignSubjectDialogOpen, setIsAssignSubjectDialogOpen] = useState(false);
  const [selectedClassForSubject, setSelectedClassForSubject] = useState("");
  const [selectedSubjectToAssign, setSelectedSubjectToAssign] = useState("");

  // Single-word validation function
  const validateSingleWord = (value: string) => {
    if (!value) return "";
    if (value.includes(' ')) return 'Only single words are allowed (no spaces)';
    return "";
  };

  const handleStudentFormChange = (field: string, value: string) => {
    setStudentCreationForm(prev => ({
      ...prev,
      [field]: value
    }));

    // Validate single-word fields in real-time
    if (['firstName', 'lastName', 'middleName'].includes(field)) {
      const error = validateSingleWord(value);
      setStudentFormErrors(prev => ({
        ...prev,
        [field]: error
      }));
    }
  };

  // Multi-step form validation
  const isStep1Valid = () => {
    const { firstName, lastName, studentId, classId } = studentCreationForm;
    return firstName && lastName && studentId && classId;
  };

  const isStep2Valid = () => {
    const { gender } = studentCreationForm;
    return gender; // Gender is required
  };

  const isStep3Valid = () => {
    const { email, password, parentWhatsApp } = studentCreationForm;
    return email && password && parentWhatsApp;
  };

  const isStep4Valid = () => {
    return true; // Step 4 is optional fields only
  };

  const isStudentFormValid = () => {
    return isStep1Valid() && isStep2Valid() && isStep3Valid() && isStep4Valid();
  };

  // Multi-step navigation
  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetFormToStep1 = () => {
    setCurrentStep(1);
    setStudentCreationForm({
      firstName: "",
      lastName: "",
      middleName: "",
      email: "",
      password: "",
      studentId: "",
      classId: "",
      dateOfBirth: "",
      gender: "",
      profileImage: "",
      parentContact: "",
      parentWhatsApp: "",
      address: ""
    });
    setStudentFormErrors({});
  };

  // Set initial school for sub-admin or first school for main admin
  useEffect(() => {
    if (user?.role === 'sub-admin' && user.schoolId) {
      setSelectedSchoolId(user.schoolId);
    }
  }, [user]);

  // Don't auto-select school for admin - let them choose manually

  // Update sync status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatus(firebaseSync.getSyncStatus());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // School-aware queries  
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

  // User Management queries
  const { data: adminUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/admin/users?adminOnly=true'],
    enabled: user?.role === 'admin'
  });

  // Helper functions for user management
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-blue-600';
      case 'sub-admin': return 'bg-purple-600';
      default: return 'bg-gray-600';
    }
  };

  const getSchoolName = (schoolId: string) => {
    const school = schools.find(s => s.id === schoolId);
    return school?.name || 'Unknown School';
  };
  
  // Class subjects query for selected class in details dialog
  const { data: selectedClassSubjects = [] } = useQuery<Subject[]>({ 
    queryKey: ['/api/admin/classes', selectedClassForDetails?.id, 'subjects'],
    queryFn: () => apiRequest(`/api/admin/classes/${selectedClassForDetails?.id}/subjects`),
    enabled: !!selectedClassForDetails?.id 
  });

  // Class subjects query for scores
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

  // Financial data queries
  const { data: feeTypes = [] } = useQuery<FeeType[]>({ 
    queryKey: ['/api/admin/fee-types', selectedSchoolId],
    queryFn: () => {
      const url = user?.role === 'admin' && selectedSchoolId 
        ? `/api/admin/fee-types?schoolId=${selectedSchoolId}`
        : '/api/admin/fee-types';
      return apiRequest(url);
    },
    enabled: !!selectedSchoolId || user?.role === 'sub-admin'
  });

  const { data: studentFees = [] } = useQuery<any[]>({ 
    queryKey: ['/api/admin/student-fees', selectedSchoolId, selectedFinanceTerm, selectedFinanceSession],
    queryFn: () => {
      let url = '/api/admin/student-fees?';
      if (user?.role === 'admin' && selectedSchoolId) url += `schoolId=${selectedSchoolId}&`;
      url += `term=${selectedFinanceTerm}&session=${selectedFinanceSession}`;
      return apiRequest(url);
    },
    enabled: !!selectedSchoolId || user?.role === 'sub-admin'
  });

  const { data: financialSummary } = useQuery<any>({ 
    queryKey: ['/api/admin/financial-summary', selectedSchoolId, selectedFinanceTerm, selectedFinanceSession],
    queryFn: () => {
      let url = '/api/admin/financial-summary?';
      if (user?.role === 'admin' && selectedSchoolId) url += `schoolId=${selectedSchoolId}&`;
      url += `term=${selectedFinanceTerm}&session=${selectedFinanceSession}`;
      return apiRequest(url);
    },
    enabled: !!selectedSchoolId || user?.role === 'sub-admin'
  });

  const { data: payments = [] } = useQuery<Payment[]>({ 
    queryKey: ['/api/admin/payments', selectedSchoolId, selectedFinanceTerm, selectedFinanceSession],
    queryFn: () => {
      let url = '/api/admin/payments?';
      if (user?.role === 'admin' && selectedSchoolId) url += `schoolId=${selectedSchoolId}&`;
      url += `term=${selectedFinanceTerm}&session=${selectedFinanceSession}`;
      return apiRequest(url);
    },
    enabled: !!selectedSchoolId || user?.role === 'sub-admin'
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

  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
      setIsDeleteStudentDialogOpen(false);
      setSelectedStudentForDeletion(null);
      toast({
        title: "Success",
        description: "Student deleted successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error?.message || "Failed to delete student",
        variant: "destructive"
      });
    }
  });

  const createStudentMutation = useMutation({
    mutationFn: async (studentData: any) => {
      return await apiRequest('/api/admin/students', {
        method: 'POST',
        body: {
          ...studentData,
          parentWhatsapp: studentData.parentWhatsApp,
          schoolId: selectedSchoolId || user?.schoolId
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student created successfully with auto-generated SOWA ID",
      });
      setIsStudentDialogOpen(false);
      setStudentCreationForm({
        firstName: "",
        lastName: "",
        middleName: "",
        email: "",
        password: "",
        classId: "",
        dateOfBirth: "",
        parentContact: "",
        parentWhatsApp: "",
        address: ""
      });
      setStudentFormErrors({});
      queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/classes', selectedClassForDetails?.id, 'students'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create student",
        variant: "destructive",
      });
    },
  });

  // User Management Mutations
  const createSubAdminMutation = useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      schoolId: string;
    }) => {
      return apiRequest('/api/admin/create-sub-admin', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "Sub-Admin Created",
        description: "New sub-administrator has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsCreateSubAdminDialogOpen(false);
      // Reset form
      setAdminFirstName("");
      setAdminLastName("");
      setAdminEmail("");
      setAdminPassword("");
      setSelectedSchoolForAdmin("");
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create sub-admin. Please try again.",
        variant: "destructive",
      });
    }
  });

  const createMainAdminMutation = useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }) => {
      return apiRequest('/api/admin/create-main-admin', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "Main Admin Created",
        description: "New main administrator has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsCreateMainAdminDialogOpen(false);
      // Reset form
      setAdminFirstName("");
      setAdminLastName("");
      setAdminEmail("");
      setAdminPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create main admin. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      schoolId?: string;
      isActive: boolean;
    }) => {
      return apiRequest(`/api/admin/users/${data.id}`, {
        method: 'PATCH',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "User Updated",
        description: "User information has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsEditUserDialogOpen(false);
      // Reset form
      setEditFirstName("");
      setEditLastName("");
      setEditEmail("");
      setEditRole("");
      setEditSchoolId("all");
      setEditIsActive(true);
      setSelectedUserForEdit(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateScoresMutation = useMutation({
    mutationFn: async (scoresArray: any[]) => {
      // Use the bulk update endpoint for better performance
      return await apiRequest('/api/admin/scores/bulk-update', {
        method: 'POST',
        body: { scores: scoresArray }
      });
    },
    onSuccess: (response) => {
      // Handle both full success and partial failures (207)
      if (response.errors && response.errors.length > 0) {
        const failedCount = response.errors.length;
        const successCount = response.results?.length || 0;
        
        toast({ 
          title: "Partial Success", 
          description: `${successCount} scores saved successfully, ${failedCount} failed. Check console for details.`,
          variant: "destructive"
        });
        
        console.warn("Score save failures:", response.errors);
      } else {
        toast({ title: "Success", description: "Scores updated successfully" });
      }
      
      // Invalidate the exact query key that fetches assessments
      if (scoresClassId && scoresSubjectId && scoresTerm && scoresSession) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/admin/assessments', scoresClassId, scoresSubjectId, scoresTerm, scoresSession] 
        });
      }
      // Also invalidate broader assessment queries for good measure
      queryClient.invalidateQueries({ queryKey: ['/api/admin/assessments'] });
      setScoreInputs({}); // Clear the input state after successful save
    },
    onError: (error) => {
      console.error("Score update error:", error);
      const errorMessage = error?.message || "Failed to update scores";
      toast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  });

  // Single-word validation is now implemented earlier in the file

  // Student form validation is implemented earlier in the file

  // Enhanced student creation mutation is implemented earlier in the file

  // Create student with comprehensive validation
  const handleCreateStudent = () => {
    if (!isStudentFormValid()) {
      toast({ 
        title: "Validation Error", 
        description: "Please complete all required fields and fix validation errors", 
        variant: "destructive" 
      });
      return;
    }

    const studentData = {
      firstName: studentCreationForm.firstName,
      lastName: studentCreationForm.lastName,
      middleName: studentCreationForm.middleName || undefined,
      email: studentCreationForm.email,
      password: studentCreationForm.password,
      studentId: studentCreationForm.studentId,
      classId: studentCreationForm.classId || selectedClassForStudents,
      dateOfBirth: studentCreationForm.dateOfBirth || undefined,
      age: studentCreationForm.age ? parseInt(studentCreationForm.age) : undefined,
      gender: studentCreationForm.gender || undefined,
      parentContact: studentCreationForm.parentContact || undefined,
      parentWhatsApp: studentCreationForm.parentWhatsApp,
      address: studentCreationForm.address || undefined,
      profileImage: studentCreationForm.profileImage || undefined
    };

    createStudentMutation.mutate(studentData);
  };

  // Helper function to sort classes in proper order
  const sortClassesByOrder = (classes: any[]) => {
    const classOrder = ["J.S.S 1", "J.S.S 2", "J.S.S 3", "S.S.S 1", "S.S.S 2", "S.S.S 3"];
    return classes.sort((a, b) => {
      const aIndex = classOrder.indexOf(a.name);
      const bIndex = classOrder.indexOf(b.name);
      if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  };

  // Helper function to get next class in progression
  const getNextClass = (currentClassName: string): { nextClass: string | null; isGraduation: boolean } => {
    const classProgression = {
      "J.S.S 1": "J.S.S 2",
      "JSS1": "JSS2", 
      "JSS 1": "JSS 2",
      "J.S.S 2": "J.S.S 3",
      "JSS2": "JSS3",
      "JSS 2": "JSS 3", 
      "J.S.S 3": "S.S.S 1",
      "JSS3": "S.S.S 1",
      "JSS 3": "S.S.S 1",
      "S.S.S 1": "S.S.S 2",
      "SSS1": "S.S.S 2",
      "SSS 1": "S.S.S 2",
      "S.S.S 2": "S.S.S 3", 
      "SSS2": "S.S.S 3",
      "SSS 2": "S.S.S 3",
      "S.S.S 3": "Graduated",
      "SSS3": "Graduated",
      "SSS 3": "Graduated"
    };

    const nextClass = classProgression[currentClassName as keyof typeof classProgression] || null;
    const isGraduation = nextClass === "Graduated";
    
    return { nextClass, isGraduation };
  };

  // Logo upload mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      return apiRequest('/api/admin/logo', {
        method: 'POST',
        body: { logoUrl }
      });
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Academy logo updated successfully" });
      setIsLogoUploadDialogOpen(false);
      setLogoFile(null);
      setLogoPreview("");
      // Refresh the logo cache to show the new logo immediately
      queryClient.invalidateQueries({ queryKey: ['/api/logo'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to upload logo", variant: "destructive" });
    }
  });

  // Principal signature upload mutation
  const uploadSignatureMutation = useMutation({
    mutationFn: async ({ schoolId, signatureUrl }: { schoolId: string; signatureUrl: string }) => {
      return apiRequest('/api/admin/schools/signature', {
        method: 'POST',
        body: { schoolId, signatureUrl }
      });
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Principal signature updated successfully" });
      setIsSignatureUploadDialogOpen(false);
      setSignatureFile(null);
      setSignaturePreview("");
      setSelectedSchoolForSignature("");
      // Refresh the schools data to show the new signature immediately
      queryClient.invalidateQueries({ queryKey: ['/api/admin/schools'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to upload signature", variant: "destructive" });
    }
  });

  // Remove subject from class mutation
  const removeSubjectMutation = useMutation({
    mutationFn: async ({ classId, subjectId }: { classId: string; subjectId: string }) => {
      return await apiRequest(`/api/admin/classes/${classId}/subjects/${subjectId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Subject removed from class successfully" 
      });
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/admin/classes', selectedClassForDetails?.id, 'subjects'] 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to remove subject from class", 
        variant: "destructive" 
      });
    }
  });

  // Add subject to class mutation
  const addSubjectMutation = useMutation({
    mutationFn: async ({ classId, subjectId }: { classId: string; subjectId: string }) => {
      return await apiRequest(`/api/admin/classes/${classId}/subjects/${subjectId}`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Subject added to class successfully" 
      });
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/admin/classes', selectedClassForDetails?.id, 'subjects'] 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to add subject to class", 
        variant: "destructive" 
      });
    }
  });

  // Create new subject mutation
  const createSubjectMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; description?: string }) => {
      return await apiRequest('/api/admin/subjects', {
        method: 'POST',
        body: {
          ...data,
          name: data.name.toUpperCase()
        }
      });
    },
    onSuccess: (newSubject) => {
      toast({ 
        title: "Success", 
        description: "New subject created successfully" 
      });
      // Reset form
      setNewSubjectName("");
      setNewSubjectCode("");
      setNewSubjectDescription("");
      setIsNewSubjectDialogOpen(false);
      // Refresh subjects list
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subjects'] });
      
      // Automatically add the new subject to the current class if we're in subject management
      if (selectedClassForDetails?.id && isSubjectManagementDialogOpen) {
        addSubjectMutation.mutate({
          classId: selectedClassForDetails.id,
          subjectId: newSubject.id
        });
      }
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to create new subject", 
        variant: "destructive" 
      });
    }
  });

  // Show export dialog to choose class
  const showExportDialog = () => {
    setIsExportDialogOpen(true);
  };

  // Export student data function with class selection
  const exportStudentData = (format: 'excel' | 'pdf') => {
    console.log('=== EXPORT DEBUG START ===');
    console.log('Export called with format:', format);
    console.log('All students count:', allStudents?.length || 0);
    console.log('All students data:', allStudents);
    console.log('Selected school ID:', selectedSchoolId);
    console.log('Selected export class:', selectedExportClass);
    
    // Check if allStudents exists and has data
    if (!allStudents || allStudents.length === 0) {
      toast({
        title: "No Data",
        description: "No students found in the system",
        variant: "destructive"
      });
      return;
    }
    
    let studentsToExport = allStudents.filter(student => {
      console.log('Checking student:', student);
      console.log('Student schoolId:', student.schoolId);
      console.log('Student class schoolId:', student.class?.schoolId);
      
      // Check against both student.schoolId and student.class.schoolId
      const studentSchoolId = student.schoolId || student.class?.schoolId;
      const matchesSchool = !selectedSchoolId || studentSchoolId === selectedSchoolId;
      console.log('Matches school:', matchesSchool);
      return matchesSchool;
    });

    console.log('After school filter - students count:', studentsToExport.length);

    // Filter by specific class if selected
    if (selectedExportClass && selectedExportClass !== "all") {
      studentsToExport = studentsToExport.filter(student => {
        const matchesClass = student.classId === selectedExportClass;
        console.log('Student classId:', student.classId, 'Selected:', selectedExportClass, 'Matches:', matchesClass);
        return matchesClass;
      });
    }

    console.log('Final filtered students:', studentsToExport);
    console.log('Final filtered students count:', studentsToExport.length);

    if (studentsToExport.length === 0) {
      toast({
        title: "No Data",
        description: `No students found ${selectedExportClass === "all" ? "to export" : "in selected class"}`,
        variant: "destructive"
      });
      return;
    }

    if (format === 'excel') {
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Group students by class
      const studentsByClass = new Map<string, typeof studentsToExport>();
      
      studentsToExport.forEach(student => {
        const className = classes.find(c => c.id === student.classId)?.name || 'Unassigned';
        if (!studentsByClass.has(className)) {
          studentsByClass.set(className, []);
        }
        studentsByClass.get(className)!.push(student);
      });

      console.log('Students by class:', studentsByClass);

      if (studentsByClass.size === 0) {
        toast({
          title: "Export Error",
          description: "No student classes found to export",
          variant: "destructive"
        });
        return;
      }

      // Sort students by class order and create a sheet for each class
      const sortedClasses = Array.from(studentsByClass.entries()).sort((a, b) => {
        const classOrder = ["J.S.S 1", "J.S.S 2", "J.S.S 3", "S.S.S 1", "S.S.S 2", "S.S.S 3"];
        const aIndex = classOrder.indexOf(a[0]);
        const bIndex = classOrder.indexOf(b[0]);
        if (aIndex === -1 && bIndex === -1) return a[0].localeCompare(b[0]);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

      sortedClasses.forEach(([className, students]) => {
        const worksheetData = [
          ['Name', 'Age', 'Gender', 'Parent Number', 'Student ID', 'Class']
        ];

        students.forEach(student => {
          // Calculate age from date of birth
          let age = 'N/A';
          if (student.dateOfBirth) {
            const birthDate = new Date(student.dateOfBirth);
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              calculatedAge--;
            }
            age = calculatedAge.toString();
          }

          // Debug student structure
          console.log('Student structure:', student);
          
          // Combine names into full name - handle nested user structure
          const firstName = student.user?.firstName || student.firstName || '';
          const middleName = student.user?.middleName || student.middleName || '';
          const lastName = student.user?.lastName || student.lastName || '';
          const fullName = [firstName, middleName, lastName]
            .filter(name => name && name.trim())
            .join(' ') || 'N/A';

          worksheetData.push([
            fullName,
            age,
            student.gender || 'N/A',
            student.parentWhatsapp || student.parentContact || 'N/A',
            student.studentId || 'N/A',
            className
          ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        // Set column widths for better readability
        worksheet['!cols'] = [
          { width: 25 }, // Name
          { width: 8 },  // Age
          { width: 10 }, // Gender
          { width: 18 }, // Parent Number
          { width: 15 }, // Student ID
          { width: 15 }  // Class
        ];
        
        // Use valid sheet name (Excel has sheet name restrictions)
        const safeSheetName = className.replace(/[:\\\/?*\[\]]/g, '-').substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
      });

      // Add summary sheet if there are multiple classes
      if (studentsByClass.size > 1) {
        const summaryData = [
          ['Class', 'Total Students'],
          ...Array.from(studentsByClass.entries()).map(([className, students]) => [
            className,
            students.length
          ]),
          ['', ''],
          ['Total Students', studentsToExport.length]
        ];
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet['!cols'] = [{ width: 20 }, { width: 15 }];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      }
      
      const schoolName = schools?.find(s => s.id === selectedSchoolId)?.name || 'All Schools';
      XLSX.writeFile(workbook, `${schoolName}_Student_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Success",
        description: `Student data exported with ${studentsByClass.size} class sheets`
      });
    } else {
      // PDF export using browser print
      const printContent = `
        <html>
          <head>
            <title>Student Data Export</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .header { text-align: center; margin-bottom: 20px; }
              .header h1 { margin: 0; color: #333; }
              .header p { margin: 5px 0; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Seat of Wisdom Academy</h1>
              <p>Student Data Export - ${schools?.find(s => s.id === selectedSchoolId)?.name || 'All Schools'}</p>
              <p>Generated on: ${new Date().toLocaleDateString()}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Class</th>
                  <th>Parent Contact</th>
                  <th>Parent WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                ${currentSchoolStudents.map(student => {
                  const className = classes.find(c => c.id === student.classId)?.name || 'N/A';
                  const fullName = `${student.firstName || ''} ${student.middleName || ''} ${student.lastName || ''}`.trim();
                  return `
                    <tr>
                      <td>${student.studentId || 'N/A'}</td>
                      <td>${fullName}</td>
                      <td>${student.email || 'N/A'}</td>
                      <td>${className}</td>
                      <td>${student.parentContact || 'N/A'}</td>
                      <td>${student.parentWhatsApp || 'N/A'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
      
      toast({
        title: "Success", 
        description: "Student data prepared for PDF export"
      });
    }
  };

  // Universal settings management - now uses the same academic calendar system as Report Cards
  const updateGlobalSettings = useMutation({
    mutationFn: async (settings: {term: string, session: string}) => {
      // Step 1: Ensure the session exists
      const sessions = await apiRequest('/api/admin/academic-sessions');
      let sessionId = sessions.find((s: any) => s.sessionYear === settings.session)?.id;
      
      if (!sessionId) {
        // Create the session if it doesn't exist
        const newSession = await apiRequest('/api/admin/academic-sessions', {
          method: 'POST',
          body: {
            sessionYear: settings.session,
            startDate: new Date(),
            endDate: new Date(new Date().getFullYear() + 1, 7, 31) // End of next August
          }
        });
        sessionId = newSession.id;
      }
      
      // Step 2: Ensure the term exists for this session
      const terms = await apiRequest(`/api/admin/academic-terms?sessionId=${sessionId}`);
      let termId = terms.find((t: any) => t.termName === settings.term)?.id;
      
      if (!termId) {
        // Create the term if it doesn't exist
        const newTerm = await apiRequest('/api/admin/academic-terms', {
          method: 'POST',
          body: {
            termName: settings.term,
            sessionId: sessionId,
            startDate: new Date(),
            endDate: new Date(),
            resumptionDate: new Date()
          }
        });
        termId = newTerm.id;
      }
      
      // Step 3: Activate the session and term
      await apiRequest(`/api/admin/academic-sessions/${sessionId}/activate`, {
        method: 'PUT'
      });
      
      await apiRequest(`/api/admin/academic-terms/${termId}/activate`, {
        method: 'PUT'
      });
      
      return { term: settings.term, session: settings.session };
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Academic calendar updated successfully" });
      setIsSettingsDialogOpen(false);
      // Invalidate the academic info query to refresh both Settings and Report Cards
      queryClient.invalidateQueries({ queryKey: ['/api/current-academic-info'] });
    },
    onError: (error) => {
      console.error('Failed to update academic calendar:', error);
      toast({ title: "Error", description: "Failed to update academic calendar", variant: "destructive" });
    }
  });

  // Create new academic session

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async (studentData: { id: string; [key: string]: any }) => {
      // Convert date string to Date object if provided
      const processedData = { ...studentData };
      if (processedData.dateOfBirth && typeof processedData.dateOfBirth === 'string') {
        processedData.dateOfBirth = new Date(processedData.dateOfBirth);
      }
      
      // Handle password update separately if provided
      const response = await apiRequest(`/api/admin/students/${studentData.id}`, {
        method: 'PATCH',
        body: processedData
      });
      
      // If new password is provided, update the user's password
      if (processedData.newPassword && processedData.newPassword.trim() !== '') {
        const student = response; // The response contains the updated student
        await apiRequest(`/api/admin/users/${student.userId}`, {
          method: 'PATCH',
          body: { password: processedData.newPassword }
        });
      }
      
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student details updated successfully"
      });
      setIsEditStudentDialogOpen(false);
      setEditingStudent(null);
      setStudentEditForm({
        firstName: "",
        lastName: "",
        middleName: "",
        email: "",
        classId: "",
        dateOfBirth: "",
        gender: "",
        parentContact: "",
        parentWhatsApp: "",
        address: "",
        newPassword: ""
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to update student details", 
        variant: "destructive"
      });
    }
  });

  // Function to open edit dialog
  const openEditStudent = (student: StudentWithDetails) => {
    setEditingStudent(student);
    setStudentEditForm({
      firstName: student.user?.firstName || "",
      lastName: student.user?.lastName || "",
      middleName: student.user?.middleName || "",
      email: student.user?.email || "",
      classId: student.classId || "",
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : "",
      age: student.age?.toString() || "",
      gender: student.gender || "",
      profileImage: student.profileImage || "",
      parentContact: student.parentContact || "",
      parentWhatsApp: student.parentWhatsapp || "",
      address: student.address || "",
      newPassword: ""
    });
    setIsEditStudentDialogOpen(true);
  };

  // Assign subject to class (from Overview tab)
  const assignSubjectToClassMutation = useMutation({
    mutationFn: async (data: {classId: string, subjectId: string}) => {
      return await apiRequest('/api/admin/classes/assign-subject', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Subject assigned to class" });
      setIsAssignSubjectDialogOpen(false);
      setSelectedClassForSubject("");
      setSelectedSubjectToAssign("");
      queryClient.invalidateQueries({ queryKey: ['/api/admin/classes'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign subject", variant: "destructive" });
    }
  });

  // Financial mutations
  const createFeeTypeMutation = useMutation({
    mutationFn: async (feeTypeData: FeeTypeForm) => {
      return await apiRequest('/api/admin/fee-types', {
        method: 'POST',
        body: {
          ...feeTypeData,
          schoolId: selectedSchoolId || user?.schoolId
        }
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Fee type created successfully" 
      });
      feeTypeForm.reset();
      setIsFeeTypeDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fee-types'] });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to create fee type", 
        variant: "destructive" 
      });
    }
  });

  // Student promotion mutation
  const promoteStudentsMutation = useMutation({
    mutationFn: async (data: { currentClassId: string; nextClassId: string; studentIds: string[] }) => {
      return await apiRequest('/api/admin/promote-students', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Students promoted successfully" 
      });
      setIsPromotionDialogOpen(false);
      setStudentsToPromote([]);
      // Refresh student data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/classes'] });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to promote students", 
        variant: "destructive" 
      });
    }
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentForm) => {
      return await apiRequest('/api/admin/payments', {
        method: 'POST',
        body: paymentData
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Payment recorded successfully" 
      });
      paymentForm.reset();
      setIsRecordPaymentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/financial-summary'] });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to record payment", 
        variant: "destructive" 
      });
    }
  });

  const assignFeeMutation = useMutation({
    mutationFn: async (assignmentData: AssignFeeForm) => {
      return await apiRequest('/api/admin/assign-fee', {
        method: 'POST',
        body: assignmentData
      });
    },
    onSuccess: (data) => {
      toast({ 
        title: "Success", 
        description: `Fee assigned to ${data.assignedFees?.length || 0} students` 
      });
      assignFeeForm.reset();
      setIsAssignFeeDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/financial-summary'] });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to assign fee to class", 
        variant: "destructive" 
      });
    }
  });

  // Form submission handlers
  const handleFeeTypeSubmit = (data: FeeTypeForm) => {
    createFeeTypeMutation.mutate(data);
  };

  const handlePaymentSubmit = (data: PaymentForm) => {
    recordPaymentMutation.mutate(data);
  };

  // Helper functions for bulk payment
  const getStudentsForPaymentClass = () => {
    if (!selectedPaymentClass) return [];
    return allStudents.filter(student => student.classId === selectedPaymentClass);
  };

  const updateBulkPayment = (index: number, field: string, value: any) => {
    setBulkPayments(prev => {
      const updated = [...prev];
      if (!updated[index]) {
        updated[index] = { 
          studentId: "", 
          amount: 0, 
          notes: "" 
        };
      }
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const getStudentFeeAmount = (studentId: string, feeTypeId: string) => {
    if (!feeTypeId) return "---";
    const studentFee = studentFees.find(sf => 
      sf.studentId === studentId && sf.feeTypeId === feeTypeId
    );
    const feeType = feeTypes.find(ft => ft.id === feeTypeId);
    return studentFee ? `₦${parseFloat(studentFee.amount).toLocaleString()}` : 
           feeType ? `₦${parseFloat(feeType.amount).toLocaleString()}` : "---";
  };

  const handleBulkPaymentSubmit = async () => {
    const validPayments = bulkPayments.filter(payment => payment.amount > 0);

    if (validPayments.length === 0) {
      toast({
        title: "No payments to record",
        description: "Please enter payment amounts for at least one student.",
        variant: "destructive",
      });
      return;
    }

    try {
      const classStudents = getStudentsForPaymentClass();
      
      for (let i = 0; i < validPayments.length; i++) {
        const payment = validPayments[i];
        const student = classStudents[i];
        
        if (student && payment.amount > 0) {
          // Find existing student fee assignment for this student
          const studentFee = studentFees.find(sf => sf.studentId === student.id);

          if (studentFee) {
            const paymentData = {
              studentFeeId: studentFee.id,
              amount: payment.amount,
              paymentDate: bulkPaymentDate,
              paymentMethod: "cash",
              notes: payment.notes || "",
            };
            await recordPaymentMutation.mutateAsync(paymentData);
          } else {
            console.warn(`No fee assignment found for student ${student.studentId}`);
          }
        }
      }

      toast({
        title: "Payments recorded successfully",
        description: `Recorded ${validPayments.length} payment(s) for the class.`,
      });
      
      setIsRecordPaymentDialogOpen(false);
      setSelectedPaymentClass("");
      setBulkPayments([]);
      
    } catch (error) {
      toast({
        title: "Error recording payments",
        description: "Some payments may not have been recorded. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAssignFeeSubmit = (data: Pick<AssignFeeForm, 'feeTypeId' | 'classId'>) => {
    const fullData: AssignFeeForm = {
      ...data,
      term: selectedFinanceTerm,
      session: selectedFinanceSession,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      notes: `Assigned for ${selectedFinanceTerm} ${selectedFinanceSession}`,
    };
    assignFeeMutation.mutate(fullData);
  };

  // Logo upload functions
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = () => {
    if (logoFile && logoPreview) {
      // For now, we'll simulate the upload by using the preview URL
      // In a real implementation, you'd upload to a file storage service first
      uploadLogoMutation.mutate(logoPreview);
    }
  };

  const handleLogoCancelation = () => {
    setIsLogoUploadDialogOpen(false);
    setLogoFile(null);
    setLogoPreview("");
  };

  // Principal signature upload functions
  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setSignaturePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = async () => {
    if (signatureFile && selectedSchoolForSignature) {
      try {
        // Get upload URL from Object Storage
        const { uploadURL } = await apiRequest("/api/objects/upload");
        
        // Upload file to Object Storage
        await fetch(uploadURL, {
          method: "PUT",
          body: signatureFile,
          headers: {
            "Content-Type": signatureFile.type,
          },
        });
        
        // Extract the object path from the upload URL
        const objectPath = new URL(uploadURL).pathname;
        
        // Update school with signature URL
        uploadSignatureMutation.mutate({ 
          schoolId: selectedSchoolForSignature, 
          signatureUrl: objectPath 
        });
      } catch (error) {
        console.error("Error uploading signature:", error);
        toast({
          title: "Upload Failed",
          description: "Failed to upload signature. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSignatureCancelation = () => {
    setIsSignatureUploadDialogOpen(false);
    setSignatureFile(null);
    setSignaturePreview("");
    setSelectedSchoolForSignature("");
  };

  // Reset student form function
  const resetStudentForm = () => {
    setStudentCreationForm({
      firstName: "",
      lastName: "",
      middleName: "",
      email: "",
      password: "",
      studentId: "",
      classId: "",
      dateOfBirth: "",
      gender: "",
      profileImage: "",
      parentContact: "",
      parentWhatsApp: "",
      address: ""
    });
    setStudentFormErrors({});
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
      setStudentCreationForm(prev => ({ ...prev, studentId: newId }));
    } catch (error) {
      console.error('Error generating student ID:', error);
      // Fallback to timestamp-based ID
      const timestamp = Date.now().toString().slice(-4);
      setStudentCreationForm(prev => ({ ...prev, studentId: `SOWA/${timestamp}` }));
    }
  };

  // Auto-generate student ID when dialog opens
  useEffect(() => {
    if (isStudentDialogOpen && !studentCreationForm.studentId) {
      generateStudentId();
    }
  }, [isStudentDialogOpen, allStudents.length, studentCreationForm.studentId]);

  const handleScoreChange = (studentId: string, field: string, value: string) => {
    // Validate score limits based on field type
    let numValue = parseInt(value) || 0;
    let maxScore = 20; // Default for CA
    
    if (field === 'exam') {
      maxScore = 60;
    }
    
    // Enforce limits
    if (numValue > maxScore) {
      toast({ 
        title: "Invalid Score", 
        description: `Maximum score for ${field === 'exam' ? 'Exam' : 'CA'} is ${maxScore}`, 
        variant: "destructive" 
      });
      return; // Don't update the input
    }
    
    if (numValue < 0) {
      toast({ 
        title: "Invalid Score", 
        description: "Score cannot be negative", 
        variant: "destructive" 
      });
      return;
    }
    
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

  // Handle Excel file upload
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!scoresClassId || !scoresSubjectId) {
      toast({
        title: "Error",
        description: "Please select class and subject first",
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', file);
    formData.append('classId', scoresClassId);
    formData.append('subjectId', scoresSubjectId);
    formData.append('term', scoresTerm);
    formData.append('session', scoresSession);

    try {
      const response = await fetch('/api/assessments/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      toast({
        title: "Excel Upload Success",
        description: `${result.successCount} students processed successfully${result.errorCount > 0 ? `, ${result.errorCount} errors` : ''}`,
      });

      if (result.errors && result.errors.length > 0) {
        console.warn("Upload errors:", result.errors);
        toast({
          title: "Upload Warnings",
          description: `${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`,
          variant: "destructive"
        });
      }

      // Refresh assessments
      queryClient.invalidateQueries({ 
        queryKey: ['/api/admin/assessments', { classId: scoresClassId, subjectId: scoresSubjectId }] 
      });

    } catch (error) {
      console.error("Excel upload error:", error);
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to upload Excel file",
        variant: "destructive"
      });
    }

    // Reset file input
    event.target.value = '';
  };

  // Handle Enter key navigation for score inputs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentStudentId: string, currentField: 'firstCA' | 'secondCA' | 'exam') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const studentsInClass = allStudents.filter(student => student.classId === scoresClassId);
      const currentIndex = studentsInClass.findIndex(student => student.id === currentStudentId);
      
      // Navigate based on current field and position
      if (currentField === 'firstCA') {
        // Move to next student's firstCA field
        if (currentIndex < studentsInClass.length - 1) {
          const nextStudentId = studentsInClass[currentIndex + 1].id;
          const nextField = document.querySelector(`input[data-student-id="${nextStudentId}"][data-field="firstCA"]`) as HTMLInputElement;
          nextField?.focus();
          nextField?.select();
        }
      } else if (currentField === 'secondCA') {
        // Move to next student's secondCA field  
        if (currentIndex < studentsInClass.length - 1) {
          const nextStudentId = studentsInClass[currentIndex + 1].id;
          const nextField = document.querySelector(`input[data-student-id="${nextStudentId}"][data-field="secondCA"]`) as HTMLInputElement;
          nextField?.focus();
          nextField?.select();
        }
      } else if (currentField === 'exam') {
        // Move to next student's exam field
        if (currentIndex < studentsInClass.length - 1) {
          const nextStudentId = studentsInClass[currentIndex + 1].id;
          const nextField = document.querySelector(`input[data-student-id="${nextStudentId}"][data-field="exam"]`) as HTMLInputElement;
          nextField?.focus();
          nextField?.select();
        }
      }
    }
  };

  // Handle download template (legacy - kept for backwards compatibility)
  const handleDownloadTemplate = async () => {
    if (!scoresClassId) {
      toast({
        title: "Error",
        description: "Please select a class first",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/assessments/template/${scoresClassId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scores_template_${scoresClassId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Template Downloaded",
        description: "Excel template downloaded with student IDs",
      });

    } catch (error) {
      console.error("Template download error:", error);
      toast({
        title: "Download Error",
        description: "Failed to download template",
        variant: "destructive"
      });
    }
  };

  // Handle download single subject template
  const handleDownloadSingleSubjectTemplate = async () => {
    if (!scoresClassId || !scoresSubjectId) {
      toast({
        title: "Error",
        description: "Please select both class and subject",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/assessments/template-single/${scoresClassId}/${scoresSubjectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'template.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Template Downloaded",
        description: `Downloaded ${filename}`,
      });

    } catch (error) {
      console.error("Single subject template download error:", error);
      toast({
        title: "Download Error",
        description: "Failed to download template",
        variant: "destructive"
      });
    }
  };

  // Handle download multi-subject template
  const handleDownloadMultiSubjectTemplate = async () => {
    if (!scoresClassId) {
      toast({
        title: "Error",
        description: "Please select a class first",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/assessments/template-multi/${scoresClassId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'template.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Template Downloaded",
        description: `Downloaded ${filename} with all subjects in separate tabs`,
      });

    } catch (error) {
      console.error("Multi-subject template download error:", error);
      toast({
        title: "Download Error",
        description: "Failed to download template",
        variant: "destructive"
      });
    }
  };

  const calculateGrade = (total: number) => {
    if (total >= 75) return 'A';
    if (total >= 50) return 'C';
    if (total >= 40) return 'P';
    return 'F';
  };

  const openClassDetails = (classItem: Class) => {
    setSelectedClassForDetails(classItem);
    setIsClassDetailsDialogOpen(true);
  };



  // Check if current term is third term
  const isThirdTerm = (term: string): boolean => {
    return term.toLowerCase().includes('third') || term.toLowerCase().includes('3rd') || term === '3';
  };

  // Report card generation function
  // New report generation function with popup
  const handleGenerateReport = (student: any) => {
    setSelectedStudentForReport(student);
    setReportTerm(scoresTerm);
    setReportSession(scoresSession);
    setNextTermResumptionDate("");
    setIsReportDialogOpen(true);
  };

  // Generate the actual report card
  const generateReportCard = (student: any, nextTermDate: string, term: string, session: string, promotedToClass?: string) => {
    // Create a printable report card
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) return;

    const totalMarks = subjects.reduce((sum, subject) => {
      const assessment = classAssessments.find(a => a.studentId === student.id && a.subjectId === subject.id);
      return sum + ((assessment?.firstCA || 0) + (assessment?.secondCA || 0) + (assessment?.exam || 0));
    }, 0);

    const promotionText = promotedToClass === "Graduated" 
      ? "🎓 CONGRATULATIONS! Student has successfully GRADUATED from the academy."
      : promotedToClass 
        ? `📈 PROMOTED TO: ${promotedToClass} for next academic session`
        : "";

    const reportHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Report Card - ${student.user.firstName} ${student.user.lastName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 10px; 
              line-height: 1.2; 
              color: #333;
              background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
              font-size: 12px;
            }
            .report-container {
              background: white;
              max-width: 210mm;
              min-height: 297mm;
              max-height: 297mm;
              margin: 0 auto;
              padding: 15px;
              border-radius: 8px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 10px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border-radius: 6px;
              padding: 12px;
            }
            .school-logo {
              width: 40px;
              height: 40px;
              margin: 0 auto 6px;
              background: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 2px;
            }
            .academy-logo {
              width: 100%;
              height: 100%;
              object-fit: contain;
              border-radius: 50%;
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              display: block !important;
              visibility: visible !important;
            }
            .school-name { 
              font-size: 16px; 
              font-weight: bold; 
              margin-bottom: 3px;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
            }
            .school-subtitle {
              font-size: 10px;
              margin-bottom: 2px;
              opacity: 0.9;
            }
            .school-motto {
              font-size: 9px;
              font-style: italic;
              opacity: 0.8;
            }
            .student-header {
              display: grid;
              grid-template-columns: 2fr 1fr 2fr;
              gap: 10px;
              margin-bottom: 12px;
              background: #f8fafc;
              padding: 10px;
              border-radius: 6px;
              border-left: 3px solid #2563eb;
            }
            .student-info, .attendance-info, .academic-info {
              background: white;
              padding: 8px;
              border-radius: 4px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .info-title {
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 5px;
              font-size: 10px;
              text-transform: uppercase;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 2px;
            }
            .info-item {
              font-size: 9px;
              margin-bottom: 2px;
            }
            .grades-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              background: white;
              border-radius: 6px;
              overflow: hidden;
              box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            }
            .grades-table th {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 6px 4px;
              text-align: center;
              font-weight: bold;
              font-size: 8px;
              line-height: 1.1;
            }
            .grades-table td {
              border: 1px solid #e2e8f0;
              padding: 4px 3px;
              text-align: center;
              font-size: 8px;
              line-height: 1.1;
            }
            .grades-table tbody tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .grades-table tbody tr:hover {
              background-color: #e2e8f0;
            }
            .subject-name {
              text-align: left !important;
              padding-left: 6px !important;
              font-weight: 500;
              font-size: 8px !important;
              max-width: 120px;
              word-wrap: break-word;
            }
            .total-score {
              font-weight: bold;
              color: #2563eb;
            }
            .grade-cell {
              font-weight: bold;
              padding: 4px 8px !important;
              border-radius: 4px;
              color: white;
            }
            .grade-a { background-color: #10b981; }
            .grade-c { background-color: #f59e0b; }
            .grade-p { background-color: #6b7280; }
            .grade-f { background-color: #ef4444; }
            .cumulative-section {
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              padding: 10px;
              border-radius: 6px;
              margin-bottom: 12px;
              border: 1px solid #cbd5e1;
            }
            .cumulative-header {
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 6px;
              text-align: center;
              font-size: 11px;
            }
            .cumulative-stats {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 6px;
              text-align: center;
              margin-bottom: 6px;
            }
            .stat-item {
              background: white;
              padding: 4px;
              border-radius: 4px;
              box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            .stat-label {
              font-size: 7px;
              color: #64748b;
              margin-bottom: 1px;
            }
            .stat-value {
              font-size: 9px;
              font-weight: bold;
              color: #2563eb;
            }
            .comments-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 12px;
            }
            .comment-box {
              background: white;
              padding: 8px;
              border-radius: 4px;
              border: 1px solid #e2e8f0;
              min-height: 50px;
            }
            .comment-title {
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 4px;
              font-size: 9px;
            }
            .comment-text {
              font-size: 8px;
              color: #4b5563;
              font-style: italic;
            }
            .signature-section {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 15px;
              margin-top: 10px;
            }
            .signature {
              text-align: center;
              border-top: 1px solid #2563eb;
              padding-top: 4px;
              font-size: 8px;
              font-weight: bold;
              color: #2563eb;
            }
            .grading-scale {
              background: white;
              padding: 6px;
              border-radius: 4px;
              margin-top: 6px;
              border: 1px solid #e2e8f0;
            }
            .scale-title {
              font-weight: bold;
              margin-bottom: 3px;
              font-size: 8px;
              color: #2563eb;
            }
            .scale-item {
              font-size: 7px;
              margin-bottom: 1px;
              display: flex;
              justify-content: space-between;
            }
            @media print {
              body { margin: 0; background: white; font-size: 11px; }
              .report-container { 
                box-shadow: none; 
                max-height: none;
                min-height: auto;
                page-break-inside: avoid;
              }
              * { 
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="header">
              <div class="school-logo">
                <img src="${currentLogoUrl}" alt="Seat of Wisdom Academy Logo" class="academy-logo" />
              </div>
              <div class="school-name">SEAT OF WISDOM ACADEMY ASABA</div>
              <div class="school-subtitle">GOVERNMENT, WAEC AND NECO APPROVED</div>
              <div class="school-motto">"The Fear of the Lord is the Beginning of Wisdom"</div>
            </div>

            <div class="student-header">
              <div class="student-info">
                <div class="info-title">Student Information</div>
                <div class="info-item"><strong>Name:</strong> ${student.user.firstName} ${student.user.lastName}</div>
                <div class="info-item"><strong>Student ID:</strong> ${student.studentId}</div>
                <div class="info-item"><strong>Class:</strong> ${student.class.name}</div>
                <div class="info-item"><strong>Gender:</strong> Male</div>
              </div>
              <div class="attendance-info">
                <div class="info-title">Attendance</div>
                <div class="info-item">No in Class: <strong>28</strong></div>
                <div class="info-item">Present: <strong>114</strong></div>
                <div class="info-item">Absent: <strong>12</strong></div>
                <div class="info-item">Total: <strong>126</strong></div>
              </div>
              <div class="academic-info">
                <div class="info-title">Session Details</div>
                <div class="info-item"><strong>Term:</strong> ${scoresTerm}</div>
                <div class="info-item"><strong>Session:</strong> ${scoresSession}</div>
                <div class="info-item"><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</div>
                <div class="info-item"><strong>Next Term:</strong> 28th April, 2025</div>
              </div>
            </div>

            <table class="grades-table">
              <thead>
                <tr>
                  <th>SUBJECT</th>
                  <th>SUBJECT<br>POSITION</th>
                  <th>1st TEST<br>(20)</th>
                  <th>2nd TEST<br>(20)</th>
                  <th>EXAM<br>(60)</th>
                  <th>TOTAL<br>(100)</th>
                  <th>STUDENT<br>AVG (%)</th>
                  <th>CLASS<br>AVG (%)</th>
                  <th>GRADE</th>
                  <th>REMARK</th>
                </tr>
              </thead>
              <tbody>
                ${subjects.map((subject, index) => {
                  const assessment = classAssessments.find(a => a.studentId === student.id && a.subjectId === subject.id);
                  const firstCA = assessment?.firstCA || 0;
                  const secondCA = assessment?.secondCA || 0;
                  const exam = assessment?.exam || 0;
                  const total = firstCA + secondCA + exam;
                  const grade = total >= 75 ? 'A' : total >= 50 ? 'C' : total >= 40 ? 'P' : 'F';
                  const gradeClass = `grade-${grade.toLowerCase()}`;
                  const studentAvg = total ? ((total / 100) * 100).toFixed(1) : '0.0';
                  const classAvg = (Math.random() * 20 + 60).toFixed(1); // Simulated class average
                  const position = index + 1;
                  const remark = total >= 75 ? 'Excellent' : 
                               total >= 50 ? 'Good' : 
                               total >= 40 ? 'Fair' : 'Poor';
                  
                  return `
                    <tr>
                      <td class="subject-name">${subject.name}</td>
                      <td>${position}</td>
                      <td>${firstCA}</td>
                      <td>${secondCA}</td>
                      <td>${exam}</td>
                      <td class="total-score">${total}</td>
                      <td>${studentAvg}</td>
                      <td>${classAvg}</td>
                      <td class="grade-cell ${gradeClass}">${grade}</td>
                      <td>${remark}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="cumulative-section">
              <div class="cumulative-header">Cumulative Report</div>
              <div class="cumulative-stats">
                <div class="stat-item">
                  <div class="stat-label">1st Test</div>
                  <div class="stat-value">${subjects.reduce((sum, subject) => {
                    const assessment = classAssessments.find(a => a.studentId === student.id && a.subjectId === subject.id);
                    return sum + (assessment?.firstCA || 0);
                  }, 0)}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">2nd Test</div>
                  <div class="stat-value">${subjects.reduce((sum, subject) => {
                    const assessment = classAssessments.find(a => a.studentId === student.id && a.subjectId === subject.id);
                    return sum + (assessment?.secondCA || 0);
                  }, 0)}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">Total</div>
                  <div class="stat-value">${totalMarks}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">Avg. (%)</div>
                  <div class="stat-value">${subjects.length ? (totalMarks / (subjects.length * 100) * 100).toFixed(2) : '0.00'}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">Status</div>
                  <div class="stat-value">${(totalMarks / (subjects.length * 100) * 100) >= 40 ? 'PASS' : 'FAIL'}</div>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; text-align: center; font-size: 8px;">
                <div>No of Sub.: <strong>${subjects.length}</strong></div>
                <div>Total Obtained: <strong>${totalMarks}</strong></div>
                <div>Result Status: <strong>${(totalMarks / (subjects.length * 100) * 100) >= 40 ? 'PASS' : 'FAIL'}</strong></div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; text-align: center; font-size: 8px; margin-top: 3px;">
                <div>Total Obtainable: <strong>${subjects.length * 100}</strong></div>
                <div>Average Mark: <strong>${subjects.length ? (totalMarks / (subjects.length * 100) * 100).toFixed(2) : '0.00'} (%)</strong></div>
                <div>Next Term Fee: <strong>Nil</strong></div>
              </div>
              
              <div class="grading-scale">
                <div class="scale-title">Grading Scale:</div>
                <div class="scale-item"><span>A - Excellent:</span> <span>75-100</span></div>
                <div class="scale-item"><span>C - Credit:</span> <span>50-74.99</span></div>
                <div class="scale-item"><span>P - Pass:</span> <span>40-49.99</span></div>
                <div class="scale-item"><span>F - Fail:</span> <span>0-39.99</span></div>
              </div>
            </div>

            <div class="comments-section">
              <div class="comment-box">
                <div class="comment-title">CLASS TEACHER'S COMMENT:</div>
                <div class="comment-text">Calm and regular in school</div>
                <div style="margin-top: 8px; font-size: 7px;">
                  <strong>CLASS TEACHER'S NAME:</strong> Nil
                </div>
              </div>
              <div class="comment-box">
                <div class="comment-title">THE HEAD'S REMARK:</div>
                <div class="comment-text">Good result. Work hard!</div>
                <div style="margin-top: 8px; text-align: center; border: 1px dashed #cbd5e1; padding: 10px; font-size: 7px; color: #64748b;">
                  HEAD TEACHER'S STAMP
                </div>
              </div>
            </div>

            ${promotionText ? `
              <div style="
                margin: 12px 0;
                padding: 10px;
                background: ${promotedToClass === 'Graduated' ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'};
                color: white;
                border-radius: 6px;
                text-align: center;
                font-size: 10px;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              ">
                ${promotionText}
              </div>
            ` : ''}

            <div style="
              margin: 10px 0;
              padding: 8px;
              background: #f1f5f9;
              border-radius: 4px;
              border-left: 3px solid #2563eb;
              font-size: 8px;
            ">
              <div style="margin-bottom: 4px;"><strong>Academic Term:</strong> ${term}</div>
              <div style="margin-bottom: 4px;"><strong>Academic Session:</strong> ${session}</div>
              ${nextTermDate ? `<div><strong>Next Term Resumes:</strong> ${new Date(nextTermDate).toLocaleDateString('en-GB')}</div>` : ''}
            </div>

            <div class="signature-section">
              <div class="signature">CLASS TEACHER</div>
              <div class="signature">HEAD TEACHER</div>
              <div class="signature">STUDENT</div>
            </div>
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
                  src={currentLogoUrl} 
                  alt="Seat of Wisdom Academy Logo" 
                  className="h-16 w-16 object-contain rounded-md bg-white p-2" 
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
                  {schools?.map((school) => (
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
                  onClick={logout}
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
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo and School Info */}
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <img 
                      src={currentLogoUrl} 
                      alt="Seat of Wisdom Academy Logo" 
                      className="h-6 w-6 sm:h-8 sm:w-8 object-contain rounded-md flex-shrink-0 bg-white p-1" 
                    />
                    <h1 className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                      Seat of Wisdom Academy
                    </h1>
                  </div>
                  <div className="hidden sm:block ml-8 sm:ml-10">
                    <p className="text-xs sm:text-sm text-gray-500">
                      {user.role === 'admin' ? 'Main Administrator' : 'Branch Administrator'}
                    </p>
                    {academicInfo && (academicInfo.currentSession || academicInfo.currentTerm) ? (
                      <p className="text-xs text-blue-600 font-medium">
                        {academicInfo.currentSession && academicInfo.currentTerm
                          ? `${academicInfo.currentSession} • ${academicInfo.currentTerm}`
                          : academicInfo.currentSession || academicInfo.currentTerm}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 font-medium">
                        2024/2025 • First Term
                      </p>
                    )}
                  </div>
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
                      {schools?.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      )) || []}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sub-Admin School Display - Hidden on mobile */}
              {user.role === 'sub-admin' && (
                <div className="hidden lg:flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-md border border-blue-200 dark:border-blue-800">
                  <School className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {schools?.find(s => s.id === (user as any).schoolId)?.name || 'Loading...'}
                  </span>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="/portal/users"
                      className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
                    >
                      <Users className="w-4 h-4" />
                      <span className="hidden sm:inline">Users</span>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Manage users, create sub-admins, and configure school settings</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* User Info - Clickable Profile Link */}
              <a 
                href="/portal/profile"
                className="flex items-center space-x-1 sm:space-x-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                <User className="h-4 w-4" />
                <span className="hidden md:inline">{user.firstName} {user.lastName}</span>
                <span className="md:hidden text-xs">{user.firstName}</span>
              </a>
              
              {/* Logout Button - Icon only on mobile */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={logout}
                    className="px-2 sm:px-4"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline sm:ml-2">Logout</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sign out of your administrator account</p>
                </TooltipContent>
              </Tooltip>
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
                  {schools?.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-10 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
              Overview
            </TabsTrigger>
            <TabsTrigger value="students" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
              Students
            </TabsTrigger>
            <TabsTrigger value="scores" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
              Scores
            </TabsTrigger>
            <TabsTrigger value="grading" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">Ratings</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
              Attendance
            </TabsTrigger>
            <TabsTrigger value="finance" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
              Finance
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
              Reports
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
              Users
            </TabsTrigger>
            {user.role === 'admin' && (
              <TabsTrigger value="news" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
                News
              </TabsTrigger>
            )}
            {user.role === 'admin' && (
              <TabsTrigger value="notifications" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
                Notifications
              </TabsTrigger>
            )}
            <TabsTrigger value="settings" className="text-xs sm:text-sm px-2 py-2 h-auto whitespace-nowrap">
              Settings
            </TabsTrigger>
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="text-2xl font-bold">{allStudents.length}</div>
                      <p className="text-xs text-muted-foreground">Across all classes</p>
                    </div>
                    <Button 
                      onClick={() => setIsStudentDialogOpen(true)}
                      size="sm"
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Add Student</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="text-2xl font-bold">{classes.length}</div>
                      <p className="text-xs text-muted-foreground">Active classes</p>
                    </div>
                    <Button 
                      onClick={() => setIsClassDialogOpen(true)}
                      size="sm"
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Add Class</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  </div>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Class
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Create a new class with name and description</p>
                    </TooltipContent>
                  </Tooltip>
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
                  {sortClassesByOrder(classes).map((classItem) => {
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openClassDetails(classItem)}
                                >
                                  View Details
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View enrolled students and manage class details</p>
                              </TooltipContent>
                            </Tooltip>
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

          {/* Students Tab - Class-based viewing */}
          <TabsContent value="students" className="space-y-6 table-container">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Student Management</CardTitle>
                  <CardDescription>
                    Select a class to view and manage students
                  </CardDescription>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button 
                          onClick={() => setIsStudentDialogOpen(true)}
                          disabled={!selectedClassForStudents}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Student
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{selectedClassForStudents ? "Create new student account with auto-generated SOWA ID" : "Select a class first to add students"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent>
                {/* Class Selection */}
                <div className="mb-6">
                  <Label htmlFor="class-select">Select Class to View Students</Label>
                  <Select value={selectedClassForStudents} onValueChange={setSelectedClassForStudents}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a class to view students..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sortClassesByOrder(classes).map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id}>
                          {classItem.name} ({allStudents.filter(s => s.classId === classItem.id).length} students)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Students Table - Only show when class is selected */}
                {selectedClassForStudents ? (
                  <div className="student-table-wrapper border rounded-lg">
                    <table className="student-table w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white w-40">Name</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white w-32">Student ID</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white w-48">Email</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white w-40">Parent WhatsApp</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {allStudents
                          .filter(student => student.classId === selectedClassForStudents)
                          .map((student) => (
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
                                {student.parentWhatsapp || 'Not provided'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditStudent(student)}
                                    className="flex items-center"
                                    data-testid={`button-edit-student-${student.id}`}
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedStudentForDeletion(student);
                                      setIsDeleteStudentDialogOpen(true);
                                    }}
                                    className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50"
                                    data-testid={`button-delete-student-${student.id}`}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {allStudents.filter(s => s.classId === selectedClassForStudents).length === 0 && (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No students in this class</h3>
                        <p className="text-gray-500">Click "Add Student" to create the first student</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <School className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Class</h3>
                    <p className="text-gray-500">Choose a class from the dropdown above to view and manage students</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scores Management Tab */}
          <TabsContent value="scores" className="space-y-6 table-container">
            <Card>
              <CardHeader>
                <CardTitle>Score Entry System</CardTitle>
                <CardDescription>
                  Enter and manage student assessment scores (1st CA: 20 marks, 2nd CA: 20 marks, Exam: 60 marks)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <Label>Select Term</Label>
                    <Select value={scoresTerm} onValueChange={setScoresTerm}>
                      <SelectTrigger data-testid="select-scores-term">
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
                    <Label>Select Academic Session</Label>
                    <Select value={scoresSession} onValueChange={setScoresSession}>
                      <SelectTrigger data-testid="select-academic-session">
                        <SelectValue placeholder="Choose an academic session" />
                      </SelectTrigger>
                      <SelectContent>
                        {academicSessions.map((session) => (
                          <SelectItem key={session.id} value={session.sessionYear}>
                            {session.sessionYear}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Select Class</Label>
                    <Select value={scoresClassId} onValueChange={setScoresClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortClassesByOrder(classes).map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Select Subject</Label>
                    <Select value={scoresSubjectId} onValueChange={(subjectId) => {
                      setScoresSubjectId(subjectId);
                      // Auto-refresh assessments when subject changes
                      if (scoresClassId && subjectId && scoresTerm && scoresSession) {
                        queryClient.invalidateQueries({ 
                          queryKey: ['/api/admin/assessments', scoresClassId, subjectId, scoresTerm, scoresSession] 
                        });
                      }
                    }} disabled={!scoresClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {classSubjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          onClick={handleSaveAllScores} 
                          disabled={!scoresClassId || !scoresSubjectId || Object.keys(scoreInputs).length === 0}
                          className="w-full"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save All Scores
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Save all entered scores for the selected class and subject</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex gap-1">
                      <input
                        type="file"
                        id="excel-upload"
                        accept=".xlsx,.xls,.csv"
                        style={{ display: 'none' }}
                        onChange={handleExcelUpload}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => document.getElementById('excel-upload')?.click()}
                            disabled={!scoresClassId || !scoresSubjectId}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            Upload
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Upload scores from Excel file (XLSX, XLS, CSV)</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                disabled={!scoresClassId}
                                variant="outline"
                                size="sm"
                                className="flex-1"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Template
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Download Excel template options</p>
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={handleDownloadSingleSubjectTemplate}
                            disabled={!scoresClassId || !scoresSubjectId}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            <div className="flex flex-col">
                              <span className="font-medium">Single Subject</span>
                              <span className="text-xs text-muted-foreground">Subject-Class.xlsx</span>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleDownloadMultiSubjectTemplate}
                            disabled={!scoresClassId}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            <div className="flex flex-col">
                              <span className="font-medium">All Subjects</span>
                              <span className="text-xs text-muted-foreground">Class-All-Subjects.xlsx (tabs)</span>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {scoresClassId && scoresSubjectId ? (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full min-w-[600px]">
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
                            
                            // Convert to numbers properly, handling both string and number inputs
                            const firstCA = Number(currentScores.firstCA || assessment?.firstCA || 0);
                            const secondCA = Number(currentScores.secondCA || assessment?.secondCA || 0);
                            const exam = Number(currentScores.exam || assessment?.exam || 0);
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
                                    onKeyDown={(e) => handleKeyDown(e, student.id, 'firstCA')}
                                    data-student-id={student.id}
                                    data-field="firstCA"
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
                                    onKeyDown={(e) => handleKeyDown(e, student.id, 'secondCA')}
                                    data-student-id={student.id}
                                    data-field="secondCA"
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
                                    onKeyDown={(e) => handleKeyDown(e, student.id, 'exam')}
                                    data-student-id={student.id}
                                    data-field="exam"
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            className="w-full"
                            onClick={handleSaveAllScores}
                            disabled={updateScoresMutation.isPending}
                          >
                            {updateScoresMutation.isPending ? "Saving..." : "Save All Scores"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Save all entered scores to the database</p>
                        </TooltipContent>
                      </Tooltip>
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

          {/* Teacher Grading Interface Tab */}
          <TabsContent value="grading" className="space-y-6 table-container">
            <TeacherGradesInterface 
              currentTerm="First Term"
              currentSession="2024/2025"
              userSchoolId={user?.role === 'admin' ? selectedSchoolId : user?.schoolId}
            />
          </TabsContent>

          {/* Financial Management Tab */}
          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-6 table-container">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Attendance Management
                </CardTitle>
                <CardDescription>
                  Record and track student attendance by entering total attendance scores for each term and session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AttendanceManagement selectedSchoolId={user?.role === 'admin' ? selectedSchoolId : user?.schoolId} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance" className="space-y-6 table-container">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₦{financialSummary?.totalPaid?.toLocaleString() || "0.00"}
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedFinanceTerm}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outstanding Fees</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₦{financialSummary?.totalOutstanding?.toLocaleString() || "0.00"}
                  </div>
                  <p className="text-xs text-muted-foreground">Pending payments</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {financialSummary?.collectionRate ? `${financialSummary.collectionRate}%` : "0%"}
                  </div>
                  <p className="text-xs text-muted-foreground">Payment success rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Students Owing</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {financialSummary?.studentsOwing || "0"}
                  </div>
                  <p className="text-xs text-muted-foreground">With outstanding fees</p>
                </CardContent>
              </Card>
            </div>

            {/* Fee Types Management */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Fee Types Management</CardTitle>
                  <CardDescription>
                    Create and manage different types of fees for the school
                  </CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setIsFeeTypeDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Fee Type
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a new fee type (tuition, registration, etc.)</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Fee Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Amount</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Category</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {feeTypes.length === 0 ? (
                        <tr>
                          <td className="px-4 py-3 text-sm text-gray-500" colSpan={5}>
                            No fee types created yet. Click "Create Fee Type" to add one.
                          </td>
                        </tr>
                      ) : (
                        feeTypes.map((feeType) => (
                          <tr key={feeType.id}>
                            <td className="px-4 py-3 font-medium">{feeType.name}</td>
                            <td className="px-4 py-3">₦{parseFloat(feeType.amount).toLocaleString()}</td>
                            <td className="px-4 py-3 capitalize">{feeType.category}</td>
                            <td className="px-4 py-3">{feeType.description || 'N/A'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                feeType.isActive 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {feeType.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Student Fee Assignments */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Student Fee Assignments</CardTitle>
                  <CardDescription>
                    Assign fees to students for {selectedFinanceTerm} {selectedFinanceSession} (set globally)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => setIsAssignFeeDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Assign Fees
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Assign fees to all students in a class</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {classes.length > 0 ? (
                    <div className="space-y-3">
                      {classes.map((classItem) => {
                        const classStudents = allStudents.filter(student => student.classId === classItem.id);
                        const classStudentFees = studentFees.filter(sf => 
                          classStudents.some(student => student.id === sf.studentId)
                        );
                        
                        // Group fees by fee type for this class
                        const feesByType = classStudentFees.reduce((acc, sf) => {
                          const feeType = feeTypes.find(ft => ft.id === sf.feeTypeId);
                          if (feeType) {
                            if (!acc[feeType.id]) {
                              acc[feeType.id] = {
                                feeType,
                                totalAmount: 0
                              };
                            }
                            acc[feeType.id].totalAmount += parseFloat(sf.amount);
                          }
                          return acc;
                        }, {} as Record<string, { feeType: FeeType; totalAmount: number }>);

                        return (
                          <div key={classItem.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-lg text-gray-900 dark:text-white">
                                {classItem.name}
                              </h4>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedPaymentClass(classItem.id);
                                  setIsAssignFeeDialogOpen(true);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Assign Fee
                              </Button>
                            </div>

                            {/* Display assigned fees for this class */}
                            {Object.keys(feesByType).length > 0 ? (
                              <div className="space-y-2">
                                {Object.values(feesByType).map(({ feeType, totalAmount }) => (
                                  <div key={feeType.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {feeType.name}
                                    </span>
                                    <span className="font-semibold text-blue-600">
                                      ₦{totalAmount.toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500">
                                <p className="text-sm">No fees assigned</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Classes Available</h3>
                      <p className="text-gray-500 mb-4">Create classes first to assign fees</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment Records */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Payments</CardTitle>
                  <CardDescription>
                    Track and record student fee payments
                  </CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setIsRecordPaymentDialogOpen(true)}>
                      <Receipt className="h-4 w-4 mr-2" />
                      Record Payment
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Record a new fee payment from a student</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Student</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Fee Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Amount</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Method</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Reference</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {payments.length === 0 ? (
                        <tr>
                          <td className="px-4 py-3 text-sm text-gray-500" colSpan={7}>
                            No payments recorded yet. Use "Record Payment" to add payment entries.
                          </td>
                        </tr>
                      ) : (
                        payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-4 py-3">
                              {new Date(payment.paymentDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {payment.student?.user?.firstName} {payment.student?.user?.lastName}
                            </td>
                            <td className="px-4 py-3">
                              {payment.studentFee?.feeType?.name}
                            </td>
                            <td className="px-4 py-3">
                              ₦{parseFloat(payment.amount).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 capitalize">
                              {payment.paymentMethod}
                            </td>
                            <td className="px-4 py-3">
                              {payment.reference || 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              {payment.recordedBy?.firstName} {payment.recordedBy?.lastName}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report Cards Tab */}
          <TabsContent value="reports" className="space-y-6 table-container">
            <ReportCardManagement 
              classes={classes}
              user={user}
            />
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-6 table-container">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage admin accounts and create sub-administrators for schools
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setIsCreateMainAdminDialogOpen(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Main Admin
                  </Button>
                  <Button onClick={() => setIsCreateSubAdminDialogOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Sub-Admin
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5" />
                  <span className="text-lg font-semibold">
                    Admin Accounts
                  </span>
                </div>
                
                {/* Users Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers.map((adminUser) => (
                        <TableRow key={adminUser.id}>
                          <TableCell className="font-medium">
                            {adminUser.firstName} {adminUser.lastName}
                          </TableCell>
                          <TableCell>{adminUser.email}</TableCell>
                          <TableCell>
                            <Badge className={`${getRoleBadgeColor(adminUser.role)} text-white`}>
                              {adminUser.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {adminUser.schoolId ? getSchoolName(adminUser.schoolId) : 'All Schools'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={adminUser.isActive ? 'default' : 'secondary'}>
                              {adminUser.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedUserForProfile(adminUser);
                                  setIsUserProfileDialogOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedUserForEdit(adminUser);
                                  setEditFirstName(adminUser.firstName);
                                  setEditLastName(adminUser.lastName);
                                  setEditEmail(adminUser.email);
                                  setEditRole(adminUser.role);
                                  setEditSchoolId(adminUser.schoolId || "all");
                                  setEditIsActive(adminUser.isActive);
                                  // Reset password fields
                                  setEditPassword("");
                                  setEditConfirmPassword("");
                                  setEditChangePassword(false);
                                  setIsEditUserDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {adminUsers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">
                      No admin users found. Click "Add Main Admin" or "Add Sub-Admin" to create administrators.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Create Main Admin Dialog */}
            <Dialog open={isCreateMainAdminDialogOpen} onOpenChange={setIsCreateMainAdminDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Main Administrator</DialogTitle>
                  <DialogDescription>
                    Create a new main admin with full system access
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="main-firstName">First Name</Label>
                      <Input
                        id="main-firstName"
                        value={adminFirstName}
                        onChange={(e) => setAdminFirstName(e.target.value)}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="main-lastName">Last Name</Label>
                      <Input
                        id="main-lastName"
                        value={adminLastName}
                        onChange={(e) => setAdminLastName(e.target.value)}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="main-email">Email</Label>
                    <Input
                      id="main-email"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="main-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="main-password"
                        type={showAdminPassword ? "text" : "password"}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                      >
                        {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setIsCreateMainAdminDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMainAdminMutation.mutate({ 
                      firstName: adminFirstName, 
                      lastName: adminLastName, 
                      email: adminEmail, 
                      password: adminPassword 
                    })}
                    disabled={!adminFirstName || !adminLastName || !adminEmail || !adminPassword || createMainAdminMutation.isPending}
                  >
                    {createMainAdminMutation.isPending ? "Creating..." : "Create Main Admin"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Create Sub-Admin Dialog */}
            <Dialog open={isCreateSubAdminDialogOpen} onOpenChange={setIsCreateSubAdminDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Sub-Administrator</DialogTitle>
                  <DialogDescription>
                    Create a new sub-admin who will manage a specific school branch
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sub-firstName">First Name</Label>
                      <Input
                        id="sub-firstName"
                        value={adminFirstName}
                        onChange={(e) => setAdminFirstName(e.target.value)}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sub-lastName">Last Name</Label>
                      <Input
                        id="sub-lastName"
                        value={adminLastName}
                        onChange={(e) => setAdminLastName(e.target.value)}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sub-email">Email</Label>
                    <Input
                      id="sub-email"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sub-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="sub-password"
                        type={showAdminPassword ? "text" : "password"}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                      >
                        {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sub-school">Assign to School</Label>
                    <Select value={selectedSchoolForAdmin} onValueChange={setSelectedSchoolForAdmin}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a school" />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map(school => (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setIsCreateSubAdminDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createSubAdminMutation.mutate({ 
                      firstName: adminFirstName, 
                      lastName: adminLastName, 
                      email: adminEmail, 
                      password: adminPassword, 
                      schoolId: selectedSchoolForAdmin 
                    })}
                    disabled={!adminFirstName || !adminLastName || !adminEmail || !adminPassword || !selectedSchoolForAdmin || createSubAdminMutation.isPending}
                  >
                    {createSubAdminMutation.isPending ? "Creating..." : "Create Sub-Admin"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* User Profile Dialog */}
            <Dialog open={isUserProfileDialogOpen} onOpenChange={setIsUserProfileDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>User Profile</DialogTitle>
                  <DialogDescription>
                    View detailed user information
                  </DialogDescription>
                </DialogHeader>
                {selectedUserForProfile && (
                  <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                        <p className="text-base">{selectedUserForProfile.firstName} {selectedUserForProfile.lastName}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                        <p className="text-base">{selectedUserForProfile.email}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                        <Badge className={`${getRoleBadgeColor(selectedUserForProfile.role)} text-white`}>
                          {selectedUserForProfile.role}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">School</Label>
                        <p className="text-base">
                          {selectedUserForProfile.schoolId ? getSchoolName(selectedUserForProfile.schoolId) : 'All Schools'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <Badge variant={selectedUserForProfile.isActive ? 'default' : 'secondary'}>
                          {selectedUserForProfile.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                        <p className="text-base">
                          {selectedUserForProfile.createdAt ? new Date(selectedUserForProfile.createdAt).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setIsUserProfileDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>
                    Update user information and settings
                  </DialogDescription>
                </DialogHeader>
                {selectedUserForEdit && (
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-firstName">First Name</Label>
                        <Input
                          id="edit-firstName"
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          placeholder="Enter first name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-lastName">Last Name</Label>
                        <Input
                          id="edit-lastName"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-role">Role</Label>
                        <Select value={editRole} onValueChange={setEditRole}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="sub-admin">Sub-Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="edit-school">School</Label>
                        <Select value={editSchoolId} onValueChange={setEditSchoolId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select school (optional for admins)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Schools (Admin only)</SelectItem>
                            {schools.map(school => (
                              <SelectItem key={school.id} value={school.id}>
                                {school.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit-isActive"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="edit-isActive">User is active</Label>
                    </div>

                    {/* Password Change Section - Only for main admins */}
                    {user?.role === 'admin' && (
                      <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center space-x-2 mb-3">
                          <input
                            type="checkbox"
                            id="edit-change-password"
                            checked={editChangePassword}
                            onChange={(e) => {
                              setEditChangePassword(e.target.checked);
                              if (!e.target.checked) {
                                setEditPassword("");
                                setEditConfirmPassword("");
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor="edit-change-password" className="text-sm font-medium">
                            Change user password
                          </Label>
                        </div>

                        {editChangePassword && (
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="edit-new-password">New Password</Label>
                              <div className="relative">
                                <Input
                                  id="edit-new-password"
                                  data-testid="input-edit-new-password"
                                  type={showEditPassword ? "text" : "password"}
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  placeholder="Enter new password"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowEditPassword(!showEditPassword)}
                                >
                                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="edit-confirm-password">Confirm New Password</Label>
                              <div className="relative">
                                <Input
                                  id="edit-confirm-password"
                                  data-testid="input-edit-confirm-password"
                                  type={showEditConfirmPassword ? "text" : "password"}
                                  value={editConfirmPassword}
                                  onChange={(e) => setEditConfirmPassword(e.target.value)}
                                  placeholder="Confirm new password"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                                >
                                  {showEditConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setIsEditUserDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedUserForEdit) return;
                      
                      // Password validation if changing password
                      if (editChangePassword) {
                        if (!editPassword || !editConfirmPassword) {
                          toast({
                            title: "Missing Password",
                            description: "Please fill in both password fields.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        if (editPassword !== editConfirmPassword) {
                          toast({
                            title: "Password Mismatch",
                            description: "The passwords do not match. Please try again.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        if (editPassword.length < 6) {
                          toast({
                            title: "Password Too Short",
                            description: "Password must be at least 6 characters long.",
                            variant: "destructive",
                          });
                          return;
                        }
                      }
                      
                      updateUserMutation.mutate({ 
                        id: selectedUserForEdit.id,
                        firstName: editFirstName, 
                        lastName: editLastName, 
                        email: editEmail, 
                        role: editRole,
                        schoolId: editRole === 'admin' || editSchoolId === 'all' ? undefined : editSchoolId,
                        isActive: editIsActive,
                        ...(editChangePassword && editPassword && {
                          password: editPassword
                        })
                      });
                    }}
                    disabled={!editFirstName || !editLastName || !editEmail || !editRole || updateUserMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    {updateUserMutation.isPending ? "Updating..." : "Update User"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6 table-container">
            <Card>
              <CardHeader>
                <CardTitle>Academy Settings</CardTitle>
                <CardDescription>
                  Configure academy-wide settings and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Management Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Academy Logo</h3>
                      <p className="text-sm text-gray-500">Upload and manage the academy logo displayed across the system</p>
                    </div>
                    <Button
                      onClick={() => setIsLogoUploadDialogOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                  
                  {/* Current Logo Preview */}
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-shrink-0">
                      <img 
                        src={currentLogoUrl} 
                        alt="Current Academy Logo" 
                        className="h-16 w-16 object-contain rounded-md border border-gray-200 bg-white p-2" 
                      />
                    </div>
                    <div>
                      <p className="font-medium">Current Logo</p>
                      <p className="text-sm text-gray-500">This logo appears in all headers and reports</p>
                    </div>
                  </div>
                </div>

                

                {/* School Management Section */}
                <div className="border-t pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">School Branches</h3>
                      <p className="text-sm text-gray-500">Manage the academy's branch locations</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {schools?.map((school, index) => (
                        <div key={school.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{school.name}</h4>
                            <Badge variant="outline">Branch {index + 1}</Badge>
                          </div>
                          <p className="text-sm text-gray-500 mb-3">{school.description || 'No description'}</p>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setEditingSchool(school);
                                setIsSchoolEditDialogOpen(true);
                              }}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Universal Settings Management */}
                <div className="border-t pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Universal Settings</h3>
                        <p className="text-sm text-gray-500">Global term and session management for the entire academy</p>
                      </div>
                      <Button onClick={() => setIsSettingsDialogOpen(true)}>
                        <Settings className="w-4 h-4 mr-2" />
                        Manage Settings
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-lg font-bold text-blue-600">Current Term</div>
                        <p className="text-sm text-blue-600">{academicInfo?.currentTerm || "Not Set"}</p>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-lg font-bold text-green-600">Current Session</div>
                        <p className="text-sm text-green-600">{academicInfo?.currentSession || "Not Set"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Information */}
                <div className="border-t pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">System Information</h3>
                      <p className="text-sm text-gray-500">Academy management system details</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{allStudents.length}</div>
                        <p className="text-sm text-gray-600">Total Students</p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{classes.length}</div>
                        <p className="text-sm text-gray-600">Active Classes</p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{schools?.length || 0}</div>
                        <p className="text-sm text-gray-600">School Branches</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Student Data Management Section */}
                <div className="border-t pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">Student Data Management</h3>
                      <p className="text-sm text-gray-500">Edit student details and export student data</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Edit Students Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Edit className="h-5 w-5 mr-2" />
                            Edit Student Details
                          </CardTitle>
                          <CardDescription>
                            Modify student information and contact details
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button 
                            onClick={() => setActiveTab("students")}
                            className="w-full"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Go to Students Tab
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Export Data Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Download className="h-5 w-5 mr-2" />
                            Export Student Data
                          </CardTitle>
                          <CardDescription>
                            Download student contact information and details
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Button 
                            onClick={showExportDialog}
                            variant="outline"
                            className="w-full"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Export Student Data
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* News Tab - Main Admin Only */}
          {user.role === 'admin' && (
            <TabsContent value="news" className="space-y-6">
              <NewsManagement />
            </TabsContent>
          )}

          {/* Notifications Tab - Main Admin Only */}
          {user.role === 'admin' && (
            <TabsContent value="notifications" className="space-y-6">
              <NotificationsManagement />
            </TabsContent>
          )}

        </Tabs>
      </main>

      {/* Class Details Dialog */}
        <Dialog open={isClassDetailsDialogOpen} onOpenChange={setIsClassDetailsDialogOpen}>
          <DialogContent className="max-w-2xl dialog-content-scrollable table-container">
            <DialogHeader>
              <DialogTitle>Class Details: {selectedClassForDetails?.name}</DialogTitle>
              <DialogDescription>
                {selectedClassForDetails?.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Subjects Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Class Subjects</h3>
                  <div className="flex space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              // Set the selected class, current term and session for scores
                              setScoresClassId(selectedClassForDetails?.id || "");
                              setScoresSubjectId("");
                              // Set current academic term and session
                              setScoresTerm(academicInfo?.currentTerm || "First Term");
                              setScoresSession(academicInfo?.currentSession || "2024/2025");
                              // Close dialog and switch to scores tab
                              setIsClassDetailsDialogOpen(false);
                              setActiveTab("scores");
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Record Scores
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Record student scores for this class</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setIsSubjectManagementDialogOpen(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Manage Subjects
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Add or remove subjects for this class</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                
                {/* Display current subjects */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedClassSubjects.map((subject) => (
                    <div key={subject.id} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {subject.name.toUpperCase()}
                      </span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0 text-blue-600 hover:text-red-600"
                        onClick={() => {
                          if (selectedClassForDetails?.id) {
                            removeSubjectMutation.mutate({
                              classId: selectedClassForDetails.id,
                              subjectId: subject.id
                            });
                          }
                        }}
                        disabled={removeSubjectMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                {selectedClassSubjects.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No subjects assigned to this class yet.</p>
                  </div>
                )}
              </div>
              </div>

              {/* Students Section */}
              <div className="space-y-4 border-t pt-6">
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
                        // Reset student form first
                        setStudentFirstName("");
                        setStudentLastName("");
                        setStudentEmail("");
                        setStudentPassword("");
                        setStudentId("");
                        
                        // Set the selected class from the current class details
                        const classId = selectedClassForDetails?.id || "";
                        setSelectedClassId(classId);
                        console.log("Setting selected class ID from class details:", classId);
                        console.log("Opening student dialog with pre-selected class");
                        
                        // Generate a new student ID for this new student
                        generateStudentId();
                        
                        // Open the student dialog and close class details
                        setIsStudentDialogOpen(true);
                        setIsClassDetailsDialogOpen(false);
                        
                        console.log("Student dialog should now be open:", true);
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

        {/* Logo Upload Dialog */}
        <Dialog open={isLogoUploadDialogOpen} onOpenChange={setIsLogoUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Academy Logo</DialogTitle>
              <DialogDescription>
                Upload a new logo for Seat of Wisdom Academy. Recommended size: 200x200px
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="logo-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Choose Logo File
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              {logoPreview && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    className="max-w-32 max-h-32 mx-auto rounded-lg border border-gray-200"
                  />
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={handleLogoCancelation}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleLogoUpload}
                  disabled={!logoFile || uploadLogoMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {uploadLogoMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploadLogoMutation.isPending ? "Uploading..." : "Upload Logo"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Principal Signature Upload Dialog */}
        <Dialog open={isSignatureUploadDialogOpen} onOpenChange={setIsSignatureUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Principal's Signature</DialogTitle>
              <DialogDescription>
                Upload a signature image for the principal. Recommended: PNG with transparent background, 400x150px
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* School Selection */}
              <div>
                <label htmlFor="school-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select School Branch
                </label>
                <select
                  id="school-select"
                  value={selectedSchoolForSignature}
                  onChange={(e) => setSelectedSchoolForSignature(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  data-testid="select-school-signature"
                >
                  <option value="">Select a school...</option>
                  {schools?.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="signature-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Choose Signature File
                </label>
                <input
                  id="signature-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  data-testid="input-signature-file"
                />
              </div>
              
              {signaturePreview && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white">
                    <img 
                      src={signaturePreview} 
                      alt="Signature preview" 
                      className="max-w-full max-h-32 mx-auto"
                    />
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={handleSignatureCancelation}
                  data-testid="button-cancel-signature"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSignatureUpload}
                  disabled={!signatureFile || !selectedSchoolForSignature || uploadSignatureMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-upload-signature-submit"
                >
                  {uploadSignatureMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploadSignatureMutation.isPending ? "Uploading..." : "Upload Signature"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Subject Management Dialog */}
        <Dialog open={isSubjectManagementDialogOpen} onOpenChange={setIsSubjectManagementDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Subjects for {selectedClassForDetails?.name}</DialogTitle>
              <DialogDescription>
                Add or remove subjects from this class
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Available Subjects</h4>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsNewSubjectDialogOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create New
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {subjects
                  .filter(subject => !selectedClassSubjects.some(cs => cs.id === subject.id))
                  .map((subject) => (
                    <div key={subject.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{subject.name.toUpperCase()}</span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          if (selectedClassForDetails?.id) {
                            addSubjectMutation.mutate({
                              classId: selectedClassForDetails.id,
                              subjectId: subject.id
                            });
                          }
                        }}
                        disabled={addSubjectMutation.isPending}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
              </div>
              {subjects.filter(subject => !selectedClassSubjects.some(cs => cs.id === subject.id)).length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">All subjects are already assigned to this class.</p>
                </div>
              )}
              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsSubjectManagementDialogOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Subject Creation Dialog */}
        <Dialog open={isNewSubjectDialogOpen} onOpenChange={setIsNewSubjectDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Subject</DialogTitle>
              <DialogDescription>
                Add a new subject to the academy curriculum
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="subject-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="subject-name"
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewSubjectName(name);
                    // Auto-generate code from name
                    const code = name
                      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
                      .split(' ')
                      .map(word => word.slice(0, 3).toUpperCase())
                      .join('')
                      .slice(0, 10); // Limit to 10 characters
                    setNewSubjectCode(code);
                  }}
                  placeholder="e.g., Physics, Chemistry, Literature"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div>
                <label htmlFor="subject-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="subject-code"
                  type="text"
                  value={newSubjectCode}
                  onChange={(e) => setNewSubjectCode(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="e.g., PHY, CHEM, LIT"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-generated from subject name, but you can edit it</p>
              </div>
              
              <div>
                <label htmlFor="subject-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="subject-description"
                  value={newSubjectDescription}
                  onChange={(e) => setNewSubjectDescription(e.target.value)}
                  placeholder="Brief description of the subject"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsNewSubjectDialogOpen(false);
                    setNewSubjectName("");
                    setNewSubjectCode("");
                    setNewSubjectDescription("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (newSubjectName.trim() && newSubjectCode.trim()) {
                      createSubjectMutation.mutate({
                        name: newSubjectName.trim(),
                        code: newSubjectCode.trim(),
                        description: newSubjectDescription.trim() || undefined
                      });
                    }
                  }}
                  disabled={!newSubjectName.trim() || !newSubjectCode.trim() || createSubjectMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createSubjectMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {createSubjectMutation.isPending ? "Creating..." : "Create Subject"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Global Student Dialog - can be opened from anywhere */}
        <Dialog open={isStudentDialogOpen} onOpenChange={(open) => {
          setIsStudentDialogOpen(open);
          if (!open) {
            // Reset form to step 1 when dialog is closed
            resetFormToStep1();
          } else {
            // Auto-generate student ID when dialog opens
            if (!studentCreationForm.studentId) {
              generateStudentId();
            }
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto student-dialog-content">
            <DialogHeader>
              <DialogTitle className="text-center">Create New Student - Step {currentStep} of 4</DialogTitle>
              
              {/* Progress Bar */}
              <div className="flex items-center justify-center space-x-2 mt-4">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center">
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        step === currentStep 
                          ? 'bg-blue-600 text-white' 
                          : step < currentStep 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {step < currentStep ? '✓' : step}
                    </div>
                    {step < 4 && (
                      <div className={`w-12 h-1 ${
                        step < currentStep ? 'bg-green-600' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </DialogHeader>
            
            <div className="space-y-6 mt-6">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center text-blue-600">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="student-firstname">First Name *</Label>
                      <Input
                        id="student-firstname"
                        value={studentCreationForm.firstName}
                        onChange={(e) => handleStudentFormChange('firstName', e.target.value)}
                        placeholder="John"
                        className={studentFormErrors.firstName ? "border-red-500" : ""}
                      />
                      {studentFormErrors.firstName && (
                        <p className="text-red-500 text-xs mt-1">{studentFormErrors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="student-lastname">Last Name *</Label>
                      <Input
                        id="student-lastname"
                        value={studentCreationForm.lastName}
                        onChange={(e) => handleStudentFormChange('lastName', e.target.value)}
                        placeholder="Doe"
                        className={studentFormErrors.lastName ? "border-red-500" : ""}
                      />
                      {studentFormErrors.lastName && (
                        <p className="text-red-500 text-xs mt-1">{studentFormErrors.lastName}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="student-middlename">Middle Name (Optional)</Label>
                    <Input
                      id="student-middlename"
                      value={studentCreationForm.middleName}
                      onChange={(e) => handleStudentFormChange('middleName', e.target.value)}
                      placeholder="Smith"
                      className={studentFormErrors.middleName ? "border-red-500" : ""}
                    />
                    {studentFormErrors.middleName && (
                      <p className="text-red-500 text-xs mt-1">{studentFormErrors.middleName}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="student-id">Student ID *</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="student-id"
                        value={studentCreationForm.studentId}
                        onChange={(e) => handleStudentFormChange('studentId', e.target.value)}
                        placeholder="e.g., SOWA/1001"
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
                    <Label htmlFor="student-class">Class *</Label>
                    <Select 
                      value={studentCreationForm.classId || selectedClassForStudents} 
                      onValueChange={(value) => handleStudentFormChange('classId', value)}
                    >
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
                </div>
              )}

              {/* Step 2: Personal Details */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center text-green-600">Personal Details</h3>
                  <div>
                    <Label htmlFor="student-gender">Gender *</Label>
                    <Select 
                      value={studentCreationForm.gender} 
                      onValueChange={(value) => handleStudentFormChange('gender', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="student-dob">Date of Birth (Optional)</Label>
                      <Input
                        id="student-dob"
                        type="date"
                        value={studentCreationForm.dateOfBirth}
                        onChange={(e) => handleStudentFormChange('dateOfBirth', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Contact Information */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center text-orange-600">Contact Information</h3>
                  <div>
                    <Label htmlFor="student-email">Email *</Label>
                    <Input
                      id="student-email"
                      type="email"
                      value={studentCreationForm.email}
                      onChange={(e) => handleStudentFormChange('email', e.target.value)}
                      placeholder="john.doe@student.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="student-password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="student-password"
                        type={showPassword ? "text" : "password"}
                        value={studentCreationForm.password}
                        onChange={(e) => handleStudentFormChange('password', e.target.value)}
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
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="student-whatsapp">Parent WhatsApp Number *</Label>
                    <Input
                      id="student-whatsapp"
                      value={studentCreationForm.parentWhatsApp}
                      onChange={(e) => handleStudentFormChange('parentWhatsApp', e.target.value)}
                      placeholder="+234 XXX XXX XXXX"
                    />
                  </div>
                  <div>
                    <Label htmlFor="student-parent-contact">Parent Contact (Optional)</Label>
                    <Input
                      id="student-parent-contact"
                      value={studentCreationForm.parentContact}
                      onChange={(e) => handleStudentFormChange('parentContact', e.target.value)}
                      placeholder="Parent phone number"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Additional Information */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center text-purple-600">Additional Information</h3>
                  <div>
                    <Label htmlFor="student-address">Address (Optional)</Label>
                    <Input
                      id="student-address"
                      value={studentCreationForm.address}
                      onChange={(e) => handleStudentFormChange('address', e.target.value)}
                      placeholder="Student's home address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="student-profile-image">Profile Image (Optional)</Label>
                    <Input
                      id="student-profile-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            handleStudentFormChange('profileImage', result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Upload a profile photo (optional). Supported formats: JPG, PNG, GIF
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">
                      Ready to Create Student
                    </h4>
                    <p className="text-xs text-blue-700">
                      Review your information and click "Create Student" to complete the registration.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button 
                  variant="outline" 
                  onClick={currentStep === 1 ? () => setIsStudentDialogOpen(false) : prevStep}
                >
                  {currentStep === 1 ? 'Cancel' : 'Previous'}
                </Button>
                
                {currentStep < 4 ? (
                  <Button 
                    onClick={nextStep}
                    disabled={
                      (currentStep === 1 && !isStep1Valid()) ||
                      (currentStep === 2 && !isStep2Valid()) ||
                      (currentStep === 3 && !isStep3Valid())
                    }
                  >
                    Next
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCreateStudent}
                    disabled={createStudentMutation.isPending || !isStudentFormValid()}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createStudentMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create Student
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fee Type Creation Dialog */}
        <Dialog open={isFeeTypeDialogOpen} onOpenChange={setIsFeeTypeDialogOpen}>
          <DialogContent className="max-w-md dialog-content-scrollable form-container">
            <DialogHeader>
              <DialogTitle>Create New Fee Type</DialogTitle>
              <DialogDescription>
                Add a new fee category for school payments
              </DialogDescription>
            </DialogHeader>
            <Form {...feeTypeForm}>
              <form onSubmit={feeTypeForm.handleSubmit(handleFeeTypeSubmit)} className="space-y-4">
                <FormField
                  control={feeTypeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee Type Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Tuition, Registration, Textbooks" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={feeTypeForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₦) *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 25000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={feeTypeForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Academic, Administrative, Miscellaneous" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={feeTypeForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of this fee type"
                          rows={3}
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFeeTypeDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createFeeTypeMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createFeeTypeMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {createFeeTypeMutation.isPending ? "Creating..." : "Create Fee Type"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog - Spreadsheet Style */}
        <Dialog open={isRecordPaymentDialogOpen} onOpenChange={setIsRecordPaymentDialogOpen}>
          <DialogContent className="max-w-6xl dialog-content-scrollable table-container">
            <DialogHeader>
              <DialogTitle>Record Class Payments</DialogTitle>
              <DialogDescription>
                Select a class and record payments for multiple students in spreadsheet format
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Class Selection */}
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="text-sm font-medium">Select Class *</label>
                  <Select 
                    value={selectedPaymentClass} 
                    onValueChange={setSelectedPaymentClass}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortClassesByOrder(classes).map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <label className="text-sm font-medium">Payment Date *</label>
                  <Input 
                    type="date" 
                    value={bulkPaymentDate}
                    onChange={(e) => setBulkPaymentDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Spreadsheet Table */}
              {selectedPaymentClass && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-sm font-medium">Student ID</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Student Name</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Total Paid (₦)</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Balance (₦)</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Payment Amount (₦)</th>
                          <th className="px-3 py-2 text-left text-sm font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getStudentsForPaymentClass().map((student, index) => {
                          // Calculate total paid and balance for this student
                          const studentPayments = payments.filter(p => {
                            const studentFee = studentFees.find(sf => sf.id === p.studentFeeId);
                            return studentFee?.studentId === student.id;
                          });
                          const totalPaid = studentPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                          
                          // Get the assigned fee amount for this student
                          const studentFee = studentFees.find(sf => sf.studentId === student.id);
                          const feeAmount = studentFee ? Number(studentFee.amount) : 0;
                          const balance = feeAmount - totalPaid;
                          
                          return (
                            <tr key={student.id} className="border-t">
                              <td className="px-3 py-2 text-sm">{student.studentId}</td>
                              <td className="px-3 py-2 text-sm font-medium">
                                {student.user?.firstName} {student.user?.lastName}
                              </td>
                              <td className="px-3 py-2 text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600">₦{totalPaid.toLocaleString()}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 hover:bg-blue-100"
                                    onClick={() => {
                                      // Show payment history modal
                                      setSelectedStudentForHistory(student);
                                      setIsPaymentHistoryDialogOpen(true);
                                    }}
                                  >
                                    <History className="h-4 w-4 text-blue-600" />
                                  </Button>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-sm text-red-600 font-medium">
                                ₦{balance.toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  className="h-8 w-24"
                                  value={bulkPayments[index]?.amount || ""}
                                  onChange={(e) => updateBulkPayment(index, 'amount', Number(e.target.value) || 0)}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  placeholder="Notes"
                                  className="h-8 w-32"
                                  value={bulkPayments[index]?.notes || ""}
                                  onChange={(e) => updateBulkPayment(index, 'notes', e.target.value)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsRecordPaymentDialogOpen(false);
                    setSelectedPaymentClass("");
                    setBulkPayments([]);
                  }}
                >
                  Close
                </Button>
                <Button 
                  disabled={!selectedPaymentClass || bulkPayments.filter(p => p.amount > 0).length === 0}
                  onClick={handleBulkPaymentSubmit}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {false ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4 mr-2" />
                  )}
                  {recordPaymentMutation.isPending ? "Recording..." : "Record Payments"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign Fee Dialog */}
        <Dialog open={isAssignFeeDialogOpen} onOpenChange={setIsAssignFeeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Fee to Class</DialogTitle>
              <DialogDescription>
                Assign a specific fee type to all students in a selected class
              </DialogDescription>
            </DialogHeader>
            <Form {...assignFeeForm}>
              <form onSubmit={assignFeeForm.handleSubmit(handleAssignFeeSubmit)} className="space-y-4">
                <FormField
                  control={assignFeeForm.control}
                  name="feeTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fee type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {feeTypes.map((feeType) => (
                            <SelectItem key={feeType.id} value={feeType.id}>
                              {feeType.name} - ₦{Number(feeType.amount).toLocaleString()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={assignFeeForm.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classes.map((classItem) => (
                            <SelectItem key={classItem.id} value={classItem.id}>
                              {classItem.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="bg-gray-50 p-3 rounded-lg text-sm">
                  <p className="font-medium">Term & Session Settings</p>
                  <p className="text-gray-600 mt-1">
                    Current Term: <span className="font-medium">{selectedFinanceTerm}</span><br/>
                    Current Session: <span className="font-medium">{selectedFinanceSession}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Term and session are set globally by the school admin
                  </p>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAssignFeeDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={assignFeeMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {assignFeeMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {assignFeeMutation.isPending ? "Assigning..." : "Assign Fee"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Payment History Dialog */}
        <Dialog open={isPaymentHistoryDialogOpen} onOpenChange={setIsPaymentHistoryDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payment History</DialogTitle>
              <DialogDescription>
                {selectedStudentForHistory && (
                  <>
                    Payment history for {selectedStudentForHistory.user?.firstName} {selectedStudentForHistory.user?.lastName} ({selectedStudentForHistory.studentId})
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {(() => {
                // Get payments for this student
                const studentPaymentHistory = payments.filter(p => {
                  const studentFee = studentFees.find(sf => sf.id === p.studentFeeId);
                  return studentFee?.studentId === selectedStudentForHistory?.id;
                });

                if (studentPaymentHistory.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No payment history found</p>
                    </div>
                  );
                }

                return (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Amount</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Method</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Reference</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentPaymentHistory.map((payment, index) => (
                          <tr key={payment.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-4 py-2 text-sm">
                              {new Date(payment.paymentDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-green-600">
                              ₦{Number(payment.amount).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-sm capitalize">
                              {payment.paymentMethod}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {payment.reference || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {payment.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <div className="px-4 py-3 bg-gray-100 border-t">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Total Paid:</span>
                        <span className="text-green-600">
                          ₦{studentPaymentHistory.reduce((sum, payment) => sum + Number(payment.amount), 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="flex justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setIsPaymentHistoryDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* Universal Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Universal Settings</DialogTitle>
              <DialogDescription>
                Set global term and session for the entire academy
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="globalTerm">Current Term</Label>
                <Select value={globalTerm} onValueChange={setGlobalTerm}>
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
                <Label htmlFor="globalSession">Current Session</Label>
                <Select value={globalSession} onValueChange={setGlobalSession}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicSessions.map((session) => (
                      <SelectItem key={session.id} value={session.sessionYear}>
                        {session.sessionYear}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => updateGlobalSettings.mutate({term: globalTerm, session: globalSession})}
                  disabled={updateGlobalSettings.isPending}
                >
                  {updateGlobalSettings.isPending ? "Updating..." : "Update Settings"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Subject Assignment Dialog */}
        <Dialog open={isAssignSubjectDialogOpen} onOpenChange={setIsAssignSubjectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Subject to Class</DialogTitle>
              <DialogDescription>
                Select a class and subject to create the assignment
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="classForSubject">Select Class</Label>
                <Select value={selectedClassForSubject} onValueChange={setSelectedClassForSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortClassesByOrder(classes).map((classItem) => (
                      <SelectItem key={classItem.id} value={classItem.id}>
                        {classItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subjectToAssign">Select Subject</Label>
                <Select value={selectedSubjectToAssign} onValueChange={setSelectedSubjectToAssign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name.toUpperCase()} ({subject.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setIsAssignSubjectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => assignSubjectToClassMutation.mutate({
                    classId: selectedClassForSubject,
                    subjectId: selectedSubjectToAssign
                  })}
                  disabled={!selectedClassForSubject || !selectedSubjectToAssign || assignSubjectToClassMutation.isPending}
                >
                  {assignSubjectToClassMutation.isPending ? "Assigning..." : "Assign Subject"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Student Dialog */}
        <Dialog open={isEditStudentDialogOpen} onOpenChange={setIsEditStudentDialogOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="text-center pb-4">
              <DialogTitle className="text-2xl font-bold text-gray-800 dark:text-gray-200">Edit Student Profile</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Update student information and profile details
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-8">
              {/* Profile Image Section */}
              <div className="flex flex-col items-center space-y-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border">
                <div className="relative">
                  <Avatar className="w-32 h-32 border-4 border-white shadow-lg">
                    <AvatarImage 
                      src={profileImagePreview || studentEditForm.profileImage || editingStudent?.profileImage || ''} 
                      alt={`${studentEditForm.firstName} ${studentEditForm.lastName}`}
                    />
                    <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                      {studentEditForm.firstName?.charAt(0)}{studentEditForm.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2">
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880}
                      onGetUploadParameters={async () => {
                        const response = await fetch('/api/objects/upload', {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                          }
                        });
                        const data = await response.json();
                        return { method: 'PUT' as const, url: data.uploadURL };
                      }}
                      onComplete={async (result) => {
                        if (result.successful?.[0]?.uploadURL && editingStudent) {
                          setIsUploadingProfileImage(true);
                          try {
                            const response = await fetch(`/api/students/${editingStudent.id}/profile-image`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                              },
                              body: JSON.stringify({ profileImageURL: result.successful[0].uploadURL })
                            });
                            
                            if (response.ok) {
                              const data = await response.json();
                              setStudentEditForm(prev => ({ ...prev, profileImage: data.objectPath }));
                              setProfileImagePreview(data.objectPath);
                              
                              // Refresh the students data to show updated profile image
                              queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
                              
                              toast({
                                title: "Success",
                                description: "Profile image updated successfully!"
                              });
                            } else {
                              throw new Error('Failed to update profile image');
                            }
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: "Failed to update profile image",
                              variant: "destructive"
                            });
                          } finally {
                            setIsUploadingProfileImage(false);
                          }
                        }
                      }}
                      buttonClassName="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105"
                    >
                      {isUploadingProfileImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </ObjectUploader>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile Photo</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Click the camera icon to upload a new photo</p>
                </div>
              </div>

              {/* Personal Information */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-blue-500" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</Label>
                      <Input
                        id="firstName"
                        value={studentEditForm.firstName}
                        onChange={(e) => setStudentEditForm(prev => ({...prev, firstName: e.target.value}))}
                        placeholder="Enter first name"
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={studentEditForm.lastName}
                        onChange={(e) => setStudentEditForm(prev => ({...prev, lastName: e.target.value}))}
                        placeholder="Enter last name"
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="middleName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Middle Name</Label>
                      <Input
                        id="middleName"
                        value={studentEditForm.middleName}
                        onChange={(e) => setStudentEditForm(prev => ({...prev, middleName: e.target.value}))}
                        placeholder="Enter middle name"
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={studentEditForm.email}
                        onChange={(e) => setStudentEditForm(prev => ({...prev, email: e.target.value}))}
                        placeholder="Enter email address"
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={studentEditForm.dateOfBirth}
                        onChange={(e) => setStudentEditForm(prev => ({...prev, dateOfBirth: e.target.value}))}
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-sm font-medium text-gray-700 dark:text-gray-300">Gender</Label>
                      <Select value={studentEditForm.gender} onValueChange={(value) => setStudentEditForm(prev => ({...prev, gender: value}))}>
                        <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-blue-500">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Academic Information */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GraduationCap className="h-5 w-5 text-green-500" />
                    Academic Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="classId" className="text-sm font-medium text-gray-700 dark:text-gray-300">Class *</Label>
                    <Select value={studentEditForm.classId} onValueChange={(value) => setStudentEditForm(prev => ({...prev, classId: value}))}>
                      <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-green-500">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortClassesByOrder(classes).map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Security Information */}
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5 text-orange-500" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={studentEditForm.newPassword}
                        onChange={(e) => setStudentEditForm(prev => ({...prev, newPassword: e.target.value}))}
                        placeholder="Enter new password (leave blank to keep current)"
                        className="transition-all duration-200 focus:ring-2 focus:ring-orange-500 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Leave blank to keep the current password unchanged
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Phone className="h-5 w-5 text-purple-500" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parentContact" className="text-sm font-medium text-gray-700 dark:text-gray-300">Parent Contact</Label>
                      <Input
                        id="parentContact"
                        value={studentEditForm.parentContact}
                        onChange={(e) => setStudentEditForm(prev => ({...prev, parentContact: e.target.value}))}
                        placeholder="Enter parent phone number"
                        className="transition-all duration-200 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentWhatsApp" className="text-sm font-medium text-gray-700 dark:text-gray-300">Parent WhatsApp</Label>
                      <Input
                        id="parentWhatsApp"
                        value={studentEditForm.parentWhatsApp}
                        onChange={(e) => setStudentEditForm(prev => ({...prev, parentWhatsApp: e.target.value}))}
                        placeholder="Enter parent WhatsApp number"
                        className="transition-all duration-200 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="address" className="text-sm font-medium text-gray-700 dark:text-gray-300">Home Address</Label>
                      <Textarea
                        id="address"
                        value={studentEditForm.address}
                        onChange={(e) => setStudentEditForm(prev => ({...prev, address: e.target.value}))}
                        placeholder="Enter complete home address"
                        className="transition-all duration-200 focus:ring-2 focus:ring-purple-500 min-h-[80px]"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditStudentDialogOpen(false);
                  setProfileImagePreview("");
                  setStudentEditForm(prev => ({...prev, newPassword: ""}));
                }}
                className="transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingStudent) {
                    updateStudentMutation.mutate({
                      id: editingStudent.id,
                      ...studentEditForm
                    });
                  }
                }}
                disabled={updateStudentMutation.isPending || !editingStudent}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-200 transform hover:scale-105"
              >
                {updateStudentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Student
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* Report Generation Dialog */}
        <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Report Card</DialogTitle>
              <DialogDescription>
                Generate report card for {selectedStudentForReport?.user?.firstName} {selectedStudentForReport?.user?.lastName}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Term and Session</Label>
                <Select 
                  value={`${reportTerm}|${reportSession}`} 
                  onValueChange={(value) => {
                    const [term, session] = value.split('|');
                    setReportTerm(term);
                    setReportSession(session);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select term and session" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicTerms.map((term) => {
                      const session = academicSessions.find(s => s.id === term.sessionId);
                      if (!session) return null;
                      return (
                        <SelectItem key={term.id} value={`${term.termName}|${session.sessionYear}`}>
                          {term.termName}, {session.sessionYear}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Next Term Resumption Date</Label>
                <input
                  type="date"
                  value={nextTermResumptionDate}
                  onChange={(e) => setNextTermResumptionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsReportDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedStudentForReport && nextTermResumptionDate) {
                      // Check if it's third term for promotion
                      if (isThirdTerm(reportTerm)) {
                        const { nextClass, isGraduation } = getNextClass(selectedStudentForReport.class.name);
                        if (nextClass) {
                          // Set up promotion dialog
                          setStudentsToPromote([selectedStudentForReport.id]);
                          setIsPromotionDialogOpen(true);
                          setIsReportDialogOpen(false);
                        } else {
                          // Generate report without promotion
                          generateReportCard(selectedStudentForReport, nextTermResumptionDate, reportTerm, reportSession);
                          setIsReportDialogOpen(false);
                        }
                      } else {
                        // Generate report without promotion
                        generateReportCard(selectedStudentForReport, nextTermResumptionDate, reportTerm, reportSession);
                        setIsReportDialogOpen(false);
                      }
                    }
                  }}
                  disabled={!nextTermResumptionDate}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Promotion Dialog */}
        <Dialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Student Promotion</DialogTitle>
              <DialogDescription>
                This is a Third Term report. Would you like to promote this student to the next class?
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {selectedStudentForReport && (() => {
                const { nextClass, isGraduation } = getNextClass(selectedStudentForReport.class.name);
                
                return (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <UserCheck className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="font-medium">
                          {selectedStudentForReport.user.firstName} {selectedStudentForReport.user.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          ID: {selectedStudentForReport.studentId}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Current Class:</span>
                        <span className="text-sm font-medium">{selectedStudentForReport.class.name}</span>
                      </div>
                      
                      {nextClass && (
                        <div className="flex justify-between">
                          <span className="text-sm">Promote to:</span>
                          <span className="text-sm font-medium text-green-600">
                            {isGraduation ? "🎓 Graduated" : nextClass}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-between space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Generate report without promotion
                    if (selectedStudentForReport && nextTermResumptionDate) {
                      generateReportCard(selectedStudentForReport, nextTermResumptionDate, reportTerm, reportSession);
                    }
                    setIsPromotionDialogOpen(false);
                  }}
                  className="flex-1"
                >
                  Skip Promotion
                </Button>
                <Button
                  onClick={() => {
                    if (selectedStudentForReport) {
                      const { nextClass, isGraduation } = getNextClass(selectedStudentForReport.class.name);
                      
                      if (nextClass && nextTermResumptionDate) {
                        // Generate report WITH promotion information
                        generateReportCard(
                          selectedStudentForReport,
                          nextTermResumptionDate,
                          reportTerm,
                          reportSession,
                          nextClass
                        );
                        
                        // If not graduation, actually promote the student in the database
                        if (!isGraduation) {
                          // Find next class ID from available classes
                          const nextClassObj = classes?.find(c => c.name === nextClass);
                          if (nextClassObj) {
                            promoteStudentsMutation.mutate({
                              currentClassId: selectedStudentForReport.classId,
                              nextClassId: nextClassObj.id,
                              studentIds: [selectedStudentForReport.id]
                            });
                          }
                        }
                      }
                    }
                    setIsPromotionDialogOpen(false);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Promote & Generate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Export Student Data</DialogTitle>
              <DialogDescription>
                Choose which class data to export
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="exportClass">Select Class</Label>
                <Select value={selectedExportClass} onValueChange={setSelectedExportClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose class to export" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {sortClassesByOrder(classes).map((classItem) => (
                      <SelectItem key={classItem.id} value={classItem.id}>
                        {classItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-center">
                <Button 
                  onClick={() => {
                    exportStudentData('excel');
                    setIsExportDialogOpen(false);
                  }}
                  disabled={!selectedExportClass}
                  variant="outline"
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export as Excel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Student Confirmation Dialog */}
        <Dialog open={isDeleteStudentDialogOpen} onOpenChange={setIsDeleteStudentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete Student</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this student? This action cannot be undone and will remove all associated data including grades, attendance records, and financial information.
              </DialogDescription>
            </DialogHeader>
            {selectedStudentForDeletion && (
              <div className="py-4">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-800">
                      {selectedStudentForDeletion.user.firstName} {selectedStudentForDeletion.user.lastName}
                    </span>
                  </div>
                  <p className="text-sm text-red-700">{selectedStudentForDeletion.user.email}</p>
                  <p className="text-sm text-red-700">Student ID: {selectedStudentForDeletion.studentId}</p>
                  <Badge className="bg-blue-500 text-white mt-2">
                    Student
                  </Badge>
                </div>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteStudentDialogOpen(false);
                  setSelectedStudentForDeletion(null);
                }}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedStudentForDeletion) {
                    deleteStudentMutation.mutate(selectedStudentForDeletion.user.id);
                  }
                }}
                disabled={deleteStudentMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteStudentMutation.isPending ? "Deleting..." : "Delete Student"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}