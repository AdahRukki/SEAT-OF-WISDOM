// Manual script to sync existing PostgreSQL data to Firebase
import { initializeApp } from "firebase/app";
import { getFirestore, setDoc, doc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sync existing class to Firebase
async function syncClassToFirebase() {
  try {
    const classData = {
      id: "SCH1-JSS2",
      name: "J.S.S 2",
      description: "",
      schoolId: "88fb7cc7-d744-4b6b-a317-923cda6150b6",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSynced: serverTimestamp()
    };

    await setDoc(doc(db, 'classes', 'SCH1-JSS2'), classData);
    console.log('✅ Class SCH1-JSS2 synced to Firebase');
  } catch (error) {
    console.error('❌ Error syncing to Firebase:', error);
  }
}

syncClassToFirebase();