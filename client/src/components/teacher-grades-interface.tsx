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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);

  // Form state for academic scores
  const [academicScores, setAcademicScores] = useState({
    firstCA: "",
    secondCA: "",
    exam: ""
  });

  // Form state for non-academic ratings
  const [nonAcademicScores, setNonAcademicScores] = useState({
    attendancePunctuality: 3,
    neatnessOrganization: 3,
    respectPoliteness: 3,
    participationTeamwork: 3,
    responsibility: 3
  });

  // Queries
  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ['/api/classes', userSchoolId],
    enabled: !!userSchoolId
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects']
  });

  const { data: classStudents = [] } = useQuery<StudentWithDetails[]>({
    queryKey: ['/api/students/by-class', selectedClassId],
    enabled: !!selectedClassId
  });

  const { data: assessments = [] } = useQuery<(Assessment & { subject: Subject })[]>({
    queryKey: ['/api/assessments', selectedClassId, currentTerm, currentSession],
    enabled: !!selectedClassId
  });

  const { data: nonAcademicRatings = [] } = useQuery<NonAcademicRating[]>({
    queryKey: ['/api/non-academic-ratings', selectedClassId, currentTerm, currentSession],
    enabled: !!selectedClassId
  });

  // Mutations
  const saveAcademicScoreMutation = useMutation({
    mutationFn: async (data: AddScore) => {
      return apiRequest('/api/assessments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ description: "Academic scores saved successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/assessments'] });
      setIsGradeDialogOpen(false);
      setAcademicScores({ firstCA: "", secondCA: "", exam: "" });
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
      return apiRequest('/api/non-academic-ratings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ description: "Non-academic ratings saved successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/non-academic-ratings'] });
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

  const handleSaveAcademicScore = () => {
    if (!selectedStudent || !selectedSubjectId) return;
    
    const firstCA = parseInt(academicScores.firstCA) || 0;
    const secondCA = parseInt(academicScores.secondCA) || 0;
    const exam = parseInt(academicScores.exam) || 0;
    
    // Validation
    if (firstCA < 0 || firstCA > 20) {
      toast({ description: "First CA must be between 0 and 20", variant: "destructive" });
      return;
    }
    if (secondCA < 0 || secondCA > 20) {
      toast({ description: "Second CA must be between 0 and 20", variant: "destructive" });
      return;
    }
    if (exam < 0 || exam > 60) {
      toast({ description: "Exam score must be between 0 and 60", variant: "destructive" });
      return;
    }

    saveAcademicScoreMutation.mutate({
      studentId: selectedStudent.id,
      subjectId: selectedSubjectId,
      classId: selectedClassId,
      term: currentTerm,
      session: currentSession,
      firstCA,
      secondCA,
      exam
    });
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

  const openGradeDialog = (student: StudentWithDetails, subjectId: string) => {
    setSelectedStudent(student);
    setSelectedSubjectId(subjectId);
    
    // Pre-fill with existing scores if available
    const existing = getStudentAssessment(student.id, subjectId);
    if (existing) {
      setAcademicScores({
        firstCA: existing.firstCA?.toString() || "",
        secondCA: existing.secondCA?.toString() || "",
        exam: existing.exam?.toString() || ""
      });
    } else {
      setAcademicScores({ firstCA: "", secondCA: "", exam: "" });
    }
    
    setIsGradeDialogOpen(true);
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
                              <TableCell key={subject.id} className="text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openGradeDialog(student, subject.id)}
                                  className="w-full"
                                  data-testid={`grade-button-${student.id}-${subject.id}`}
                                >
                                  {assessment ? (
                                    <div className="space-y-1">
                                      <div className="text-xs">
                                        {assessment.firstCA || 0}+{assessment.secondCA || 0}+{assessment.exam || 0}
                                      </div>
                                      <Badge 
                                        variant="secondary" 
                                        className={`text-xs ${gradeInfo.color} text-white`}
                                      >
                                        {total}% ({gradeInfo.grade})
                                      </Badge>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">Add Score</span>
                                  )}
                                </Button>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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

      {/* Academic Score Input Dialog */}
      <Dialog open={isGradeDialogOpen} onOpenChange={setIsGradeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Input Academic Scores</DialogTitle>
            <DialogDescription>
              Enter scores for {selectedStudent?.user.firstName} {selectedStudent?.user.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="first-ca">First CA (out of 20)</Label>
              <Input
                id="first-ca"
                type="number"
                min="0"
                max="20"
                value={academicScores.firstCA}
                onChange={(e) => setAcademicScores(prev => ({ ...prev, firstCA: e.target.value }))}
                placeholder="0-20"
                data-testid="input-first-ca"
              />
            </div>
            <div>
              <Label htmlFor="second-ca">Second CA (out of 20)</Label>
              <Input
                id="second-ca"
                type="number"
                min="0"
                max="20"
                value={academicScores.secondCA}
                onChange={(e) => setAcademicScores(prev => ({ ...prev, secondCA: e.target.value }))}
                placeholder="0-20"
                data-testid="input-second-ca"
              />
            </div>
            <div>
              <Label htmlFor="exam">Exam (out of 60)</Label>
              <Input
                id="exam"
                type="number"
                min="0"
                max="60"
                value={academicScores.exam}
                onChange={(e) => setAcademicScores(prev => ({ ...prev, exam: e.target.value }))}
                placeholder="0-60"
                data-testid="input-exam"
              />
            </div>
            
            {/* Preview calculation */}
            {(academicScores.firstCA || academicScores.secondCA || academicScores.exam) && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calculator className="h-4 w-4" />
                  Preview
                </div>
                <div className="mt-2 text-sm">
                  {(() => {
                    const total = (parseInt(academicScores.firstCA) || 0) + 
                                  (parseInt(academicScores.secondCA) || 0) + 
                                  (parseInt(academicScores.exam) || 0);
                    const gradeInfo = calculateGrade(total);
                    return (
                      <div>
                        Total: {total}/100 | Grade: <Badge className={gradeInfo.color}>{gradeInfo.grade}</Badge> | {gradeInfo.remark}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsGradeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAcademicScore} disabled={saveAcademicScoreMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {saveAcademicScoreMutation.isPending ? "Saving..." : "Save Scores"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Non-Academic Rating Dialog */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Non-Academic Ratings</DialogTitle>
            <DialogDescription>
              Rate {selectedStudent?.user.firstName} {selectedStudent?.user.lastName} on behavioral aspects (1-5 scale)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {[
              { key: 'attendancePunctuality', label: 'Attendance & Punctuality' },
              { key: 'neatnessOrganization', label: 'Neatness & Organization' },
              { key: 'respectPoliteness', label: 'Respect & Politeness' },
              { key: 'participationTeamwork', label: 'Participation/Teamwork' },
              { key: 'responsibility', label: 'Responsibility' }
            ].map(({ key, label }) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Select 
                  value={nonAcademicScores[key as keyof typeof nonAcademicScores].toString()} 
                  onValueChange={(value) => setNonAcademicScores(prev => ({ 
                    ...prev, 
                    [key]: parseInt(value) 
                  }))}
                >
                  <SelectTrigger data-testid={`select-${key}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(rating => (
                      <SelectItem key={rating} value={rating.toString()}>
                        {rating} - {getRatingText(rating)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRatingDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNonAcademicRating} disabled={saveNonAcademicRatingMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {saveNonAcademicRatingMutation.isPending ? "Saving..." : "Save Ratings"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}