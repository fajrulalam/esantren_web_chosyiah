import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  deleteField,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from './config';
import { 
  AttendanceRecord, 
  AttendanceType, 
  SantriWithAttendance, 
  AttendanceReport,
  AttendanceReportData
} from '@/types/attendance';

// Function to create a new attendance session
export async function createAttendanceSession(
  attendanceType: string, 
  kodeAsrama: string, 
  teacherId: string,
  attendanceTypeId?: string
): Promise<string> {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const timestamp = now.getTime();
  // Encode the attendance type to handle spaces and special characters
  const encodedType = encodeURIComponent(attendanceType);
  const sessionId = `${today}-${encodedType}-${timestamp}`;

  // Prepare student statuses object
  const studentStatuses: Record<string, any> = {};
  
  // Check if this is coming from a selected attendance type with specific santri list
  if (attendanceTypeId) {
    console.log(`Creating session from attendance type ID: ${attendanceTypeId}`);
    
    // Get the attendance type document to check for specific santri IDs
    const attendanceTypeDoc = await getDoc(doc(db, "AttendanceTypes", attendanceTypeId));
    
    if (attendanceTypeDoc.exists()) {
      const typeData = attendanceTypeDoc.data();
      const listOfSantriIds = typeData.listOfSantriIds || [];
      
      console.log(`Attendance type has ${listOfSantriIds.length} specified santris`);
      
      if (listOfSantriIds.length > 0) {
        // If we have specific santri IDs, include only those students
        // This requires individual document gets to ensure we only include valid santris
        for (const santriId of listOfSantriIds) {
          const santriDoc = await getDoc(doc(db, "SantriCollection", santriId));
          if (santriDoc.exists() && santriDoc.data().kodeAsrama === kodeAsrama) {
            studentStatuses[santriId] = {
              status: 'absent',
              updatedAt: serverTimestamp(),
              updatedBy: teacherId
            };
          }
        }
        
        console.log(`Added ${Object.keys(studentStatuses).length} students from the specified list`);
      } else {
        // If the attendance type exists but has no specified santris,
        // fallback to default behavior (all active students)
        await addActiveStudents();
      }
    } else {
      // If the attendance type ID is invalid, fallback to default behavior
      console.log("Attendance type ID provided but document not found, using default behavior");
      await addActiveStudents();
    }
  } else {
    // This is a manual input (not from a selected type), use default behavior
    console.log("Manual input session (not from attendance type selection), using default behavior");
    await addActiveStudents();
  }
  
  // Helper function to add all active students for this asrama
  async function addActiveStudents() {
    const q = query(
      collection(db, "SantriCollection"),
      where("kodeAsrama", "==", kodeAsrama),
      where("statusAktif", "==", "Aktif")
    );
    
    const studentSnapshot = await getDocs(q);
    
    // Set all students as absent by default
    studentSnapshot.docs.forEach(doc => {
      studentStatuses[doc.id] = {
        status: 'absent',
        updatedAt: serverTimestamp(),
        updatedBy: teacherId
      };
    });
    
    console.log(`Added ${studentSnapshot.docs.length} active students`);
  }

  const sessionDoc: Partial<AttendanceRecord> = {
    id: sessionId,
    attendanceType,
    kodeAsrama,
    timestamp: serverTimestamp() as Timestamp,
    createdBy: teacherId,
    studentStatuses: studentStatuses,
    isActive: true,
    attendanceTypeId: attendanceTypeId || null // Store the type ID for reference
  };

  await setDoc(doc(db, "AttendanceRecords", sessionId), sessionDoc);
  return sessionId;
}

// Function to find active sessions for a dormitory
export async function getActiveSessions(kodeAsrama: string): Promise<AttendanceRecord[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, "AttendanceRecords"),
    where("kodeAsrama", "==", kodeAsrama),
    where("timestamp", ">=", today),
    where("isActive", "==", true)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as AttendanceRecord);
}

// Function to get all students for a dormitory
export async function loadStudentsForDormitory(kodeAsrama: string): Promise<SantriWithAttendance[]> {
  const q = query(
    collection(db, "SantriCollection"),
    where("kodeAsrama", "==", kodeAsrama)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SantriWithAttendance));
}

