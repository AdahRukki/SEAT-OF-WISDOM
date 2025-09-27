import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen, User, Star, Save, Calculator } from "lucide-react";
import type { 
  StudentWithDetails, 
  Subject, 
  Assessment, 
  NonAcademicRating,
  UpdateNonAcademicRating,
  AddScore,
  Class 
} from "@shared/schema";
import { calculateGrade, getRatingText } from "@shared/schema";

interface TeacherGradesInterfaceProps {
  currentTerm: string;
  currentSession: string;
  userSchoolId?: string;
}

export function TeacherGradesInterface({ 
  currentTerm, 
  currentSession, 
  userSchoolId 
}: TeacherGradesInterfaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [editingCell, setEditingCell] = useState<{studentId: string, subjectId: string, field: 'firstCA' | 'secondCA' | 'exam'} | null>(null);
  const [tempScores, setTempScores] = useState<{[key: string]: string}>({});

  // Form state for non-academic ratings
  const [nonAcademicScores, setNonAcademicScores] = useState({
    attendancePunctuality: 3,
    neatnessOrganization: 3,
    respectPoliteness: 3,
    participationTeamwork: 3,
    responsibility: 3
  });
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);

  // Queries
  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ['/api/admin/classes', userSchoolId],
    enabled: !!userSchoolId
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/admin/subjects']
  });

  const { data: classStudents = [], isLoading: studentsLoading } = useQuery<StudentWithDetails[]>({
    queryKey: [`/api/admin/students/by-class/${selectedClassId}`],
    enabled: !!selectedClassId
  });

  const { data: assessments = [], isLoading: assessmentsLoading } = useQuery<(Assessment & { subject: Subject })[]>({
    queryKey: [`/api/admin/assessments/${selectedClassId}/${currentTerm}/${currentSession}`],
    enabled: !!selectedClassId
  });

  const { data: nonAcademicRatings = [], isLoading: ratingsLoading } = useQuery<NonAcademicRating[]>({
    queryKey: [`/api/admin/non-academic-ratings/${selectedClassId}/${currentTerm}/${currentSession}`],
    enabled: !!selectedClassId
  });

  // Mutations
  const saveAcademicScoreMutation = useMutation({
    mutationFn: async (data: AddScore) => {
      return apiRequest('/api/admin/assessments', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: (_, variables) => {
      toast({ description: "Academic scores saved successfully!" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/assessments/${selectedClassId}/${currentTerm}/${currentSession}`] });
      // Clear editing state after successful save with a small delay to show the saved value
      setTimeout(() => {
        setEditingCell(null);
        setTempScores({});
      }, 100);
    },
    onError: (error: any) => {
      toast({ 
        description: error.message || "Failed to save academic scores",
        variant: "destructive" 
      });
    }
  });

  const saveNonAcademicRatingMutation = useMutation({
    mutationFn: async (data: UpdateNonAcademicRating) => {
      return apiRequest('/api/admin/non-academic-ratings', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => {
      toast({ description: "Non-academic ratings saved successfully!" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/non-academic-ratings/${selectedClassId}/${currentTerm}/${currentSession}`] });
      setIsRatingDialogOpen(false);
      setNonAcademicScores({
        attendancePunctuality: 3,
        neatnessOrganization: 3,
        respectPoliteness: 3,
        participationTeamwork: 3,
        responsibility: 3
      });
    },
    onError: (error: any) => {
      toast({ 
        description: error.message || "Failed to save non-academic ratings",
        variant: "destructive" 
      });
    }
  });

  // Helper functions
  const getStudentAssessment = (studentId: string, subjectId: string) => {
    return assessments.find(a => a.studentId === studentId && a.subjectId === subjectId);
  };

  const getStudentNonAcademicRating = (studentId: string) => {
    return nonAcademicRatings.find(r => r.studentId === studentId);
  };

  const handleSaveScore = (studentId: string, subjectId: string, field: 'firstCA' | 'secondCA' | 'exam', value: string) => {
    const numValue = parseInt(value) || 0;
    
    // Validation
    const maxValue = field === 'exam' ? 60 : 20;
    if (numValue < 0 || numValue > maxValue) {
      toast({ 
        description: `${field === 'exam' ? 'Exam' : field === 'firstCA' ? 'First CA' : 'Second CA'} must be between 0 and ${maxValue}`, 
        variant: "destructive" 
      });
      return;
    }

    // Get existing scores for this student/subject
    const existing = getStudentAssessment(studentId, subjectId);
    const updatedScores = {
      studentId,
      subjectId,
      classId: selectedClassId,
      term: currentTerm,
      session: currentSession,
      firstCA: existing?.firstCA || 0,
      secondCA: existing?.secondCA || 0,
      exam: existing?.exam || 0,
      [field]: numValue
    };

    saveAcademicScoreMutation.mutate(updatedScores);
  };

  const handleSaveNonAcademicRating = () => {
    if (!selectedStudent) return;

    saveNonAcademicRatingMutation.mutate({
      studentId: selectedStudent.id,
      classId: selectedClassId,
      term: currentTerm,
      session: currentSession,
      ...nonAcademicScores
    });
  };

  const handleCellEdit = (studentId: string, subjectId: string, field: 'firstCA' | 'secondCA' | 'exam') => {
    setEditingCell({ studentId, subjectId, field });
    const existing = getStudentAssessment(studentId, subjectId);
    const currentValue = existing?.[field]?.toString() || "";
    setTempScores({ [`${studentId}-${subjectId}-${field}`]: currentValue });
  };

  const handleKeyPress = (e: React.KeyboardEvent, studentId: string, subjectId: string, field: 'firstCA' | 'secondCA' | 'exam') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const key = `${studentId}-${subjectId}-${field}`;
      const value = tempScores[key] || "";
      
      if (value.trim()) {
        handleSaveScore(studentId, subjectId, field, value);
      } else {
        // If no value, just move to next field
        setEditingCell(null);
        setTempScores({});
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setTempScores({});
    }
  };

  const openRatingDialog = (student: StudentWithDetails) => {
    setSelectedStudent(student);
    
    // Pre-fill with existing ratings if available
    const existing = getStudentNonAcademicRating(student.id);
    if (existing) {
      setNonAcademicScores({
        attendancePunctuality: existing.attendancePunctuality || 3,
        neatnessOrganization: existing.neatnessOrganization || 3,
        respectPoliteness: existing.respectPoliteness || 3,
        participationTeamwork: existing.participationTeamwork || 3,
        responsibility: existing.responsibility || 3
      });
    } else {
      setNonAcademicScores({
        attendancePunctuality: 3,
        neatnessOrganization: 3,
        respectPoliteness: 3,
        participationTeamwork: 3,
        responsibility: 3
      });
    }
    
    setIsRatingDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Teacher Grades & Ratings Interface
          </CardTitle>
          <CardDescription>
            Input academic scores (20+20+60) and non-academic ratings for students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="class-select">Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger data-testid="select-class">
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div>Term: <Badge variant="outline">{currentTerm}</Badge></div>
              <div>Session: <Badge variant="outline">{currentSession}</Badge></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle>Students in Class</CardTitle>
            <CardDescription>
              Click on score cells to input grades, or use the rating button for behavioral assessments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="academic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="academic">Academic Scores</TabsTrigger>
                <TabsTrigger value="behavioral">Behavioral Ratings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="academic" className="space-y-4">
                {studentsLoading || assessmentsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading students and assessments...</p>
                    </div>
                  </div>
                ) : classStudents.length === 0 ? (
                  <div className="text-center p-8">
                    <p className="text-muted-foreground">No students found in this class.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          {subjects.map(subject => (
                            <TableHead key={subject.id} className="text-center min-w-[120px]">
                              {subject.name}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStudents.map(student => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {student.user.firstName} {student.user.lastName}
                            </div>
                          </TableCell>
                          {subjects.map(subject => {
                            const assessment = getStudentAssessment(student.id, subject.id);
                            const total = (assessment?.firstCA || 0) + (assessment?.secondCA || 0) + (assessment?.exam || 0);
                            const gradeInfo = calculateGrade(total);
                            
                            return (
                              <TableCell key={subject.id} className="p-2">
                                {/* Horizontal layout with CA1, CA2, Exam in a row */}
                                <div className="flex items-center gap-2 mb-2">
                                  {/* CA1 Input */}
                                  <div className="flex flex-col items-center">
                                    <span className="text-xs font-medium mb-1">CA1</span>
                                    {editingCell?.studentId === student.id && editingCell?.subjectId === subject.id && editingCell?.field === 'firstCA' ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={tempScores[`${student.id}-${subject.id}-firstCA`] || ""}
                                        onChange={(e) => setTempScores(prev => ({ 
                                          ...prev, 
                                          [`${student.id}-${subject.id}-firstCA`]: e.target.value 
                                        }))}
                                        onKeyDown={(e) => handleKeyPress(e, student.id, subject.id, 'firstCA')}
                                        onBlur={() => {
                                          const key = `${student.id}-${subject.id}-firstCA`;
                                          const value = tempScores[key] || "";
                                          if (value) handleSaveScore(student.id, subject.id, 'firstCA', value);
                                          setEditingCell(null);
                                          setTempScores({});
                                        }}
                                        className="h-7 text-sm w-16 p-1 border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-blue-50 text-center"
                                        autoFocus
                                        data-testid={`input-ca1-${student.id}-${subject.id}`}
                                      />
                                    ) : (
                                      <div 
                                        className={`h-7 w-16 text-sm border rounded p-1 cursor-pointer transition-colors duration-200 flex items-center justify-center font-medium ${
                                          (assessment?.firstCA || 0) >= 16 ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' :
                                          (assessment?.firstCA || 0) >= 12 ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100' :
                                          (assessment?.firstCA || 0) > 0 ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' :
                                          'bg-gray-50 border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-200'
                                        }`}
                                        onClick={() => handleCellEdit(student.id, subject.id, 'firstCA')}
                                        data-testid={`cell-ca1-${student.id}-${subject.id}`}
                                        title={`CA1 Score: ${assessment?.firstCA || 0}/20 - Click to edit`}
                                      >
                                        {assessment?.firstCA || 0}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* CA2 Input */}
                                  <div className="flex flex-col items-center">
                                    <span className="text-xs font-medium mb-1">CA2</span>
                                    {editingCell?.studentId === student.id && editingCell?.subjectId === subject.id && editingCell?.field === 'secondCA' ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={tempScores[`${student.id}-${subject.id}-secondCA`] || ""}
                                        onChange={(e) => setTempScores(prev => ({ 
                                          ...prev, 
                                          [`${student.id}-${subject.id}-secondCA`]: e.target.value 
                                        }))}
                                        onKeyDown={(e) => handleKeyPress(e, student.id, subject.id, 'secondCA')}
                                        onBlur={() => {
                                          const key = `${student.id}-${subject.id}-secondCA`;
                                          const value = tempScores[key] || "";
                                          if (value) handleSaveScore(student.id, subject.id, 'secondCA', value);
                                          setEditingCell(null);
                                          setTempScores({});
                                        }}
                                        className="h-7 text-sm w-16 p-1 border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-blue-50 text-center"
                                        autoFocus
                                        data-testid={`input-ca2-${student.id}-${subject.id}`}
                                      />
                                    ) : (
                                      <div 
                                        className={`h-7 w-16 text-sm border rounded p-1 cursor-pointer transition-colors duration-200 flex items-center justify-center font-medium ${
                                          (assessment?.secondCA || 0) >= 16 ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' :
                                          (assessment?.secondCA || 0) >= 12 ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100' :
                                          (assessment?.secondCA || 0) > 0 ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' :
                                          'bg-gray-50 border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-200'
                                        }`}
                                        onClick={() => handleCellEdit(student.id, subject.id, 'secondCA')}
                                        data-testid={`cell-ca2-${student.id}-${subject.id}`}
                                        title={`CA2 Score: ${assessment?.secondCA || 0}/20 - Click to edit`}
                                      >
                                        {assessment?.secondCA || 0}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Exam Input */}
                                  <div className="flex flex-col items-center">
                                    <span className="text-xs font-medium mb-1">Exam</span>
                                    {editingCell?.studentId === student.id && editingCell?.subjectId === subject.id && editingCell?.field === 'exam' ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={tempScores[`${student.id}-${subject.id}-exam`] || ""}
                                        onChange={(e) => setTempScores(prev => ({ 
                                          ...prev, 
                                          [`${student.id}-${subject.id}-exam`]: e.target.value 
                                        }))}
                                        onKeyDown={(e) => handleKeyPress(e, student.id, subject.id, 'exam')}
                                        onBlur={() => {
                                          const key = `${student.id}-${subject.id}-exam`;
                                          const value = tempScores[key] || "";
                                          if (value) handleSaveScore(student.id, subject.id, 'exam', value);
                                          setEditingCell(null);
                                          setTempScores({});
                                        }}
                                        className="h-7 text-sm w-16 p-1 border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-blue-50 text-center"
                                        autoFocus
                                        data-testid={`input-exam-${student.id}-${subject.id}`}
                                      />
                                    ) : (
                                      <div 
                                        className={`h-7 w-16 text-sm border rounded p-1 cursor-pointer transition-colors duration-200 flex items-center justify-center font-medium ${
                                          (assessment?.exam || 0) >= 48 ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' :
                                          (assessment?.exam || 0) >= 36 ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100' :
                                          (assessment?.exam || 0) > 0 ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' :
                                          'bg-gray-50 border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-200'
                                        }`}
                                        onClick={() => handleCellEdit(student.id, subject.id, 'exam')}
                                        data-testid={`cell-exam-${student.id}-${subject.id}`}
                                        title={`Exam Score: ${assessment?.exam || 0}/60 - Click to edit`}
                                      >
                                        {assessment?.exam || 0}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Total and Grade - Horizontal layout */}
                                <div className="text-center">
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs ${gradeInfo.color} text-white`}
                                  >
                                    {total}% ({gradeInfo.grade})
                                  </Badge>
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="behavioral" className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead className="text-center">Attendance & Punctuality</TableHead>
                        <TableHead className="text-center">Neatness & Organization</TableHead>
                        <TableHead className="text-center">Respect & Politeness</TableHead>
                        <TableHead className="text-center">Participation/Teamwork</TableHead>
                        <TableHead className="text-center">Responsibility</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classStudents.map(student => {
                        const rating = getStudentNonAcademicRating(student.id);
                        
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {student.user.firstName} {student.user.lastName}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">
                                {rating?.attendancePunctuality || 3} - {getRatingText(rating?.attendancePunctuality || 3)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">
                                {rating?.neatnessOrganization || 3} - {getRatingText(rating?.neatnessOrganization || 3)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">
                                {rating?.respectPoliteness || 3} - {getRatingText(rating?.respectPoliteness || 3)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">
                                {rating?.participationTeamwork || 3} - {getRatingText(rating?.participationTeamwork || 3)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">
                                {rating?.responsibility || 3} - {getRatingText(rating?.responsibility || 3)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRatingDialog(student)}
                                data-testid={`rating-button-${student.id}`}
                              >
                                <Star className="h-4 w-4 mr-1" />
                                Rate
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}


    </div>
  );
}