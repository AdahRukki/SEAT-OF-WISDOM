import { useState, useEffect, useContext, createContext } from "react";
import { Student, InsertStudent } from "@shared/schema";
import { 
  getLocalData, 
  addStudent as addStudentToStorage, 
  updateStudent as updateStudentInStorage,
  addScore as addScoreToStorage,
  deleteStudent as deleteStudentFromStorage,
  getSyncStatus
} from "@/lib/storage";
import type { SyncStatus } from "@/lib/storage";

interface StudentsContextType {
  students: Student[];
  loading: boolean;
  syncStatus: SyncStatus;
  addStudent: (student: InsertStudent) => Promise<Student>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<Student | null>;
  addScore: (studentId: string, score: number) => Promise<Student | null>;
  deleteStudent: (id: string) => Promise<boolean>;
  refreshStudents: () => void;
  refreshSyncStatus: () => void;
}

const StudentsContext = createContext<StudentsContextType | null>(null);

export function StudentsProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    lastSyncDate: null,
    pendingCount: 0
  });

  const refreshStudents = () => {
    const data = getLocalData();
    setStudents(data.students);
  };

  const refreshSyncStatus = () => {
    const status = getSyncStatus();
    setSyncStatus(status);
  };

  // Load initial data
  useEffect(() => {
    refreshStudents();
    refreshSyncStatus();
    setLoading(false);
  }, []);

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
    };
    
    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addStudent = async (studentData: InsertStudent): Promise<Student> => {
    const newStudent = addStudentToStorage(studentData);
    refreshStudents();
    refreshSyncStatus();
    return newStudent;
  };

  const updateStudent = async (id: string, updates: Partial<Student>): Promise<Student | null> => {
    const updatedStudent = updateStudentInStorage(id, updates);
    if (updatedStudent) {
      refreshStudents();
      refreshSyncStatus();
    }
    return updatedStudent;
  };

  const addScore = async (studentId: string, score: number): Promise<Student | null> => {
    const updatedStudent = addScoreToStorage(studentId, score);
    if (updatedStudent) {
      refreshStudents();
      refreshSyncStatus();
    }
    return updatedStudent;
  };

  const deleteStudent = async (id: string): Promise<boolean> => {
    const success = deleteStudentFromStorage(id);
    if (success) {
      refreshStudents();
      refreshSyncStatus();
    }
    return success;
  };

  return (
    <StudentsContext.Provider value={{
      students,
      loading,
      syncStatus,
      addStudent,
      updateStudent,
      addScore,
      deleteStudent,
      refreshStudents,
      refreshSyncStatus
    }}>
      {children}
    </StudentsContext.Provider>
  );
}

export function useLocalStudents() {
  const context = useContext(StudentsContext);
  if (!context) {
    throw new Error("useLocalStudents must be used within a StudentsProvider");
  }
  return context;
}