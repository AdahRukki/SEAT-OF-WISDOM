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
import { Star, Save, Users } from "lucide-react";
import type { 
  StudentWithDetails, 
  NonAcademicRating,
  UpdateNonAcademicRating,
  Class 
} from "@shared/schema";
import { getRatingText } from "@shared/schema";

interface BehavioralRatingsInterfaceProps {
  currentTerm: string;
  currentSession: string;
  userSchoolId?: string;
}

export function BehavioralRatingsInterface({ 
  currentTerm, 
  currentSession, 
  userSchoolId 
}: BehavioralRatingsInterfaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);

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
      toast({ description: "Behavioral ratings saved successfully!" });
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
        description: error.message || "Failed to save behavioral ratings",
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
    
    const ratingData: UpdateNonAcademicRating = {
      classId: selectedClassId,
      studentId: selectedStudent.id,
      term: currentTerm,
      session: currentSession,
      attendancePunctuality: nonAcademicScores.attendancePunctuality,
      neatnessOrganization: nonAcademicScores.neatnessOrganization,
      respectPoliteness: nonAcademicScores.respectPoliteness,
      participationTeamwork: nonAcademicScores.participationTeamwork,
      responsibility: nonAcademicScores.responsibility
    };

    saveNonAcademicRatingMutation.mutate(ratingData);
  };

  const openRatingDialog = (student: StudentWithDetails) => {
    setSelectedStudent(student);
    const existingRating = getStudentNonAcademicRating(student.id);
    
    if (existingRating) {
      setNonAcademicScores({
        attendancePunctuality: existingRating.attendancePunctuality,
        neatnessOrganization: existingRating.neatnessOrganization,
        respectPoliteness: existingRating.respectPoliteness,
        participationTeamwork: existingRating.participationTeamwork,
        responsibility: existingRating.responsibility
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

  if (!userSchoolId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Behavioral Ratings Interface</span>
          </CardTitle>
          <CardDescription>
            Please select a school to manage behavioral ratings
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Star className="h-5 w-5" />
            <span>Behavioral Ratings Interface</span>
          </CardTitle>
          <CardDescription>
            Rate student behavior across 5 key areas (1-5 scale)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Label htmlFor="classSelect">Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} data-testid="select-class">
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class to rate students" />
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
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div>Term: <strong>{currentTerm}</strong></div>
              <div>Session: <strong>{currentSession}</strong></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      {selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle>Students in Class</CardTitle>
            <CardDescription>
              Click on a student to rate their behavioral performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {studentsLoading || ratingsLoading ? (
              <div className="text-center py-8">Loading students and ratings...</div>
            ) : classStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No students found in this class
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Attendance & Punctuality</TableHead>
                      <TableHead>Neatness & Organization</TableHead>
                      <TableHead>Respect & Politeness</TableHead>
                      <TableHead>Participation/Teamwork</TableHead>
                      <TableHead>Responsibility</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classStudents.map((student) => {
                      const rating = getStudentNonAcademicRating(student.id);
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">
                            {student.user.firstName} {student.user.lastName}
                          </TableCell>
                          <TableCell>
                            <Badge variant={rating ? "default" : "secondary"}>
                              {rating ? `${rating.attendancePunctuality}/5` : "Not Rated"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rating ? "default" : "secondary"}>
                              {rating ? `${rating.neatnessOrganization}/5` : "Not Rated"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rating ? "default" : "secondary"}>
                              {rating ? `${rating.respectPoliteness}/5` : "Not Rated"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rating ? "default" : "secondary"}>
                              {rating ? `${rating.participationTeamwork}/5` : "Not Rated"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rating ? "default" : "secondary"}>
                              {rating ? `${rating.responsibility}/5` : "Not Rated"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => openRatingDialog(student)}
                              data-testid={`button-rate-${student.id}`}
                            >
                              <Star className="h-4 w-4 mr-2" />
                              Rate
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rating Dialog */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rate Behavioral Performance</DialogTitle>
            <DialogDescription>
              {selectedStudent && `Rating for ${selectedStudent.user.firstName} ${selectedStudent.user.lastName}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Attendance & Punctuality */}
            <div>
              <Label>Attendance & Punctuality</Label>
              <Select 
                value={nonAcademicScores.attendancePunctuality.toString()} 
                onValueChange={(value) => setNonAcademicScores(prev => ({...prev, attendancePunctuality: parseInt(value)}))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating}/5 - {getRatingText(rating)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Neatness & Organization */}
            <div>
              <Label>Neatness & Organization</Label>
              <Select 
                value={nonAcademicScores.neatnessOrganization.toString()} 
                onValueChange={(value) => setNonAcademicScores(prev => ({...prev, neatnessOrganization: parseInt(value)}))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating}/5 - {getRatingText(rating)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Respect & Politeness */}
            <div>
              <Label>Respect & Politeness</Label>
              <Select 
                value={nonAcademicScores.respectPoliteness.toString()} 
                onValueChange={(value) => setNonAcademicScores(prev => ({...prev, respectPoliteness: parseInt(value)}))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating}/5 - {getRatingText(rating)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Participation/Teamwork */}
            <div>
              <Label>Participation/Teamwork</Label>
              <Select 
                value={nonAcademicScores.participationTeamwork.toString()} 
                onValueChange={(value) => setNonAcademicScores(prev => ({...prev, participationTeamwork: parseInt(value)}))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating}/5 - {getRatingText(rating)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Responsibility */}
            <div>
              <Label>Responsibility</Label>
              <Select 
                value={nonAcademicScores.responsibility.toString()} 
                onValueChange={(value) => setNonAcademicScores(prev => ({...prev, responsibility: parseInt(value)}))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating}/5 - {getRatingText(rating)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={() => setIsRatingDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveNonAcademicRating}
                disabled={saveNonAcademicRatingMutation.isPending}
                data-testid="button-save-rating"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveNonAcademicRatingMutation.isPending ? "Saving..." : "Save Rating"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}