'use client';

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { KODE_ASRAMA } from '@/constants';
import useAttendanceStore from './store';
import SessionSelector from '@/components/attendance/SessionSelector';
import LateReturnAlerts from '@/components/attendance/LateReturnAlerts';
import NetworkStatusIndicator from '@/components/attendance/NetworkStatus';

export default function AttendanceHome() {
    const [teacherId, setTeacherId] = useState<string | null>(null);
    const [teacherName, setTeacherName] = useState<string>('');
    const { setKodeAsrama } = useAttendanceStore();
    const [isLoading, setIsLoading] = useState(true);

    // Load teacher info on mount
    useEffect(() => {
        const loadTeacherInfo = async () => {
            setIsLoading(true);
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

                    // Set kode asrama from constants
                    setKodeAsrama(KODE_ASRAMA);
                }
            } catch (error) {
                console.error("Error loading teacher info:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTeacherInfo();
    }, [setKodeAsrama]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-3">Memuat informasi...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Sistem Absensi Asrama</h1>
                    <p className="text-gray-600 dark:text-gray-400">Selamat datang, {teacherName}</p>
                </div>

                <NetworkStatusIndicator />
            </div>

            {teacherId && (
                <>
                    <LateReturnAlerts kodeAsrama={KODE_ASRAMA} teacherId={teacherId} />

                    <SessionSelector kodeAsrama={KODE_ASRAMA} teacherId={teacherId} />

                    <div className="mt-8">
                        <h2 className="text-xl font-semibold mb-4">Menu Lainnya</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <a
                                href="/attendance/report"
                                className="block p-5 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                            >
                                <h3 className="text-lg font-medium mb-2">Laporan Kehadiran</h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Lihat dan unduh laporan kehadiran santri berdasarkan rentang tanggal.
                                </p>
                            </a>

                            <a
                                href="/attendance/history"
                                className="block p-5 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                            >
                                <h3 className="text-lg font-medium mb-2">Sejarah Presensi</h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Lihat dan kelola sesi presensi yang telah ditutup.
                                </p>
                            </a>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}