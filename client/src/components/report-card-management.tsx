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

  // Filter state for generated reports list
  const [filterSearch, setFilterSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterTermSession, setFilterTermSession] = useState("");

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

    // Validate all students have been checked
    if (!isAllStudentsValidated) {
      toast({
        title: "Validation Required",
        description:
          "All students must be validated before generating reports.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingReports(true);
    setShowResumptionDateDialog(false);

    try {
      // Use selected term/session from dropdown (prioritize user selection)
      const currentTerm = selectedTerm || academicInfo?.currentTerm;
      const currentSession = selectedSession || academicInfo?.currentSession;
      const isThirdTerm = currentTerm === "Third Term";
      const resumptionDateStr = format(resumptionDate, "PPP");

      // Build validated student list from validation results
      const validatedStudentIds = new Set<string>();
      Object.entries(validationResults).forEach(([studentId, validation]) => {
        if (validation.hasAllScores && validation.hasAttendance) {
          validatedStudentIds.add(studentId);
        }
      });

      if (validatedStudentIds.size === 0) {
        toast({
          title: "No Validated Students",
          description: "No students found with complete validation data.",
          variant: "destructive",
        });
        return;
      }

      let totalReports = validatedStudentIds.size;
      let generatedReports = 0;

      // Publish scores and generate reports for validated students
      for (const classId in schoolValidationResults) {
        const classResult = schoolValidationResults[classId];
        if (classResult.validatedStudents > 0) {
          // Publish scores for this class with next term resume date
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

          // Get students for this class
          const classStudents = await apiRequest(
            `/api/admin/students/class/${classId}`,
          );

          for (const student of classStudents) {
            // Only generate for validated students
            if (validatedStudentIds.has(student.id)) {
              try {
                // Create report card record with resumption date
                await createReportMutation.mutateAsync({
                  studentId: student.id,
                  classId: classId,
                  term: currentTerm,
                  session: currentSession,
                  studentName: `${student.user.firstName} ${student.user.lastName}`,
                  className: classResult.className,
                  totalScore: "0", // Would be calculated from actual scores
                  averageScore: "0", // Would be calculated from actual scores
                  attendancePercentage: "0", // Would be calculated from attendance data
                  resumptionDate: resumptionDateStr, // Include resumption date
                });

                generatedReports++;
              } catch (error) {
                console.error(
                  `Failed to generate report for student ${student.id}:`,
                  error,
                );
                throw error; // Stop process if report generation fails
              }
            }
          }
        }
      }

      const allReportsGenerated = generatedReports === totalReports;

      if (!allReportsGenerated) {
        throw new Error(
          `Only ${generatedReports}/${totalReports} reports generated successfully`,
        );
      }

      toast({
        title: "All Reports Generated Successfully",
        description: `Generated ${generatedReports} reports. ${isThirdTerm ? "Promoting students..." : "Advancing term..."}`,
      });

      // Sequential execution: Promote first (if third term), then advance term
      try {
        if (isThirdTerm) {
          await promoteStudentsToNextClass();
          toast({
            title: "Students Promoted",
            description:
              "All students have been promoted to their next classes.",
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

  // Student promotion logic for third term
  const promoteStudentsToNextClass = async () => {
    console.log("Starting student promotion process...");

    try {
      let totalPromoted = 0;
      let totalGraduated = 0;

      // Process each class with validated students
      for (const classId in schoolValidationResults) {
        const classResult = schoolValidationResults[classId];
        if (classResult.validatedStudents > 0) {
          // Get students for this class
          const classStudents = await apiRequest(
            `/api/admin/students/class/${classId}`,
          );

          // Determine next class for this class
          const nextClassId = getNextClass(classId);

          if (nextClassId === "GRADUATE") {
            // Students graduate (SS3 → Graduate)
            const studentIds = classStudents.map((s: any) => s.id);
            if (studentIds.length > 0) {
              await apiRequest("/api/admin/promote-students", {
                method: "POST",
                body: {
                  currentClassId: classId,
                  nextClassId: "graduated",
                  studentIds,
                },
              });
              totalGraduated += studentIds.length;
              console.log(
                `Graduated ${studentIds.length} students from ${classId}`,
              );
            }
          } else if (nextClassId) {
            // Promote to next class
            const studentIds = classStudents.map((s: any) => s.id);
            if (studentIds.length > 0) {
              await apiRequest("/api/admin/promote-students", {
                method: "POST",
                body: {
                  currentClassId: classId,
                  nextClassId: nextClassId,
                  studentIds,
                },
              });
              totalPromoted += studentIds.length;
              console.log(
                `Promoted ${studentIds.length} students from ${classId} to ${nextClassId}`,
              );
            }
          }
        }
      }

      if (totalPromoted > 0 || totalGraduated > 0) {
        const message = [];
        if (totalPromoted > 0)
          message.push(`${totalPromoted} students promoted`);
        if (totalGraduated > 0)
          message.push(`${totalGraduated} students graduated`);

        console.log(`Promotion complete: ${message.join(", ")}`);
      }
    } catch (error) {
      console.error("Error promoting students:", error);
      throw new Error("Failed to promote students to next classes");
    }
  };

  // Helper function to determine next class for promotion
  const getNextClass = (currentClassId: string): string | null => {
    // Extract school number and class info from ID (e.g., "SCH1-JSS1")
    const match = currentClassId.match(/^(SCH\d+)-([A-Z]+)(\d+)$/);
    if (!match) return null;

    const [, schoolPrefix, classType, classNumber] = match;
    const currentNumber = parseInt(classNumber);

    if (classType === "JSS") {
      if (currentNumber === 1) return `${schoolPrefix}-JSS2`;
      if (currentNumber === 2) return `${schoolPrefix}-JSS3`;
      if (currentNumber === 3) return `${schoolPrefix}-SS1`;
    } else if (classType === "SS") {
      if (currentNumber === 1) return `${schoolPrefix}-SS2`;
      if (currentNumber === 2) return `${schoolPrefix}-SS3`;
      if (currentNumber === 3) return "GRADUATE"; // SS3 graduates
    } else if (classType === "PRI") {
      // Primary school progression
      if (currentNumber < 6) return `${schoolPrefix}-PRI${currentNumber + 1}`;
      if (currentNumber === 6) return `${schoolPrefix}-JSS1`; // Primary 6 → JSS1
    }

    return null; // Unknown class type or final year
  };

  // Helper function to get promotion message for report cards
  const getPromotionMessage = (studentClassId: string): string => {
    const nextClass = getNextClass(studentClassId);

    if (nextClass === "GRADUATE") {
      return "Congratulations! You have successfully graduated.";
    } else if (nextClass) {
      // Convert class ID to readable name (SCH1-JSS2 → "J.S.S 2")
      const match = nextClass.match(/^SCH\d+-([A-Z]+)(\d+)$/);
      if (match) {
        const [, classType, number] = match;
        if (classType === "JSS") return `Promoted to J.S.S ${number}`;
        if (classType === "SS") return `Promoted to S.S.S ${number}`;
        if (classType === "PRI") return `Promoted to Primary ${number}`;
      }
      return `Promoted to ${nextClass}`;
    }

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

  const getValidationStatus = (studentId: string) => {
    const validation = validationResults[studentId];
    if (!validation) return null;

    if (validation.hasAllScores && validation.hasAttendance) {
      return { status: "complete", color: "bg-green-500", text: "Complete" };
    } else if (validation.hasAllScores || validation.hasAttendance) {
      return { status: "partial", color: "bg-yellow-500", text: "Partial" };
    } else {
      return { status: "incomplete", color: "bg-red-500", text: "Incomplete" };
    }
  };

  const canGenerateReport = (studentId: string) => {
    const validation = validationResults[studentId];
    return validation && validation.hasAllScores && validation.hasAttendance;
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
      const attendancePercentage = studentAttendance
        ? Math.round(
            (studentAttendance.presentDays / studentAttendance.totalDays) * 100,
          )
        : 0;

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
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A4 portrait; margin: 10mm; }
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 0; 
                line-height: 1.2; 
                color: #1e3a8a;
                background: #eff6ff;
              }
             .report-card {
  width: 90%;
  max-width: 750px;
  margin: 20px auto;
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
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .behavioral-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 4px;
              }
              .behavioral-item {
                background: #f8faff;
                padding: 5px 3px;
                border-radius: 4px;
                box-shadow: 0 1px 3px rgba(37, 99, 235, 0.1);
                text-align: center;
              }
              .behavioral-label {
                font-size: 7px;
                font-weight: 700;
                margin-bottom: 3px;
                color: #60a5fa;
              }
              .behavioral-value {
                font-size: 8px;
                font-weight: 800;
                color: #2563eb;
              }
              .grade-key {
                padding: 8px;
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                margin: 0 8px 8px 8px;
                font-size: 7px;
                border-radius: 6px;
                border: 2px solid #93c5fd;
              }
              .grade-key-title {
                font-weight: 800;
                margin-bottom: 5px;
                font-size: 9px;
                color: #1e40af;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .grade-key-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 3px;
                color: #1e3a8a;
                font-weight: 600;
              }
              .footer {
                padding: 10px;
                text-align: center;
                background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
                color: white;
                font-size: 8px;
              }
              .print-button {
                display: block;
                width: 200px;
                margin: 15px auto;
                padding: 12px 24px;
                background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .print-button:hover {
                background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
                box-shadow: 0 6px 8px rgba(37, 99, 235, 0.4);
                transform: translateY(-2px);
              }
              .print-button:active {
                transform: translateY(0px);
                box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
              }
              .principal-comment-section {
                padding: 10px;
                margin: 8px;
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                border-radius: 6px;
                border-left: 4px solid #2563eb;
              }
              .principal-comment-section h3 {
                text-align: center;
                margin-bottom: 6px;
                font-size: 10px;
                font-weight: 800;
                color: #1e40af;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .principal-comment-text {
                font-size: 8px;
                line-height: 1.4;
                color: #1e3a8a;
                font-style: italic;
                text-align: justify;
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
                <img src="/assets/academy-logo.png" alt="School Logo" class="header-logo" />
                <div class="header-text">
                  <div class="school-name">SEAT OF WISDOM ACADEMY</div>
                  <div class="school-info">ASABA, DELTA STATE</div>
                  <div class="education-levels">PRE NURSERY, NURSERY, PRIMARY & SECONDARY</div>
                  <div class="school-motto">GOVERNMENT, WAEC AND NECO APPROVED</div>
                  <div class="report-title">${report.term} ASSESSMENT REPORT - ${report.session} SESSION</div>
                </div>
              </div>
              
              <div class="student-info">
                <div class="info-item">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${student.user.firstName} ${student.user.lastName}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">ID:</span>
                  <span class="info-value">${student.studentId}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Class:</span>
                  <span class="info-value">${report.className}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Gender:</span>
                  <span class="info-value">${student.gender || 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Age:</span>
                  <span class="info-value">${
                    student.dateOfBirth
                      ? (() => {
                          const birthDate = new Date(student.dateOfBirth);
                          const today = new Date();

                          // Check if the date is valid
                          if (isNaN(birthDate.getTime())) {
                            return "N/A";
                          }

                          // Check if the birth date is in the future
                          if (birthDate > today) {
                            return "N/A";
                          }

                          let calculatedAge =
                            today.getFullYear() - birthDate.getFullYear();
                          const monthDiff =
                            today.getMonth() - birthDate.getMonth();
                          if (
                            monthDiff < 0 ||
                            (monthDiff === 0 &&
                              today.getDate() < birthDate.getDate())
                          ) {
                            calculatedAge--;
                          }

                          // Ensure age is reasonable (between 0 and 150)
                          if (calculatedAge < 0 || calculatedAge > 150) {
                            return "N/A";
                          }

                          return calculatedAge;
                        })()
                      : "N/A"
                  } years</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Next Term:</span>
                  <span class="info-value">${resumptionDate ? new Date(resumptionDate).toLocaleDateString("en-GB") : 'TBA'}</span>
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
                  </tr>
                </thead>
                <tbody>
                  ${subjectsWithScores
                    .map((subject: any) => {
                      const assessment = assessments.find(
                        (a: any) =>
                          a.studentId === student.id &&
                          a.subjectId === subject.id,
                      );
                      const firstCA = assessment?.firstCA || 0;
                      const secondCA = assessment?.secondCA || 0;
                      const exam = assessment?.exam || 0;
                      const total = firstCA + secondCA + exam;

                      const { grade, remark } = calculateGrade(total);

                      return `
                      <tr>
                        <td class="subject-name">${subject.name.toUpperCase()}</td>
                        <td>${firstCA}</td>
                        <td>${secondCA}</td>
                        <td>${exam}</td>
                        <td><strong>${total}</strong></td>
                        <td class="grade">${grade}</td>
                        <td>${remark}</td>
                      </tr>
                    `;
                    })
                    .join("")}
                </tbody>
              </table>

              <div class="stats-section">
                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-label">TOTAL SCORE</div>
                    <div class="stat-value">${totalMarks}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">AVERAGE</div>
                    <div class="stat-value">${subjectsWithScores.length ? ((totalMarks / (subjectsWithScores.length * 100)) * 100).toFixed(1) : "0"}%</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">ATTENDANCE</div>
                    <div class="stat-value">${attendancePercentage}%</div>
                  </div>
                  
                </div>
              </div>

              ${studentBehavioralRating ? `
              <div class="behavioral-section">
                <h3>BEHAVIORAL ASSESSMENT</h3>
                <div class="behavioral-grid">
                  <div class="behavioral-item">
                    <div class="behavioral-label">Attendance</div>
                    <div class="behavioral-value">${getRatingText(studentBehavioralRating.attendancePunctuality)}</div>
                  </div>
                  <div class="behavioral-item">
                    <div class="behavioral-label">Neatness</div>
                    <div class="behavioral-value">${getRatingText(studentBehavioralRating.neatnessOrganization)}</div>
                  </div>
                  <div class="behavioral-item">
                    <div class="behavioral-label">Respect</div>
                    <div class="behavioral-value">${getRatingText(studentBehavioralRating.respectPoliteness)}</div>
                  </div>
                  <div class="behavioral-item">
                    <div class="behavioral-label">Participation</div>
                    <div class="behavioral-value">${getRatingText(studentBehavioralRating.participationTeamwork)}</div>
                  </div>
                  <div class="behavioral-item">
                    <div class="behavioral-label">Responsibility</div>
                    <div class="behavioral-value">${getRatingText(studentBehavioralRating.responsibility)}</div>
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
              
              <div class="flex justify-center gap-4 mt-6">
                <button class="print-button" onclick="window.print()">
                  🖨️ Print Report Card
                </button>
                <button class="print-button" onclick="downloadReport()">
                  ⬇️ Download Report Card
                </button>
              </div>
              
              <script>
                function downloadReport() {
                  window.print();
                }
              </script>

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

  return (
    <div className="space-y-4">
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
                disabled={!isAllStudentsValidated || isGeneratingReports}
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
          </div>
        </CardContent>
      </Card>

      {/* Date Selection Dialog */}
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
              Generate Reports & Advance Term
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Per-student Validation Results */}
      {selectedClass && selectedTerm && selectedSession && Object.keys(validationResults).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Student Data Status</CardTitle>
            <CardDescription className="text-xs">
              {Object.values(validationResults).filter(v => v.hasAllScores && v.hasAttendance).length} of {students.length} students ready
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border rounded-lg border overflow-hidden">
              {students.map((student: any) => {
                const status = getValidationStatus(student.id);
                const validation = validationResults[student.id];
                const isReady = validation?.hasAllScores && validation?.hasAttendance;
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
          </CardContent>
        </Card>
      )}

      {/* Generated Reports List */}
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
          </div>
        </CardHeader>
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
              <p className="text-xs text-muted-foreground mt-1">Validate students above, then click Generate All Report Cards.</p>
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
    </div>
  );
}
