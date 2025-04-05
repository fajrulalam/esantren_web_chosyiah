import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { markAttendance, overrideSickStatus, overrideReturnStatus } from '@/firebase/attendance';
import useAttendanceStore from '@/app/attendance/store';
import { SantriWithAttendance } from '@/types/attendance';
import {
  CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, ArrowRightStartOnRectangleIcon, InformationCircleIcon, ClockIcon
} from '@heroicons/react/24/solid';

interface StudentCardProps {
  student: SantriWithAttendance;
  sessionId: string;
  teacherId: string;
}

const StudentCard = memo(({ student, sessionId, teacherId }: StudentCardProps) => {
  const { currentSession } = useAttendanceStore();
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const studentStatus = currentSession?.studentStatuses?.[student.id]?.status || 'absent';
  const isLateReturning =
      student.statusKehadiran === 'Pulang' &&
      student.statusKepulangan?.rencanaTanggalKembali?.toDate() < new Date() &&
      !student.statusKepulangan?.sudahKembali;

  // --- Action Handlers (Keep the optimized handlers from previous version) ---
  const handleStatusToggle = useCallback(async () => {
    if (isLongPressing) return;
    let newStatus = studentStatus === 'present' ? 'absent' : 'present';
    if (student.statusKehadiran === 'Sakit' && newStatus === 'present') newStatus = 'excusedSick';
    else if (student.statusKehadiran === 'Pulang' && newStatus === 'present') newStatus = 'excusedPulang';
    try {
      await markAttendance(sessionId, student.id, newStatus as any, teacherId);
    } catch (error) { console.error("Failed to mark attendance:", error); }
  }, [studentStatus, student.id, student.statusKehadiran, sessionId, teacherId, isLongPressing]);

  const handleLongPressStart = useCallback(() => {
    if (student.statusKehadiran !== 'Sakit' && student.statusKehadiran !== 'Pulang') return;
    setIsLongPressing(true);
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => { if (isLongPressing) setShowStatusModal(true); }, 700);
  }, [student.statusKehadiran, isLongPressing]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    setTimeout(() => setIsLongPressing(false), 50);
  }, []);

  useEffect(() => {
    return () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
  }, []);

  const handleStatusOverride = async (action: 'recover' | 'returned') => {
    try {
      if (action === 'recover' && student.statusKehadiran === 'Sakit') {
        await overrideSickStatus(student.id, false, teacherId);
        if (studentStatus === 'excusedSick') await markAttendance(sessionId, student.id, 'present', teacherId);
      } else if (action === 'returned' && student.statusKehadiran === 'Pulang') {
        await overrideReturnStatus(student.id, true, teacherId);
        if (studentStatus === 'excusedPulang') await markAttendance(sessionId, student.id, 'present', teacherId);
      }
    } catch (error) { console.error("Failed to override status:", error); }
    finally { setShowStatusModal(false); }
  };
  // --- End Action Handlers ---

  // --- Claymorphism Styling Helpers (REVISED) ---

  const getCardClasses = () => {
    // Define base styles common to both modes
    const base = "flex items-center p-2 rounded-xl transition-all duration-300 ease-out relative overflow-hidden cursor-pointer";

    // Light mode styles
    const lightBg = "bg-slate-100";
    const lightShadow = "shadow-[6px_6px_12px_#d1d9e6,_-6px_-6px_12px_#ffffff]"; // Standard light clay shadow
    const lightHover = "hover:shadow-[4px_4px_8px_#d1d9e6,_-4px_-4px_8px_#ffffff]";
    const lightActive = "active:shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff] active:scale-[0.98] active:translate-y-[1px]";

    // Dark mode styles (with toned-down top-left shadow)
    const darkBg = "dark:bg-slate-800";
    // Toned-down top-left shadow: using a very subtle, darker grey (slate-700 with low opacity)
    const darkShadow = "dark:shadow-[6px_6px_12px_rgba(0,0,0,0.4),_-6px_-6px_12px_rgba(51,65,85,0.1)]"; // #334155 = slate-700, used with 10% opacity
    const darkHover = "dark:hover:shadow-[4px_4px_8px_rgba(0,0,0,0.4),_-4px_-4px_8px_rgba(51,65,85,0.1)]";
    const darkActive = "dark:active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(51,65,85,0.1)] active:scale-[0.98] active:translate-y-[1px]";


    // Combine all classes
    return `${base} ${lightBg} ${lightShadow} ${lightHover} ${lightActive} ${darkBg} ${darkShadow} ${darkHover} ${darkActive}`;
  };


  const getStatusIndicatorStyle = (status: typeof studentStatus): string => {
    let bgColor = '';
    let textColor = 'text-white'; // Mostly white text for contrast on colored backgrounds
    let shadow = '';

    // Soft status colors
    switch (status) {
      case 'present':
        bgColor = 'bg-emerald-500 dark:bg-emerald-600'; // Slightly stronger for indicator
        shadow = 'shadow-[inset_3px_3px_6px_#2a5a40,inset_-3px_-3px_6px_#408a60] dark:shadow-[inset_3px_3px_6px_#1e4634,inset_-3px_-3px_6px_#306b4b]';
        break;
      case 'absent':
        bgColor = 'bg-rose-500 dark:bg-rose-600';
        shadow = 'shadow-[inset_3px_3px_6px_#9f1239,inset_-3px_-3px_6px_#f43f5e] dark:shadow-[inset_3px_3px_6px_#7d1a34,inset_-3px_-3px_6px_#b9213f]';
        break;
      case 'excusedSick':
        bgColor = 'bg-amber-500 dark:bg-amber-600';
        shadow = 'shadow-[inset_3px_3px_6px_#b45309,inset_-3px_-3px_6px_#f59e0b] dark:shadow-[inset_3px_3px_6px_#92400e,inset_-3px_-3px_6px_#ca8a04]';
        break;
      case 'excusedPulang':
        bgColor = 'bg-sky-500 dark:bg-sky-600';
        shadow = 'shadow-[inset_3px_3px_6px_#0369a1,inset_-3px_-3px_6px_#38bdf8] dark:shadow-[inset_3px_3px_6px_#045581,inset_-3px_-3px_6px_#0ea5e9]';
        break;
      default:
        bgColor = 'bg-slate-400 dark:bg-slate-600';
        textColor = 'text-slate-800 dark:text-slate-100';
        shadow = 'shadow-[inset_3px_3px_6px_#94a3b8,inset_-3px_-3px_6px_#cbd5e1] dark:shadow-[inset_3px_3px_6px_#475569,inset_-3px_-3px_6px_#64748b]';
    }
    // Base style + dynamic colors/shadows
    return `flex flex-col items-center justify-center w-16 h-16 rounded-lg ml-2 shrink-0 ${bgColor} ${textColor} ${shadow} transition-colors duration-300`;
  };


  // --- Icon and Text Helpers (Unchanged) ---
  const getStatusIcon = (status: typeof studentStatus): React.ReactNode => {
    const iconClass = "w-6 h-6 mb-0.5";
    // Adjusted icon colors for potentially better contrast on the new indicator backgrounds
    switch (status) {
      case 'present': return <CheckCircleIcon className={iconClass + " text-emerald-100 dark:text-emerald-100"} />;
      case 'absent': return <XCircleIcon className={iconClass + " text-rose-100 dark:text-rose-100"} />;
      case 'excusedSick': return <InformationCircleIcon className={iconClass + " text-amber-100 dark:text-amber-100"} />;
      case 'excusedPulang': return <ArrowRightStartOnRectangleIcon className={iconClass + " text-sky-100 dark:text-sky-100"} />;
      default: return null;
    }
  };
  const getStatusText = (status: typeof studentStatus): string => {
    switch (status) {
      case 'present': return 'Hadir'; case 'absent': return 'Absen'; case 'excusedSick': return 'Sakit'; case 'excusedPulang': return 'Pulang'; default: return 'Unknown';
    }
  };

  // --- Modal Styling (Revised Shadows for Dark Mode) ---
  const modalOverlayStyle = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4";
  const modalContentStyle = `
      bg-slate-100 dark:bg-slate-800
      p-5 rounded-2xl w-full max-w-sm
      border border-white/20 dark:border-black/20
      shadow-[8px_8px_16px_#b8bec9,_-8px_-8px_16px_#ffffff]
      dark:shadow-[8px_8px_16px_rgba(0,0,0,0.4),_-8px_-8px_16px_rgba(51,65,85,0.1)]
    `; // Applied toned-down dark shadow logic here too

  const modalButtonStyle = (variant: 'confirm' | 'cancel'): string => {
    const base = `px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ease-out flex items-center justify-center gap-2 active:scale-[0.97]`;
    // Define shadows with toned-down dark mode top-left shadow
    const confirmShadow = `shadow-[3px_3px_6px_#a3cfbb,_-3px_-3px_6px_#e0fff0] dark:shadow-[3px_3px_6px_rgba(0,0,0,0.3),_-3px_-3px_6px_rgba(51,65,85,0.1)]`;
    const cancelShadow = `shadow-[3px_3px_6px_#d1d9e6,_-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_rgba(0,0,0,0.3),_-3px_-3px_6px_rgba(51,65,85,0.1)]`;
    const confirmActive = `active:shadow-[inset_1px_1px_3px_#2a5a40,inset_-1px_-1px_3px_#408a60] dark:active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3),inset_-1px_-1px_3px_rgba(51,65,85,0.1)]`;
    const cancelActive = `active:shadow-[inset_1px_1px_3px_#b8bec9,inset_-1px_-1px_3px_#ffffff] dark:active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3),inset_-1px_-1px_3px_rgba(51,65,85,0.1)]`;

    if (variant === 'confirm') {
      return `${base} bg-emerald-500 hover:bg-emerald-600 text-white ${confirmShadow} ${confirmActive}`;
    } else { // cancel
      return `${base} bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 ${cancelShadow} ${cancelActive}`;
    }
  };
  // --- End Styling ---


  // --- JSX Structure (Mostly Unchanged) ---
  const cardDynamicClasses = getCardClasses(); // Get combined classes
  const statusIndicatorDynamicClasses = getStatusIndicatorStyle(studentStatus);

  return (
      <>
        <div
            className={cardDynamicClasses} // Use the combined class string
            onClick={handleStatusToggle}
            onTouchStart={handleLongPressStart}
            onMouseDown={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
            onMouseUp={handleLongPressEnd}
            onTouchMove={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            role="button"
            tabIndex={0}
            aria-label={`Student ${student.nama}, Status: ${getStatusText(studentStatus)}. Tap to toggle, long press for options.`}
        >
          {/* Left Side: Info */}
          <div className="flex-grow pr-2 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{student.nama}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {student.kamar || '-'} / Sem: {student.semester || '-'}
            </p>
            {/* Base Status Badges */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {student.statusKehadiran === 'Sakit' && studentStatus !== 'excusedSick' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                <ExclamationTriangleIcon className="w-3 h-3 mr-1" /> Sakit
                            </span>
              )}
              {student.statusKehadiran === 'Pulang' && studentStatus !== 'excusedPulang' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                                <ArrowRightStartOnRectangleIcon className="w-3 h-3 mr-1" /> Pulang
                            </span>
              )}
              {isLateReturning && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                                <ClockIcon className="w-3 h-3 mr-1" /> Terlambat
                            </span>
              )}
            </div>
          </div>

          {/* Right Side: Status Indicator */}
          <div className={statusIndicatorDynamicClasses}> {/* Use dynamic classes */}
            {getStatusIcon(studentStatus)}
            <span className="text-[10px] font-medium leading-tight mt-0.5">
                        {getStatusText(studentStatus)}
                    </span>
          </div>
        </div>

        {/* Status Override Modal */}
        {showStatusModal && (
            <div className={modalOverlayStyle} onClick={() => setShowStatusModal(false)}>
              <div className={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <h3 className="text-base font-semibold mb-3 text-slate-800 dark:text-slate-100 text-center">
                  Update Status: {student.nama}
                </h3>
                {student.statusKehadiran === 'Sakit' && (
                    <div className="mb-4 text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Santri ini ditandai sedang sakit.</p>
                      <button onClick={() => handleStatusOverride('recover')} className={modalButtonStyle('confirm')}>
                        <CheckCircleIcon className="w-4 h-4" /> Tandai Sembuh
                      </button>
                    </div>
                )}
                {student.statusKehadiran === 'Pulang' && (
                    <div className="mb-4 text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Santri ini ditandai sedang pulang.</p>
                      {student.statusKepulangan?.rencanaTanggalKembali && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            Rencana kembali: {format(student.statusKepulangan.rencanaTanggalKembali.toDate(), 'dd MMM yy')}
                          </p>
                      )}
                      <button onClick={() => handleStatusOverride('returned')} className={modalButtonStyle('confirm')}>
                        <CheckCircleIcon className="w-4 h-4" /> Tandai Kembali
                      </button>
                    </div>
                )}
                <div className="mt-4 flex justify-center">
                  <button onClick={() => setShowStatusModal(false)} className={modalButtonStyle('cancel')}>
                    Tutup
                  </button>
                </div>
              </div>
            </div>
        )}
      </>
  );
});

StudentCard.displayName = 'StudentCard';

export default StudentCard;