import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  enableNetwork,
  disableNetwork,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import type { 
  School, 
  User, 
  Class, 
  Subject, 
  Student, 
  Assessment,
  StudentWithDetails 
} from "@shared/schema";

// Collection names
const COLLECTIONS = {
  schools: 'schools',
  users: 'users', 
  classes: 'classes',
  subjects: 'subjects',
  students: 'students',
  assessments: 'assessments',
  syncQueue: 'syncQueue'
};

// Check if Firebase is available
const isFirebaseAvailable = () => db !== null;

// Firebase sync manager
export class FirebaseSync {
  private isOnline = navigator.onLine;
  private syncQueue: any[] = [];

  constructor() {
    if (!isFirebaseAvailable()) {
      console.log('ℹ️ Firebase sync disabled - Firebase not initialized');
      return;
    }
    // Monitor online status
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private async handleOnline() {
    if (!isFirebaseAvailable()) return;
    this.isOnline = true;
    await enableNetwork(db!);
    await this.processSyncQueue();
  }

  private async handleOffline() {
    if (!isFirebaseAvailable()) return;
    this.isOnline = false;
    await disableNetwork(db!);
  }

  // Queue operations for offline sync
  private queueOperation(operation: string, collection: string, data: any, id?: string) {
    this.syncQueue.push({
      operation,
      collection,
      data,
      id,
      timestamp: new Date().toISOString()
    });
    
    // Store in localStorage for persistence
    localStorage.setItem('firebaseSyncQueue', JSON.stringify(this.syncQueue));
  }

  // Process queued operations when back online
  private async processSyncQueue() {
    if (!isFirebaseAvailable()) return;
    
    const stored = localStorage.getItem('firebaseSyncQueue');
    if (stored) {
      this.syncQueue = JSON.parse(stored);
    }

    const batch = writeBatch(db!);
    let batchCount = 0;

    for (const item of this.syncQueue) {
      try {
        const docRef = item.id 
          ? doc(db!, item.collection, item.id)
          : doc(collection(db!, item.collection));

        switch (item.operation) {
          case 'create':
          case 'update':
            batch.set(docRef, {
              ...item.data,
              lastModified: serverTimestamp(),
              syncedAt: serverTimestamp()
            }, { merge: true });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }

        batchCount++;
        
        // Firebase batch limit is 500
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      } catch (error) {
        console.error('Sync operation failed:', error);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // Clear sync queue
    this.syncQueue = [];
    localStorage.removeItem('firebaseSyncQueue');
  }

  // Schools
  async syncSchool(school: School): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    if (!this.isOnline) {
      this.queueOperation('update', COLLECTIONS.schools, school, school.id);
      return;
    }

    try {
      await setDoc(doc(db!, COLLECTIONS.schools, school.id), {
        ...school,
        lastModified: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to sync school:', error);
      this.queueOperation('update', COLLECTIONS.schools, school, school.id);
    }
  }

  async getSchools(): Promise<School[]> {
    if (!isFirebaseAvailable()) return [];
    
    try {
      const snapshot = await getDocs(collection(db!, COLLECTIONS.schools));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
    } catch (error) {
      console.error('Failed to get schools from Firebase:', error);
      return [];
    }
  }

  // Users
  async syncUser(user: User): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    if (!this.isOnline) {
      this.queueOperation('update', COLLECTIONS.users, user, user.id);
      return;
    }

    try {
      await setDoc(doc(db!, COLLECTIONS.users, user.id), {
        ...user,
        password: undefined, // Never sync passwords to Firebase
        lastModified: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to sync user:', error);
      this.queueOperation('update', COLLECTIONS.users, user, user.id);
    }
  }

  // Classes
  async syncClass(classData: Class): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    if (!this.isOnline) {
      this.queueOperation('update', COLLECTIONS.classes, classData, classData.id);
      return;
    }

    try {
      await setDoc(doc(db!, COLLECTIONS.classes, classData.id), {
        ...classData,
        lastModified: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to sync class:', error);
      this.queueOperation('update', COLLECTIONS.classes, classData, classData.id);
    }
  }

  async getClassesBySchool(schoolId: string): Promise<Class[]> {
    if (!isFirebaseAvailable()) return [];
    
    try {
      const q = query(
        collection(db!, COLLECTIONS.classes),
        where("schoolId", "==", schoolId),
        orderBy("name")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
    } catch (error) {
      console.error('Failed to get classes from Firebase:', error);
      return [];
    }
  }

  // Students
  async syncStudent(student: Student): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    if (!this.isOnline) {
      this.queueOperation('update', COLLECTIONS.students, student, student.id);
      return;
    }

    try {
      await setDoc(doc(db!, COLLECTIONS.students, student.id), {
        ...student,
        lastModified: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to sync student:', error);
      this.queueOperation('update', COLLECTIONS.students, student, student.id);
    }
  }

  async getStudentsBySchool(schoolId: string): Promise<StudentWithDetails[]> {
    if (!isFirebaseAvailable()) return [];
    
    try {
      const q = query(
        collection(db!, COLLECTIONS.students),
        where("schoolId", "==", schoolId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentWithDetails));
    } catch (error) {
      console.error('Failed to get students from Firebase:', error);
      return [];
    }
  }

  // Assessments
  async syncAssessment(assessment: Assessment): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    if (!this.isOnline) {
      this.queueOperation('update', COLLECTIONS.assessments, assessment, assessment.id);
      return;
    }

    try {
      await setDoc(doc(db!, COLLECTIONS.assessments, assessment.id!), {
        ...assessment,
        lastModified: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to sync assessment:', error);
      this.queueOperation('update', COLLECTIONS.assessments, assessment, assessment.id);
    }
  }

  async getAssessments(classId: string, subjectId: string, term: string, session: string): Promise<Assessment[]> {
    if (!isFirebaseAvailable()) return [];
    
    try {
      const q = query(
        collection(db!, COLLECTIONS.assessments),
        where("classId", "==", classId),
        where("subjectId", "==", subjectId),
        where("term", "==", term),
        where("session", "==", session)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment));
    } catch (error) {
      console.error('Failed to get assessments from Firebase:', error);
      return [];
    }
  }

  // Real-time listeners
  subscribeToSchools(callback: (schools: School[]) => void) {
    if (!isFirebaseAvailable()) return () => {};
    
    return onSnapshot(collection(db!, COLLECTIONS.schools), (snapshot) => {
      const schools = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
      callback(schools);
    });
  }

  subscribeToClassesBySchool(schoolId: string, callback: (classes: Class[]) => void) {
    if (!isFirebaseAvailable()) return () => {};
    
    const q = query(
      collection(db!, COLLECTIONS.classes),
      where("schoolId", "==", schoolId)
    );
    
    return onSnapshot(q, (snapshot) => {
      const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      callback(classes);
    });
  }

  subscribeToStudentsBySchool(schoolId: string, callback: (students: StudentWithDetails[]) => void) {
    if (!isFirebaseAvailable()) return () => {};
    
    const q = query(
      collection(db!, COLLECTIONS.students),
      where("schoolId", "==", schoolId)
    );
    
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentWithDetails));
      callback(students);
    });
  }

  // Bulk sync operations
  async bulkSyncAssessments(assessments: Assessment[]): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    if (!this.isOnline) {
      assessments.forEach(assessment => {
        this.queueOperation('update', COLLECTIONS.assessments, assessment, assessment.id);
      });
      return;
    }

    try {
      const batch = writeBatch(db!);
      
      assessments.forEach(assessment => {
        const docRef = assessment.id 
          ? doc(db!, COLLECTIONS.assessments, assessment.id)
          : doc(collection(db!, COLLECTIONS.assessments));
          
        batch.set(docRef, {
          ...assessment,
          lastModified: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
    } catch (error) {
      console.error('Failed to bulk sync assessments:', error);
      // Queue individually if batch fails
      assessments.forEach(assessment => {
        this.queueOperation('update', COLLECTIONS.assessments, assessment, assessment.id);
      });
    }
  }
}

// Export singleton instance
export const firebaseSync = new FirebaseSync();

// Export convenience functions for server-side imports
export const syncClassToFirebase = (classData: Class) => firebaseSync.syncClass(classData);
export const syncStudentToFirebase = (student: Student) => firebaseSync.syncStudent(student);
