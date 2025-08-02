import { Student, InsertStudent } from "@shared/schema";

const STORAGE_KEY = "student_tracker_data";
const SYNC_STATUS_KEY = "student_tracker_sync_status";

export interface LocalData {
  students: Student[];
  lastSyncDate: string | null;
  pendingChanges: {
    added: Student[];
    updated: Student[];
    deleted: string[];
  };
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncDate: string | null;
  pendingCount: number;
}

// Initialize local storage with default data
const getDefaultData = (): LocalData => ({
  students: [],
  lastSyncDate: null,
  pendingChanges: {
    added: [],
    updated: [],
    deleted: []
  }
});

// Get data from local storage
export const getLocalData = (): LocalData => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return getDefaultData();
    
    const parsed = JSON.parse(data);
    // Convert date strings back to Date objects
    parsed.students = parsed.students.map((student: any) => ({
      ...student,
      createdAt: new Date(student.createdAt),
      updatedAt: new Date(student.updatedAt)
    }));
    
    return parsed;
  } catch (error) {
    console.error("Error reading local data:", error);
    return getDefaultData();
  }
};

// Save data to local storage
export const saveLocalData = (data: LocalData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving local data:", error);
  }
};

// Generate a unique ID for new students
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Add a new student
export const addStudent = (studentData: InsertStudent): Student => {
  const data = getLocalData();
  const newStudent: Student = {
    id: generateId(),
    ...studentData,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  data.students.push(newStudent);
  data.pendingChanges.added.push(newStudent);
  saveLocalData(data);
  
  return newStudent;
};

// Update a student
export const updateStudent = (id: string, updates: Partial<Student>): Student | null => {
  const data = getLocalData();
  const studentIndex = data.students.findIndex(s => s.id === id);
  
  if (studentIndex === -1) return null;
  
  const updatedStudent = {
    ...data.students[studentIndex],
    ...updates,
    updatedAt: new Date()
  };
  
  data.students[studentIndex] = updatedStudent;
  
  // Track as pending change if not already in added list
  const isNewStudent = data.pendingChanges.added.some(s => s.id === id);
  if (!isNewStudent) {
    const existingUpdateIndex = data.pendingChanges.updated.findIndex(s => s.id === id);
    if (existingUpdateIndex >= 0) {
      data.pendingChanges.updated[existingUpdateIndex] = updatedStudent;
    } else {
      data.pendingChanges.updated.push(updatedStudent);
    }
  } else {
    // Update in the added list
    const addedIndex = data.pendingChanges.added.findIndex(s => s.id === id);
    if (addedIndex >= 0) {
      data.pendingChanges.added[addedIndex] = updatedStudent;
    }
  }
  
  saveLocalData(data);
  return updatedStudent;
};

// Add score to a student
export const addScore = (studentId: string, score: number): Student | null => {
  const data = getLocalData();
  const student = data.students.find(s => s.id === studentId);
  
  if (!student) return null;
  
  const updatedScores = [...student.scores, score];
  return updateStudent(studentId, { scores: updatedScores });
};

// Delete a student
export const deleteStudent = (id: string): boolean => {
  const data = getLocalData();
  const studentIndex = data.students.findIndex(s => s.id === id);
  
  if (studentIndex === -1) return false;
  
  const student = data.students[studentIndex];
  data.students.splice(studentIndex, 1);
  
  // Handle pending changes
  const addedIndex = data.pendingChanges.added.findIndex(s => s.id === id);
  if (addedIndex >= 0) {
    // If it was a new student, just remove from added list
    data.pendingChanges.added.splice(addedIndex, 1);
  } else {
    // If it was an existing student, add to deleted list
    data.pendingChanges.deleted.push(id);
    // Remove from updated list if present
    const updatedIndex = data.pendingChanges.updated.findIndex(s => s.id === id);
    if (updatedIndex >= 0) {
      data.pendingChanges.updated.splice(updatedIndex, 1);
    }
  }
  
  saveLocalData(data);
  return true;
};

// Get sync status
export const getSyncStatus = (): SyncStatus => {
  const data = getLocalData();
  const pendingCount = data.pendingChanges.added.length + 
                      data.pendingChanges.updated.length + 
                      data.pendingChanges.deleted.length;
  
  return {
    isOnline: navigator.onLine,
    lastSyncDate: data.lastSyncDate,
    pendingCount
  };
};

// Clear all pending changes (called after successful sync)
export const clearPendingChanges = (): void => {
  const data = getLocalData();
  data.pendingChanges = {
    added: [],
    updated: [],
    deleted: []
  };
  data.lastSyncDate = new Date().toISOString();
  saveLocalData(data);
};

// Export/Import functions for backup
export const exportData = (): string => {
  const data = getLocalData();
  return JSON.stringify(data, null, 2);
};

export const importData = (jsonData: string): boolean => {
  try {
    const data = JSON.parse(jsonData);
    // Validate the structure
    if (!data.students || !Array.isArray(data.students)) {
      throw new Error("Invalid data structure");
    }
    
    // Convert date strings back to Date objects
    data.students = data.students.map((student: any) => ({
      ...student,
      createdAt: new Date(student.createdAt),
      updatedAt: new Date(student.updatedAt)
    }));
    
    saveLocalData(data);
    return true;
  } catch (error) {
    console.error("Error importing data:", error);
    return false;
  }
};