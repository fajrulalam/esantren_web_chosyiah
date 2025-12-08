import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { markAttendance, overrideSickStatus, overrideReturnStatus } from '@/firebase/attendance';
import useAttendanceStore from '@/app/attendance/store';
import { SantriWithAttendance } from '@/types/attendance';
import {
  CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, ArrowRightStartOnRectangleIcon, InformationCircleIcon, ClockIcon
} from '@heroicons/react/24/solid';

// Custom hook for handling long press
function useLongPress(callback: () => void, ms = 700) {
  // Use a ref for the timer instead of state to avoid re-renders
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const start = useCallback(() => {
    console.log("Starting long press timer");
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Set new timer
    timerRef.current = setTimeout(callback, ms);
  }, [callback, ms]);
  
  const stop = useCallback(() => {
    console.log("Stopping long press timer");
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  
  // Ensure timer is cleared on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  
  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop
  };
}

interface StudentCardProps {
  student: SantriWithAttendance;
  sessionId: string;
  teacherId: string;
}

const StudentCard = memo(({ student, sessionId, teacherId }: StudentCardProps) => {
  const { currentSession } = useAttendanceStore();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [justLongPressed, setJustLongPressed] = useState(false);

  // For display, use the current status from session if available, or calculate it
  const studentStatus = currentSession?.studentStatuses?.[student.id]?.status || 
                       (student.statusKehadiran === 'Sakit' ? 'excusedSick' : 
                        student.statusKehadiran === 'Pulang' ? 'excusedPulang' : 'absent');
  
  // For debugging - log the status to make sure it's working
  useEffect(() => {
    console.log(`Student ${student.nama} (${student.id}): statusKehadiran=${student.statusKehadiran}, studentStatus=${studentStatus}`);
    
    if (currentSession?.studentStatuses?.[student.id]) {
      console.log(`  - Status in session: ${currentSession.studentStatuses[student.id].status}`);
    } else {
      console.log(`  - No status in session yet, will display: ${studentStatus}`);
    }
  }, [currentSession, student, studentStatus]);
  const isLateReturning =
      student.statusKehadiran === 'Pulang' &&
      student.statusKepulangan?.rencanaTanggalKembali?.toDate() < new Date() &&
      !student.statusKepulangan?.sudahKembali;

  // --- Action Handlers (Simplified to ensure functionality) ---
  const handleStatusToggle = useCallback(async () => {
    if (justLongPressed) {
      console.log("Ignoring click after long press");
      setJustLongPressed(false);
      return;
    }
    
    // For students with special status (Sakit or Pulang), show the modal instead of toggling
    if (student.statusKehadiran === 'Sakit' || student.statusKehadiran === 'Pulang') {
      console.log(`Showing status modal for ${student.nama} (${student.statusKehadiran})`);
      setShowStatusModal(true);
      return;
    }
    
    let newStatus;
    
    // Simple toggle between states for regular students
    if (studentStatus === 'present') {
      newStatus = 'excusedSick';
    } else if (studentStatus === 'absent') {
      newStatus = 'present';
    } else if (studentStatus === 'excusedSick') {
      newStatus = 'absent';
    } else if (studentStatus === 'dispen') {
      newStatus = 'present';
    } else if (studentStatus === 'excusedPulang') {
      // If pulang but statusKehadiran is not Pulang (the status was changed in SantriCollection)
      // Then toggle like normal
      newStatus = 'present';
    } else {
      // For other cases
      newStatus = 'present';
    }
    
    console.log(`Toggling status for ${student.nama} from ${studentStatus} to ${newStatus}`);
    
    try {
      await markAttendance(sessionId, student.id, newStatus, teacherId);
    } catch (error) { 
      console.error("Failed to mark attendance:", error); 
    }
  }, [studentStatus, student.id, student.nama, student.statusKehadiran, sessionId, teacherId, justLongPressed, setShowStatusModal]);

  // Handle long press
  const handleLongPress = useCallback(() => {
    console.log("Long press detected for", student.nama);
    setJustLongPressed(true);
    
    if (student.statusKehadiran === 'Sakit' || student.statusKehadiran === 'Pulang') {
      console.log("Showing status modal for", student.nama);
      // Show status override modal for sick or returning students
      setShowStatusModal(true); 
    } else {
      console.log("Marking", student.nama, "as dispen");
      // Mark as dispen on long press for regular students
      markAttendance(sessionId, student.id, 'dispen', teacherId)
        .then(() => {
          console.log("Successfully marked as dispen");
          // No need to refresh since we're using real-time updates
        })
        .catch(error => console.error("Failed to mark dispensation:", error));
    }
    
    // Reset after a delay
    setTimeout(() => {
      setJustLongPressed(false);
    }, 800);
  }, [student.nama, student.statusKehadiran, student.id, sessionId, teacherId, setShowStatusModal]);

  // Use our custom hook
  const longPressEvent = useLongPress(handleLongPress, 700);

  const handleStatusOverride = async (action: 'recover' | 'returned' | 'present' | 'absent' | 'sick') => {
    try {
      if (action === 'recover' && student.statusKehadiran === 'Sakit') {
        // Mark as recovered in SantriCollection (changes the base status)
        await overrideSickStatus(student.id, false, teacherId, student.statusSakit!);
        if (studentStatus === 'excusedSick') await markAttendance(sessionId, student.id, 'present', teacherId);
      } else if (action === 'returned' && student.statusKehadiran === 'Pulang') {
        // Mark as returned in SantriCollection (changes the base status)
        await overrideReturnStatus(student.id, true, teacherId, student.statusKepulangan!);
        if (studentStatus === 'excusedPulang') await markAttendance(sessionId, student.id, 'present', teacherId);
      } else if (action === 'present') {
        // Just mark as present in the attendance session without changing SantriCollection status
        await markAttendance(sessionId, student.id, 'present', teacherId);
      } else if (action === 'absent') {
        // Mark as absent in the attendance session
        await markAttendance(sessionId, student.id, 'absent', teacherId);
      } else if (action === 'sick') {
        // Mark as sick in the attendance session
        await markAttendance(sessionId, student.id, 'excusedSick', teacherId);
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
      case 'dispen':
        bgColor = 'bg-purple-500 dark:bg-purple-600';
        shadow = 'shadow-[inset_3px_3px_6px_#7e22ce,inset_-3px_-3px_6px_#a855f7] dark:shadow-[inset_3px_3px_6px_#6b21a8,inset_-3px_-3px_6px_#9333ea]';
        break;
      default:
        bgColor = 'bg-slate-400 dark:bg-slate-600';
        textColor = 'text-slate-800 dark:text-slate-100';
        shadow = 'shadow-[inset_3px_3px_6px_#94a3b8,inset_-3px_-3px_6px_#cbd5e1] dark:shadow-[inset_3px_3px_6px_#475569,inset_-3px_-3px_6px_#64748b]';
    }
    // Base style + dynamic colors/shadows
    return `flex flex-col items-center justify-center w-16 h-16 rounded-lg ml-2 shrink-0 ${bgColor} ${textColor} ${shadow} transition-colors duration-300`;
  };


  // --- Icon and Text Helpers (Updated) ---
  const getStatusIcon = (status: typeof studentStatus): React.ReactNode => {
    const iconClass = "w-6 h-6 mb-0.5";
    // Adjusted icon colors for potentially better contrast on the new indicator backgrounds
    switch (status) {
      case 'present': return <CheckCircleIcon className={iconClass + " text-emerald-100 dark:text-emerald-100"} />;
      case 'absent': return <XCircleIcon className={iconClass + " text-rose-100 dark:text-rose-100"} />;
      case 'excusedSick': return <InformationCircleIcon className={iconClass + " text-amber-100 dark:text-amber-100"} />;
      case 'excusedPulang': return <ArrowRightStartOnRectangleIcon className={iconClass + " text-sky-100 dark:text-sky-100"} />;
      case 'dispen': return <ExclamationTriangleIcon className={iconClass + " text-purple-100 dark:text-purple-100"} />;
      default: return null;
    }
  };
  const getStatusText = (status: typeof studentStatus): string => {
    switch (status) {
      case 'present': return 'Hadir'; 
      case 'absent': return 'Absen'; 
      case 'excusedSick': return 'Sakit'; 
      case 'excusedPulang': return 'Pulang'; 
      case 'dispen': return 'Dispen';
      default: return 'Unknown';
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
            {...longPressEvent}
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
                    <div className="mb-4">
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 text-center">Santri ini ditandai sedang sakit.</p>
                      
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status kehadiran sesi ini:</p>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <button 
                          onClick={() => handleStatusOverride('present')} 
                          className={`px-2 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium ${studentStatus === 'present' ? 'ring-2 ring-emerald-500' : ''}`}
                        >
                          Hadir
                        </button>
                        <button 
                          onClick={() => handleStatusOverride('absent')} 
                          className={`px-2 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium ${studentStatus === 'absent' ? 'ring-2 ring-red-500' : ''}`}
                        >
                          Tidak Hadir
                        </button>
                        <button 
                          onClick={() => handleStatusOverride('sick')} 
                          className={`px-2 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium ${studentStatus === 'excusedSick' ? 'ring-2 ring-amber-500' : ''}`}
                        >
                          Sakit
                        </button>
                      </div>
                      
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Update status di sistem:</p>
                        <button 
                          onClick={() => handleStatusOverride('recover')} 
                          className={modalButtonStyle('confirm')}
                        >
                          <CheckCircleIcon className="w-4 h-4" /> Tandai Sembuh
                        </button>
                      </div>
                    </div>
                )}
                {student.statusKehadiran === 'Pulang' && (
                    <div className="mb-4">
                      <div className="text-center mb-3">
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Santri ini ditandai sedang pulang.</p>
                        {student.statusKepulangan?.rencanaTanggalKembali && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Rencana kembali: {format(student.statusKepulangan.rencanaTanggalKembali.toDate(), 'dd MMM yy')}
                            </p>
                        )}
                      </div>
                      
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status kehadiran sesi ini:</p>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <button 
                          onClick={() => handleStatusOverride('present')} 
                          className={`px-2 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium ${studentStatus === 'present' ? 'ring-2 ring-emerald-500' : ''}`}
                        >
                          Hadir
                        </button>
                        <button 
                          onClick={() => handleStatusOverride('absent')} 
                          className={`px-2 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium ${studentStatus === 'absent' ? 'ring-2 ring-red-500' : ''}`}
                        >
                          Tidak Hadir
                        </button>
                        <button 
                          onClick={() => handleStatusOverride('sick')} 
                          className={`px-2 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium ${studentStatus === 'excusedPulang' ? 'ring-2 ring-sky-500' : ''}`}
                        >
                          Pulang
                        </button>
                      </div>
                      
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Update status di sistem:</p>
                        <button 
                          onClick={() => handleStatusOverride('returned')} 
                          className={modalButtonStyle('confirm')}
                        >
                          <CheckCircleIcon className="w-4 h-4" /> Tandai Kembali
                        </button>
                      </div>
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