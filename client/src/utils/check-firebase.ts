import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function checkFirebaseData() {
  // Return null if Firebase is not available
  if (!db) {
    console.log('ℹ️ Firebase not initialized - skipping Firebase data check');
    return null;
  }
  
  try {
    // Check all classes in Firebase
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const classes = classesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('🔍 All Firebase Classes:', classes);
    
    // Check School 1 classes specifically
    const school1ClassesQuery = query(
      collection(db, 'classes'),
      where('schoolId', '==', '88fb7cc7-d744-4b6b-a317-923cda6150b6')
    );
    
    const school1Snapshot = await getDocs(school1ClassesQuery);
    const school1Classes = school1Snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('🏫 School 1 Classes in Firebase:', school1Classes);
    
    // Check if JSS2 specifically exists
    const jss2Exists = school1Classes.find(c => c.id === 'SCH1-JSS2');
    console.log('📝 JSS2 School 1 exists in Firebase:', !!jss2Exists);
    
    return {
      allClasses: classes,
      school1Classes: school1Classes,
      jss2Exists: !!jss2Exists
    };
  } catch (error) {
    console.error('❌ Error checking Firebase:', error);
    return null;
  }
}