// Function to mark a student's attendance in a session
export async function markAttendance(
  sessionId: string, 
  santriId: string, 
  status: 'present' | 'absent' | 'excusedSick' | 'excusedPulang' | 'overridePresent', 
  teacherId: string
): Promise<void> {
  const sessionRef = doc(db, "AttendanceRecords", sessionId);

  // Using dot notation for nested updates
  await updateDoc(sessionRef, {
    [`studentStatuses.${santriId}`]: {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: teacherId
    }
  });
}

// Function to add new santris to an existing session
export async function addSantrisToSession(
  sessionId: string,
  santriIds: string[],
  teacherId: string
): Promise<boolean> {
  if (!santriIds.length) return false;
  
  const sessionRef = doc(db, "AttendanceRecords", sessionId);
  const sessionSnap = await getDoc(sessionRef);
  
  if (!sessionSnap.exists()) {
    return false;
  }
  
  const sessionData = sessionSnap.data();
  const updates: Record<string, any> = {};
  
  // For each santri, add them to the studentStatuses if they don't exist
  for (const santriId of santriIds) {
    if (!sessionData.studentStatuses[santriId]) {
      updates[`studentStatuses.${santriId}`] = {
        status: 'absent',
        updatedAt: serverTimestamp(),
        updatedBy: teacherId
      };
    }
  }
  
  // If there are updates to make
  if (Object.keys(updates).length > 0) {
    await updateDoc(sessionRef, updates);
    return true;
  }
  
  return false;
}

// Function to handle overriding "Sakit" status
export async function overrideSickStatus(
  santriId: string, 
  isStillSick: boolean, 
  teacherId: string
): Promise<boolean> {
  if (!isStillSick) {
    await updateDoc(doc(db, "SantriCollection", santriId), {
      statusKehadiran: "Ada",
      updatedAt: serverTimestamp(),
      updatedBy: teacherId
    });
    return true;
  }
  return false;
}

// Function to handle overriding "Pulang" status
export async function overrideReturnStatus(
  santriId: string, 
  hasReturned: boolean, 
  teacherId: string
): Promise<boolean> {
  if (hasReturned) {
    await updateDoc(doc(db, "SantriCollection", santriId), {
      statusKehadiran: "Ada",
      statusKepulangan: deleteField(), // Remove the entire map
      updatedAt: serverTimestamp(),
      updatedBy: teacherId
    });
    return true;
  }
  return false;
}

// Function to close an active attendance session
export async function closeAttendanceSession(
  sessionId: string, 
  teacherId: string
): Promise<boolean> {
  const sessionRef = doc(db, "AttendanceRecords", sessionId);

  try {
    await updateDoc(sessionRef, {
      isActive: false,
      closedAt: serverTimestamp(),
      closedBy: teacherId
    });
    return true;
  } catch (error) {
    console.error(`Error closing session ${sessionId}:`, error);
    return false;
  }
}

// Function to delete an attendance session
export async function deleteAttendanceSession(
  sessionId: string
): Promise<boolean> {
  const sessionRef = doc(db, "AttendanceRecords", sessionId);

  try {
    await deleteDoc(sessionRef);
    return true;
  } catch (error) {
    console.error(`Error deleting session ${sessionId}:`, error);
    return false;
  }
}

// Function to get attendance types
export async function getAttendanceTypes(isFrequent: boolean = true): Promise<AttendanceType[]> {
  const q = query(
    collection(db, "AttendanceTypes"),
    where("isFrequent", "==", isFrequent)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id // Include the document ID
  } as AttendanceType));
}

// Function to get session details by ID
export async function getSessionById(sessionId: string): Promise<AttendanceRecord | null> {
  const sessionDoc = await getDoc(doc(db, "AttendanceRecords", sessionId));
  
  if (sessionDoc.exists()) {
    return sessionDoc.data() as AttendanceRecord;
  }
  
  return null;
}

