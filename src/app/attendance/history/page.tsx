'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { format } from 'date-fns';
import { AttendanceRecord } from '@/types/attendance';
import { KODE_ASRAMA } from '@/constants';
import { deleteAttendanceSession } from '@/firebase/attendance';

export default function AttendanceHistoryPage() {
  const router = useRouter();
  const [closedSessions, setClosedSessions] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Load closed sessions
  useEffect(() => {
    const loadClosedSessions = async () => {
      setLoading(true);
      try {
        // Query for sessions that are closed (isActive = false)
        const q = query(
          collection(db, "AttendanceRecords"),
          where("kodeAsrama", "==", KODE_ASRAMA),
          where("isActive", "==", false),
          orderBy("timestamp", "desc")
        );
        
        const snapshot = await getDocs(q);
        const sessionData = snapshot.docs.map(doc => ({
          ...doc.data()
        } as AttendanceRecord));
        
        setClosedSessions(sessionData);
      } catch (error) {
        console.error("Error loading closed sessions:", error);
        setError("Gagal memuat sesi yang telah ditutup. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };

    loadClosedSessions();
  }, []);

  // Format date/time
  const formatDate = (timestamp: Timestamp) => {
    return format(timestamp.toDate(), 'dd MMMM yyyy - HH:mm');
  };

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string) => {
    const confirmation = window.confirm("Apakah Anda yakin ingin menghapus sesi presensi ini? Tindakan ini tidak dapat dibatalkan.");
    if (!confirmation) return;
    
    setIsDeletingSession(true);
    try {
      const success = await deleteAttendanceSession(sessionId);
      if (success) {
        // Update local state
        setClosedSessions(closedSessions.filter(session => session.id !== sessionId));
      } else {
        setError("Gagal menghapus sesi. Silakan coba lagi.");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      setError("Terjadi kesalahan saat menghapus sesi.");
    } finally {
      setIsDeletingSession(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Sejarah Presensi</h1>
          <button
            onClick={() => router.push('/attendance')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Kembali
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2">Memuat sesi presensi...</p>
        </div>
      ) : closedSessions.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p>Belum ada sesi presensi yang telah ditutup.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {closedSessions.map(session => (
            <div 
              key={session.id} 
              className="relative p-5 bg-white dark:bg-gray-800 rounded-lg 
                        shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.8)]
                        dark:shadow-[4px_4px_10px_rgba(0,0,0,0.2),-4px_-4px_10px_rgba(255,255,255,0.05)]
                        border border-gray-100 dark:border-gray-700"
            >
              <div className="flex flex-col sm:flex-row justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                    {session.attendanceType}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {session.timestamp ? formatDate(session.timestamp) : 'Tanggal tidak tersedia'}
                  </p>
                  {session.closedAt && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Ditutup pada: {formatDate(session.closedAt)}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2 mt-4 sm:mt-0">
                  <button
                    onClick={() => router.push(`/attendance/${session.id}`)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
                  >
                    Lihat
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    disabled={isDeletingSession}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Hapus
                  </button>
                </div>
              </div>
              
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs rounded-full">
                  Hadir: {Object.values(session.studentStatuses || {}).filter(s => s.status === 'present' || s.status === 'overridePresent').length}
                </div>
                <div className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 text-xs rounded-full">
                  Tidak Hadir: {Object.values(session.studentStatuses || {}).filter(s => s.status === 'absent').length}
                </div>
                <div className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 text-xs rounded-full">
                  Sakit: {Object.values(session.studentStatuses || {}).filter(s => s.status === 'excusedSick').length}
                </div>
                <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded-full">
                  Pulang: {Object.values(session.studentStatuses || {}).filter(s => s.status === 'excusedPulang').length}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}