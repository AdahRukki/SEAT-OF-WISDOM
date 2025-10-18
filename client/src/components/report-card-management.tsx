import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
}: ReportCardManagementProps) {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
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

  // Fetch generated report cards
  const { data: generatedReports = [], isLoading: isLoadingReports } = useQuery<
    GeneratedReportCard[]
  >({
    queryKey: ["/api/admin/generated-reports"],
  });

  // Fetch students for selected class
  const { data: students = [] } = useQuery<any[]>({
    queryKey: [`/api/admin/students/class/${selectedClass}`],
    enabled: !!selectedClass,
  });

  // Use same academic info query as Settings for synchronization
  const { data: academicInfo } = useQuery<{
    currentSession: string | null;
    currentTerm: string | null;
  }>({
    queryKey: ["/api/current-academic-info"],
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

  // Validation mutation
  const validateMutation = useMutation({
    mutationFn: async (data: {
      studentId: string;
      classId: string;
      term: string;
      session: string;
    }) => {
      return await apiRequest("/api/admin/validate-report-data", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: (result, variables) => {
      // Map server response to frontend ValidationResult format
      const validationResult: ValidationResult = {
        hasAllScores:
          result.status === "complete" ||
          (result.status === "partial" &&
            (!result.missingSubjects || result.missingSubjects.length === 0)),
        hasAttendance: result.hasAttendance,
        missingSubjects: result.missingSubjects || [],
      };

      setValidationResults((prev) => ({
        ...prev,
        [variables.studentId]: validationResult,
      }));
    },
    onError: (error) => {
      toast({
        title: "Validation Error",
        description: "Failed to validate report data",
        variant: "destructive",
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
        queryKey: ["/api/admin/generated-reports"],
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
        queryKey: ["/api/admin/generated-reports"],
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

    if (students.length === 0) {
      toast({
        title: "No Students Found",
        description: "No students found in the selected class",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    setValidationResults({});

    try {
      for (const student of students) {
        await validateMutation.mutateAsync({
          studentId: student.id,
          classId: selectedClass,
          term: selectedTerm,
          session: selectedSession,
        });
      }

      toast({
        title: "Validation Complete",
        description: `Validated ${students.length} students. Check the results below.`,
      });
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Some validations failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

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

  // Validation for entire school - only validates, shows class issues
  const handleValidateEntireSchool = async () => {
    setIsValidating(true);
    setValidationResults({});
    setSchoolValidationResults({});
    setIsAllStudentsValidated(false);

    try {
      // Use shared academic info instead of direct API call
      if (!academicInfo?.currentTerm || !academicInfo?.currentSession) {
        try {
          await apiRequest("/api/admin/initialize-academic-calendar", {
            method: "POST",
          });
          // Refresh the academic info query after initialization
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
            description:
              "Failed to initialize academic calendar. Please contact administrator.",
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

      let totalStudentsAcrossSchool = 0;
      let validatedStudentsAcrossSchool = 0;
      const classResults: typeof schoolValidationResults = {};

      // Validate all students by class
      for (const classItem of classes) {
        const classStudents = await apiRequest(
          `/api/admin/students/class/${classItem.id}`,
        );
        const classTotal = classStudents.length;
        let classValidated = 0;
        const classIssues: string[] = [];

        totalStudentsAcrossSchool += classTotal;

        // Validate each student in the class
        for (const student of classStudents) {
          try {
            const validationResult = await validateMutation.mutateAsync({
              studentId: student.id,
              classId: classItem.id,
              term: currentTerm,
              session: currentSession,
            });

            if (validationResult.status === "complete") {
              classValidated++;
              validatedStudentsAcrossSchool++;
            } else {
              classIssues.push(
                `${student.user.firstName} ${student.user.lastName}: ${validationResult.message}`,
              );
            }
          } catch (error) {
            console.error(`Failed to validate student ${student.id}:`, error);
            classIssues.push(
              `${student.user.firstName} ${student.user.lastName}: Validation failed`,
            );
          }
        }

        // Store class results
        classResults[classItem.id] = {
          className: classItem.name,
          totalStudents: classTotal,
          validatedStudents: classValidated,
          issues: classIssues,
        };
      }

      setSchoolValidationResults(classResults);

      if (totalStudentsAcrossSchool === 0) {
        toast({
          title: "No Students Found",
          description: "No students found across all classes.",
          variant: "destructive",
        });
        return;
      }

      const successRate =
        (validatedStudentsAcrossSchool / totalStudentsAcrossSchool) * 100;
      const allValidated =
        validatedStudentsAcrossSchool === totalStudentsAcrossSchool;
      setIsAllStudentsValidated(allValidated);

      toast({
        title: allValidated
          ? "All Students Validated Successfully"
          : "Validation Complete - Issues Found",
        description: `${validatedStudentsAcrossSchool}/${totalStudentsAcrossSchool} students validated (${successRate.toFixed(1)}%). Check class details below.`,
        variant: allValidated ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Validation Error",
        description:
          "Failed to complete school-wide validation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Generate all report cards for the entire school with date selection
  const handleGenerateAllReports = async () => {
    // Hard validation gating - double check that all students are validated
    if (!isAllStudentsValidated) {
      toast({
        title: "Validation Required",
        description:
          "All students must be validated before generating reports.",
        variant: "destructive",
      });
      return;
    }

    if (!resumptionDate) {
      toast({
        title: "Date Required",
        description: "Please select the next term resumption date.",
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

      // Generate reports only for validated students
      for (const classId in schoolValidationResults) {
        const classResult = schoolValidationResults[classId];
        if (classResult.validatedStudents > 0) {
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
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Term Advanced Successfully",
        description: `School has been advanced to ${response.newTerm} ${response.newSession}`,
      });
      // Refresh current academic info to sync with Settings page
      queryClient.invalidateQueries({
        queryKey: ["/api/current-academic-info"],
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

      // Calculate totals
      const totalMarks = subjects.reduce((sum: number, subject: any) => {
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
                grid-template-columns: 1fr 1fr;
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
                  ${subjects
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
                    <div class="stat-value">${subjects.length ? ((totalMarks / (subjects.length * 100)) * 100).toFixed(1) : "0"}%</div>
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
                    <img src="/attached_assets/targeted_element_1759270721981.png" alt="Principal Signature" class="signature-image" />
                    <div class="signature-name">Principal, Seat of Wisdom Academy Asaba</div>
                  </div>
                </div>
                <div style="margin-top: 6px; font-size: 7px;">
                  Generated: ${new Date().toLocaleDateString()} ${resumptionDate ? `| Next Term: ${new Date(resumptionDate).toLocaleDateString("en-GB")}` : ''}
                </div>
              </div>
              
              <div class="flex justify-center gap-4 mt-6">
                <button class="print-button" onclick="window.print()">
                  🖨️ Print Report Card
                </button>
                <button class="print-button" onclick="/* Add your download logic here */ alert('Download logic here');">
                  ⬇️ Download Report Card
                </button>
              </div>

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

  return (
    <div className="space-y-6">
      {/* Report Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Report Card Management
          </CardTitle>
          <CardDescription>
            Validate student data and manage generated report cards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label>Select Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
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
              <Label>Term and Session</Label>
              <Select 
                value={`${selectedTerm}|${selectedSession}`} 
                onValueChange={(value) => {
                  const [term, session] = value.split('|');
                  setSelectedTerm(term);
                  setSelectedSession(session);
                }}
              >
                <SelectTrigger data-testid="select-reports-session">
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
          </div>

          <div className="flex gap-4 flex-wrap">
            <Button
              onClick={handleValidateAll}
              disabled={
                !selectedClass ||
                !selectedTerm ||
                !selectedSession ||
                isValidating
              }
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {isValidating ? "Validating..." : "Validate All Students"}
            </Button>

            {/* New Workflow: Validate First, Then Generate Reports */}
            <Button
              onClick={handleValidateEntireSchool}
              disabled={isValidating}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-validate-entire-school"
            >
              <CheckCircle className="w-4 h-4" />
              {isValidating ? "Validating..." : "Validate Entire School"}
            </Button>

            <Button
              onClick={() => setShowResumptionDateDialog(true)}
              disabled={!isAllStudentsValidated || isGeneratingReports}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400"
              data-testid="button-generate-all-reports"
            >
              <BookOpen className="w-4 h-4" />
              {isGeneratingReports
                ? "Generating Reports..."
                : "Generate All Report Cards for Whole School"}
            </Button>

            {/* Date Selection Dialog */}
            <Dialog
              open={showResumptionDateDialog}
              onOpenChange={setShowResumptionDateDialog}
            >
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
                        className={`w-full justify-start text-left font-normal ${
                          !resumptionDate && "text-muted-foreground"
                        }`}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {resumptionDate
                          ? format(resumptionDate, "PPP")
                          : "Pick a date"}
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
                  <Button
                    variant="outline"
                    onClick={() => setShowResumptionDateDialog(false)}
                  >
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

            {/* Legacy batch generation removed - now handled by new workflow */}
          </div>
        </CardContent>
      </Card>

      {/* School-wide Validation Results by Class */}
      {Object.keys(schoolValidationResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>School Validation Results by Class</CardTitle>
            <CardDescription>
              Overview of validation status across all classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(schoolValidationResults).map(
                ([classId, result]) => (
                  <div key={classId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {result.className}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {result.validatedStudents}/{result.totalStudents}{" "}
                          students validated
                        </p>
                      </div>
                      <Badge
                        className={
                          result.validatedStudents === result.totalStudents
                            ? "bg-green-500 text-white"
                            : result.validatedStudents > 0
                              ? "bg-yellow-500 text-white"
                              : "bg-red-500 text-white"
                        }
                      >
                        {result.validatedStudents === result.totalStudents
                          ? "Complete"
                          : result.validatedStudents > 0
                            ? "Partial"
                            : "Incomplete"}
                      </Badge>
                    </div>

                    {result.issues.length > 0 && (
                      <div className="mt-3">
                        <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Issues Found:
                        </h4>
                        <div className="space-y-1 text-sm">
                          {result.issues.slice(0, 5).map((issue, index) => (
                            <p key={index} className="text-red-600 pl-6">
                              • {issue}
                            </p>
                          ))}
                          {result.issues.length > 5 && (
                            <p className="text-muted-foreground pl-6">
                              ... and {result.issues.length - 5} more issues
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {result.validatedStudents === result.totalStudents && (
                      <div className="mt-3 flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">
                          All students ready for report generation
                        </span>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>

            {isAllStudentsValidated && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">
                    All students validated successfully!
                  </span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  You can now generate report cards for the entire school.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student Validation Results */}
      {selectedClass &&
        selectedTerm &&
        selectedSession &&
        Object.keys(validationResults).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Student Data Status</CardTitle>
              <CardDescription>
                Check which students have complete data for report generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {students.map((student: any) => {
                  const status = getValidationStatus(student.id);
                  const validation = validationResults[student.id];

                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">
                            {student.user.firstName} {student.user.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {student.studentId}
                          </p>
                        </div>
                        {status && (
                          <Badge className={`${status.color} text-white`}>
                            {status.text}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {validation && (
                          <div className="text-sm text-muted-foreground">
                            {!validation.hasAllScores &&
                              validation.missingSubjects.length > 0 && (
                                <p className="flex items-center gap-1 text-red-600">
                                  <AlertTriangle className="w-4 h-4" />
                                  Missing subjects:{" "}
                                  {validation.missingSubjects.join(", ")}
                                </p>
                              )}
                            {!validation.hasAllScores &&
                              validation.missingSubjects.length === 0 && (
                                <p className="flex items-center gap-1 text-red-600">
                                  <AlertTriangle className="w-4 h-4" />
                                  Missing assessment scores
                                </p>
                              )}
                            {!validation.hasAttendance && (
                              <p className="flex items-center gap-1 text-red-600">
                                <AlertTriangle className="w-4 h-4" />
                                No attendance data
                              </p>
                            )}
                            {validation.hasAllScores &&
                              validation.hasAttendance && (
                                <p className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="w-4 h-4" />
                                  All data complete
                                </p>
                              )}
                          </div>
                        )}

                        <Button
                          size="sm"
                          disabled={
                            !canGenerateReport(student.id) ||
                            generatingReports.has(student.id)
                          }
                          onClick={() => handleGenerateReportCard(student)}
                          className="flex items-center gap-1"
                        >
                          {generatingReports.has(student.id) ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Generated Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Generated Report Cards
          </CardTitle>
          <CardDescription>
            View and manage previously generated report cards
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingReports ? (
            <p>Loading generated reports...</p>
          ) : generatedReports.length === 0 ? (
            <p className="text-muted-foreground">
              No report cards have been generated yet.
            </p>
          ) : (
            <div className="space-y-4">
              {generatedReports.map((report: GeneratedReportCard) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <School className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{report.studentName}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.className} • {report.term} {report.session}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {new Date(report.generatedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewReportCard(report)}
                      className="flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete Report Card
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this report card
                            record for {report.studentName}? This action cannot
                            be undone.
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
