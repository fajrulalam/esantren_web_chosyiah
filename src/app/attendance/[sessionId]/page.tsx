'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { format } from 'date-fns';
import id from 'date-fns/locale/id';
import { useSessionRealtime, useStudentsRealtime } from '@/app/attendance/hooks';
import useAttendanceStore from '@/app/attendance/store';
import StudentCard from '@/components/attendance/StudentCard';
import NetworkStatusIndicator from '@/components/attendance/NetworkStatus';
import { closeAttendanceSession, deleteAttendanceSession, addSantrisToSession } from '@/firebase/attendance';
import { KODE_ASRAMA } from '@/constants';
import { Santri } from '@/types/attendance';

export default function AttendanceScreen({ params }: { params: { sessionId: string } }) {
  const sessionId = params.sessionId;
  const router = useRouter();
  const { currentSession, students, loading, setLoading, setError } = useAttendanceStore();
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debug hooks - MUST be declared before any conditional returns
  useEffect(() => {
    // Debug info for the session
    if (currentSession) {
      console.log("Current session:", {
        id: currentSession.id,
        type: currentSession.attendanceType,
        typeId: currentSession.attendanceTypeId,
        studentsCount: Object.keys(currentSession.studentStatuses || {}).length,
      });
    }
  }, [currentSession]);

  useEffect(() => {
    // Debug info for loaded students
    if (students) {
      console.log("Loaded students:", students.length);
    }
  }, [students]);

  // State for add santri modal
  const [showAddSantriModal, setShowAddSantriModal] = useState(false);
  const [allSantris, setAllSantris] = useState<Santri[]>([]);
  const [filteredSantris, setFilteredSantris] = useState<Santri[]>([]);
  const [selectedSantriIds, setSelectedSantriIds] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [isLoadingSantris, setIsLoadingSantris] = useState(false);
  const [isAddingSantris, setIsAddingSantris] = useState(false);
  const [filters, setFilters] = useState({
    statusAktif: 'Aktif',
    kamar: '',
    jenjangPendidikan: ''
  });

  // Load teacher info on mount
  useEffect(() => {
    const loadTeacherInfo = async () => {
      setLoading(true);
      try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (user) {
          setTeacherId(user.uid);

          // Get teacher's name
          const teacherDoc = await getDoc(doc(db, "PengurusCollection", user.uid));
          if (teacherDoc.exists()) {
            setTeacherName(teacherDoc.data().nama || 'Pengurus');
          }
        }
      } catch (error) {
        console.error("Error loading teacher info:", error);
        setError("Gagal memuat informasi pengurus. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };

    loadTeacherInfo();
  }, [setLoading, setError]);

  // Subscribe to real-time updates
  useSessionRealtime(sessionId);
  useStudentsRealtime(KODE_ASRAMA);

  // Close session handler
  const handleCloseSession = async () => {
    if (!currentSession || !currentSession.isActive || !teacherId) return;

    const confirmation = window.confirm("Apakah Anda yakin ingin menutup sesi presensi ini? Sesi yang sudah ditutup tidak dapat diubah lagi.");
    if (confirmation) {
      setIsClosing(true);
      try {
        const success = await closeAttendanceSession(sessionId, teacherId);
        if (success) {
          // Ask if user wants to share the summary to WhatsApp after closing
          const shareSummary = window.confirm(
            "Sesi berhasil ditutup! Apakah Anda ingin membagikan ringkasan kehadiran ke WhatsApp?"
          );
          
          if (shareSummary) {
            // Generate and share the summary before redirecting
            shareToWhatsApp();
            // Short delay to ensure WhatsApp is launched before redirecting
            setTimeout(() => {
              router.push('/attendance');
            }, 1000);
          } else {
            router.push('/attendance');
          }
        } else {
          setError("Gagal menutup sesi. Silakan coba lagi.");
        }
      } catch (error) {
        console.error("Error closing session:", error);
        setError("Terjadi kesalahan saat menutup sesi.");
      } finally {
        setIsClosing(false);
      }
    }
  };

  // Delete session handler
  const handleDeleteSession = async () => {
    if (!currentSession) return;

    const confirmation = window.confirm("Apakah Anda yakin ingin menghapus sesi presensi ini? Tindakan ini tidak dapat dibatalkan dan semua data presensi akan hilang.");
    if (confirmation) {
      setIsDeleting(true);
      try {
        const success = await deleteAttendanceSession(sessionId);
        if (success) {
          router.push('/attendance');
        } else {
          setError("Gagal menghapus sesi. Silakan coba lagi.");
        }
      } catch (error) {
        console.error("Error deleting session:", error);
        setError("Terjadi kesalahan saat menghapus sesi.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Fetch all santris who are not already in the session
  const fetchAvailableSantris = async () => {
    if (!currentSession) return;

    setIsLoadingSantris(true);
    try {
      const santriRef = collection(db, "SantriCollection");
      // Get all santris from the current asrama
      const q = query(
          santriRef,
          where("kodeAsrama", "==", KODE_ASRAMA)
      );
      const querySnapshot = await getDocs(q);

      // Create a set of santri IDs who are already in the session
      const existingSantriIds = new Set(Object.keys(currentSession.studentStatuses || {}));

      // Filter out santris who are already in the session
      const santriData = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            nama: doc.data().nama || '',
            kamar: doc.data().kamar || '',
            jenjangPendidikan: doc.data().jenjangPendidikan || '',
            statusAktif: doc.data().statusAktif || '',
            tahunMasuk: doc.data().tahunMasuk || '',
            kodeAsrama: doc.data().kodeAsrama
          }))
          .filter(santri => !existingSantriIds.has(santri.id));

      setAllSantris(santriData);

      // Apply initial filters
      applyFilters(santriData, filters);
    } catch (error) {
      console.error("Error fetching santri data:", error);
      setError("Gagal memuat data santri. Silakan coba lagi.");
    } finally {
      setIsLoadingSantris(false);
    }
  };

  // Apply filters
  const applyFilters = (data: Santri[], currentFilters: typeof filters) => {
    let filtered = [...data];

    if (currentFilters.statusAktif) {
      filtered = filtered.filter(santri => santri.statusAktif === currentFilters.statusAktif);
    }

    if (currentFilters.kamar) {
      filtered = filtered.filter(santri => santri.kamar === currentFilters.kamar);
    }

    if (currentFilters.jenjangPendidikan) {
      filtered = filtered.filter(santri => santri.jenjangPendidikan === currentFilters.jenjangPendidikan);
    }

    setFilteredSantris(filtered);
    setIsSelectAll(false);
  };

  // Handle filter changes
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    applyFilters(allSantris, newFilters);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedSantriIds(new Set());
    } else {
      const newSelectedIds = new Set<string>();
      filteredSantris.forEach(santri => newSelectedIds.add(santri.id));
      setSelectedSantriIds(newSelectedIds);
    }
    setIsSelectAll(!isSelectAll);
  };

  // Handle individual selection
  const handleSelectSantri = (santriId: string) => {
    const newSelectedIds = new Set(selectedSantriIds);
    if (newSelectedIds.has(santriId)) {
      newSelectedIds.delete(santriId);
    } else {
      newSelectedIds.add(santriId);
    }
    setSelectedSantriIds(newSelectedIds);
    setIsSelectAll(newSelectedIds.size === filteredSantris.length && filteredSantris.length > 0);
  };

  // Add santris to session
  const handleAddSantris = async () => {
    if (!currentSession || !teacherId || selectedSantriIds.size === 0) return;

    setIsAddingSantris(true);
    try {
      const success = await addSantrisToSession(
          sessionId,
          Array.from(selectedSantriIds),
          teacherId
      );

      if (success) {
        // Close modal and reset
        setShowAddSantriModal(false);
        setSelectedSantriIds(new Set());
        setIsSelectAll(false);
      } else {
        setError("Gagal menambahkan santri. Silakan coba lagi.");
      }
    } catch (error) {
      console.error("Error adding santris:", error);
      setError("Terjadi kesalahan saat menambahkan santri.");
    } finally {
      setIsAddingSantris(false);
    }
  };

  // Load santris when modal opens
  useEffect(() => {
    if (showAddSantriModal) {
      fetchAvailableSantris();
    } else {
      // Reset selections when modal closes
      setSelectedSantriIds(new Set());
      setIsSelectAll(false);
    }
  }, [showAddSantriModal]);

  // Format date/time
  const formatDate = (date: Date) => {
    return format(date, 'dd MMMM yyyy');
  };
  
  // Format date/time in specific format for WhatsApp
  const formatDateTimeForWhatsApp = (date: Date) => {
    return format(date, 'EEEE, dd-MM-yyyy HH:mm', { locale: id });
  };
  
  // Generate session summary for WhatsApp
  const generateSessionSummary = () => {
    if (!currentSession) return '';
    
    // Count attendance statuses
    let presentCount = 0;
    let absentCount = 0;
    let sickCount = 0;
    let pulangCount = 0;
    const absentStudents: string[] = [];
    
    students.forEach(student => {
      const status = currentSession.studentStatuses[student.id]?.status;
      
      switch(status) {
        case 'present':
        case 'overridePresent':
          presentCount++;
          break;
        case 'absent':
          absentCount++;
          if (student.nama) absentStudents.push(student.nama);
          break;
        case 'excusedSick':
          sickCount++;
          break;
        case 'excusedPulang':
          pulangCount++;
          break;
      }
    });
    
    // Get session date
    const sessionDate = currentSession.timestamp 
      ? new Date(currentSession.timestamp.seconds * 1000) 
      : new Date();
    
    // Build the summary message
    let summary = `*LAPORAN KEHADIRAN SANTRI*\n\n`;
    summary += `*Kegiatan:* ${currentSession.attendanceType}\n`;
    summary += `*Waktu:* ${formatDateTimeForWhatsApp(sessionDate)}\n\n`;
    summary += `*Ringkasan:*\n`;
    summary += `✅ Hadir: ${presentCount} santri\n`;
    summary += `🤒 Sakit: ${sickCount} santri\n`;
    summary += `🏠 Pulang: ${pulangCount} santri\n`;
    summary += `❌ Tidak Hadir: ${absentCount} santri\n\n`;
    
    // Add list of absent students if any
    if (absentStudents.length > 0) {
      summary += `*Daftar Santri Tidak Hadir:*\n`;
      absentStudents.forEach((name, index) => {
        summary += `${index + 1}. ${name}\n`;
      });
    }
    
    return summary;
  };
  
  // Open WhatsApp with session summary
  const shareToWhatsApp = () => {
    const summary = generateSessionSummary();
    const encodedSummary = encodeURIComponent(summary);
    const whatsappUrl = `whatsapp://send?text=${encodedSummary}`;
    window.open(whatsappUrl, '_blank');
  };

  // Loading state
  if (loading || !currentSession || students.length === 0) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto relative">
              <div className="absolute inset-0 rounded-full bg-indigo-100 dark:bg-indigo-900/20
                        shadow-[inset_10px_-10px_15px_rgba(255,255,255,0.55),inset_-10px_10px_15px_rgba(70,27,169,0.1)]
                        dark:shadow-[inset_10px_-10px_15px_rgba(10,10,20,0.5),inset_-10px_10px_15px_rgba(90,50,220,0.2)]">
              </div>
              <svg className="animate-spin h-12 w-12 text-indigo-600 dark:text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                   xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="mt-4 text-base font-medium text-gray-600 dark:text-gray-300">Memuat data absensi...</p>
          </div>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header Card */}
          <div className="mb-8 rounded-2xl p-6 relative
                      bg-white dark:bg-gray-800
                      shadow-[5px_5px_15px_rgba(0,0,0,0.07),_-5px_-5px_15px_rgba(255,255,255,0.8)]
                      dark:shadow-[5px_5px_15px_rgba(0,0,0,0.3),_-5px_-5px_15px_rgba(255,255,255,0.04)]
                      border border-gray-100 dark:border-gray-700/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
                  Presensi {currentSession.attendanceType}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {currentSession.timestamp && formatDate(currentSession.timestamp.toDate())}
                </p>
                <div className="flex items-center gap-3 mt-2">
                {/*<span className="bg-gray-100 dark:bg-gray-700 py-1 px-3 rounded-full text-sm text-gray-600 dark:text-gray-300">*/}
                {/*  Asrama: {currentSession.kodeAsrama}*/}
                {/*</span>*/}
                {/*  {currentSession.attendanceTypeId && (*/}
                {/*      <span className="bg-indigo-50 dark:bg-indigo-900/30 py-1 px-3 rounded-full text-sm text-indigo-700 dark:text-indigo-300">*/}
                {/*    {currentSession.attendanceTypeId}*/}
                {/*  </span>*/}
                {/*  )}*/}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <NetworkStatusIndicator />

                {!currentSession.isActive && (
                  <>
                    <div className="text-center px-4 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-full text-sm font-medium text-red-600 dark:text-red-300">
                      Sesi telah ditutup
                    </div>
                    <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <button 
                        onClick={shareToWhatsApp}
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline"
                      >
                        Bagikan ringkasan ke WhatsApp
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                  onClick={() => router.push('/attendance')}
                  className="px-5 py-2.5 bg-white dark:bg-gray-800
                        text-gray-700 dark:text-gray-200 font-medium rounded-full
                        shadow-[3px_3px_10px_rgba(0,0,0,0.08),_-3px_-3px_10px_rgba(255,255,255,0.8)]
                        dark:shadow-[3px_3px_10px_rgba(0,0,0,0.25),_-3px_-3px_10px_rgba(255,255,255,0.04)]
                        hover:shadow-[1px_1px_5px_rgba(0,0,0,0.08),_-1px_-1px_5px_rgba(255,255,255,0.8)]
                        dark:hover:shadow-[1px_1px_5px_rgba(0,0,0,0.25),_-1px_-1px_5px_rgba(255,255,255,0.04)]
                        transition-all duration-200 hover:translate-y-0.5
                        border border-gray-100 dark:border-gray-700/50"
              >
                ← Kembali
              </button>

              {currentSession.isActive && (
                  <>
                    <button
                        onClick={shareToWhatsApp}
                        className="px-5 py-2.5 bg-green-500 
                            text-white font-medium rounded-full
                            shadow-[3px_3px_10px_rgba(0,0,0,0.08),_-3px_-3px_10px_rgba(255,255,255,0.8)]
                            dark:shadow-[3px_3px_10px_rgba(0,0,0,0.25),_-3px_-3px_10px_rgba(255,255,255,0.04)]
                            hover:shadow-[1px_1px_5px_rgba(0,0,0,0.08),_-1px_-1px_5px_rgba(255,255,255,0.8)]
                            dark:hover:shadow-[1px_1px_5px_rgba(0,0,0,0.25),_-1px_-1px_5px_rgba(255,255,255,0.04)]
                            transition-all duration-200 hover:translate-y-0.5
                            border border-green-400"
                    >
                      Share ke WhatsApp
                    </button>
                    
                    <button
                        onClick={handleCloseSession}
                        className="px-5 py-2.5 bg-white dark:bg-gray-800
                            text-red-600 dark:text-red-400 font-medium rounded-full
                            shadow-[3px_3px_10px_rgba(0,0,0,0.08),_-3px_-3px_10px_rgba(255,255,255,0.8)]
                            dark:shadow-[3px_3px_10px_rgba(0,0,0,0.25),_-3px_-3px_10px_rgba(255,255,255,0.04)]
                            hover:shadow-[1px_1px_5px_rgba(0,0,0,0.08),_-1px_-1px_5px_rgba(255,255,255,0.8)]
                            dark:hover:shadow-[1px_1px_5px_rgba(0,0,0,0.25),_-1px_-1px_5px_rgba(255,255,255,0.04)]
                            transition-all duration-200 hover:translate-y-0.5
                            border border-red-100 dark:border-red-800/30
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isClosing}
                    >
                      {isClosing ? 'Menutup Sesi...' : 'Tutup Sesi'}
                    </button>
                  </>
              )}


              {/*<button*/}
              {/*    onClick={handleDeleteSession}*/}
              {/*    className="px-5 py-2.5 bg-red-50 dark:bg-red-900/20*/}
              {/*          text-red-600 dark:text-red-400 font-medium rounded-full*/}
              {/*          shadow-[3px_3px_10px_rgba(0,0,0,0.08),_-3px_-3px_10px_rgba(255,255,255,0.8)]*/}
              {/*          dark:shadow-[3px_3px_10px_rgba(0,0,0,0.25),_-3px_-3px_10px_rgba(255,255,255,0.04)]*/}
              {/*          hover:shadow-[1px_1px_5px_rgba(0,0,0,0.08),_-1px_-1px_5px_rgba(255,255,255,0.8)]*/}
              {/*          dark:hover:shadow-[1px_1px_5px_rgba(0,0,0,0.25),_-1px_-1px_5px_rgba(255,255,255,0.04)]*/}
              {/*          transition-all duration-200 hover:translate-y-0.5*/}
              {/*          border border-red-100 dark:border-red-800/30*/}
              {/*          disabled:opacity-50 disabled:cursor-not-allowed"*/}
              {/*    disabled={isDeleting}*/}
              {/*>*/}
              {/*  {isDeleting ? 'Menghapus...' : 'Hapus Sesi'}*/}
              {/*</button>*/}

              {currentSession.isActive && (
                  <button
                      onClick={() => setShowAddSantriModal(true)}
                      className="px-5 py-2.5 bg-green-50 dark:bg-green-900/20
                          text-green-600 dark:text-green-400 font-medium rounded-full
                          shadow-[3px_3px_10px_rgba(0,0,0,0.08),_-3px_-3px_10px_rgba(255,255,255,0.8)]
                          dark:shadow-[3px_3px_10px_rgba(0,0,0,0.25),_-3px_-3px_10px_rgba(255,255,255,0.04)]
                          hover:shadow-[1px_1px_5px_rgba(0,0,0,0.08),_-1px_-1px_5px_rgba(255,255,255,0.8)]
                          dark:hover:shadow-[1px_1px_5px_rgba(0,0,0,0.25),_-1px_-1px_5px_rgba(255,255,255,0.04)]
                          transition-all duration-200 hover:translate-y-0.5
                          border border-green-100 dark:border-green-800/30"
                  >
                    Tambah Santri
                  </button>
              )}
            </div>
          </div>

          {/* Stats Section */}
          <div className="mb-8 rounded-2xl p-6 relative
                      bg-gray-50 dark:bg-gray-800/50
                      shadow-[5px_5px_15px_rgba(0,0,0,0.05),_-5px_-5px_15px_rgba(255,255,255,0.6)]
                      dark:shadow-[5px_5px_15px_rgba(0,0,0,0.2),_-5px_-5px_15px_rgba(255,255,255,0.03)]
                      border border-gray-100/80 dark:border-gray-700/50">
            <h2 className="text-xl font-bold mb-5 text-gray-800 dark:text-gray-100">Ringkasan Presensi</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <div className="rounded-2xl p-4 relative
                          bg-white dark:bg-gray-800
                          shadow-[5px_5px_15px_rgba(0,0,0,0.05),_-5px_-5px_15px_rgba(255,255,255,0.9)]
                          dark:shadow-[5px_5px_15px_rgba(0,0,0,0.2),_-5px_-5px_15px_rgba(255,255,255,0.03)]
                          border border-green-100/50 dark:border-green-900/10">
                <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                  {students.filter(s => currentSession.studentStatuses?.[s.id]?.status === 'present').length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hadir</div>
              </div>
              <div className="rounded-2xl p-4 relative
                          bg-white dark:bg-gray-800
                          shadow-[5px_5px_15px_rgba(0,0,0,0.05),_-5px_-5px_15px_rgba(255,255,255,0.9)]
                          dark:shadow-[5px_5px_15px_rgba(0,0,0,0.2),_-5px_-5px_15px_rgba(255,255,255,0.03)]
                          border border-red-100/50 dark:border-red-900/10">
                <div className="text-4xl font-bold text-red-600 dark:text-red-400">
                  {students.filter(s => currentSession.studentStatuses?.[s.id]?.status === 'absent').length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tidak Hadir</div>
              </div>
              <div className="rounded-2xl p-4 relative
                          bg-white dark:bg-gray-800
                          shadow-[5px_5px_15px_rgba(0,0,0,0.05),_-5px_-5px_15px_rgba(255,255,255,0.9)]
                          dark:shadow-[5px_5px_15px_rgba(0,0,0,0.2),_-5px_-5px_15px_rgba(255,255,255,0.03)]
                          border border-yellow-100/50 dark:border-yellow-900/10">
                <div className="text-4xl font-bold text-yellow-600 dark:text-yellow-400">
                  {students.filter(s => currentSession.studentStatuses?.[s.id]?.status === 'excusedSick').length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sakit</div>
              </div>
              <div className="rounded-2xl p-4 relative
                          bg-white dark:bg-gray-800
                          shadow-[5px_5px_15px_rgba(0,0,0,0.05),_-5px_-5px_15px_rgba(255,255,255,0.9)]
                          dark:shadow-[5px_5px_15px_rgba(0,0,0,0.2),_-5px_-5px_15px_rgba(255,255,255,0.03)]
                          border border-blue-100/50 dark:border-blue-900/10">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {students.filter(s => currentSession.studentStatuses?.[s.id]?.status === 'excusedPulang').length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pulang</div>
              </div>
            </div>
          </div>

          {/* Students Grid */}
          <div className="students-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {students.map(student => (
                <StudentCard
                    key={student.id}
                    student={student}
                    sessionId={sessionId}
                    teacherId={teacherId || ''}
                />
            ))}
          </div>

          {/* Add Santri Modal */}
          {showAddSantriModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto
                         border border-gray-200 dark:border-gray-700
                         shadow-[8px_8px_20px_rgba(0,0,0,0.12),_-8px_-8px_20px_rgba(255,255,255,0.5)]
                         dark:shadow-[8px_8px_20px_rgba(0,0,0,0.4),_-8px_-8px_20px_rgba(255,255,255,0.03)]">
                  <h3 className="text-2xl font-bold mb-5 text-gray-800 dark:text-gray-100">Tambah Santri ke Sesi Presensi</h3>

                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label htmlFor="statusAktif" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Status Aktif
                      </label>
                      <select
                          id="statusAktif"
                          name="statusAktif"
                          value={filters.statusAktif}
                          onChange={handleFilterChange}
                          className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:text-white px-3 py-2"
                      >
                        <option value="">Semua Status</option>
                        <option value="Aktif">Aktif</option>
                        <option value="Boyong">Boyong</option>
                        <option value="Lulus">Lulus</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="kamar" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Kamar
                      </label>
                      <select
                          id="kamar"
                          name="kamar"
                          value={filters.kamar}
                          onChange={handleFilterChange}
                          className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:text-white px-3 py-2"
                      >
                        <option value="">Semua Kamar</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        {/* Add more kamar options as needed */}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="jenjangPendidikan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Jenjang Pendidikan
                      </label>
                      <select
                          id="jenjangPendidikan"
                          name="jenjangPendidikan"
                          value={filters.jenjangPendidikan}
                          onChange={handleFilterChange}
                          className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:text-white px-3 py-2"
                      >
                        <option value="">Semua Jenjang</option>
                        <option value="MTs">MTs</option>
                        <option value="MA">MA</option>
                        <option value="Aliyah">Aliyah</option>
                        <option value="SMP">SMP</option>
                        <option value="SMA">SMA</option>
                        {/* Add more jenjang options as needed */}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center mb-4">
                    <input
                        type="checkbox"
                        id="selectAll"
                        checked={isSelectAll}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-indigo-600 bg-gray-100 border-gray-300 rounded mr-2 focus:ring-indigo-500"
                    />
                    <label htmlFor="selectAll" className="text-gray-700 dark:text-gray-300 text-sm">Pilih Semua</label>
                  </div>

                  {isLoadingSantris && (
                      <div className="py-4 text-center text-gray-600 dark:text-gray-300">Memuat data santri...</div>
                  )}

                  {!isLoadingSantris && filteredSantris.length === 0 && (
                      <div className="py-4 text-center text-gray-600 dark:text-gray-300">Tidak ada santri tersedia.</div>
                  )}

                  {!isLoadingSantris && filteredSantris.length > 0 && (
                      <ul className="space-y-2 mb-6">
                        {filteredSantris.map(santri => (
                            <li key={santri.id} className="flex items-center">
                              <input
                                  type="checkbox"
                                  checked={selectedSantriIds.has(santri.id)}
                                  onChange={() => handleSelectSantri(santri.id)}
                                  className="h-4 w-4 text-indigo-600 bg-gray-100 border-gray-300 rounded mr-2 focus:ring-indigo-500"
                              />
                              <span className="text-gray-700 dark:text-gray-300 text-sm">
                        {santri.nama} - Kamar {santri.kamar}, {santri.jenjangPendidikan}
                      </span>
                            </li>
                        ))}
                      </ul>
                  )}

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={() => setShowAddSantriModal(false)}
                        className="px-5 py-2.5 bg-white dark:bg-gray-700
                            text-gray-700 dark:text-gray-300 font-medium rounded-full
                            shadow-[3px_3px_10px_rgba(0,0,0,0.06),_-3px_-3px_10px_rgba(255,255,255,0.6)]
                            dark:shadow-[3px_3px_10px_rgba(0,0,0,0.4),_-3px_-3px_10px_rgba(255,255,255,0.03)]
                            hover:shadow-[1px_1px_5px_rgba(0,0,0,0.04),_-1px_-1px_5px_rgba(255,255,255,0.6)]
                            dark:hover:shadow-[1px_1px_5px_rgba(0,0,0,0.3),_-1px_-1px_5px_rgba(255,255,255,0.02)]
                            transition-all duration-200 hover:translate-y-0.5
                            border border-gray-200 dark:border-gray-600"
                    >
                      Batal
                    </button>

                    <button
                        onClick={handleAddSantris}
                        disabled={selectedSantriIds.size === 0 || isAddingSantris}
                        className="px-5 py-2.5 bg-green-600 dark:bg-green-500
                            text-white font-medium rounded-full
                            shadow-[3px_3px_10px_rgba(0,0,0,0.12),_-3px_-3px_10px_rgba(255,255,255,0.5)]
                            dark:shadow-[3px_3px_10px_rgba(0,0,0,0.4),_-3px_-3px_10px_rgba(255,255,255,0.02)]
                            hover:shadow-[1px_1px_5px_rgba(0,0,0,0.12),_-1px_-1px_5px_rgba(255,255,255,0.5)]
                            dark:hover:shadow-[1px_1px_5px_rgba(0,0,0,0.4),_-1px_-1px_5px_rgba(255,255,255,0.02)]
                            transition-all duration-200 hover:translate-y-0.5
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAddingSantris ? 'Menambahkan...' : `Tambahkan (${selectedSantriIds.size})`}
                    </button>
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>
  );
}
