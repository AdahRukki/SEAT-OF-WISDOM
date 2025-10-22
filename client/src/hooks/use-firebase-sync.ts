import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Class, StudentWithDetails } from '@shared/schema';

export function useFirebaseSync(selectedSchoolId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!selectedSchoolId) return;

    // Listen to classes changes in Firebase
    const classesQuery = query(
      collection(db, 'classes'),
      where('schoolId', '==', selectedSchoolId)
    );

    const unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
      const firebaseClasses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Class[];

      // Update the classes cache with Firebase data
      queryClient.setQueryData(['/api/admin/classes', selectedSchoolId], (oldData: any) => {
        if (!oldData) return firebaseClasses;
        
        // Merge Firebase data with existing data
        // Firebase takes priority for existing classes
        const existingIds = new Set(firebaseClasses.map(c => c.id));
        const localOnlyClasses = oldData.filter((c: Class) => !existingIds.has(c.id));
        
        return [...firebaseClasses, ...localOnlyClasses];
      });

      console.log('🔄 Firebase classes updated:', firebaseClasses.length);
    });

    // Listen to students changes in Firebase
    const studentsQuery = query(
      collection(db, 'students'),
      where('schoolId', '==', selectedSchoolId)
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const firebaseStudents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentWithDetails[];

      // Update the students cache with Firebase data
      queryClient.setQueryData(['/api/admin/students', selectedSchoolId], (oldData: any) => {
        if (!oldData) return firebaseStudents;
        
        // Merge Firebase data with existing data
        const existingIds = new Set(firebaseStudents.map(s => s.id));
        const localOnlyStudents = oldData.filter((s: StudentWithDetails) => !existingIds.has(s.id));
        
        return [...firebaseStudents, ...localOnlyStudents];
      });

      console.log('🔄 Firebase students updated:', firebaseStudents.length);
    });

    // Cleanup listeners on unmount or school change
    return () => {
      unsubscribeClasses();
      unsubscribeStudents();
    };
  }, [selectedSchoolId, queryClient]);
}