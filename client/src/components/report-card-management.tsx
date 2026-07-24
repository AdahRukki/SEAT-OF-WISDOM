import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Eye,
  Download,
  Calendar,
  School,
  ArrowRight,
  RefreshCw,
  CalendarDays,
  BookOpen,
  ChevronDown,
  ChevronRight,
  UserX,
} from "lucide-react";
import { calculateGrade } from "@shared/schema";

interface ReportCardManagementProps {
  classes: any[];
  user: any;
  selectedSchoolId?: string;
  schools?: any[];
}

interface ValidationResult {
  hasAllScores: boolean;
  hasAttendance: boolean;
  missingSubjects: string[];
}

interface SkippedStudent {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  missingSubjects: string[];
  hasAttendance: boolean;
}

interface GeneratedReportCard {
  id: string;
  studentId: string;
  classId: string;
  term: string;
  session: string;
  studentName: string;
  className: string;
  totalScore?: string;
  averageScore?: string;
  attendancePercentage?: string;
  generatedAt: string;
  generatedBy: string;
}

export function ReportCardManagement({
  classes,
  user,
  selectedSchoolId: initialSchoolId = "",
  schools = [],
}: ReportCardManagementProps) {
  const [activeSchoolId, setActiveSchoolId] = useState(initialSchoolId);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState("");

  // Sync if parent changes the school selection
  useEffect(() => {
    setActiveSchoolId(initialSchoolId);
    setSelectedClass("");
  }, [initialSchoolId]);

  const [validationResults, setValidationResults] = useState<
    Record<string, ValidationResult>
  >({});
  const [isValidating, setIsValidating] = useState(false);
  const [batchResumptionDate, setBatchResumptionDate] = useState("");
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(
    new Set(),
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch generated report cards (filtered by school)
  const { data: generatedReports = [], isLoading: isLoadingReports } = useQuery<
    GeneratedReportCard[]
  >({
    queryKey: ["/api/admin/generated-reports", activeSchoolId],
    queryFn: () => apiRequest(activeSchoolId ? `/api/admin/generated-reports?schoolId=${activeSchoolId}` : "/api/admin/generated-reports"),
  });

  // Fetch students for selected class
  const { data: students = [] } = useQuery<any[]>({
    queryKey: [`/api/admin/students/class/${selectedClass}`],
    enabled: !!selectedClass,
  });

  // Use same academic info query as Settings for synchronization (school-aware)
  const { data: academicInfo } = useQuery<{
    currentSession: string | null;
    currentTerm: string | null;
  }>({
    queryKey: activeSchoolId ? ["/api/current-academic-info", activeSchoolId] : ["/api/current-academic-info"],
    queryFn: () => apiRequest(activeSchoolId ? `/api/current-academic-info?schoolId=${activeSchoolId}` : "/api/current-academic-info"),
  });

  // Fetch academic sessions
  const { data: academicSessions = [] } = useQuery<{ id: string; sessionYear: string; isActive: boolean }[]>({
    queryKey: ['/api/admin/academic-sessions'],
  });

  // Fetch academic terms
  const { data: academicTerms = [] } = useQuery<{ id: string; termName: string; sessionId: string; isActive: boolean }[]>({
    queryKey: ['/api/admin/academic-terms'],
  });

  // Initialize with current term/session on first load only
  useEffect(() => {
    if (academicInfo?.currentTerm && !selectedTerm) {
      setSelectedTerm(academicInfo.currentTerm);
    }
    if (academicInfo?.currentSession && !selectedSession) {
      setSelectedSession(academicInfo.currentSession);
    }
  }, [academicInfo]);

  // Bulk validation mutation (replaces per-student sequential calls)
  const bulkValidateMutation = useMutation({
    mutationFn: async (data: { classId: string; term: string; session: string }) => {
      return await apiRequest("/api/admin/validate-report-data-bulk", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: (result) => {
      setValidationResults(result.results);
    },
    onError: () => {
      toast({
        title: "Validation Error",
        description: "Failed to validate report data",
        variant: "destructive",
      });
    },
  });

  // School-wide bulk validation mutation
  const schoolValidateMutation = useMutation({
    mutationFn: async (data: { term: string; session: string; schoolId?: string }) => {
      return await apiRequest("/api/admin/validate-report-data-school", {
        method: "POST",
        body: data,
      });
    },
  });

  // Delete report mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return await apiRequest(`/api/admin/generated-reports/${reportId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/generated-reports", activeSchoolId],
      });
      toast({
        title: "Success",
        description: "Report card deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete report card",
        variant: "destructive",
      });
    },
  });

  // Bulk clear reports mutation
  const clearReportsMutation = useMutation({
    mutationFn: async (opts: { schoolId: string; classId?: string; term?: string; session?: string }) => {
      return await apiRequest("/api/admin/generated-reports/bulk", {
        method: "DELETE",
        body: opts,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/generated-reports", activeSchoolId] });
      setIsClearDialogOpen(false);
      toast({
        title: "Reports Cleared",
        description: result.message || "Report cards removed successfully",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear report cards", variant: "destructive" });
    },
  });

  // Create report card record mutation
  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/admin/generated-reports", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/generated-reports", activeSchoolId],
      });
      toast({
        title: "Success",
        description: "Report card record created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create report card record",
        variant: "destructive",
      });
    },
  });

  const handleValidateAll = async () => {
    if (!selectedClass || !selectedTerm || !selectedSession) {
      toast({
        title: "Missing Selection",
        description: "Please select class, term, and session first",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    setValidationResults({});

    try {
      const result = await bulkValidateMutation.mutateAsync({
        classId: selectedClass,
        term: selectedTerm,
        session: selectedSession,
      });

      toast({
        title: "Validation Complete",
        description: `${result.summary.ready}/${result.summary.total} students ready. ${result.summary.partial > 0 ? `${result.summary.partial} partial.` : ""} ${result.summary.incomplete > 0 ? `${result.summary.incomplete} incomplete.` : ""}`.trim(),
      });
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Failed to validate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Auto-validate when class + term + session are all selected
  useEffect(() => {
    if (selectedClass && selectedTerm && selectedSession && students.length > 0) {
      setValidationResults({});
      setIsValidating(true);
      bulkValidateMutation.mutateAsync({
        classId: selectedClass,
        term: selectedTerm,
        session: selectedSession,
      }).finally(() => setIsValidating(false));
    }
  }, [selectedClass, selectedTerm, selectedSession, students.length]);

  // State for tracking validation results by class
  const [schoolValidationResults, setSchoolValidationResults] = useState<{
    [classId: string]: {
      className: string;
      totalStudents: number;
      validatedStudents: number;
      issues: string[];
    };
  }>({});
  const [isAllStudentsValidated, setIsAllStudentsValidated] = useState(false);
  const [showResumptionDateDialog, setShowResumptionDateDialog] =
    useState(false);
  const [resumptionDate, setResumptionDate] = useState<Date | undefined>(
    undefined,
  );
  const [isGeneratingReports, setIsGeneratingReports] = useState(false);

  // Skipped students state (populated after bulk generation)
  const [skippedStudents, setSkippedStudents] = useState<SkippedStudent[]>([]);
  const [generationSummary, setGenerationSummary] = useState<{ generated: number; skipped: number } | null>(null);
  const [skippedPanelOpen, setSkippedPanelOpen] = useState(true);
  const [individualValidating, setIndividualValidating] = useState<Set<string>>(new Set());
  const [individualValidationResults, setIndividualValidationResults] = useState<Record<string, ValidationResult>>({});
  const [individuallyGenerated, setIndividuallyGenerated] = useState<Set<string>>(new Set());

  // Filter state for generated reports list
  const [filterSearch, setFilterSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterTermSession, setFilterTermSession] = useState("");

  // Clear reports dialog state
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [clearScope, setClearScope] = useState<"class" | "all">("class");
  const [clearClassId, setClearClassId] = useState("");
  const [clearTerm, setClearTerm] = useState("__all__");
  const [clearSession, setClearSession] = useState("__all__");

  // Tab state — resets on navigation away (component unmount/remount)
  const [activeTab, setActiveTab] = useState("validate");

  // Per-student validation list status filter
  const [studentStatusFilter, setStudentStatusFilter] = useState<"all" | "ready" | "incomplete">("all");

  // Validation for entire school - single bulk API call
  const handleValidateEntireSchool = async () => {
    setIsValidating(true);
    setValidationResults({});
    setSchoolValidationResults({});
    setIsAllStudentsValidated(false);

    try {
      if (!academicInfo?.currentTerm || !academicInfo?.currentSession) {
        try {
          await apiRequest("/api/admin/initialize-academic-calendar", {
            method: "POST",
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/current-academic-info"],
          });
          toast({
            title: "Academic Calendar Initialized",
            description: "Academic calendar has been initialized successfully.",
          });
        } catch (error) {
          toast({
            title: "Initialization Failed",
            description: "Failed to initialize academic calendar. Please contact administrator.",
            variant: "destructive",
          });
          return;
        }
      }

      const currentTerm = selectedTerm || academicInfo?.currentTerm;
      const currentSession = selectedSession || academicInfo?.currentSession;

      if (!currentTerm || !currentSession) {
        toast({
          title: "Missing Term/Session",
          description: "Please select a term and session to validate.",
          variant: "destructive",
        });
        return;
      }

      const result = await schoolValidateMutation.mutateAsync({
        term: currentTerm,
        session: currentSession,
        schoolId: activeSchoolId || undefined,
      });

      setSchoolValidationResults(result.classes);
      setValidationResults(result.studentResults);

      if (result.summary.totalStudents === 0) {
        toast({
          title: "No Students Found",
          description: "No students found across all classes.",
          variant: "destructive",
        });
        return;
      }

      const allValidated = result.summary.readyStudents === result.summary.totalStudents;
      setIsAllStudentsValidated(allValidated);

      const successRate = (result.summary.readyStudents / result.summary.totalStudents) * 100;

      toast({
        title: allValidated
          ? "All Students Validated Successfully"
          : "Validation Complete - Issues Found",
        description: `${result.summary.readyStudents}/${result.summary.totalStudents} students validated (${successRate.toFixed(1)}%). Check class details below.`,
        variant: allValidated ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Failed to complete school-wide validation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Generate all report cards for the entire school with date selection
  const handleGenerateAllReports = async () => {
    // Validate date is set
    if (!resumptionDate) {
      toast({
        title: "Date Required",
        description: "Please select the next term resumption date before generating reports.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingReports(true);
    setShowResumptionDateDialog(false);
    setSkippedStudents([]);
    setGenerationSummary(null);
    setIndividuallyGenerated(new Set());

    try {
      // Use selected term/session from dropdown (prioritize user selection)
      const currentTerm = selectedTerm || academicInfo?.currentTerm;
      const currentSession = selectedSession || academicInfo?.currentSession;
      const isThirdTerm = currentTerm === "Third Term";
      const resumptionDateStr = format(resumptionDate, "PPP");

      // Split students into validated and skipped groups
      const validatedStudentIds = new Set<string>();
      const newSkippedStudents: SkippedStudent[] = [];

      Object.entries(validationResults).forEach(([studentId, validation]) => {
        if (validation.hasAllScores) {
          validatedStudentIds.add(studentId);
        }
      });

      if (validatedStudentIds.size === 0) {
        toast({
          title: "No Validated Students",
          description: "No students found with complete scores. Please ensure at least one student has all scores recorded.",
          variant: "destructive",
        });
        return;
      }

      let generatedCount = 0;

      // Publish scores and generate reports for validated students only
      for (const classId in schoolValidationResults) {
        const classResult = schoolValidationResults[classId];

        // Get students for this class
        const classStudents = await apiRequest(
          `/api/admin/students/class/${classId}`,
        );

        // Collect skipped students for this class
        for (const student of classStudents) {
          if (!validatedStudentIds.has(student.id)) {
            const validation = validationResults[student.id];
            newSkippedStudents.push({
              studentId: student.id,
              studentName: `${student.user.firstName} ${student.user.lastName}`,
              classId,
              className: classResult.className,
              missingSubjects: validation?.missingSubjects || [],
              hasAttendance: validation?.hasAttendance || false,
            });
          }
        }

        const classHasValidatedStudents = classStudents.some((s: any) => validatedStudentIds.has(s.id));

        if (classHasValidatedStudents) {
          // Publish scores for this class (only affects validated students server-side)
          try {
            await apiRequest('/api/admin/publish-scores', {
              method: 'POST',
              body: {
                classId: classId,
                term: currentTerm,
                session: currentSession,
                nextTermResumes: format(resumptionDate, 'yyyy-MM-dd')
              }
            });
          } catch (publishError) {
            console.error(`Failed to publish scores for class ${classId}:`, publishError);
            throw publishError;
          }

          for (const student of classStudents) {
            if (validatedStudentIds.has(student.id)) {
              try {
                await createReportMutation.mutateAsync({
                  studentId: student.id,
                  classId: classId,
                  term: currentTerm,
                  session: currentSession,
                  studentName: `${student.user.firstName} ${student.user.lastName}`,
                  className: classResult.className,
                  totalScore: "0",
                  averageScore: "0",
                  attendancePercentage: "0",
                  resumptionDate: resumptionDateStr,
                });
                generatedCount++;
              } catch (error) {
                console.error(
                  `Failed to generate report for student ${student.id}:`,
                  error,
                );
                throw error;
              }
            }
          }
        }
      }

      setSkippedStudents(newSkippedStudents);
      setGenerationSummary({ generated: generatedCount, skipped: newSkippedStudents.length });
      setSkippedPanelOpen(true);

      toast({
        title: "Reports Generated",
        description: `Reports generated for ${generatedCount} student${generatedCount !== 1 ? "s" : ""}. ${newSkippedStudents.length > 0 ? `${newSkippedStudents.length} student${newSkippedStudents.length !== 1 ? "s were" : " was"} skipped due to incomplete data.` : ""}`.trim(),
      });

      // Sequential execution: Promote first (if third term), then advance term
      try {
        if (isThirdTerm) {
          const skippedIds = new Set(newSkippedStudents.map((s) => s.studentId));
          await promoteStudentsToNextClass(skippedIds);
          toast({
            title: "Students Promoted",
            description: newSkippedStudents.length > 0
              ? `Validated students promoted. ${newSkippedStudents.length} skipped student${newSkippedStudents.length !== 1 ? "s were" : " was"} not promoted.`
              : "All students have been promoted to their next classes.",
          });
        }

        // Only advance term if promotion succeeded (or not needed)
        await advanceAcademicTerm.mutateAsync();
      } catch (promotionOrAdvanceError) {
        console.error(
          "Failed during promotion or term advancement:",
          promotionOrAdvanceError,
        );
        toast({
          title: "Process Failed",
          description: isThirdTerm
            ? "Student promotion failed. Term not advanced."
            : "Term advancement failed.",
          variant: "destructive",
        });
        throw promotionOrAdvanceError;
      }
    } catch (error) {
      console.error("Report generation process failed:", error);
      toast({
        title: "Process Failed",
        description:
          "Failed to complete report generation and term advancement.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReports(false);
    }
  };

  // Student promotion logic for third term — skippedIds are excluded from promotion
  const promoteStudentsToNextClass = async (skippedIds: Set<string> = new Set()) => {
    console.log("Starting student promotion process...");

    try {
      // SNAPSHOT: fetch all student lists BEFORE any DB writes to prevent cascade re-promotion
      const snapshot: Record<string, string[]> = {};
      for (const classId in schoolValidationResults) {
        if (schoolValidationResults[classId].validatedStudents > 0) {
          const classStudents = await apiRequest(`/api/admin/students/class/${classId}`);
          snapshot[classId] = classStudents
            .filter((s: any) => !skippedIds.has(s.id))
            .map((s: any) => s.id);
        }
      }

      // PROMOTE: iterate over snapshot only — no live DB reads inside the loop
      let totalPromoted = 0;
      let totalGraduated = 0;

      for (const classId in snapshot) {
        const studentIds = snapshot[classId];
        if (studentIds.length === 0) continue;

        const { nextClassId, isGraduation } = getNextClass(classId);

        if (isGraduation) {
          await apiRequest("/api/admin/promote-students", {
            method: "POST",
            body: { currentClassId: classId, nextClassId: "graduated", studentIds },
          });
          totalGraduated += studentIds.length;
          console.log(`Graduated ${studentIds.length} students from ${classId}`);
        } else if (nextClassId) {
          await apiRequest("/api/admin/promote-students", {
            method: "POST",
            body: { currentClassId: classId, nextClassId, studentIds },
          });
          totalPromoted += studentIds.length;
          console.log(`Promoted ${studentIds.length} students from ${classId} to ${nextClassId}`);
        }
      }

      if (totalPromoted > 0 || totalGraduated > 0) {
        const message = [];
        if (totalPromoted > 0) message.push(`${totalPromoted} students promoted`);
        if (totalGraduated > 0) message.push(`${totalGraduated} students graduated`);
        console.log(`Promotion complete: ${message.join(", ")}`);
      }
    } catch (error) {
      console.error("Error promoting students:", error);
      throw new Error("Failed to promote students to next classes");
    }
  };

  // Helper function to determine next class using admin-configured sortOrder
  const getNextClass = (currentClassId: string): { nextClassId: string | null; nextClassName: string | null; isGraduation: boolean } => {
    const current = classes.find((c: any) => c.id === currentClassId);
    if (!current) return { nextClassId: null, nextClassName: null, isGraduation: false };

    const sameSchoolClasses = [...classes]
      .filter((c: any) => c.schoolId === current.schoolId)
      .sort((a: any, b: any) => {
        const diff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        return diff !== 0 ? diff : (a.name || "").localeCompare(b.name || "");
      });

    const index = sameSchoolClasses.findIndex((c: any) => c.id === currentClassId);
    if (index === -1) return { nextClassId: null, nextClassName: null, isGraduation: false };

    const isGraduation = index === sameSchoolClasses.length - 1;
    if (isGraduation) return { nextClassId: null, nextClassName: "Graduated", isGraduation: true };

    const next = sameSchoolClasses[index + 1];
    return { nextClassId: next.id, nextClassName: next.name, isGraduation: false };
  };

  // Helper function to get promotion message for report cards
  const getPromotionMessage = (studentClassId: string): string => {
    const { nextClassName, isGraduation } = getNextClass(studentClassId);
    if (isGraduation) return "Congratulations! You have successfully graduated.";
    if (nextClassName) return `Promoted to ${nextClassName}`;
    return "Continue to next session";
  };

  // Term progression system
  const advanceAcademicTerm = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/advance-term", {
        method: "POST",
        body: activeSchoolId ? { schoolId: activeSchoolId } : {},
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Term Advanced Successfully",
        description: `School has been advanced to ${response.newTerm} ${response.newSession}`,
      });
      // Refresh current academic info for this school
      queryClient.invalidateQueries({
        queryKey: ["/api/current-academic-info", activeSchoolId],
      });
      // Also reset validation results since we're in a new term
      setSchoolValidationResults({});
      setValidationResults({});
      setIsAllStudentsValidated(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to advance academic term",
        variant: "destructive",
      });
    },
  });

  const handleAdvanceTerm = () => {
    advanceAcademicTerm.mutate();
  };

  // Handle individual validate & generate for a skipped student
  const handleIndividualValidateAndGenerate = async (skipped: SkippedStudent) => {
    setIndividualValidating((prev) => new Set(prev).add(skipped.studentId));
    try {
      const result = await apiRequest("/api/admin/validate-report-data-bulk", {
        method: "POST",
        body: {
          classId: skipped.classId,
          term: selectedTerm || academicInfo?.currentTerm,
          session: selectedSession || academicInfo?.currentSession,
        },
      });
      const studentResult: ValidationResult = result.results?.[skipped.studentId] || {
        hasAllScores: false,
        hasAttendance: false,
        missingSubjects: skipped.missingSubjects,
      };
      setIndividualValidationResults((prev) => ({
        ...prev,
        [skipped.studentId]: studentResult,
      }));
    } catch {
      toast({
        title: "Validation Error",
        description: `Failed to validate ${skipped.studentName}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIndividualValidating((prev) => {
        const next = new Set(prev);
        next.delete(skipped.studentId);
        return next;
      });
    }
  };

  const handleForceGenerateSkipped = async (skipped: SkippedStudent) => {
    try {
      const currentTerm = selectedTerm || academicInfo?.currentTerm;
      const currentSession = selectedSession || academicInfo?.currentSession;
      const resumptionDateStr = resumptionDate ? format(resumptionDate, "PPP") : undefined;

      await createReportMutation.mutateAsync({
        studentId: skipped.studentId,
        classId: skipped.classId,
        term: currentTerm,
        session: currentSession,
        studentName: skipped.studentName,
        className: skipped.className,
        totalScore: "0",
        averageScore: "0",
        attendancePercentage: "0",
        ...(resumptionDateStr ? { resumptionDate: resumptionDateStr } : {}),
      });

      // Remove from skipped list
      setSkippedStudents((prev) => prev.filter((s) => s.studentId !== skipped.studentId));
      setIndividuallyGenerated((prev) => new Set(prev).add(skipped.studentId));
      setIndividualValidationResults((prev) => {
        const next = { ...prev };
        delete next[skipped.studentId];
        return next;
      });
      setGenerationSummary((prev) => prev ? { ...prev, skipped: prev.skipped - 1, generated: prev.generated + 1 } : prev);

      toast({
        title: "Report Generated",
        description: `Report card generated for ${skipped.studentName}.`,
      });
    } catch {
      toast({
        title: "Generation Failed",
        description: `Could not generate report for ${skipped.studentName}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const getValidationStatus = (studentId: string) => {
    const validation = validationResults[studentId];
    if (!validation) return null;

    if (validation.hasAllScores) {
      return { status: "complete", color: "bg-green-500", text: "Complete" };
    } else if (validation.missingSubjects && validation.missingSubjects.length > 0) {
      return { status: "partial", color: "bg-yellow-500", text: "Partial" };
    } else {
      return { status: "incomplete", color: "bg-red-500", text: "Incomplete" };
    }
  };

  const canGenerateReport = (studentId: string) => {
    const validation = validationResults[studentId];
    return validation && validation.hasAllScores;
  };

  const handleViewReportCard = async (
    report: GeneratedReportCard,
    resumptionDate?: string,
  ) => {
    try {
      // Fetch the student data first
      const allStudents = await apiRequest("/api/admin/students");
      const student = allStudents.find((s: any) => s.id === report.studentId);

      if (!student) {
        throw new Error("Student not found");
      }

      // Fetch subjects first
      const subjects = await apiRequest(
        `/api/admin/classes/${report.classId}/subjects`,
      );

      // Fetch assessments for each subject for this student
      const assessmentPromises = subjects.map((subject: any) =>
        apiRequest(
          `/api/admin/assessments?classId=${report.classId}&subjectId=${subject.id}&term=${encodeURIComponent(report.term)}&session=${encodeURIComponent(report.session)}`,
        ),
      );

      const [assessmentArrays, attendance, behavioralRatings] = await Promise.all([
        Promise.all(assessmentPromises),
        apiRequest(
          `/api/admin/attendance/class/${report.classId}?term=${encodeURIComponent(report.term)}&session=${encodeURIComponent(report.session)}`,
        ),
        apiRequest(
          `/api/admin/non-academic-ratings/${report.classId}/${encodeURIComponent(report.term)}/${encodeURIComponent(report.session)}`,
        ).catch(() => []) // Return empty array if no ratings found
      ]);

      // Flatten assessments and filter for this student
      const allAssessments = assessmentArrays.flat();
      const assessments = allAssessments.filter(
        (a: any) => a.studentId === report.studentId,
      );

      // Filter subjects to only show those with scores (total > 0)
      const subjectsWithScores = subjects.filter((subject: any) => {
        const assessment = assessments.find(
          (a: any) => a.studentId === student.id && a.subjectId === subject.id,
        );
        const total = (assessment?.firstCA || 0) + (assessment?.secondCA || 0) + (assessment?.exam || 0);
        return total > 0;
      });

      // Get class name to check if it's SSS class
      const className = classes.find((c) => c.id === report.classId)?.name || "";
      // Match SSS classes: "S.S.S 1", "S.S.S 2", "S.S.S 3" or "SSS1", "SSS2", "SSS3"
      const isSSSClass = /S\.?S\.?S\.?\s*[123]/i.test(className);
      
      // Validate minimum 8 subjects for SSS classes
      if (isSSSClass && subjectsWithScores.length < 8) {
        toast({
          title: "Insufficient Subjects",
          description: `${className} requires at least 8 subjects with scores. Currently has ${subjectsWithScores.length} subjects.`,
          variant: "destructive",
        });
        return;
      }

      // Calculate totals using only subjects with scores
      const totalMarks = subjectsWithScores.reduce((sum: number, subject: any) => {
        const assessment = assessments.find(
          (a: any) => a.studentId === student.id && a.subjectId === subject.id,
        );
        return (
          sum +
          ((assessment?.firstCA || 0) +
            (assessment?.secondCA || 0) +
            (assessment?.exam || 0))
        );
      }, 0);

      const studentAttendance = attendance.find(
        (att: any) => att.studentId === student.id,
      );
      const attendanceRecorded = studentAttendance && studentAttendance.totalDays > 0;
      const attendanceDays = attendanceRecorded
        ? `${studentAttendance.presentDays} / ${studentAttendance.totalDays} days`
        : null;

      // Get behavioral rating for this student, or use default rating of 3 (Good)
      const existingRating = behavioralRatings.find(
        (rating: any) => rating.studentId === student.id
      );
      
      const studentBehavioralRating = existingRating || {
        attendancePunctuality: 3,
        neatnessOrganization: 3,
        respectPoliteness: 3,
        participationTeamwork: 3,
        responsibility: 3
      };

      // Helper function to convert numeric rating to text
      const getRatingText = (rating: number | null | undefined): string => {
        if (!rating) return 'Not Rated';
        if (rating === 5) return 'Excellent';
        if (rating === 4) return 'Very Good';
        if (rating === 3) return 'Good';
        if (rating === 2) return 'Fair';
        if (rating === 1) return 'Poor';
        return 'Not Rated';
      };

      // Helper function to get principal's comment based on average percentage
      const getPrincipalComment = (averagePercentage: number): string => {
        if (averagePercentage >= 90) {
          return "Outstanding performance! You have demonstrated excellent understanding and consistency. Keep up this remarkable standard.";
        } else if (averagePercentage >= 80) {
          return "A very good result! You are focused and hardworking. Maintain this level of commitment for even greater success.";
        } else if (averagePercentage >= 75) {
          return "Good work! You show clear understanding of your subjects. With a bit more effort, you can reach the top.";
        } else if (averagePercentage >= 70) {
          return "A fairly good performance. You are doing well, but there is still room for improvement. Aim higher next term.";
        } else if (averagePercentage >= 65) {
          return "You have tried, but you can do much better. Put in more effort and stay focused on your studies.";
        } else if (averagePercentage >= 60) {
          return "A fair attempt, but there is a need for greater dedication. Work harder to improve your overall performance.";
        } else if (averagePercentage >= 50) {
          return "You passed, but this performance is not satisfactory. More seriousness and consistent study habits are required.";
        } else if (averagePercentage >= 45) {
          return "You barely passed. Try to be more attentive in class and spend more time revising your work.";
        } else if (averagePercentage >= 40) {
          return "A poor result. You need to put in significant effort and seek help from teachers to strengthen weak areas.";
        } else {
          return "Very poor performance. You must work very hard and take your studies seriously. Consistent supervision is advised.";
        }
      };

      // Helper function to get behavioral interpretation
      const getBehavioralInterpretation = (behavioralRating: any): { averageRating: number; interpretation: string } => {
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

      // Calculate average percentage
      const averagePercentage = subjects.length ? ((totalMarks / (subjects.length * 100)) * 100) : 0;

      // Get behavioral interpretation (only if behavioral data exists)
      const behavioralInterpretation = studentBehavioralRating ? getBehavioralInterpretation(studentBehavioralRating) : null;

      // Get principal's comment based on average
      const principalComment = getPrincipalComment(averagePercentage);

      // Fetch school data to get principal signature
      const schools = await apiRequest("/api/admin/schools");
      const studentSchool = schools.find((s: any) => s.id === student.user.schoolId);
      const principalSignature = studentSchool?.principalSignature || '';

      // Generate the detailed report card
      const reportWindow = window.open("", "_blank");
      if (!reportWindow) return;

      const reportHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Report Card - ${student.user.firstName} ${student.user.lastName}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A4 portrait; margin: 12mm; }
              body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e8eeff; color: #1e3a8a; line-height: 1.4; }
              .report-card { width: 100%; max-width: 760px; margin: 20px auto; background: #fdfbf7; box-shadow: 0 4px 20px rgba(30,58,138,0.15); border: 1px solid #c7d2fe; }

              .header { background: linear-gradient(to right, #1e3a8a, #1d4ed8, #1e3a8a); padding: 28px 28px 22px 28px; display: flex; align-items: center; gap: 20px; border-bottom: 4px solid #d4af37; color: white; }
              .header-logo { width: 80px; height: 80px; border-radius: 50%; border: 3px solid #d4af37; background: white; object-fit: cover; flex-shrink: 0; }
              .header-text { flex: 1; text-align: center; }
              .school-name { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; letter-spacing: 1px; margin-bottom: 3px; }
              .school-levels { font-size: 9px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #d4af37; margin-bottom: 3px; }
              .school-location { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #bfdbfe; margin-bottom: 4px; }
              .school-motto { font-family: 'Playfair Display', serif; font-style: italic; color: #d4af37; font-size: 11px; margin-bottom: 10px; }
              .report-title-wrap { display: inline-block; border-top: 1px solid #d4af37; border-bottom: 1px solid #d4af37; padding: 5px 24px; }
              .report-title { font-family: 'Playfair Display', serif; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }

              .student-info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; padding: 16px 24px; background: #f0f4ff; border-bottom: 2px solid #d4af37; }
              .info-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e3a8a; display: block; margin-bottom: 2px; }
              .info-value { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 12px; font-weight: 600; color: #0f172a; font-variant-numeric: tabular-nums; }
              .info-name { font-family: 'Playfair Display', serif; font-size: 12px; font-weight: 600; color: #0f172a; }

              .body { padding: 20px 24px; }
              .section-heading { font-family: 'Playfair Display', serif; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-bottom: 12px; }

              .subjects-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
              .subjects-table th { background: linear-gradient(to right, #1e3a8a, #1d4ed8, #1e3a8a); color: white; padding: 8px 6px; text-align: center; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e3a8a; }
              .subjects-table th.subject-col { text-align: left; }
              .subjects-table td { padding: 7px 6px; text-align: center; border: 1px solid #1e3a8a; font-size: 9px; font-variant-numeric: tabular-nums; }
              .subjects-table td.subject-col { text-align: left; font-weight: 600; color: #0f172a; font-variant-numeric: normal; }
              .subjects-table tr:nth-child(even) td { background: #f0f4ff; }
              .subjects-table tr:nth-child(odd) td { background: #ffffff; }
              .subjects-table td.total-col { font-weight: 700; background: #e8eeff !important; }
              .subjects-table td.grade-col { font-weight: 700; color: #1e3a8a; }

              .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
              .panel { background: #f0f4ff; border: 1px solid #c7d2fe; padding: 12px; }
              .panel-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(212,175,55,0.2); font-size: 10px; }
              .panel-row:last-child { border-bottom: none; }
              .panel-val { font-weight: 700; color: #1e3a8a; font-variant-numeric: tabular-nums; }

              .behavioral-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
              .behavioral-item { display: flex; justify-content: space-between; font-size: 9px; padding: 4px 0; border-bottom: 1px solid rgba(212,175,55,0.15); }
              .behavioral-val { font-weight: 700; }

              .comment-section { border-left: 4px solid #1e3a8a; padding: 10px 14px; margin-bottom: 16px; background: #f8faff; }
              .comment-label { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 11px; color: #1e3a8a; margin-bottom: 5px; }
              .comment-text { font-size: 9px; font-style: italic; line-height: 1.6; color: #1e3a8a; }

              .promotion-section { background: linear-gradient(to right, #1e3a8a, #1d4ed8, #1e3a8a); color: white; text-align: center; padding: 12px; border: 2px solid #d4af37; margin-bottom: 20px; }
              .promotion-label { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 4px; }
              .promotion-text { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; letter-spacing: 1px; }

              .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: end; margin-bottom: 20px; }
              .grade-key { background: #f0f4ff; border: 1px solid #c7d2fe; padding: 10px 12px; }
              .grade-key-title { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e3a8a; border-bottom: 1px solid rgba(212,175,55,0.4); padding-bottom: 4px; margin-bottom: 6px; }
              .grade-key-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-size: 8px; font-weight: 600; color: #1e3a8a; }
              .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: center; }
              .sig-line { border-bottom: 1px solid #1e3a8a; height: 36px; margin-bottom: 4px; }
              .sig-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e3a8a; }

              .print-button { display: inline-block; padding: 11px 28px; background: #1e3a8a; color: white; border: none; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; margin: 8px; }

              @media print {
                * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
                body { background: white !important; margin: 0 !important; }
                .report-card { margin: 0 !important; box-shadow: none !important; border: none !important; max-width: 100% !important; }
                .print-button { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="report-card">

              <div class="header">
                <img src="/assets/academy-logo.png" alt="School Logo" class="header-logo" />
                <div class="header-text">
                  <div class="school-name">SEAT OF WISDOM ACADEMY</div>
                  <div class="school-levels">Pre-Nursery, Nursery, Primary &amp; Secondary</div>
                  <div class="school-location">Asaba, Delta State</div>
                  <div class="school-motto">"The Fear of the Lord is the Beginning of Wisdom"</div>
                  <div class="report-title-wrap">
                    <div class="report-title">${report.term} Assessment Report &mdash; ${report.session} Session</div>
                  </div>
                </div>
              </div>

              <div class="student-info">
                <div><span class="info-label">Student Name</span><span class="info-name">${student.user.firstName} ${student.user.middleName ? student.user.middleName + ' ' : ''}${student.user.lastName}</span></div>
                <div><span class="info-label">Student ID</span><span class="info-value">${student.studentId}</span></div>
                <div><span class="info-label">Class</span><span class="info-value">${report.className}</span></div>
                <div><span class="info-label">Gender</span><span class="info-value">${student.gender || 'N/A'}</span></div>
                <div><span class="info-label">Age</span><span class="info-value">${
                  student.dateOfBirth
                    ? (() => {
                        const birthDate = new Date(student.dateOfBirth);
                        const today = new Date();
                        if (isNaN(birthDate.getTime()) || birthDate > today) return "N/A";
                        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) calculatedAge--;
                        if (calculatedAge < 0 || calculatedAge > 150) return "N/A";
                        return calculatedAge + ' yrs';
                      })()
                    : "N/A"
                }</span></div>
                <div><span class="info-label">Next Term Begins</span><span class="info-value">${resumptionDate ? new Date(resumptionDate).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBA'}</span></div>
              </div>

              <div class="body">

                <div class="section-heading">Academic Performance</div>
                <table class="subjects-table">
                  <thead>
                    <tr>
                      <th class="subject-col">Subject</th>
                      <th>1st CA<br><span style="font-size:7px;font-weight:400;opacity:0.85">(20)</span></th>
                      <th>2nd CA<br><span style="font-size:7px;font-weight:400;opacity:0.85">(20)</span></th>
                      <th>Exam<br><span style="font-size:7px;font-weight:400;opacity:0.85">(60)</span></th>
                      <th style="background:#1d4ed8;">Total<br><span style="font-size:7px;font-weight:400;opacity:0.85">(100)</span></th>
                      <th>Grade</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${subjectsWithScores.map((subject: any) => {
                      const assessment = assessments.find((a: any) => a.studentId === student.id && a.subjectId === subject.id);
                      const firstCA = assessment?.firstCA || 0;
                      const secondCA = assessment?.secondCA || 0;
                      const exam = assessment?.exam || 0;
                      const total = firstCA + secondCA + exam;
                      const { grade, remark } = calculateGrade(total);
                      return `<tr>
                        <td class="subject-col">${subject.name}</td>
                        <td>${firstCA}</td>
                        <td>${secondCA}</td>
                        <td>${exam}</td>
                        <td class="total-col">${total}</td>
                        <td class="grade-col">${grade}</td>
                        <td style="font-style:italic;">${remark}</td>
                      </tr>`;
                    }).join("")}
                  </tbody>
                </table>

                <div class="two-col">
                  <div>
                    <div class="section-heading">Summary</div>
                    <div class="panel">
                      <div class="panel-row"><span>Total Score</span><span class="panel-val">${totalMarks} / ${subjectsWithScores.length * 100}</span></div>
                      <div class="panel-row" style="border-bottom:none;"><span>Average</span><span class="panel-val">${subjectsWithScores.length ? ((totalMarks / (subjectsWithScores.length * 100)) * 100).toFixed(1) : "0"}%</span></div>
                    </div>
                    ${attendanceRecorded ? `
                    <div class="section-heading" style="margin-top:14px;">Attendance</div>
                    <table style="width:100%;border-collapse:collapse;font-size:9px;">
                      <tr>
                        <td style="padding:6px 8px;border:1px solid #1e3a8a;background:#f0f4ff;font-weight:600;">Days School Opened</td>
                        <td style="padding:6px 8px;border:1px solid #1e3a8a;background:#ffffff;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;">${studentAttendance.totalDays}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 8px;border:1px solid #1e3a8a;background:#f0f4ff;font-weight:600;">Days Present</td>
                        <td style="padding:6px 8px;border:1px solid #1e3a8a;background:#e8eeff;text-align:center;font-weight:700;color:#1e3a8a;font-variant-numeric:tabular-nums;">${studentAttendance.presentDays}</td>
                      </tr>
                    </table>
                    ` : ''}
                  </div>
                  <div>
                    <div class="section-heading">Behavioral Assessment</div>
                    <div class="panel">
                      ${studentBehavioralRating ? `
                      <div class="behavioral-grid">
                        <div class="behavioral-item"><span>Attendance</span><span class="behavioral-val">${getRatingText(studentBehavioralRating.attendancePunctuality)}</span></div>
                        <div class="behavioral-item"><span>Punctuality</span><span class="behavioral-val">${getRatingText(studentBehavioralRating.attendancePunctuality)}</span></div>
                        <div class="behavioral-item"><span>Neatness</span><span class="behavioral-val">${getRatingText(studentBehavioralRating.neatnessOrganization)}</span></div>
                        <div class="behavioral-item"><span>Respect</span><span class="behavioral-val">${getRatingText(studentBehavioralRating.respectPoliteness)}</span></div>
                        <div class="behavioral-item"><span>Participation</span><span class="behavioral-val">${getRatingText(studentBehavioralRating.participationTeamwork)}</span></div>
                        <div class="behavioral-item"><span>Responsibility</span><span class="behavioral-val">${getRatingText(studentBehavioralRating.responsibility)}</span></div>
                      </div>
                      ${behavioralInterpretation ? `<div style="text-align:center;margin-top:6px;font-size:9px;font-weight:700;color:#1e3a8a;">${behavioralInterpretation.interpretation}</div>` : ''}
                      ` : '<div style="font-size:9px;color:#64748b;font-style:italic;">No behavioral data recorded.</div>'}
                    </div>
                  </div>
                </div>

                <div class="comment-section">
                  <div class="comment-label">Principal's Comment</div>
                  <p class="comment-text">${principalComment}</p>
                </div>

                ${report.term === 'Third Term' ? `
                <div class="promotion-section">
                  <div class="promotion-label">Final Decision</div>
                  <div class="promotion-text">${getPromotionMessage(student.classId)}</div>
                </div>
                ` : ''}

                <div class="bottom-grid">
                  <div class="grade-key">
                    <div class="grade-key-title">Grading Key (WAEC Standard)</div>
                    <div class="grade-key-grid">
                      <div><strong>A1</strong>: 75-100 Excellent</div>
                      <div><strong>C6</strong>: 50-54 Credit</div>
                      <div><strong>B2</strong>: 70-74 Very Good</div>
                      <div><strong>D7</strong>: 45-49 Pass</div>
                      <div><strong>B3</strong>: 65-69 Good</div>
                      <div><strong>E8</strong>: 40-44 Pass</div>
                      <div><strong>C4</strong>: 60-64 Credit</div>
                      <div><strong>F9</strong>: 0-39 Fail</div>
                      <div><strong>C5</strong>: 55-59 Credit</div>
                    </div>
                  </div>
                  <div class="sig-section">
                    <div style="text-align:center;">
                      ${principalSignature ? `<div style="height:36px;margin-bottom:4px;display:flex;align-items:flex-end;justify-content:center;"><img src="${principalSignature}" alt="Principal Signature" style="max-height:36px;max-width:150px;" crossorigin="anonymous" /></div>` : `<div class="sig-line"></div>`}
                      <div class="sig-label">Principal</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div style="text-align:center;margin:8px 0 20px;">
              <button class="print-button" onclick="window.print()">Print Report Card</button>
            </div>
          </body>
        </html>
      `;

      reportWindow.document.write(reportHTML);
      reportWindow.document.close();
      
    } catch (error) {
      console.error("Error loading report card data:", error);
      toast({
        title: "Error",
        description: "Failed to load report card data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateReportCard = (student: any) => {
    // This would trigger the existing report card generation logic
    // For now, we'll create a record that the report was generated
    const validation = validationResults[student.id];
    if (!validation || !canGenerateReport(student.id)) {
      toast({
        title: "Cannot Generate Report",
        description:
          "Student data is incomplete. Please ensure all scores and attendance are recorded.",
        variant: "destructive",
      });
      return;
    }

    // Create report card record
    createReportMutation.mutate({
      studentId: student.id,
      classId: selectedClass,
      term: selectedTerm,
      session: selectedSession,
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      className: classes.find((c) => c.id === selectedClass)?.name || "",
      totalScore: "0", // This would be calculated from actual scores
      averageScore: "0", // This would be calculated from actual scores
      attendancePercentage: "0", // This would be calculated from attendance data
    });
  };

  // Batch generation function
  const handleBatchGenerateReports = async (readyStudents: any[]) => {
    if (!batchResumptionDate) {
      toast({
        title: "Missing Information",
        description: "Please select a next term resumption date",
        variant: "destructive",
      });
      return;
    }

    setIsBatchGenerating(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const student of readyStudents) {
        try {
          // Create report card record for each student
          await createReportMutation.mutateAsync({
            studentId: student.id,
            classId: selectedClass,
            term: selectedTerm,
            session: selectedSession,
            studentName: `${student.user.firstName} ${student.user.lastName}`,
            className: classes.find((c) => c.id === selectedClass)?.name || "",
            totalScore: "0", // This would be calculated from actual scores
            averageScore: "0", // This would be calculated from actual scores
            attendancePercentage: "0", // This would be calculated from attendance data
          });

          // Generate and print individual report card
          await handleViewReportCard(
            {
              id: student.id,
              studentId: student.id,
              classId: selectedClass,
              term: selectedTerm,
              session: selectedSession,
              studentName: `${student.user.firstName} ${student.user.lastName}`,
              className:
                classes.find((c) => c.id === selectedClass)?.name || "",
              totalScore: "0",
              averageScore: "0",
              attendancePercentage: "0",
              generatedAt: new Date().toISOString(),
              generatedBy: user?.firstName + " " + user?.lastName || "Admin",
            },
            batchResumptionDate,
          );

          successCount++;
        } catch (error) {
          console.error(
            `Failed to generate report for ${student.user.firstName} ${student.user.lastName}:`,
            error,
          );
          failureCount++;
        }
      }

      toast({
        title: "Batch Generation Complete",
        description: `Successfully generated ${successCount} reports${failureCount > 0 ? `, ${failureCount} failed` : ""}`,
        variant: successCount > 0 ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Batch generation error:", error);
      toast({
        title: "Batch Generation Failed",
        description: "An error occurred during batch generation",
        variant: "destructive",
      });
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Build unique term/session combos from generated reports for the filter
  const reportTermSessions = Array.from(
    new Set(generatedReports.map((r) => `${r.term}|${r.session}`))
  ).sort();

  // Build unique classes from generated reports for the filter
  const reportClasses = Array.from(
    new Set(generatedReports.map((r) => r.classId))
  ).map((cid) => {
    const found = generatedReports.find((r) => r.classId === cid);
    return { classId: cid, className: found?.className || cid };
  });

  // Apply filters ("__all__" is the sentinel for "no filter")
  const filteredReports = generatedReports.filter((report) => {
    const matchSearch =
      !filterSearch ||
      report.studentName.toLowerCase().includes(filterSearch.toLowerCase());
    const matchClass = !filterClass || filterClass === "__all__" || report.classId === filterClass;
    const matchTermSession =
      !filterTermSession || filterTermSession === "__all__" ||
      `${report.term}|${report.session}` === filterTermSession;
    return matchSearch && matchClass && matchTermSession;
  });

  // Counts for headers
  const readyCount = students.filter((s: any) => {
    const v = validationResults[s.id];
    return v && v.hasAllScores;
  }).length;
  const incompleteCount = Object.keys(validationResults).length > 0
    ? Object.keys(validationResults).length - readyCount
    : 0;

  // Filtered students list based on status filter
  const filteredStudents = students.filter((s: any) => {
    if (studentStatusFilter === "all") return true;
    const v = validationResults[s.id];
    const isReady = v && v.hasAllScores;
    if (studentStatusFilter === "ready") return isReady;
    if (studentStatusFilter === "incomplete") return !isReady;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Date Selection Dialog — lives outside tabs so it can open from either tab */}
      <Dialog open={showResumptionDateDialog} onOpenChange={setShowResumptionDateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Next Term Resumption Date</DialogTitle>
            <DialogDescription>
              Choose the date when the next term will resume. This will be
              included in the report cards.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${!resumptionDate && "text-muted-foreground"}`}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {resumptionDate ? format(resumptionDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <DatePicker
                  mode="single"
                  selected={resumptionDate}
                  onSelect={setResumptionDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowResumptionDateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateAllReports}
              disabled={!resumptionDate}
              className="bg-green-600 hover:bg-green-700"
            >
              Generate Reports &amp; Advance Term
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="validate" className="flex-1 sm:flex-none text-xs sm:text-sm">
            Validate &amp; Generate
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex-1 sm:flex-none text-xs sm:text-sm">
            Generated Reports
            {generatedReports.length > 0 && (
              <Badge className="ml-1.5 text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-0">
                {generatedReports.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Validate & Generate ── */}
        <TabsContent value="validate" className="space-y-4 mt-4">
          {/* Report Generation Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="w-5 h-5 text-primary" />
                Report Card Management
              </CardTitle>
              <CardDescription className="text-xs">
                Select context → Validate → Generate report cards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
          {/* Step 1: Context selectors */}
          {/* School selector — shown for main admin only */}
          {user?.role === 'admin' && schools.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">School</Label>
              <Select
                value={activeSchoolId || "__all__"}
                onValueChange={(v) => {
                  setActiveSchoolId(v === "__all__" ? "" : v);
                  setSelectedClass("");
                  setValidationResults({});
                  setSchoolValidationResults({});
                  setIsAllStudentsValidated(false);
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select school" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Schools</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {(activeSchoolId
                    ? classes.filter((c) => c.schoolId === activeSchoolId || c.school?.id === activeSchoolId)
                    : classes
                  ).map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Term & Session</Label>
              <Select
                value={`${selectedTerm}|${selectedSession}`}
                onValueChange={(value) => {
                  const [term, session] = value.split("|");
                  setSelectedTerm(term);
                  setSelectedSession(session);
                }}
              >
                <SelectTrigger className="h-9 text-sm" data-testid="select-reports-session">
                  <SelectValue placeholder="Select term and session" />
                </SelectTrigger>
                <SelectContent>
                  {academicTerms.map((term) => {
                    const session = academicSessions.find(
                      (s) => s.id === term.sessionId
                    );
                    if (!session) return null;
                    return (
                      <SelectItem
                        key={term.id}
                        value={`${term.termName}|${session.sessionYear}`}
                      >
                        {term.termName}, {session.sessionYear}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Step 2 & 3: Actions */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleValidateAll}
                disabled={!selectedClass || !selectedTerm || !selectedSession || isValidating}
                variant="outline"
                size="sm"
                className="h-8 text-xs"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                {isValidating ? "Validating…" : "Validate Class"}
              </Button>

              <Button
                onClick={handleValidateEntireSchool}
                disabled={isValidating}
                variant="outline"
                size="sm"
                className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                data-testid="button-validate-entire-school"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                {isValidating ? "Validating…" : "Validate Entire School"}
              </Button>

              <Button
                onClick={() => setShowResumptionDateDialog(true)}
                disabled={
                  Object.keys(schoolValidationResults).length === 0 ||
                  !Object.values(validationResults).some((v) => v.hasAllScores) ||
                  isGeneratingReports
                }
                size="sm"
                className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                data-testid="button-generate-all-reports"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                {isGeneratingReports ? "Generating…" : "Generate All Report Cards"}
              </Button>
            </div>

            {isAllStudentsValidated && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2.5 py-1.5">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                All students validated — ready to generate report cards.
              </div>
            )}
            {!isAllStudentsValidated && Object.keys(schoolValidationResults).length > 0 && Object.values(validationResults).some((v) => v.hasAllScores) && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Some students have incomplete data. Fully-validated students will be generated; incomplete ones will be listed for individual handling.
              </div>
            )}
          </div>
            </CardContent>
          </Card>

          {/* School-wide Validation Results */}
          {Object.keys(schoolValidationResults).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">School Validation Results</CardTitle>
                <CardDescription className="text-xs">Validation status across all classes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(schoolValidationResults).map(([classId, result]) => {
                    const isComplete = result.validatedStudents === result.totalStudents;
                    return (
                      <div key={classId} className={`rounded-lg border p-3 ${isComplete ? 'border-green-200 bg-green-50/50' : 'border-border'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{result.className}</p>
                            <Badge className={`text-[10px] px-1.5 py-0 ${isComplete ? 'bg-green-500' : result.validatedStudents > 0 ? 'bg-yellow-500' : 'bg-red-500'} text-white`}>
                              {isComplete ? "Complete" : result.validatedStudents > 0 ? "Partial" : "Incomplete"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{result.validatedStudents}/{result.totalStudents}</span>
                        </div>
                        {result.issues.length > 0 && (
                          <div className="space-y-0.5 mt-1.5">
                            {result.issues.slice(0, 3).map((issue, i) => (
                              <p key={i} className="text-[11px] text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />{issue}
                              </p>
                            ))}
                            {result.issues.length > 3 && (
                              <p className="text-[11px] text-muted-foreground pl-4">+{result.issues.length - 3} more issues</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generation Summary Banner */}
          {generationSummary && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${generationSummary.skipped === 0 ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Reports generated for <strong>{generationSummary.generated}</strong> student{generationSummary.generated !== 1 ? "s" : ""}.
                {generationSummary.skipped > 0 && (
                  <> <strong>{generationSummary.skipped}</strong> student{generationSummary.skipped !== 1 ? "s were" : " was"} skipped due to incomplete data.</>
                )}
              </span>
            </div>
          )}

          {/* Skipped Students Panel */}
          {skippedStudents.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <button
                  onClick={() => setSkippedPanelOpen((o) => !o)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-amber-600" />
                    <CardTitle className="text-sm font-semibold text-amber-800">
                      Skipped Students ({skippedStudents.length})
                    </CardTitle>
                  </div>
                  {skippedPanelOpen ? (
                    <ChevronDown className="w-4 h-4 text-amber-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-amber-600" />
                  )}
                </button>
                <CardDescription className="text-xs mt-1">
                  These students had incomplete data and were skipped during bulk generation. Validate and generate their reports individually below.
                </CardDescription>
              </CardHeader>
              {skippedPanelOpen && (
                <CardContent>
                  {(() => {
                    const byClass: Record<string, SkippedStudent[]> = {};
                    skippedStudents.forEach((s) => {
                      if (!byClass[s.classId]) byClass[s.classId] = [];
                      byClass[s.classId].push(s);
                    });
                    return Object.entries(byClass).map(([classId, skippedGroup]) => (
                      <div key={classId} className="mb-4 last:mb-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          {skippedGroup[0].className}
                        </p>
                        <div className="divide-y divide-border rounded-lg border overflow-hidden">
                          {skippedGroup.map((skipped) => {
                            const indivResult = individualValidationResults[skipped.studentId];
                            const isSkippedValidating = individualValidating.has(skipped.studentId);
                            const isGenerating = createReportMutation.isPending;
                            return (
                              <div key={skipped.studentId} className="px-3 py-2.5 bg-background">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{skipped.studentName}</p>
                                    {!indivResult && (
                                      <div className="flex flex-wrap gap-x-3 mt-0.5">
                                        {skipped.missingSubjects.length > 0 && (
                                          <span className="text-[11px] text-red-600">
                                            Missing scores: {skipped.missingSubjects.slice(0, 3).join(", ")}{skipped.missingSubjects.length > 3 ? ` +${skipped.missingSubjects.length - 3}` : ""}
                                          </span>
                                        )}
                                        {!skipped.hasAttendance && (
                                          <span className="text-[11px] text-orange-600">No attendance</span>
                                        )}
                                      </div>
                                    )}
                                    {indivResult && (
                                      <div className="mt-1.5 rounded border border-border bg-muted/40 p-2 space-y-1">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Validation Result</p>
                                        {indivResult.hasAllScores ? (
                                          <p className="text-[11px] text-green-700 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> All data complete — ready to generate.
                                          </p>
                                        ) : (
                                          <>
                                            {!indivResult.hasAllScores && indivResult.missingSubjects.length > 0 && (
                                              <p className="text-[11px] text-red-600 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                                Missing scores: {indivResult.missingSubjects.join(", ")}
                                              </p>
                                            )}
                                            {!indivResult.hasAllScores && indivResult.missingSubjects.length === 0 && (
                                              <p className="text-[11px] text-red-600 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                                Missing scores
                                              </p>
                                            )}
                                            {!indivResult.hasAttendance && (
                                              <p className="text-[11px] text-orange-600 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                                No attendance recorded
                                              </p>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleIndividualValidateAndGenerate(skipped)}
                                      disabled={isSkippedValidating || isGenerating}
                                      className="h-7 px-2 text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
                                    >
                                      {isSkippedValidating ? (
                                        <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Validating…</>
                                      ) : (
                                        <><CheckCircle className="w-3 h-3 mr-1" />Validate &amp; Generate</>
                                      )}
                                    </Button>
                                    {indivResult && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleForceGenerateSkipped(skipped)}
                                        disabled={isGenerating}
                                        className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                                      >
                                        {isGenerating ? (
                                          <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Generating…</>
                                        ) : (
                                          <><Download className="w-3 h-3 mr-1" />Generate Report Anyway</>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </CardContent>
              )}
            </Card>
          )}

          {/* Per-student Validation Results */}
          {selectedClass && selectedTerm && selectedSession && Object.keys(validationResults).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      Students
                      {Object.keys(validationResults).length > 0 && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          — <span className="text-green-700 font-medium">{readyCount} Ready</span>
                          {incompleteCount > 0 && (
                            <> · <span className="text-red-600 font-medium">{incompleteCount} Incomplete</span></>
                          )}
                        </span>
                      )}
                    </CardTitle>
                  </div>
                  {/* Status filter */}
                  <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
                    {(["all", "ready", "incomplete"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setStudentStatusFilter(f)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors capitalize ${
                          studentStatusFilter === f
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f === "all" ? `All (${students.length})` : f === "ready" ? `Ready (${readyCount})` : `Incomplete (${incompleteCount})`}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No students match this filter.</p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border overflow-hidden">
                    {filteredStudents.map((student: any) => {
                      const status = getValidationStatus(student.id);
                      const validation = validationResults[student.id];
                      const isReady = validation?.hasAllScores;
                      return (
                        <div key={student.id} className={`flex items-center justify-between px-3 py-2 gap-3 ${isReady ? 'bg-background' : 'bg-red-50/30 dark:bg-red-900/10'}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{student.user.firstName} {student.user.lastName}</p>
                              {status && (
                                <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${status.color} text-white`}>{status.text}</Badge>
                              )}
                            </div>
                            {validation && !isReady && (
                              <div className="flex flex-wrap gap-x-3 mt-0.5">
                                {!validation.hasAllScores && validation.missingSubjects.length > 0 && (
                                  <span className="text-[11px] text-red-600">Missing: {validation.missingSubjects.slice(0,2).join(", ")}{validation.missingSubjects.length > 2 ? ` +${validation.missingSubjects.length-2}` : ""}</span>
                                )}
                                {!validation.hasAllScores && validation.missingSubjects.length === 0 && (
                                  <span className="text-[11px] text-red-600">Missing scores</span>
                                )}
                                {!validation.hasAttendance && (
                                  <span className="text-[11px] text-orange-600">No attendance</span>
                                )}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={isReady ? "default" : "outline"}
                            disabled={!canGenerateReport(student.id) || generatingReports.has(student.id)}
                            onClick={() => handleGenerateReportCard(student)}
                            className="h-7 px-2 text-xs shrink-0"
                          >
                            {generatingReports.has(student.id) ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <><Download className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Generate</span></>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 2: Generated Reports ── */}
        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Eye className="w-4 h-4 text-primary" />
                    Generated Report Cards
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {filteredReports.length} of {generatedReports.length} reports
                  </CardDescription>
                </div>
                {generatedReports.length > 0 && activeSchoolId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 shrink-0"
                    onClick={() => {
                      setClearScope("class");
                      setClearClassId(selectedClass || (reportClasses[0]?.classId ?? ""));
                      setClearTerm("__all__");
                      setClearSession("__all__");
                      setIsClearDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Clear Reports
                  </Button>
                )}
              </div>
            </CardHeader>

            {/* Clear Reports Dialog */}
            <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <Trash2 className="w-4 h-4" />
                    Clear Report Cards
                  </DialogTitle>
                  <DialogDescription>
                    Remove generated report cards so students can no longer view them. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {/* Scope */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Scope</Label>
                    <Select value={clearScope} onValueChange={(v) => setClearScope(v as "class" | "all")}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="class">Selected class only</SelectItem>
                        <SelectItem value="all">All classes in this school</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Class selector — only shown when scope = class */}
                  {clearScope === "class" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Class</Label>
                      <Select value={clearClassId} onValueChange={setClearClassId}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select a class" />
                        </SelectTrigger>
                        <SelectContent>
                          {reportClasses.map((c) => (
                            <SelectItem key={c.classId} value={c.classId}>{c.className}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Term */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Term</Label>
                    <Select value={clearTerm} onValueChange={setClearTerm}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All terms</SelectItem>
                        {Array.from(new Set(generatedReports.map((r) => r.term))).sort().map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Session */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Session</Label>
                    <Select value={clearSession} onValueChange={setClearSession}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All sessions</SelectItem>
                        {Array.from(new Set(generatedReports.map((r) => r.session))).sort().map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Summary */}
                  <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                    {(() => {
                      const scopeLabel = clearScope === "all"
                        ? "all classes"
                        : (reportClasses.find((c) => c.classId === clearClassId)?.className || "selected class");
                      const termLabel = clearTerm === "__all__" ? "all terms" : clearTerm;
                      const sessionLabel = clearSession === "__all__" ? "all sessions" : clearSession;
                      const matchCount = generatedReports.filter((r) => {
                        const matchClass = clearScope === "all" || r.classId === clearClassId;
                        const matchTerm = clearTerm === "__all__" || r.term === clearTerm;
                        const matchSession = clearSession === "__all__" || r.session === clearSession;
                        return matchClass && matchTerm && matchSession;
                      }).length;
                      return `This will delete ${matchCount} report card${matchCount !== 1 ? "s" : ""} for ${scopeLabel}, ${termLabel}, ${sessionLabel}.`;
                    })()}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setIsClearDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={clearReportsMutation.isPending || (clearScope === "class" && !clearClassId)}
                    onClick={() => {
                      clearReportsMutation.mutate({
                        schoolId: activeSchoolId,
                        classId: clearScope === "class" ? clearClassId : undefined,
                        term: clearTerm === "__all__" ? undefined : clearTerm,
                        session: clearSession === "__all__" ? undefined : clearSession,
                      });
                    }}
                  >
                    {clearReportsMutation.isPending ? "Clearing…" : "Clear Reports"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <CardContent className="space-y-3">
              {/* Filter bar */}
              {generatedReports.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="Search by student name…"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Select value={filterClass || "__all__"} onValueChange={(v) => setFilterClass(v === "__all__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All classes</SelectItem>
                      {reportClasses.map((c) => (
                        <SelectItem key={c.classId} value={c.classId}>{c.className}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterTermSession || "__all__"} onValueChange={(v) => setFilterTermSession(v === "__all__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All terms</SelectItem>
                      {reportTermSessions.map((ts) => {
                        const [t, s] = ts.split("|");
                        return (
                          <SelectItem key={ts} value={ts}>{t}, {s}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isLoadingReports ? (
                <div className="divide-y divide-border rounded-lg border overflow-hidden">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-36" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-16 rounded" />
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Skeleton className="h-7 w-16 rounded" />
                        <Skeleton className="h-7 w-7 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : generatedReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
                  <FileText className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">No reports generated yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Go to the Validate &amp; Generate tab to generate report cards.</p>
                </div>
              ) : filteredReports.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No reports match your filters.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border overflow-hidden">
                  {filteredReports.map((report: GeneratedReportCard) => (
                    <div key={report.id} className="flex items-center justify-between px-3 py-2.5 gap-3 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{report.studentName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{report.className}</span>
                          <span className="text-[11px] text-muted-foreground">{report.term} · {report.session}</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(report.generatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewReportCard(report)}
                          className="h-7 px-2 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Report Card</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the report card for{" "}
                                <strong>{report.studentName}</strong>? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(report.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
