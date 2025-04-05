import { create } from 'zustand';
import { AttendanceRecord, SantriWithAttendance } from '@/types/attendance';

interface AttendanceStore {
  currentSession: AttendanceRecord | null;
  students: SantriWithAttendance[];
  loading: boolean;
  error: string | null;
  kodeAsrama: string | null;
  
  setCurrentSession: (session: AttendanceRecord | null) => void;
  setStudents: (students: SantriWithAttendance[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setKodeAsrama: (kodeAsrama: string | null) => void;
  
  // Reset state when switching sessions
  resetSessionData: () => void;
}

const useAttendanceStore = create<AttendanceStore>((set) => ({
  currentSession: null,
  students: [],
  loading: false,
  error: null,
  kodeAsrama: null,
  
  setCurrentSession: (session) => set({ currentSession: session }),
  setStudents: (students) => set({ students }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setKodeAsrama: (kodeAsrama) => set({ kodeAsrama }),
  
  resetSessionData: () => set({
    currentSession: null,
    students: [],
    loading: false,
    error: null
  }),
}));

export default useAttendanceStore;