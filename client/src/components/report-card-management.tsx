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
        body: data,
      });
    },
    onSuccess: (result, variables) => {
      // Map server response to frontend ValidationResult format
      const validationResult: ValidationResult = {
        hasAllScores: result.status === "complete" || (result.status === "partial" && (!result.missingSubjects || result.missingSubjects.length === 0)),
        hasAttendance: result.hasAttendance,
        missingSubjects: result.missingSubjects || []
      };
      
      setValidationResults(prev => ({
        ...prev,
        [variables.studentId]: validationResult
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

  const handleViewReportCard = async (report: GeneratedReportCard) => {
    try {
      // Fetch the student data first
      const allStudents = await apiRequest("/api/admin/students");
      const student = allStudents.find((s: any) => s.id === report.studentId);
      
      if (!student) {
        throw new Error("Student not found");
      }


      // Fetch subjects first
      const subjects = await apiRequest(`/api/admin/classes/${report.classId}/subjects`);
      
      // Fetch assessments for each subject for this student
      const assessmentPromises = subjects.map((subject: any) => 
        apiRequest(`/api/admin/assessments?classId=${report.classId}&subjectId=${subject.id}&term=${encodeURIComponent(report.term)}&session=${encodeURIComponent(report.session)}`)
      );
      
      const [assessmentArrays, attendance] = await Promise.all([
        Promise.all(assessmentPromises),
        apiRequest(`/api/admin/attendance/class/${report.classId}?term=${encodeURIComponent(report.term)}&session=${encodeURIComponent(report.session)}`)
      ]);

      // Flatten assessments and filter for this student
      const allAssessments = assessmentArrays.flat();
      const assessments = allAssessments.filter((a: any) => a.studentId === report.studentId);


      // Calculate totals
      const totalMarks = subjects.reduce((sum: number, subject: any) => {
        const assessment = assessments.find((a: any) => a.studentId === student.id && a.subjectId === subject.id);
        return sum + ((assessment?.firstCA || 0) + (assessment?.secondCA || 0) + (assessment?.exam || 0));
      }, 0);

      const studentAttendance = attendance.find((att: any) => att.studentId === student.id);
      const attendancePercentage = studentAttendance ? 
        Math.round((studentAttendance.presentDays / studentAttendance.totalDays) * 100) : 0;

      // Generate the detailed report card
      const reportWindow = window.open('', '_blank');
      if (!reportWindow) return;

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
                <div class="school-name">SEAT OF WISDOM ACADEMY</div>
                <div class="school-motto">"Nurturing Excellence in Learning"</div>
                <div class="report-title">STUDENT REPORT CARD</div>
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
                  <span class="info-label">Session:</span>
                  <span class="info-value">${report.session}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Term:</span>
                  <span class="info-value">${report.term}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Age:</span>
                  <span class="info-value">${student.dateOfBirth ? (() => {
                    const birthDate = new Date(student.dateOfBirth);
                    const today = new Date();
                    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                      calculatedAge--;
                    }
                    return calculatedAge;
                  })() : 'N/A'} years</span>
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
                  ${subjects.map((subject: any) => {
                    const assessment = assessments.find((a: any) => a.studentId === student.id && a.subjectId === subject.id);
                    const firstCA = assessment?.firstCA || 0;
                    const secondCA = assessment?.secondCA || 0;
                    const exam = assessment?.exam || 0;
                    const total = firstCA + secondCA + exam;
                    
                    let grade = 'F';
                    let remark = 'Fail';
                    
                    if (total >= 90) { grade = 'A+'; remark = 'Excellent'; }
                    else if (total >= 80) { grade = 'A'; remark = 'Very Good'; }
                    else if (total >= 70) { grade = 'B'; remark = 'Good'; }
                    else if (total >= 60) { grade = 'C'; remark = 'Credit'; }
                    else if (total >= 50) { grade = 'D'; remark = 'Pass'; }
                    else if (total >= 40) { grade = 'E'; remark = 'Poor'; }
                    
                    return `
                      <tr>
                        <td class="subject-name">${subject.name}</td>
                        <td>${firstCA}</td>
                        <td>${secondCA}</td>
                        <td>${exam}</td>
                        <td><strong>${total}</strong></td>
                        <td class="grade">${grade}</td>
                        <td>${remark}</td>
                      </tr>
                    `;
                  }).join('')}
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
                    <div class="stat-value">${subjects.length ? (totalMarks / (subjects.length * 100) * 100).toFixed(2) : '0.00'}%</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">ATTENDANCE</div>
                    <div class="stat-value">${attendancePercentage}%</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">RESULT</div>
                    <div class="stat-value">${(totalMarks / (subjects.length * 100) * 100) >= 40 ? 'PASS' : 'FAIL'}</div>
                  </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                  <div>No of Subjects: <strong>${subjects.length}</strong></div>
                  <div>Total Obtainable: <strong>${subjects.length * 100}</strong></div>
                  <div>Result Status: <strong>${(totalMarks / (subjects.length * 100) * 100) >= 40 ? 'PASS' : 'FAIL'}</strong></div>
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
                  Generated on ${new Date().toLocaleDateString()} | Report ID: ${report.id}
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      reportWindow.document.write(reportHTML);
      reportWindow.document.close();
      reportWindow.print();
    } catch (error) {
      console.error('Error loading report card data:', error);
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
      studentName: `${student.user.firstName} ${student.user.lastName}`,
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
                        <p className="font-medium">{student.user.firstName} {student.user.lastName}</p>
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
                          {!validation.hasAllScores && validation.missingSubjects.length > 0 && (
                            <p className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="w-4 h-4" />
                              Missing subjects: {validation.missingSubjects.join(", ")}
                            </p>
                          )}
                          {!validation.hasAllScores && validation.missingSubjects.length === 0 && (
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
                          {validation.hasAllScores && validation.hasAttendance && (
                            <p className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              All data complete
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