import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocalStudents } from "@/hooks/use-local-students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { AddStudentModal } from "@/components/add-student-modal";
import { StudentRow } from "@/components/student-row";
import { GraduationCap, Plus, Users, TrendingUp, Trophy, AlertTriangle, Search, ChevronDown, User, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Student } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { students, loading, syncStatus } = useLocalStudents();
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { toast } = useToast();

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

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear all local data? This cannot be undone.")) {
      localStorage.clear();
      window.location.reload();
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
              <p className="text-sm text-gray-600">Offline Mode - Data saved locally</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Sync Status */}
            <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-gray-100">
              {syncStatus.isOnline ? (
                <Cloud className="h-4 w-4 text-green-600" />
              ) : (
                <CloudOff className="h-4 w-4 text-gray-500" />
              )}
              <span className="text-sm text-gray-600">
                {syncStatus.isOnline ? "Online" : "Offline"}
              </span>
              {syncStatus.pendingCount > 0 && (
                <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                  {syncStatus.pendingCount} pending
                </span>
              )}
            </div>

            <Button 
              onClick={() => setShowSyncModal(true)}
              variant="outline"
              size="sm"
              className="border-gray-300"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync
            </Button>

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
                      onClick={handleClearData}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Clear All Data
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
      
      {/* Simple Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Sync with Firebase</h3>
            <p className="text-gray-600 mb-4">
              {syncStatus.pendingCount > 0 
                ? `You have ${syncStatus.pendingCount} pending changes. Would you like to sync them to Firebase?`
                : "Your data is up to date. You can still sync to backup your data."
              }
            </p>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowSyncModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast({
                    title: "Sync Feature",
                    description: "Firebase sync will be available once you complete the Firebase setup.",
                  });
                  setShowSyncModal(false);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Sync Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
