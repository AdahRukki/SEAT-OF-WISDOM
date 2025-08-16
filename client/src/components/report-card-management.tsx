import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
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
  School,
  Printer
} from "lucide-react";

interface ReportCardManagementProps {
  classes: any[];
  user: any;
}

interface ValidationResult {
  studentId: string;
  status: string;
  message: string;
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
  nextTermResumptionDate?: string;
  generatedAt: string;
  generatedBy: string;
}

export function ReportCardManagement({ classes, user }: ReportCardManagementProps) {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [showResumptionDialog, setShowResumptionDialog] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<any>(null);
  const [nextTermResumptionDate, setNextTermResumptionDate] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Clear validation results when class, term, or session changes
  useEffect(() => {
    setValidationResults({});
  }, [selectedClass, selectedTerm, selectedSession]);

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
        body: data,
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
        body: data,
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
      console.log(`Validating ${students.length} students for class ${selectedClass}, term ${selectedTerm}, session ${selectedSession}`);
      
      for (const student of students) {
        console.log(`Validating student: ${student.firstName} ${student.lastName} (ID: ${student.id})`);
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
      console.error("Validation error:", error);
      toast({
        title: "Validation Error",
        description: "Some validations failed. Please try again.",
        variant: "destructive",
      });
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
    const alreadyGenerated = generatedReports.some(report => 
      report.studentId === studentId && 
      report.classId === selectedClass && 
      report.term === selectedTerm && 
      report.session === selectedSession
    );
    return validation && validation.hasAllScores && validation.hasAttendance && !alreadyGenerated;
  };

  const isReportAlreadyGenerated = (studentId: string) => {
    return generatedReports.some(report => 
      report.studentId === studentId && 
      report.classId === selectedClass && 
      report.term === selectedTerm && 
      report.session === selectedSession
    );
  };

  const handleGenerateReportCard = (student: any) => {
    const validation = validationResults[student.id];
    if (!validation || !canGenerateReport(student.id)) {
      if (isReportAlreadyGenerated(student.id)) {
        toast({
          title: "Report Already Generated",
          description: "A report card for this student, term, and session already exists.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Cannot Generate Report",
          description: "Student data is incomplete. Please ensure all scores and attendance are recorded.",
          variant: "destructive",
        });
      }
      return;
    }

    // Show resumption date dialog
    setSelectedStudentForReport(student);
    setShowResumptionDialog(true);
  };

  const handleConfirmGeneration = () => {
    if (!selectedStudentForReport || !nextTermResumptionDate) {
      toast({
        title: "Missing Information",
        description: "Please enter the next term resumption date.",
        variant: "destructive",
      });
      return;
    }

    // Create report card record
    createReportMutation.mutate({
      studentId: selectedStudentForReport.id,
      classId: selectedClass,
      term: selectedTerm,
      session: selectedSession,
      studentName: `${selectedStudentForReport.firstName} ${selectedStudentForReport.lastName}`,
      className: classes.find(c => c.id === selectedClass)?.name || "",
      totalScore: "0", // This would be calculated from actual scores
      averageScore: "0", // This would be calculated from actual scores
      attendancePercentage: "0", // This would be calculated from attendance data
      nextTermResumptionDate: new Date(nextTermResumptionDate).toISOString(),
    });
    
    setShowResumptionDialog(false);
    setSelectedStudentForReport(null);
    setNextTermResumptionDate("");
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
                        variant={isReportAlreadyGenerated(student.id) ? "secondary" : "default"}
                      >
                        <Download className="w-4 h-4" />
                        {isReportAlreadyGenerated(student.id) ? "Already Generated" : "Generate"}
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
                        <p className="font-medium">{report.studentName}, {report.session}, {report.term} Report Card</p>
                        <p className="text-sm text-muted-foreground">
                          {report.className} • Generated: {new Date(report.generatedAt).toLocaleDateString()}
                        </p>
                        {report.nextTermResumptionDate && (
                          <p className="text-sm text-muted-foreground">
                            Next Term Resumes: {new Date(report.nextTermResumptionDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`/reports/${report.id}`, '_blank')}
                      className="flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const printWindow = window.open(`/reports/${report.id}`, '_blank');
                        if (printWindow) {
                          printWindow.onload = () => printWindow.print();
                        }
                      }}
                      className="flex items-center gap-1"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </Button>
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

      {/* Next Term Resumption Date Dialog */}
      <Dialog open={showResumptionDialog} onOpenChange={setShowResumptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Report Card</DialogTitle>
            <DialogDescription>
              Please enter the next term resumption date for {selectedStudentForReport?.firstName} {selectedStudentForReport?.lastName}'s report card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="resumption-date">Next Term Resumption Date</Label>
              <Input
                id="resumption-date"
                type="date"
                value={nextTermResumptionDate}
                onChange={(e) => setNextTermResumptionDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResumptionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmGeneration}>
              Generate Report Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}