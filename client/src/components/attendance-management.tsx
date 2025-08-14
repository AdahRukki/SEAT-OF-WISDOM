import { useState, useEffect } from "react";
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
  const [totalDaysForClass, setTotalDaysForClass] = useState<number>(0);
  const [attendanceInputs, setAttendanceInputs] = useState<Record<string, { presentDays: number }>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch classes for the selected school
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ["/api/admin/classes", selectedSchoolId],
    enabled: !!selectedSchoolId,
  });

  // Fetch students in selected class
  const { data: studentsInClass = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["/api/admin/students", "by-class", selectedClassId],
    queryFn: () => apiRequest(`/api/admin/students?classId=${selectedClassId}`),
    enabled: !!selectedClassId,
  });

  // Fetch current academic info
  const { data: academicInfo } = useQuery({
    queryKey: ["/api/current-academic-info"],
  });

  // Fetch existing attendance records for the class
  const { data: existingAttendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["/api/admin/attendance/class", selectedClassId, selectedTerm, selectedSession],
    queryFn: () => apiRequest(`/api/admin/attendance/class/${selectedClassId}?term=${encodeURIComponent(selectedTerm)}&session=${encodeURIComponent(selectedSession)}`),
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

  const handlePresentDaysChange = (studentId: string, presentDays: number) => {
    setAttendanceInputs(prev => ({
      ...prev,
      [studentId]: { presentDays: Math.max(0, Math.min(presentDays, totalDaysForClass)) }
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

    if (totalDaysForClass <= 0) {
      toast({
        title: "Error",
        description: "Please enter total days for the class",
        variant: "destructive",
      });
      return;
    }

    const attendance = attendanceInputs[studentId];
    if (!attendance) {
      toast({
        title: "Error",
        description: "Please enter attendance data for this student",
        variant: "destructive",
      });
      return;
    }

    const absentDays = totalDaysForClass - attendance.presentDays;

    await recordAttendanceMutation.mutateAsync({
      studentId,
      classId: selectedClassId,
      term: selectedTerm,
      session: selectedSession,
      totalDays: totalDaysForClass,
      presentDays: attendance.presentDays,
      absentDays: absentDays,
    });
  };

  const getExistingAttendanceForStudent = (studentId: string): AttendanceWithStudent | undefined => {
    return (existingAttendance as AttendanceWithStudent[]).find((att: AttendanceWithStudent) => att.studentId === studentId);
  };

  // Effect to set total days from existing records or reset when class/term/session changes
  useEffect(() => {
    if (existingAttendance && (existingAttendance as AttendanceWithStudent[]).length > 0) {
      const firstRecord = (existingAttendance as AttendanceWithStudent[])[0];
      setTotalDaysForClass(firstRecord.totalDays);
    } else {
      setTotalDaysForClass(0);
    }
  }, [existingAttendance, selectedClassId, selectedTerm, selectedSession]);

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
            <div className="space-y-6">
              {/* Total Days Input for the Class */}
              <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <Label className="font-medium text-blue-900 dark:text-blue-100">
                    Total School Days for {selectedTerm} {selectedSession}
                  </Label>
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="1"
                    max="200"
                    value={totalDaysForClass}
                    onChange={(e) => setTotalDaysForClass(parseInt(e.target.value) || 0)}
                    placeholder="Enter total days (e.g., 65)"
                    className="max-w-48"
                  />
                  <p className="text-sm text-muted-foreground">
                    This applies to all students in the class
                  </p>
                </div>
              </Card>

              {/* Individual Student Present Days */}
              {totalDaysForClass > 0 && (
                <div className="grid gap-4">
                  <h4 className="font-medium text-lg">Student Attendance (Present Days)</h4>
                  {(studentsInClass as StudentWithDetails[]).map((student: StudentWithDetails) => {
                    const existingRecord = getExistingAttendanceForStudent(student.id);
                    const currentInput = attendanceInputs[student.id] || {
                      presentDays: existingRecord?.presentDays || 0,
                    };
                    const absentDays = totalDaysForClass - currentInput.presentDays;

                    return (
                      <Card key={student.id} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-medium">{student.user.firstName} {student.user.lastName}</h4>
                            <p className="text-sm text-muted-foreground">ID: {student.studentId}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={calculateAttendancePercentage(currentInput.presentDays, totalDaysForClass) >= 75 ? "default" : "destructive"}>
                              {calculateAttendancePercentage(currentInput.presentDays, totalDaysForClass).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <Label htmlFor={`present-${student.id}`}>Present Days</Label>
                            <Input
                              id={`present-${student.id}`}
                              type="number"
                              min="0"
                              max={totalDaysForClass}
                              value={currentInput.presentDays}
                              onChange={(e) => handlePresentDaysChange(student.id, parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label>Absent Days</Label>
                            <div className="flex items-center h-10 px-3 py-2 border border-input bg-muted rounded-md text-sm">
                              {absentDays}
                            </div>
                          </div>
                          <div>
                            <Label>Total Days</Label>
                            <div className="flex items-center h-10 px-3 py-2 border border-input bg-muted rounded-md text-sm">
                              {totalDaysForClass}
                            </div>
                          </div>
                        </div>

                        <Button 
                          onClick={() => handleSubmitAttendance(student.id)}
                          disabled={recordAttendanceMutation.isPending}
                          className="w-full"
                        >
                          {recordAttendanceMutation.isPending ? "Saving..." : "Save Attendance"}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}

              {totalDaysForClass <= 0 && (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Please enter the total school days first</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}