import { useEffect, useState } from 'react';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import useAttendanceStore from './store';
import { SantriWithAttendance } from '@/types/attendance';

// Hook to subscribe to real-time updates for a session
export function useSessionRealtime(sessionId: string | null) {
  const { setCurrentSession } = useAttendanceStore();

  useEffect(() => {
    if (!sessionId) return;

    const sessionRef = doc(db, "AttendanceRecords", sessionId);
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        setCurrentSession({
          id: snapshot.id,
          ...snapshot.data()
        } as any);
      }
    }, (error) => {
      console.error("Error listening to session:", error);
    });

    return () => unsubscribe();
  }, [sessionId, setCurrentSession]);
}

// Hook to subscribe to real-time updates for students
export function useStudentsRealtime(kodeAsrama: string | null) {
  const { setStudents, currentSession } = useAttendanceStore();

  useEffect(() => {
    if (!kodeAsrama) return;

    const q = query(
      collection(db, "SantriCollection"),
      where("kodeAsrama", "==", kodeAsrama)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let studentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SantriWithAttendance));
      
      // Filter students by attendance type's listOfSantriIds if available
      if (currentSession && currentSession.attendanceTypeId) {
        // Only filter if we have student statuses in the session
        // This ensures we're not showing an empty list during initial loading
        if (currentSession.studentStatuses && Object.keys(currentSession.studentStatuses).length > 0) {
          // We only show students who are in the session's studentStatuses
          const includedSantriIds = new Set(Object.keys(currentSession.studentStatuses));
          studentData = studentData.filter(student => includedSantriIds.has(student.id));
          
          console.log(`Filtered students from ${snapshot.docs.length} to ${studentData.length} based on session's student statuses`);
        }
      }
      
      setStudents(studentData);
    }, (error) => {
      console.error("Error listening to students:", error);
    });

    return () => unsubscribe();
  }, [kodeAsrama, currentSession, setStudents]);
}

// Function to determine CSS class based on student status
export function getStatusClass(
  baseStatus: 'Ada' | 'Sakit' | 'Pulang', 
  sessionStatus: string
): string {
  let classes = 'student-card';
  
  // Base status styling
  if (baseStatus === 'Sakit') {
    classes += ' sick-status';
  } else if (baseStatus === 'Pulang') {
    classes += ' away-status';
  }
  
  // Session status styling
  if (sessionStatus === 'present' || sessionStatus === 'overridePresent') {
    classes += ' present';
  } else if (sessionStatus === 'absent') {
    classes += ' absent';
  } else if (sessionStatus === 'excusedSick') {
    classes += ' excused-sick';
  } else if (sessionStatus === 'excusedPulang') {
    classes += ' excused-away';
  }
  
  return classes;
}

// Hook to detect network status
export function useNetworkStatus() {
  // Start with a default value (assuming online) and update it after mount
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set the actual state once on client side
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  return isOnline;
}