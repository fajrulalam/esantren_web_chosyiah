import React, { useEffect, useState } from 'react';
import { query, collection, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { SantriWithAttendance } from '@/types/attendance';
import { overrideReturnStatus } from '@/firebase/attendance';
import { format } from 'date-fns';

interface LateReturnAlertsProps {
  kodeAsrama: string;
  teacherId: string;
}

export default function LateReturnAlerts({ kodeAsrama, teacherId }: LateReturnAlertsProps) {
  const [lateStudents, setLateStudents] = useState<SantriWithAttendance[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Set isClient flag after initial render
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!kodeAsrama || !isClient) return;

    const q = query(
      collection(db, "SantriCollection"),
      where("kodeAsrama", "==", kodeAsrama),
      where("statusKehadiran", "==", "Pulang") // Pre-filter in Firestore if possible
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allStudents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SantriWithAttendance));

      // Further filtering in client-side to find late students
      const now = new Date();
      const lateStuds = allStudents.filter(student =>
        student.statusKepulangan?.rencanaTanggalKembali?.toDate() < now &&
        !student.statusKepulangan?.sudahKembali
      );
      
      setLateStudents(lateStuds);
    });

    return () => unsubscribe();
  }, [kodeAsrama, isClient]);

  // Don't render anything on the server or during first render
  if (!isClient || lateStudents.length === 0) return null;

  return (
    <div className="late-return-alerts bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3">
        Santri Terlambat Kembali ({lateStudents.length})
      </h3>
      <ul className="divide-y divide-amber-200 dark:divide-amber-800">
        {lateStudents.map(student => {
          const plannedReturn = student.statusKepulangan?.rencanaTanggalKembali?.toDate();
          // Calculate on client side with memoization to avoid SSR/CSR mismatch
          const daysLate = React.useMemo(() => {
            if (!plannedReturn) return 'N/A';
            return Math.max(0, Math.floor((new Date().getTime() - plannedReturn.getTime()) / (1000 * 60 * 60 * 24)));
          }, [plannedReturn?.getTime()]);

          return (
            <li key={student.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-medium block">{student.nama}</span>
                <span className="text-sm text-amber-700 dark:text-amber-300 block">
                  Rencana kembali: {plannedReturn ? format(plannedReturn, 'dd MMM yyyy') : 'Unknown'}
                </span>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {daysLate === 0 ? 'Hari ini' : `${daysLate} hari terlambat`}
                </span>
              </div>
              
              <button
                onClick={() => overrideReturnStatus(student.id, true, teacherId, student)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
              >
                Tandai Sudah Kembali
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}