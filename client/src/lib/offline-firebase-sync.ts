import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
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
  Assessment 
} from "@shared/schema";

// Queue operation interface
interface QueuedOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  collection: string;
  documentId: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

// Local storage keys
const SYNC_QUEUE_KEY = 'sowa_sync_queue';
const OFFLINE_DATA_KEY = 'sowa_offline_data';
const LAST_SYNC_KEY = 'sowa_last_sync';

// Check if Firebase is available
const isFirebaseAvailable = () => db !== null;

export class OfflineFirebaseSync {
  private isOnline = navigator.onLine;
  private syncQueue: QueuedOperation[] = [];
  private syncInProgress = false;
  private listeners: Array<() => void> = [];

  constructor() {
    if (!isFirebaseAvailable()) {
      console.log('ℹ️ Offline Firebase sync disabled - Firebase not initialized');
      return;
    }
    this.initializeOfflineSupport();
    this.setupNetworkListeners();
    this.loadQueueFromStorage();
    this.startPeriodicSync();
  }

  private initializeOfflineSupport() {
    try {
      console.log('🔄 Firebase offline-first sync initialized');
    } catch (error) {
      console.warn('⚠️ Could not enable offline persistence:', error);
    }
  }

  private setupNetworkListeners() {
    if (!isFirebaseAvailable()) return;
    
    window.addEventListener('online', async () => {
      this.isOnline = true;
      console.log('🌐 Network online - enabling Firebase sync');
      await enableNetwork(db!);
      await this.processSyncQueue();
    });

    window.addEventListener('offline', async () => {
      this.isOnline = false;
      console.log('📱 Network offline - switching to local storage');
      await disableNetwork(db!);
    });
  }

  private startPeriodicSync() {
    setInterval(async () => {
      if (this.isOnline && this.syncQueue.length > 0 && !this.syncInProgress) {
        await this.processSyncQueue();
      }
    }, 30000); // Sync every 30 seconds
  }

  private loadQueueFromStorage() {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        this.syncQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private saveQueueToStorage() {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private queueOperation(type: 'CREATE' | 'UPDATE' | 'DELETE', collection: string, documentId: string, data: any) {
    const operation: QueuedOperation = {
      id: this.generateId(),
      type,
      collection,
      documentId,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.syncQueue.push(operation);
    this.saveQueueToStorage();

    // If online, try to sync immediately
    if (this.isOnline && !this.syncInProgress) {
      this.processSyncQueue();
    }
  }

  // Public methods for data operations
  async saveAssessment(assessment: Assessment): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    const documentId = assessment.id;
    
    if (this.isOnline) {
      try {
        const docRef = doc(db!, 'assessments', documentId);
        await setDoc(docRef, {
          ...assessment,
          lastUpdated: new Date().toISOString(),
          syncStatus: 'synced'
        });
        console.log('✅ Assessment saved to Firebase:', documentId);
      } catch (error) {
        console.log('📱 Firebase unavailable, saving to local queue');
        this.queueOperation('CREATE', 'assessments', documentId, assessment);
        this.saveToLocalStorage('assessments', documentId, assessment);
      }
    } else {
      console.log('📱 Offline: Saving assessment to local storage');
      this.queueOperation('CREATE', 'assessments', documentId, assessment);
      this.saveToLocalStorage('assessments', documentId, assessment);
    }
  }

  async updateAssessment(assessmentId: string, updates: Partial<Assessment>): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    if (this.isOnline) {
      try {
        const docRef = doc(db!, 'assessments', assessmentId);
        await updateDoc(docRef, {
          ...updates,
          lastUpdated: new Date().toISOString(),
          syncStatus: 'synced'
        });
        console.log('✅ Assessment updated in Firebase:', assessmentId);
      } catch (error) {
        console.log('📱 Firebase unavailable, queueing update');
        this.queueOperation('UPDATE', 'assessments', assessmentId, updates);
        this.updateLocalStorage('assessments', assessmentId, updates);
      }
    } else {
      console.log('📱 Offline: Queueing assessment update');
      this.queueOperation('UPDATE', 'assessments', assessmentId, updates);
      this.updateLocalStorage('assessments', assessmentId, updates);
    }
  }

  async saveStudent(student: Student): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    const documentId = student.id;
    
    if (this.isOnline) {
      try {
        const docRef = doc(db!, 'students', documentId);
        await setDoc(docRef, {
          ...student,
          lastUpdated: new Date().toISOString(),
          syncStatus: 'synced'
        });
        console.log('✅ Student saved to Firebase:', documentId);
      } catch (error) {
        this.queueOperation('CREATE', 'students', documentId, student);
        this.saveToLocalStorage('students', documentId, student);
      }
    } else {
      console.log('📱 Offline: Saving student to local storage');
      this.queueOperation('CREATE', 'students', documentId, student);
      this.saveToLocalStorage('students', documentId, student);
    }
  }

