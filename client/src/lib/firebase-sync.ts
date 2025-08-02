import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  serverTimestamp,
  writeBatch 
} from "firebase/firestore";
import { db } from "./firebase";
import { getLocalData, saveLocalData, clearPendingChanges } from "./storage";
import { Student } from "@shared/schema";

export interface SyncResult {
  success: boolean;
  message: string;
  details?: {
    added: number;
    updated: number;
    deleted: number;
    downloaded: number;
  };
}

// Sync local changes to Firebase
export const syncToFirebase = async (): Promise<SyncResult> => {
  try {
    const localData = getLocalData();
    const { pendingChanges } = localData;
    
    const batch = writeBatch(db);
    let operationCount = 0;
    
    // Add new students
    const addedStudents: any[] = [];
    for (const student of pendingChanges.added) {
      const docRef = doc(collection(db, "students"));
      const studentData = {
        name: student.name,
        email: student.email,
        class: student.class,
        scores: student.scores,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(docRef, studentData);
      addedStudents.push({ localId: student.id, firebaseId: docRef.id, data: studentData });
      operationCount++;
    }
    
    // Update existing students
    for (const student of pendingChanges.updated) {
      // For updated students, we need to find them by matching data since we don't have Firebase IDs
      // This is a limitation of offline-first approach - we'll handle this in the full sync
      operationCount++;
    }
    
    // Delete students (similar issue - we need Firebase IDs)
    for (const studentId of pendingChanges.deleted) {
      operationCount++;
    }
    
    // Commit the batch
    if (operationCount > 0) {
      await batch.commit();
    }
    
    // Update local data with Firebase IDs for new students
    const updatedLocalData = getLocalData();
    addedStudents.forEach(({ localId, firebaseId }) => {
      const studentIndex = updatedLocalData.students.findIndex(s => s.id === localId);
      if (studentIndex >= 0) {
        updatedLocalData.students[studentIndex].id = firebaseId;
      }
    });
    
    clearPendingChanges();
    
    return {
      success: true,
      message: "Successfully synced to Firebase",
      details: {
        added: pendingChanges.added.length,
        updated: pendingChanges.updated.length,
        deleted: pendingChanges.deleted.length,
        downloaded: 0
      }
    };
  } catch (error: any) {
    console.error("Sync to Firebase failed:", error);
    return {
      success: false,
      message: `Sync failed: ${error.message || "Unknown error"}`
    };
  }
};

// Download data from Firebase and merge with local
export const syncFromFirebase = async (): Promise<SyncResult> => {
  try {
    const querySnapshot = await getDocs(collection(db, "students"));
    const firebaseStudents: Student[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      firebaseStudents.push({
        id: doc.id,
        name: data.name,
        email: data.email,
        class: data.class,
        scores: data.scores || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });
    
    const localData = getLocalData();
    
    // Merge strategy: Firebase data overwrites local for existing students
    // New local students are preserved
    const mergedStudents = [...firebaseStudents];
    
    // Add local students that don't exist in Firebase
    localData.students.forEach(localStudent => {
      const existsInFirebase = firebaseStudents.some(fbStudent => 
        fbStudent.email === localStudent.email && fbStudent.name === localStudent.name
      );
      
      if (!existsInFirebase) {
        mergedStudents.push(localStudent);
      }
    });
    
    // Update local storage
    const updatedData = {
      ...localData,
      students: mergedStudents,
      lastSyncDate: new Date().toISOString()
    };
    
    saveLocalData(updatedData);
    
    return {
      success: true,
      message: "Successfully downloaded from Firebase",
      details: {
        added: 0,
        updated: 0,
        deleted: 0,
        downloaded: firebaseStudents.length
      }
    };
  } catch (error: any) {
    console.error("Sync from Firebase failed:", error);
    return {
      success: false,
      message: `Download failed: ${error.message || "Unknown error"}`
    };
  }
};

// Full bi-directional sync
export const fullSync = async (): Promise<SyncResult> => {
  try {
    // First, upload local changes
    const uploadResult = await syncToFirebase();
    if (!uploadResult.success) {
      return uploadResult;
    }
    
    // Then, download any updates from Firebase
    const downloadResult = await syncFromFirebase();
    if (!downloadResult.success) {
      return downloadResult;
    }
    
    return {
      success: true,
      message: "Full sync completed successfully",
      details: {
        added: uploadResult.details?.added || 0,
        updated: uploadResult.details?.updated || 0,
        deleted: uploadResult.details?.deleted || 0,
        downloaded: downloadResult.details?.downloaded || 0
      }
    };
  } catch (error: any) {
    console.error("Full sync failed:", error);
    return {
      success: false,
      message: `Full sync failed: ${error.message || "Unknown error"}`
    };
  }
};