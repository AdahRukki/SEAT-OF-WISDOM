import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Calendar, Check, X } from "lucide-react";
import type { Class, Attendance, StudentWithDetails } from "@shared/schema";

interface AttendanceWithStudent extends Attendance {
  student: StudentWithDetails;
}

interface AttendanceManagementProps {
  selectedSchoolId?: string;
}

export function AttendanceManagement({ selectedSchoolId }: AttendanceManagementProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [attendanceInputs, setAttendanceInputs] = useState<Record<string, { totalDays: number; presentDays: number; absentDays: number }>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch classes for the selected school
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ["/api/admin/classes", selectedSchoolId],
    enabled: !!selectedSchoolId,
  });

  // Fetch students in selected class
  const { data: studentsInClass = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["/api/admin/classes", selectedClassId, "students"],
    enabled: !!selectedClassId,
  });

  // Fetch current academic info
  const { data: academicInfo } = useQuery({
    queryKey: ["/api/current-academic-info"],
  });

  // Fetch existing attendance records for the class
  const { data: existingAttendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["/api/admin/attendance/class", selectedClassId, selectedTerm, selectedSession],
    enabled: !!(selectedClassId && selectedTerm && selectedSession),
  });

  // Record attendance mutation
  const recordAttendanceMutation = useMutation({
    mutationFn: async (attendanceData: {
      studentId: string;
      classId: string;
      term: string;
      session: string;
      totalDays: number;
      presentDays: number;
      absentDays: number;
    }) => {
      return apiRequest("/api/admin/attendance", {
        method: "POST",
        body: JSON.stringify(attendanceData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attendance"] });
      toast({
        title: "Success",
        description: "Attendance recorded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record attendance",
        variant: "destructive",
      });
    },
  });

  const handleAttendanceChange = (studentId: string, field: 'totalDays' | 'presentDays' | 'absentDays', value: number) => {
    setAttendanceInputs(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
        // Auto-calculate absent days when total and present are provided
        ...(field === 'totalDays' || field === 'presentDays' ? {
          absentDays: field === 'totalDays' 
            ? Math.max(0, value - (prev[studentId]?.presentDays || 0))
            : Math.max(0, (prev[studentId]?.totalDays || 0) - value)
        } : {})
      }
    }));
  };

  const handleSubmitAttendance = async (studentId: string) => {
    if (!selectedClassId || !selectedTerm || !selectedSession) {
      toast({
        title: "Error",
        description: "Please select class, term, and session",
        variant: "destructive",
      });
      return;
    }

    const attendance = attendanceInputs[studentId];
    if (!attendance || attendance.totalDays <= 0) {
      toast({
        title: "Error",
        description: "Please enter valid attendance data",
        variant: "destructive",
      });
      return;
    }

    await recordAttendanceMutation.mutateAsync({
      studentId,
      classId: selectedClassId,
      term: selectedTerm,
      session: selectedSession,
      totalDays: attendance.totalDays,
      presentDays: attendance.presentDays,
      absentDays: attendance.absentDays,
    });
  };

  const getExistingAttendanceForStudent = (studentId: string): AttendanceWithStudent | undefined => {
    return (existingAttendance as AttendanceWithStudent[]).find((att: AttendanceWithStudent) => att.studentId === studentId);
  };

  const calculateAttendancePercentage = (present: number, total: number): number => {
    return total > 0 ? Math.round((present / total) * 100) : 0;
  };

  const getAttendanceBadgeVariant = (percentage: number) => {
    if (percentage >= 90) return "default"; // Green
    if (percentage >= 75) return "secondary"; // Blue
    if (percentage >= 60) return "outline"; // Orange
    return "destructive"; // Red
  };

  if (!selectedSchoolId) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Please select a school to manage attendance</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Class</Label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {(classes as Class[]).map((cls: Class) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
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
              <SelectItem value="2023/2024">2023/2024</SelectItem>
              <SelectItem value="2024/2025">2024/2025</SelectItem>
              <SelectItem value="2025/2026">2025/2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedClassId && selectedTerm && selectedSession && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <h3 className="text-lg font-semibold">
              Attendance Management - {(classes as Class[]).find((c: Class) => c.id === selectedClassId)?.name} ({selectedTerm} {selectedSession})
            </h3>
          </div>

          {studentsLoading || attendanceLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading students and attendance data...</span>
            </div>
          ) : (studentsInClass as StudentWithDetails[]).length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No students found in this class</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {(studentsInClass as StudentWithDetails[]).map((student: StudentWithDetails) => {
                const existingRecord = getExistingAttendanceForStudent(student.id);
                const currentInput = attendanceInputs[student.id] || {
                  totalDays: existingRecord?.totalDays || 0,
                  presentDays: existingRecord?.presentDays || 0,
                  absentDays: existingRecord?.absentDays || 0
                };
                const percentage = calculateAttendancePercentage(currentInput.presentDays, currentInput.totalDays);

                return (
                  <Card key={student.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {student.user.firstName} {student.user.lastName}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Student ID: {student.studentId}
                          </p>
                        </div>
                        {existingRecord && (
                          <div className="flex items-center gap-2">
                            <Badge variant={getAttendanceBadgeVariant(percentage)}>
                              {percentage}%
                            </Badge>
                            <Check className="h-4 w-4 text-green-600" />
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs">Total Days</Label>
                          <Input
                            type="number"
                            min="0"
                            max="200"
                            value={currentInput.totalDays}
                            onChange={(e) => handleAttendanceChange(student.id, 'totalDays', Number(e.target.value))}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Present Days</Label>
                          <Input
                            type="number"
                            min="0"
                            max={currentInput.totalDays}
                            value={currentInput.presentDays}
                            onChange={(e) => handleAttendanceChange(student.id, 'presentDays', Number(e.target.value))}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Absent Days</Label>
                          <Input
                            type="number"
                            value={currentInput.absentDays}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Attendance: {percentage}%
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSubmitAttendance(student.id)}
                          disabled={recordAttendanceMutation.isPending}
                        >
                          {recordAttendanceMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : existingRecord ? (
                            "Update"
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}