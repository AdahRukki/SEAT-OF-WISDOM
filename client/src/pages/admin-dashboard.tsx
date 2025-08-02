import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, BookOpen, GraduationCap, LogOut } from "lucide-react";
import type { Class, Subject, Student, StudentWithDetails } from "@shared/schema";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);

  // Form states
  const [className, setClassName] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectDescription, setSubjectDescription] = useState("");

  // Student form states
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  // Scores management states
  const [scoresClassId, setScoresClassId] = useState("");
  const [scoresSubjectId, setScoresSubjectId] = useState("");
  const [scoresTerm, setScoresTerm] = useState("First Term");
  const [scoresSession, setScoresSession] = useState("2024/2025");

  // Queries
  const { data: classes = [] } = useQuery<Class[]>({ queryKey: ['/api/admin/classes'] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ['/api/admin/subjects'] });
  const { data: allStudents = [] } = useQuery<StudentWithDetails[]>({ queryKey: ['/api/admin/students'] });
  
  // Class subjects query
  const { data: classSubjects = [] } = useQuery<Subject[]>({ 
    queryKey: ['/api/admin/classes', scoresClassId, 'subjects'],
    enabled: !!scoresClassId 
  });

  // Class assessments query
  const { data: classAssessments = [] } = useQuery<any[]>({ 
    queryKey: ['/api/admin/assessments', scoresClassId, scoresSubjectId, scoresTerm, scoresSession],
    enabled: !!scoresClassId && !!scoresSubjectId
  });

  // Mutations
  const createClassMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiRequest('POST', '/api/admin/classes', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/classes'] });
      setIsClassDialogOpen(false);
      setClassName("");
      setClassDescription("");
      toast({ title: "Success", description: "Class created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create class", variant: "destructive" });
    }
  });

  const createSubjectMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; description?: string }) => {
      const response = await apiRequest('POST', '/api/admin/subjects', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subjects'] });
      setIsSubjectDialogOpen(false);
      setSubjectName("");
      setSubjectCode("");
      setSubjectDescription("");
      toast({ title: "Success", description: "Subject created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create subject", variant: "destructive" });
    }
  });

  const createStudentMutation = useMutation({
    mutationFn: async (data: {
      user: { email: string; password: string; firstName: string; lastName: string; role: string };
      student: { studentId: string; classId: string };
    }) => {
      // First create the user
      const userResponse = await apiRequest('POST', '/api/admin/users', data.user);
      const user = await userResponse.json();
      
      // Then create the student record
      const studentResponse = await apiRequest('POST', '/api/admin/students', {
        ...data.student,
        userId: user.id
      });
      return studentResponse.json();
    },
    onSuccess: () => {
      setIsStudentDialogOpen(false);
      setStudentFirstName("");
      setStudentLastName("");
      setStudentEmail("");
      setStudentPassword("");
      setStudentId("");
      setSelectedClassId("");
      toast({ title: "Success", description: "Student created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create student", variant: "destructive" });
    }
  });

  const handleCreateClass = () => {
    createClassMutation.mutate({
      name: className,
      description: classDescription || undefined
    });
  };

  const handleCreateSubject = () => {
    createSubjectMutation.mutate({
      name: subjectName,
      code: subjectCode,
      description: subjectDescription || undefined
    });
  };

  const handleCreateStudent = () => {
    if (!selectedClassId) {
      toast({ title: "Error", description: "Please select a class", variant: "destructive" });
      return;
    }

    createStudentMutation.mutate({
      user: {
        email: studentEmail,
        password: studentPassword,
        firstName: studentFirstName,
        lastName: studentLastName,
        role: "student"
      },
      student: {
        studentId,
        classId: selectedClassId
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Welcome back, {user?.firstName} {user?.lastName}
                </p>
              </div>
            </div>
            <Button onClick={logout} variant="outline" className="flex items-center space-x-2">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="scores">Manage Scores</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{classes.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{subjects.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Status</CardTitle>
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">Online</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="classes" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Manage Classes</h2>
              <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Class</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Class</DialogTitle>
                    <DialogDescription>Add a new class to the system.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="class-name">Class Name</Label>
                      <Input
                        id="class-name"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="e.g., Grade 5A"
                      />
                    </div>
                    <div>
                      <Label htmlFor="class-description">Description (Optional)</Label>
                      <Input
                        id="class-description"
                        value={classDescription}
                        onChange={(e) => setClassDescription(e.target.value)}
                        placeholder="Class description"
                      />
                    </div>
                    <Button 
                      onClick={handleCreateClass} 
                      disabled={!className || createClassMutation.isPending}
                    >
                      {createClassMutation.isPending ? "Creating..." : "Create Class"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((classItem) => (
                <Card key={classItem.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{classItem.name}</CardTitle>
                    {classItem.description && (
                      <CardDescription>{classItem.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(classItem.createdAt!).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="subjects" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Manage Subjects</h2>
              <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Subject</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Subject</DialogTitle>
                    <DialogDescription>Add a new subject to the system.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="subject-name">Subject Name</Label>
                      <Input
                        id="subject-name"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="e.g., Mathematics"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject-code">Subject Code</Label>
                      <Input
                        id="subject-code"
                        value={subjectCode}
                        onChange={(e) => setSubjectCode(e.target.value)}
                        placeholder="e.g., MATH"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject-description">Description (Optional)</Label>
                      <Input
                        id="subject-description"
                        value={subjectDescription}
                        onChange={(e) => setSubjectDescription(e.target.value)}
                        placeholder="Subject description"
                      />
                    </div>
                    <Button 
                      onClick={handleCreateSubject} 
                      disabled={!subjectName || !subjectCode || createSubjectMutation.isPending}
                    >
                      {createSubjectMutation.isPending ? "Creating..." : "Create Subject"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((subject) => (
                <Card key={subject.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{subject.name}</CardTitle>
                    <CardDescription>Code: {subject.code}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {subject.description && (
                      <p className="text-sm mb-2">{subject.description}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      Created: {new Date(subject.createdAt!).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Manage Students</h2>
              <Dialog open={isStudentDialogOpen} onOpenChange={setIsStudentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Student</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Student</DialogTitle>
                    <DialogDescription>Add a new student to the system.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="student-first-name">First Name</Label>
                        <Input
                          id="student-first-name"
                          value={studentFirstName}
                          onChange={(e) => setStudentFirstName(e.target.value)}
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <Label htmlFor="student-last-name">Last Name</Label>
                        <Input
                          id="student-last-name"
                          value={studentLastName}
                          onChange={(e) => setStudentLastName(e.target.value)}
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="student-email">Email</Label>
                      <Input
                        id="student-email"
                        type="email"
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        placeholder="john.doe@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="student-password">Password</Label>
                      <Input
                        id="student-password"
                        type="password"
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder="student password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="student-id">Student ID</Label>
                      <Input
                        id="student-id"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="STU001"
                      />
                    </div>
                    <div>
                      <Label>Class</Label>
                      <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a class" />
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
                    <Button 
                      onClick={handleCreateStudent} 
                      disabled={
                        !studentFirstName || !studentLastName || !studentEmail || 
                        !studentPassword || !studentId || !selectedClassId || 
                        createStudentMutation.isPending
                      }
                      className="w-full"
                    >
                      {createStudentMutation.isPending ? "Creating..." : "Create Student"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Student Management</CardTitle>
                <CardDescription>
                  Students are organized by class. Select a class to view and manage students.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  Total Classes: {classes.length}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scores" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Manage Student Scores</h2>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Score Entry System</CardTitle>
                <CardDescription>
                  Enter and manage student assessment scores for all subjects and terms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <Label>Select Class</Label>
                    <Select value={scoresClassId} onValueChange={setScoresClassId}>
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
                    <Label>Select Subject</Label>
                    <Select value={scoresSubjectId} onValueChange={setScoresSubjectId} disabled={!scoresClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {classSubjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Term & Session</Label>
                    <Select value={`${scoresTerm}-${scoresSession}`} onValueChange={(value) => {
                      const [term, session] = value.split('-');
                      setScoresTerm(term.replace('_', ' '));
                      setScoresSession(session);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="First Term-2024/2025">First Term 2024/2025</SelectItem>
                        <SelectItem value="Second Term-2024/2025">Second Term 2024/2025</SelectItem>
                        <SelectItem value="Third Term-2024/2025">Third Term 2024/2025</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {scoresClassId && scoresSubjectId ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Student</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Student ID</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">1st CA (30)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">2nd CA (30)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Exam (70)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Total (100)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {allStudents
                          .filter(student => student.classId === scoresClassId)
                          .map((student) => {
                            const assessment = classAssessments.find(a => a.studentId === student.id);
                            const total = assessment ? 
                              Number(assessment.firstCA || 0) + Number(assessment.secondCA || 0) + Number(assessment.exam || 0) : 0;
                            const grade = total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 50 ? 'C' : total >= 40 ? 'D' : 'F';
                            
                            return (
                              <tr key={student.id}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {student.user.firstName} {student.user.lastName}
                                </td>
                                <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                                  {student.studentId}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="30"
                                    className="w-16 h-8 text-center"
                                    defaultValue={assessment?.firstCA || ''}
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="30"
                                    className="w-16 h-8 text-center"
                                    defaultValue={assessment?.secondCA || ''}
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="70"
                                    className="w-16 h-8 text-center"
                                    defaultValue={assessment?.exam || ''}
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900 dark:text-white">
                                  {total}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                    grade === 'A' ? 'bg-green-500' : 
                                    grade === 'B' ? 'bg-blue-500' : 
                                    grade === 'C' ? 'bg-yellow-500' : 
                                    grade === 'D' ? 'bg-orange-500' : 'bg-red-500'
                                  } text-white`}>
                                    {grade}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        }
                      </tbody>
                    </table>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800">
                      <Button className="w-full">
                        Save All Scores
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Select Class and Subject
                    </h3>
                    <p className="text-gray-500">
                      Choose a class and subject above to view and manage student scores.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}