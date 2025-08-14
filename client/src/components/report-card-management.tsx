import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
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
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Trash2,
  Eye,
  Download,
  Calendar,
  School
} from "lucide-react";

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

export function ReportCardManagement({ classes, user }: ReportCardManagementProps) {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [isValidating, setIsValidating] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch generated report cards
  const { data: generatedReports = [], isLoading: isLoadingReports } = useQuery<GeneratedReportCard[]>({
    queryKey: ["/api/admin/generated-reports"],
  });

  // Fetch students for selected class
  const { data: students = [] } = useQuery<any[]>({
    queryKey: [`/api/admin/students/class/${selectedClass}`],
    enabled: !!selectedClass,
  });

  // Validation mutation
  const validateMutation = useMutation({
    mutationFn: async (data: { studentId: string; classId: string; term: string; session: string }) => {
      return await apiRequest("/api/admin/validate-report-data", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (result, variables) => {
      setValidationResults(prev => ({
        ...prev,
        [variables.studentId]: result
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/generated-reports"] });
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
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/generated-reports"] });
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
      for (const student of students) {
        await validateMutation.mutateAsync({
          studentId: student.id,
          classId: selectedClass,
          term: selectedTerm,
          session: selectedSession,
        });
      }
    } catch (error) {
      // Individual errors are handled in the mutation
    } finally {
      setIsValidating(false);
    }
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

  const handleGenerateReportCard = (student: any) => {
    // This would trigger the existing report card generation logic
    // For now, we'll create a record that the report was generated
    const validation = validationResults[student.id];
    if (!validation || !canGenerateReport(student.id)) {
      toast({
        title: "Cannot Generate Report",
        description: "Student data is incomplete. Please ensure all scores and attendance are recorded.",
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
      studentName: `${student.firstName} ${student.lastName}`,
      className: classes.find(c => c.id === selectedClass)?.name || "",
      totalScore: "0", // This would be calculated from actual scores
      averageScore: "0", // This would be calculated from actual scores
      attendancePercentage: "0", // This would be calculated from attendance data
    });
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              <Label>Term</Label>
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
            <div>
              <Label>Session</Label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
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

          <div className="flex gap-4">
            <Button 
              onClick={handleValidateAll}
              disabled={!selectedClass || !selectedTerm || !selectedSession || isValidating}
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {isValidating ? "Validating..." : "Validate All Students"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student Validation Results */}
      {selectedClass && selectedTerm && selectedSession && Object.keys(validationResults).length > 0 && (
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
                  <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{student.firstName} {student.lastName}</p>
                        <p className="text-sm text-muted-foreground">{student.studentId}</p>
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
                          {!validation.hasAllScores && (
                            <p className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="w-4 h-4" />
                              Missing subjects: {validation.missingSubjects.join(", ")}
                            </p>
                          )}
                          {!validation.hasAttendance && (
                            <p className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="w-4 h-4" />
                              No attendance data
                            </p>
                          )}
                        </div>
                      )}
                      
                      <Button
                        size="sm"
                        disabled={!canGenerateReport(student.id)}
                        onClick={() => handleGenerateReportCard(student)}
                        className="flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Generate
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
            <p className="text-muted-foreground">No report cards have been generated yet.</p>
          ) : (
            <div className="space-y-4">
              {generatedReports.map((report: GeneratedReportCard) => (
                <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Report Card</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this report card record for {report.studentName}? 
                            This action cannot be undone.
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