  async saveClass(classData: Class): Promise<void> {
    if (!isFirebaseAvailable()) return;
    
    const documentId = classData.id;
    
    if (this.isOnline) {
      try {
        const docRef = doc(db!, 'classes', documentId);
        await setDoc(docRef, {
          ...classData,
          lastUpdated: new Date().toISOString(),
          syncStatus: 'synced'
        });
        console.log('✅ Class saved to Firebase:', documentId);
      } catch (error) {
        this.queueOperation('CREATE', 'classes', documentId, classData);
        this.saveToLocalStorage('classes', documentId, classData);
      }
    } else {
      console.log('📱 Offline: Saving class to local storage');
      this.queueOperation('CREATE', 'classes', documentId, classData);
      this.saveToLocalStorage('classes', documentId, classData);
    }
  }

  private saveToLocalStorage(collection: string, documentId: string, data: any) {
    try {
      const offlineData = this.getOfflineData();
      if (!offlineData[collection]) {
        offlineData[collection] = {};
      }
      offlineData[collection][documentId] = {
        ...data,
        offlineCreated: true,
        timestamp: Date.now()
      };
      localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(offlineData));
    } catch (error) {
      console.error('Failed to save to local storage:', error);
    }
  }

  private updateLocalStorage(collection: string, documentId: string, updates: any) {
    try {
      const offlineData = this.getOfflineData();
      if (offlineData[collection] && offlineData[collection][documentId]) {
        offlineData[collection][documentId] = {
          ...offlineData[collection][documentId],
          ...updates,
          timestamp: Date.now()
        };
        localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(offlineData));
      }
    } catch (error) {
      console.error('Failed to update local storage:', error);
    }
  }

  private getOfflineData(): any {
    try {
      const stored = localStorage.getItem(OFFLINE_DATA_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get offline data:', error);
      return {};
    }
  }

  async getOfflineAssessments(): Promise<Assessment[]> {
    const offlineData = this.getOfflineData();
    if (offlineData.assessments) {
      return Object.values(offlineData.assessments) as Assessment[];
    }
    return [];
  }

  async processSyncQueue(): Promise<void> {
    if (!isFirebaseAvailable() || this.syncInProgress || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Processing sync queue:', this.syncQueue.length, 'operations');

    const batch = writeBatch(db!);
    const completedOperations: string[] = [];

    for (const operation of this.syncQueue) {
      try {
        const docRef = doc(db!, operation.collection, operation.documentId);

        switch (operation.type) {
          case 'CREATE':
            batch.set(docRef, {
              ...operation.data,
              lastUpdated: new Date().toISOString(),
              syncStatus: 'synced'
            });
            break;
          case 'UPDATE':
            batch.update(docRef, {
              ...operation.data,
              lastUpdated: new Date().toISOString(),
              syncStatus: 'synced'
            });
            break;
          case 'DELETE':
            batch.delete(docRef);
            break;
        }

        completedOperations.push(operation.id);
      } catch (error) {
        console.error('Failed to process operation:', operation.id, error);
        operation.retryCount++;
        
        // Remove operations that have failed too many times
        if (operation.retryCount > 3) {
          completedOperations.push(operation.id);
        }
      }
    }

    try {
      await batch.commit();
      console.log('✅ Sync batch committed successfully');

      // Remove completed operations from queue
      this.syncQueue = this.syncQueue.filter(op => !completedOperations.includes(op.id));
      this.saveQueueToStorage();

      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch (error) {
      console.error('❌ Failed to commit sync batch:', error);
    }

    this.syncInProgress = false;
  }

  // Setup real-time listeners for online data
  setupRealTimeSync(collectionName: string, callback: (data: any[]) => void): () => void {
    if (!isFirebaseAvailable() || !this.isOnline) return () => {};

    const q = query(collection(db!, collectionName), orderBy('lastUpdated', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(data);
    }, (error) => {
      console.error('Real-time sync error:', error);
    });

    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  getSyncStatus(): { 
    isOnline: boolean; 
    queueLength: number; 
    lastSync: string | null;
    syncInProgress: boolean;
  } {
    return {
      isOnline: this.isOnline,
      queueLength: this.syncQueue.length,
      lastSync: localStorage.getItem(LAST_SYNC_KEY),
      syncInProgress: this.syncInProgress
    };
  }

  // Force sync (for manual sync button)
  async forcSync(): Promise<void> {
    if (this.isOnline) {
      await this.processSyncQueue();
    }
  }

  // Cleanup
  destroy() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
  }
}

// Export singleton instance
export const firebaseSync = new OfflineFirebaseSync();