// Function to identify students who are late returning
export function findLateReturnStudents(students: SantriWithAttendance[]): SantriWithAttendance[] {
  const now = new Date();

  return students.filter(student =>
    student.statusKehadiran === "Pulang" &&
    student.statusKepulangan?.rencanaTanggalKembali?.toDate() < now &&
    !student.statusKepulangan?.sudahKembali
  );
}

// Function to generate attendance report for a date range
export async function generateAttendanceReport(
  kodeAsrama: string, 
  startDate: Date, 
  endDate: Date,
  filters?: {
    attendanceTypeId?: string;
    sessionType?: 'scheduled' | 'incidental' | 'all';
  }
): Promise<AttendanceReport> {
  // Start with basic query conditions
  let conditions: any[] = [
    where("kodeAsrama", "==", kodeAsrama),
    where("timestamp", ">=", startDate),
    where("timestamp", "<=", endDate),
  ];
  
  // Build query based on filters
  const q = query(collection(db, "AttendanceRecords"), ...conditions);
  const recordsSnapshot = await getDocs(q);
  
  // Get all records first, then filter in memory for more complex conditions
  let records = recordsSnapshot.docs.map(doc => doc.data() as AttendanceRecord);
  
  // Apply additional filters if provided
  if (filters) {
    // Filter by specific attendance type if provided
    if (filters.attendanceTypeId) {
      records = records.filter(record => record.attendanceTypeId === filters.attendanceTypeId);
    }
    
    // Filter by session type (scheduled vs incidental)
    if (filters.sessionType && filters.sessionType !== 'all') {
      if (filters.sessionType === 'scheduled') {
        // Scheduled sessions have a non-null attendanceTypeId
        records = records.filter(record => record.attendanceTypeId !== null && record.attendanceTypeId !== undefined);
      } else if (filters.sessionType === 'incidental') {
        // Incidental sessions have a null attendanceTypeId
        records = records.filter(record => record.attendanceTypeId === null || record.attendanceTypeId === undefined);
      }
    }
  }

  // Get all students for this dormitory
  const studentsSnapshot = await getDocs(
      query(
          collection(db, "SantriCollection"),
          where("kodeAsrama", "==", kodeAsrama),
          where("statusAktif", "==", "Aktif")
      )
  );

  const students = studentsSnapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  } as SantriWithAttendance));

  // Initialize report data
  const reportData: AttendanceReportData[] = students.map(student => ({
    id: student.id,
    nama: student.nama,
    presentCount: 0,
    absentCount: 0,
    sickCount: 0,
    pulangCount: 0,
    unknownCount: 0,
    attendanceRate: '0%'
  }));

  // Process each record
  records.forEach(record => {
    Object.entries(record.studentStatuses || {}).forEach(([studentId, statusData]) => {
      const studentReport = reportData.find(r => r.id === studentId);
      if (!studentReport) return;

      switch (statusData.status) {
        case 'present':
        case 'overridePresent':
          studentReport.presentCount++;
          break;
        case 'excusedSick':
          studentReport.sickCount++;
          studentReport.absentCount++;
          break;
        case 'excusedPulang':
          studentReport.pulangCount++;
          studentReport.absentCount++;
          break;
        case 'absent':
          studentReport.unknownCount++;
          studentReport.absentCount++;
          break;
      }
    });
  });

  // Calculate attendance rates - improved calculation based on actual sessions each student was part of
  reportData.forEach(report => {
    // Count how many sessions this student was supposed to attend
    let studentSessionCount = 0;
    
    records.forEach(record => {
      // If student ID exists in this session's studentStatuses, then they were supposed to attend
      if (record.studentStatuses && record.studentStatuses[report.id]) {
        studentSessionCount++;
      }
    });
    
    // Calculate attendance rate based on sessions the student was actually part of
    report.studentSessionCount = studentSessionCount; // Store the count for reference
    report.attendanceRate = studentSessionCount > 0
      ? ((report.presentCount / studentSessionCount) * 100).toFixed(1) + '%'
      : 'N/A';
  });

  // Calculate total number of unique sessions
  const totalSessions = records.length;

  return {
    startDate,
    endDate,
    kodeAsrama,
    totalSessions,
    studentReports: reportData
  };
}