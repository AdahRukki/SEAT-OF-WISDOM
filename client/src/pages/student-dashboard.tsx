import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, LogOut, BookOpen, Trophy, User, Printer } from "lucide-react";
import logoImage from "@assets/4oWHptM_1754171230437.gif";
import type { StudentWithDetails, Assessment, Subject } from "@shared/schema";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [selectedTerm, setSelectedTerm] = useState("First Term");
  const [selectedSession, setSelectedSession] = useState("2024/2025");

  // Queries
  const { data: profile } = useQuery<StudentWithDetails>({ 
    queryKey: ['/api/student/profile'] 
  });

  const { data: assessments = [] } = useQuery<(Assessment & { subject: Subject })[]>({ 
    queryKey: ['/api/student/assessments'],
    enabled: !!profile
  });

  const calculateGrade = (total: number) => {
    if (total >= 80) return { grade: 'A', color: 'bg-green-500' };
    if (total >= 60) return { grade: 'B', color: 'bg-blue-500' };
    if (total >= 50) return { grade: 'C', color: 'bg-yellow-500' };
    if (total >= 40) return { grade: 'D', color: 'bg-orange-500' };
    return { grade: 'F', color: 'bg-red-500' };
  };

  const calculateOverallAverage = () => {
    if (assessments.length === 0) return 0;
    const total = assessments.reduce((acc, assessment) => acc + Number(assessment.total), 0);
    return Math.round(total / assessments.length);
  };

  const overallAverage = calculateOverallAverage();
  const overallGrade = calculateGrade(overallAverage);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div>
                <div className="flex items-center space-x-3">
                  <img 
                    src={logoImage} 
                    alt="Seat of Wisdom Academy Logo" 
                    className="h-8 w-8 object-contain rounded-md flex-shrink-0" 
                  />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Seat of Wisdom Academy</h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 ml-11">
                  Welcome back, <a 
                    href="/profile"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    {user?.firstName} {user?.lastName}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <a 
                href="/profile"
                className="flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors text-sm"
              >
                <User className="h-4 w-4" />
                <span>Profile</span>
              </a>
              <Button 
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }} 
                variant="outline" 
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="scores">My Scores</TabsTrigger>
            <TabsTrigger value="report">Report Card</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overall Average</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overallAverage}%</div>
                  <Badge className={`${overallGrade.color} text-white mt-2`}>
                    Grade {overallGrade.grade}
                  </Badge>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assessments.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Class</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{profile?.class?.name || 'N/A'}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Student ID</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">{profile?.studentId || 'N/A'}</div>
                </CardContent>
              </Card>
            </div>

            {/* Academic Progress Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Academic Progress</CardTitle>
                <CardDescription>Your performance across all subjects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assessments.map((assessment) => {
                    const total = Number(assessment.total);
                    const { grade, color } = calculateGrade(total);
                    return (
                      <div key={assessment.id} className="flex items-center space-x-4">
                        <div className="w-24 text-sm font-medium">
                          {assessment.subject.name}
                        </div>
                        <div className="flex-1">
                          <Progress value={total} className="h-2" />
                        </div>
                        <div className="w-16 text-right text-sm font-medium">
                          {total}%
                        </div>
                        <Badge className={`${color} text-white w-8 text-center`}>
                          {grade}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scores" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">My Assessment Scores</h2>
              <div className="flex space-x-4">
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Term">First Term</SelectItem>
                    <SelectItem value="Second Term">Second Term</SelectItem>
                    <SelectItem value="Third Term">Third Term</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024/2025">2024/2025</SelectItem>
                    <SelectItem value="2023/2024">2023/2024</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6">
              {assessments.map((assessment) => {
                const total = Number(assessment.total);
                const { grade, color } = calculateGrade(total);
                return (
                  <Card key={assessment.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{assessment.subject.name}</CardTitle>
                          <CardDescription>Subject Code: {assessment.subject.code}</CardDescription>
                        </div>
                        <Badge className={`${color} text-white`}>
                          Grade {grade}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">First CA</p>
                          <p className="text-2xl font-bold">{assessment.firstCA || '0'}</p>
                          <p className="text-xs text-gray-500">out of 30</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Second CA</p>
                          <p className="text-2xl font-bold">{assessment.secondCA || '0'}</p>
                          <p className="text-xs text-gray-500">out of 30</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Exam</p>
                          <p className="text-2xl font-bold">{assessment.exam || '0'}</p>
                          <p className="text-xs text-gray-500">out of 70</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Total</p>
                          <p className="text-3xl font-bold text-blue-600">{total}</p>
                          <p className="text-xs text-gray-500">out of 100</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Progress value={total} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {assessments.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Scores Available
                    </h3>
                    <p className="text-gray-500">
                      Your assessment scores will appear here once they are recorded.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="report" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Report Card</CardTitle>
                    <CardDescription>
                      Your comprehensive academic report for {selectedTerm}, {selectedSession}
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => window.print()} 
                    className="no-print"
                    variant="outline"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="report-card">
                <div className="space-y-6">
                  {/* School Header for Print */}
                  <div className="hidden print-only">
                    <h1 className="text-center text-2xl font-bold mb-4">STUDENT REPORT CARD</h1>
                    <div className="text-center mb-6">
                      <p className="text-lg font-semibold">Academic Session: {selectedSession}</p>
                      <p className="text-lg font-semibold">Term: {selectedTerm}</p>
                    </div>
                  </div>

                  {/* Student Info */}
                  <div className="student-info grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">Student Name</p>
                      <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Student ID</p>
                      <p className="font-semibold">{profile?.studentId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Class</p>
                      <p className="font-semibold">{profile?.class?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Term</p>
                      <p className="font-semibold">{selectedTerm}, {selectedSession}</p>
                    </div>
                  </div>

                  {/* Grades Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Subject</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">1st CA</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">2nd CA</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Exam</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Total</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {assessments.map((assessment) => {
                          const total = Number(assessment.total);
                          const { grade } = calculateGrade(total);
                          return (
                            <tr key={assessment.id}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {assessment.subject.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                                {assessment.firstCA || '0'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                                {assessment.secondCA || '0'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                                {assessment.exam || '0'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900 dark:text-white">
                                {total}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`grade-badge inline-block px-2 py-1 rounded text-xs font-medium ${calculateGrade(total).color} text-white`}>
                                  {grade}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="summary grid grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Overall Average</p>
                      <p className="text-2xl font-bold text-blue-600">{overallAverage}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Overall Grade</p>
                      <Badge className={`${overallGrade.color} text-white text-lg`}>
                        {overallGrade.grade}
                      </Badge>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Subjects</p>
                      <p className="text-2xl font-bold text-blue-600">{assessments.length}</p>
                    </div>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Profile</CardTitle>
                <CardDescription>Your student information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                      <p className="text-lg font-semibold">{user?.firstName} {user?.lastName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Email</Label>
                      <p className="text-lg">{user?.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Student ID</Label>
                      <p className="text-lg font-semibold">{profile?.studentId}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Class</Label>
                      <p className="text-lg font-semibold">{profile?.class?.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Account Status</Label>
                      <Badge className="bg-green-500 text-white">Active</Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Joined</Label>
                      <p className="text-lg">
                        {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}