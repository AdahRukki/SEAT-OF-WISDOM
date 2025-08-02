import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { AddStudentModal } from "@/components/add-student-modal";
import { StudentRow } from "@/components/student-row";
import { GraduationCap, Plus, Users, TrendingUp, Trophy, AlertTriangle, Search, ChevronDown, User } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Student } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "students"), orderBy("name"));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const studentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Student[];
        
        setStudents(studentsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching students:", error);
        toast({
          title: "Error",
          description: "Failed to load students. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, toast]);

  useEffect(() => {
    let filtered = [...students];

    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    switch (sortBy) {
      case "name":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "score":
        filtered.sort((a, b) => {
          const avgA = a.scores.length > 0 ? a.scores.reduce((sum, score) => sum + score, 0) / a.scores.length : 0;
          const avgB = b.scores.length > 0 ? b.scores.reduce((sum, score) => sum + score, 0) / b.scores.length : 0;
          return avgB - avgA;
        });
        break;
      case "class":
        filtered.sort((a, b) => a.class.localeCompare(b.class));
        break;
    }

    setFilteredStudents(filtered);
  }, [students, searchTerm, sortBy]);

  const stats = {
    totalStudents: students.length,
    averageScore: students.length > 0 
      ? students.reduce((sum, student) => {
          const avg = student.scores.length > 0 ? student.scores.reduce((s, score) => s + score, 0) / student.scores.length : 0;
          return sum + avg;
        }, 0) / students.length
      : 0,
    topScore: students.reduce((max, student) => {
      const studentMax = student.scores.length > 0 ? Math.max(...student.scores) : 0;
      return Math.max(max, studentMax);
    }, 0),
    studentsNeedingHelp: students.filter(student => {
      const avg = student.scores.length > 0 ? student.scores.reduce((sum, score) => sum + score, 0) / student.scores.length : 0;
      return avg < 70;
    }).length,
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-blue-600 rounded-lg w-10 h-10 flex items-center justify-center mr-3">
              <GraduationCap className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Student Score Tracker</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.email}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
            
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <ChevronDown className="h-3 w-3" />
              </Button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="text-blue-600 h-5 w-5" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-green-600 h-5 w-5" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.averageScore.toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Trophy className="text-yellow-600 h-5 w-5" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Top Score</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.topScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="text-red-600 h-5 w-5" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Need Help</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.studentsNeedingHelp}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Students Table */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Students</h2>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2"
                  />
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort by Name</SelectItem>
                    <SelectItem value="score">Sort by Score</SelectItem>
                    <SelectItem value="class">Sort by Class</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Latest Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Average
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      {searchTerm ? "No students found matching your search." : "No students added yet. Click 'Add Student' to get started."}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <StudentRow key={student.id} student={student} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      <AddStudentModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />
    </div>
  );
}
