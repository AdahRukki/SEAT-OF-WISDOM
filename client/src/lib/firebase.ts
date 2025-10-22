import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED, initializeFirestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getFirebaseConfig } from "@/config/firebase-config";

// Internal Firebase instances
let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _initPromise: Promise<void> | null = null;
let _initError: Error | null = null;

// Initialize Firebase asynchronously
async function initializeFirebase() {
  if (_app) return; // Already initialized
  
  try {
    // Get configuration (tries env vars first, then server)
    const firebaseConfig = await getFirebaseConfig();
    
    // Initialize Firebase app
    _app = initializeApp(firebaseConfig);
    
    // Initialize Firestore with offline persistence and connection settings
    _db = initializeFirestore(_app, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      experimentalForceLongPolling: false, // Try WebChannel first
      experimentalAutoDetectLongPolling: true, // Auto-detect if long-polling is needed
    });
    
    // Enable offline persistence for better reliability
    try {
      await enableIndexedDbPersistence(_db, {
        forceOwnership: false // Allow multiple tabs
      });
      console.log('🔄 Firebase offline-first sync initialized');
    } catch (err: any) {
      if (err.code === 'failed-precondition') {
        console.warn('⚠️ Multiple tabs open, offline persistence only available in one tab');
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Browser doesn\'t support offline persistence');
      } else {
        console.error('❌ Error enabling offline persistence:', err);
      }
    }
    
    // Initialize Auth
    _auth = getAuth(_app);
    
    console.log('🔥 Firebase initialized with project:', firebaseConfig.projectId);
    console.log('🌐 Environment:', import.meta.env.MODE);
    console.log('🔗 Domain:', window.location.hostname);
    
  } catch (error) {
    _initError = error as Error;
    console.error('❌ Failed to initialize Firebase:', error);
    throw error;
  }
}

// Start initialization immediately
_initPromise = initializeFirebase();

// Helper to ensure Firebase is ready before use
export async function ensureFirebaseReady(): Promise<void> {
  if (_initError) {
    throw _initError;
  }
  await _initPromise;
}

// Create a Proxy for db that automatically waits for initialization
const dbHandler: ProxyHandler<any> = {
  get(target, prop) {
    if (!_db) {
      if (_initError) {
        throw new Error(`Firebase initialization failed: ${_initError.message}`);
      }
      throw new Error('Firebase is still initializing. Please wait or call ensureFirebaseReady() first.');
    }
    const value = _db[prop as keyof Firestore];
    return typeof value === 'function' ? value.bind(_db) : value;
  }
};

// Create a Proxy for auth that automatically waits for initialization
const authHandler: ProxyHandler<any> = {
  get(target, prop) {
    if (!_auth) {
      if (_initError) {
        throw new Error(`Firebase initialization failed: ${_initError.message}`);
      }
      throw new Error('Firebase is still initializing. Please wait or call ensureFirebaseReady() first.');
    }
    const value = _auth[prop as keyof Auth];
    return typeof value === 'function' ? value.bind(_auth) : value;
  }
};

// Export proxied instances that are safe to use immediately
export const db = new Proxy({}, dbHandler) as Firestore;
export const auth = new Proxy({}, authHandler) as Auth;

// Export the app (will be null until initialized)
export function getApp(): FirebaseApp {
  if (!_app) {
    if (_initError) {
      throw new Error(`Firebase initialization failed: ${_initError.message}`);
    }
    throw new Error('Firebase is still initializing. Please wait or call ensureFirebaseReady() first.');
  }
  return _app;
}

export default { get app() { return getApp(); } };