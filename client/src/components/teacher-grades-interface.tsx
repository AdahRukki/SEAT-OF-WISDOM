import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { User, Star, Save } from "lucide-react";
import type { 
  StudentWithDetails, 
  NonAcademicRating,
  UpdateNonAcademicRating,
  Class 
} from "@shared/schema";
import { getRatingText } from "@shared/schema";

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
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  
  // Term and Session state - initialize with current values from props
  const [selectedTerm, setSelectedTerm] = useState<string>(currentTerm);
  const [selectedSession, setSelectedSession] = useState<string>(currentSession);

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
    queryKey: ['/api/admin/classes', userSchoolId],
    enabled: !!userSchoolId
  });

  // Fetch available academic sessions
  const { data: academicSessions = [] } = useQuery<{ id: string; sessionYear: string; isActive: boolean }[]>({
    queryKey: ['/api/admin/academic-sessions'],
  });


  const { data: classStudents = [], isLoading: studentsLoading } = useQuery<StudentWithDetails[]>({
    queryKey: [`/api/admin/students/by-class/${selectedClassId}`],
    enabled: !!selectedClassId
  });


  const { data: nonAcademicRatings = [], isLoading: ratingsLoading } = useQuery<NonAcademicRating[]>({
    queryKey: [`/api/admin/non-academic-ratings/${selectedClassId}/${currentTerm}/${currentSession}`],
    enabled: !!selectedClassId
  });

  // Mutations

  const saveNonAcademicRatingMutation = useMutation({
    mutationFn: async (data: UpdateNonAcademicRating) => {
      return apiRequest('/api/admin/non-academic-ratings', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => {
      toast({ description: "Non-academic ratings saved successfully!" });
      // Invalidate the specific ratings query
      queryClient.invalidateQueries({ 
        queryKey: [`/api/admin/non-academic-ratings/${selectedClassId}/${currentTerm}/${currentSession}`] 
      });
      // Also invalidate all non-academic ratings queries to ensure refresh
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().includes('/api/admin/non-academic-ratings')
      });
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
  const getStudentNonAcademicRating = (studentId: string) => {
    return nonAcademicRatings.find(r => r.studentId === studentId);
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
            <User className="h-5 w-5" />
            Teacher Behavioral Ratings Interface
          </CardTitle>
          <CardDescription>
            Input non-academic behavioral ratings for students (1-5 scale)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label htmlFor="term-select">Select Term</Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger data-testid="select-term">
                  <SelectValue placeholder="Choose a term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="First Term">First Term</SelectItem>
                  <SelectItem value="Second Term">Second Term</SelectItem>
                  <SelectItem value="Third Term">Third Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="session-select">Select Session</Label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger data-testid="select-session">
                  <SelectValue placeholder="Choose a session" />
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
          </div>
        </CardContent>
      </Card>

      {selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle>Students in Class</CardTitle>
            <CardDescription>
              Click the rating button to assess student behavioral development
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
            </div>
          </CardContent>
        </Card>
      )}


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
              <Button 
                onClick={handleSaveNonAcademicRating} 
                disabled={saveNonAcademicRatingMutation.isPending}
                data-testid="button-save-ratings"
              >
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