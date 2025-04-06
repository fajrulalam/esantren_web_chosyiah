import React from 'react';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { IzinSakitPulang } from '@/types/izinSakitPulang'; // Assuming this path is correct
import {
  CheckCircleIcon as CheckCircleSolid,
  XCircleIcon as XCircleSolid,
  ClockIcon as ClockSolid,
  ArrowUturnLeftIcon, // For "Sudah Kembali" / "Sudah Sembuh"
  ArrowRightStartOnRectangleIcon, // For "Pulang"
  HeartIcon as HeartPulseIcon, // Using HeartIcon from solid
  CalendarDaysIcon, // For dates
  InformationCircleIcon, // For reason/complaint
  TrashIcon,
  CheckIcon, // For Quick Approve
  XMarkIcon, // For Quick Reject
  ArrowRightIcon, // For connecting dates
} from '@heroicons/react/24/solid'; // Using solid icons for better visibility

// Props interface remains the same
export interface IzinCardProps {
  izin: IzinSakitPulang & { santriName?: string };
  formatDate: (timestamp: Timestamp) => string;
  detailLink: string;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  showQuickApprove?: boolean;
  showQuickReject?: boolean;
  onQuickApprove?: (application: IzinSakitPulang & { santriName?: string }, isNdalem: boolean) => void;
  onQuickReject?: (application: IzinSakitPulang & { santriName?: string }, isNdalem: boolean) => void;
  isNdalemAction?: boolean;
}

// Helper to determine if the process is completed (for styling/logic)
const isIzinCompleted = (izin: IzinSakitPulang) => {
  return ["Sudah Kembali", "Sudah Sembuh", "Ditolak", "Ditolak Ustadzah", "Ditolak Ndalem"].includes(izin.status);
};

// --- Status Badge Component (Unchanged) ---
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let bgColor = "bg-gray-200 dark:bg-gray-700";
  let textColor = "text-gray-700 dark:text-gray-200";
  let ringColor = "ring-gray-300 dark:ring-gray-600";
  let IconComponent = ClockSolid;

  switch (status) {
    case "Menunggu Persetujuan Ustadzah":
    case "Menunggu Diperiksa Ustadzah":
    case "Menunggu Persetujuan Ndalem":
      bgColor = "bg-yellow-100 dark:bg-yellow-800/50";
      textColor = "text-yellow-800 dark:text-yellow-200";
      ringColor = "ring-yellow-300 dark:ring-yellow-700";
      IconComponent = ClockSolid;
      break;
    case "Disetujui":
    case "Proses Pulang":
    case "Dalam Masa Sakit":
      bgColor = "bg-blue-100 dark:bg-blue-800/50";
      textColor = "text-blue-800 dark:text-blue-200";
      ringColor = "ring-blue-300 dark:ring-blue-700";
      IconComponent = CheckCircleSolid;
      break;
    case "Sudah Kembali":
    case "Sudah Sembuh":
      bgColor = "bg-green-100 dark:bg-green-800/50";
      textColor = "text-green-800 dark:text-green-200";
      ringColor = "ring-green-300 dark:ring-green-700";
      IconComponent = ArrowUturnLeftIcon;
      break;
    case "Ditolak":
    case "Ditolak Ustadzah":
    case "Ditolak Ndalem":
      bgColor = "bg-red-100 dark:bg-red-800/50";
      textColor = "text-red-800 dark:text-red-200";
      ringColor = "ring-red-300 dark:ring-red-700";
      IconComponent = XCircleSolid;
      break;
  }

  return (
      <div
          className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full
        text-xs font-medium tracking-wide
        ${bgColor} ${textColor}
        ring-1 ${ringColor} ring-inset
      `}
      >
        <IconComponent className="w-4 h-4 flex-shrink-0" />
        <span>{status}</span>
      </div>
  );
};

// --- Progress Bar Component (Improved Claymorphism) ---
const ProgressBar: React.FC<{ izin: IzinSakitPulang }> = ({ izin }) => {
  if (isIzinCompleted(izin)) return null;

  let progress = 0;
  let steps: string[] = [];
  let progressColor = "bg-yellow-500 dark:bg-yellow-400"; // Default pending

  // Determine steps and progress percentage
  if (izin.izinType === "Pulang") {
    steps = ["Pengajuan", "Ustadzah", "Ndalem", "Pulang"];
    switch (izin.status) {
      case "Menunggu Persetujuan Ustadzah": progress = 15; break;
      case "Menunggu Persetujuan Ndalem": progress = 45; break;
      case "Disetujui":
      case "Proses Pulang":
        progress = 75;
        progressColor = "bg-blue-500 dark:bg-blue-400";
        break;
      default: progress = 5;
    }
  } else if (izin.izinType === "Sakit") {
    steps = ["Pengajuan", "Diperiksa", "Sakit"];
    switch (izin.status) {
      case "Menunggu Diperiksa Ustadzah": progress = 20; break;
      case "Disetujui":
      case "Dalam Masa Sakit":
        progress = 60;
        progressColor = "bg-blue-500 dark:bg-blue-400";
        break;
      default: progress = 5;
    }
  } else {
    return null;
  }

  // Determine current step index for highlighting checkpoints
  let currentStepIndex = -1;
  if (izin.izinType === "Pulang") {
    if (["Menunggu Persetujuan Ustadzah"].includes(izin.status)) currentStepIndex = 0;
    else if (["Menunggu Persetujuan Ndalem"].includes(izin.status)) currentStepIndex = 1;
    else if (["Disetujui", "Proses Pulang"].includes(izin.status)) currentStepIndex = 2;
  } else if (izin.izinType === "Sakit") {
    if (["Menunggu Diperiksa Ustadzah"].includes(izin.status)) currentStepIndex = 0;
    else if (["Disetujui", "Dalam Masa Sakit"].includes(izin.status)) currentStepIndex = 1;
  }

  return (
      <div className="mt-4 mb-3 px-1">
        {/* Progress Bar Container with Improved Claymorphism */}
        <div className="relative h-2 w-full rounded-full bg-gradient-to-br from-slate-100 to-slate-300 dark:from-slate-700 dark:to-slate-800/90 shadow-[inset_2px_2px_3px_rgba(193,197,202,0.6),inset_-2px_-2px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_3px_rgba(44,48,54,0.7),inset_-2px_-2px_3px_rgba(74,81,90,0.7)]">
          {/* Progress Indicator (Clean fill) */}
          <div
              className={`absolute left-0 top-0 h-full rounded-full ${progressColor} transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
          ></div>
          {/* Checkpoint Circles (Claymorphic) */}
          <div className="absolute inset-0 flex items-center justify-between px-[2px]"> {/* Increased padding slightly for larger circles */}
            {steps.map((_, index) => {
              const isActive = index <= currentStepIndex;
              const isNext = index === currentStepIndex + 1;
              // Base background for circles
              let circleBg = isActive ? progressColor : 'bg-slate-200 dark:bg-slate-600/80';
              if (isNext) circleBg = 'bg-slate-300 dark:bg-slate-500/80'; // Slightly different for next step

              return (
                  <div
                      key={`step-circle-${index}`}
                      className={`
                                    w-3.5 h-3.5 rounded-full ${circleBg} transition-colors duration-300
                                    // Claymorphism for circles: subtle inset shadow
                                    shadow-[inset_1px_1px_1px_rgba(0,0,0,0.15),inset_-1px_-1px_1px_rgba(255,255,255,0.6)]
                                    dark:shadow-[inset_1px_1px_1px_rgba(0,0,0,0.4),inset_-1px_-1px_1px_rgba(74,81,90,0.4)]
                                `}
                  ></div>
              );
            })}
          </div>
        </div>

        {/* Step Labels (Aligned below checkpoints) */}
        <div className="flex justify-between text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">
          {steps.map((step, index) => (
              <span key={step} className={`
                        w-1/${steps.length} text-center // Ensure even distribution
                        ${index <= currentStepIndex ? 'font-semibold text-slate-700 dark:text-slate-200' : ''}
                        ${index === currentStepIndex + 1 ? 'text-slate-600 dark:text-slate-300' : ''}
                    `}>
                        {step}
                    </span>
          ))}
        </div>
      </div>
  );
};


// --- Main Card Component ---
const IzinCard: React.FC<IzinCardProps> = ({
                                             izin,
                                             formatDate,
                                             detailLink,
                                             canDelete = false,
                                             onDelete,
                                             showQuickApprove = false,
                                             showQuickReject = false,
                                             onQuickApprove,
                                             onQuickReject,
                                             isNdalemAction = false,
                                           }) => {

  // Handlers remain the same
  const handleDelete = () => onDelete?.(izin.id);
  const handleQuickApprove = () => onQuickApprove?.(izin, isNdalemAction);
  const handleQuickReject = () => onQuickReject?.(izin, isNdalemAction);

  // Determine main icon based on type (Updated Sakit Icon)
  const TypeIcon = izin.izinType === "Pulang" ? ArrowRightStartOnRectangleIcon : HeartPulseIcon;

  // Claymorphism button style (Unchanged)
  const clayButtonBase = `
    flex items-center justify-center p-2 rounded-lg
    transition-all duration-150 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900
    shadow-[2px_2px_4px_#bdbdbd,inset_-1px_-1px_2px_#ffffff]
    dark:shadow-[2px_2px_4px_#2a2a2a,inset_-1px_-1px_2px_#4a4a4a]
    active:shadow-[inset_2px_2px_4px_#bdbdbd,inset_-1px_-1px_2px_#ffffff]
    dark:active:shadow-[inset_2px_2px_4px_#2a2a2a,inset_-1px_-1px_2px_#4a4a4a]
  `;
  const clayButtonPrimary = `${clayButtonBase} bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 focus:ring-indigo-500`;
  const clayButtonDanger = `${clayButtonBase} bg-red-100 dark:bg-red-800/50 hover:bg-red-200 dark:hover:bg-red-700/50 text-red-700 dark:text-red-200 focus:ring-red-500`;
  const clayButtonSuccess = `${clayButtonBase} bg-green-100 dark:bg-green-800/50 hover:bg-green-200 dark:hover:bg-green-700/50 text-green-700 dark:text-green-200 focus:ring-green-500`;


  return (
      <div
          className="
        bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900
        rounded-3xl
        p-5 md:p-6
        shadow-[5px_5px_10px_#c1c5ca,-5px_-5px_10px_#ffffff]
        dark:shadow-[5px_5px_10px_#2c3036,-5px_-5px_10px_#4a515a]
        transition-all duration-300 ease-in-out
        hover:shadow-[7px_7px_14px_#c1c5ca,-7px_-7px_14px_#ffffff]
        dark:hover:shadow-[7px_7px_14px_#2c3036,-7px_-7px_14px_#4a515a]
        relative overflow-hidden group
      "
      >
        {/* === Header Section === */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-3"> {/* Reduced mb */}
          {/* Left: Icon + Name + Type */}
          <div className="flex items-center gap-3 flex-grow min-w-0">
            {/* Updated Icon Container: Rounded-full, enhanced shadow */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-200 dark:from-indigo-800 dark:to-purple-900 flex items-center justify-center shadow-[inset_3px_3px_5px_rgba(193,197,202,0.6),inset_-3px_-3px_5px_rgba(255,255,255,0.8)] dark:shadow-[inset_3px_3px_5px_rgba(44,48,54,0.6),inset_-3px_-3px_5px_rgba(74,81,90,0.6)]">
              <TypeIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate" title={izin.santriName}>
                {izin.santriName || 'Nama Santri Tidak Tersedia'}
              </p>
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                Izin {izin.izinType}
              </p>
            </div>
          </div>

          {/* Right: Status Badge */}
          <div className="flex-shrink-0 mt-1 sm:mt-0">
            <StatusBadge status={izin.status} />
          </div>
        </div>

        {/* === Progress Bar Section === */}
        <ProgressBar izin={izin} />

        {/* === Main Content Section === */}
        <div className="space-y-3 mt-5 mb-5"> {/* Adjusted margins */}
          {/* Reason / Complaint */}
          <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <InformationCircleIcon className="w-5 h-5 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="break-words">
            <span className="font-medium text-slate-800 dark:text-slate-200 mr-1">
              {izin.izinType === "Pulang" ? "Alasan:" : "Keluhan:"}
            </span>
              {izin.izinType === "Pulang" ? (izin as any).alasan : (izin as any).keluhan || "Tidak ada detail."}
            </p>
          </div>

          {/* Dates Section (Unchanged from v2) */}
          <div className="space-y-1.5 text-sm">
            {/* Combined Pulang Dates */}
            {izin.izinType === "Pulang" && (izin as any).tglPulang && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <CalendarDaysIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Periode Pulang:</span>
                    <span>{formatDate((izin as any).tglPulang)}</span>
                    {(izin as any).rencanaTanggalKembali && (
                        <>
                          <ArrowRightIcon className="w-3 h-3 text-slate-400 dark:text-slate-500 mx-1" />
                          <span>{formatDate((izin as any).rencanaTanggalKembali)}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-500 ml-1">(Rencana)</span>
                        </>
                    )}
                  </div>
                </div>
            )}

            {/* Actual Return Date */}
            {izin.izinType === "Pulang" && izin.status === "Sudah Kembali" && (izin as any).tanggalKembali && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <ArrowUturnLeftIcon className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300 mr-1">Aktual Kembali:</span>
                    {formatDate((izin as any).tanggalKembali)}
                  </div>
                </div>
            )}

            {/* Creation Timestamp (Hidden for Izin Pulang) */}
            {izin.izinType !== "Pulang" && (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-xs pt-1">
                  <ClockSolid className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Dibuat: {formatDate(izin.timestamp)}</span>
                </div>
            )}
          </div>
        </div>

        {/* === Footer / Actions Section === */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200/80 dark:border-slate-700/60">
          {/* Quick Actions */}
          {showQuickApprove && (
              <button onClick={handleQuickApprove} className={clayButtonSuccess} title="Setujui Cepat">
                <CheckIcon className="h-5 w-5" />
              </button>
          )}
          {showQuickReject && (
              <button onClick={handleQuickReject} className={clayButtonDanger} title="Tolak Cepat">
                <XMarkIcon className="h-5 w-5" />
              </button>
          )}

          {/* Detail Link (as button) */}
          <Link href={detailLink} className={`${clayButtonPrimary} text-sm px-4`}>
            Detail
          </Link>

          {/* Delete Button */}
          {canDelete && onDelete && (
              <button onClick={handleDelete} className={clayButtonDanger} title="Hapus Izin">
                <TrashIcon className="h-5 w-5" />
              </button>
          )}
        </div>

        {/* Optional: Return Status Tag (Unchanged from v2) */}
        {izin.izinType === "Pulang" && izin.status === "Sudah Kembali" && (
            <div className={`absolute bottom-3 left-3 px-2 py-0.5 rounded-full text-xs font-semibold z-10
          ${(izin as any).kembaliSesuaiRencana
                ? "bg-green-100 text-green-700 ring-1 ring-green-300 dark:bg-green-800/60 dark:text-green-200 dark:ring-green-600"
                : "bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-800/60 dark:text-red-200 dark:ring-red-600"}`}
            >
              {(izin as any).kembaliSesuaiRencana ? "Tepat Waktu" : "Terlambat"}
            </div>
        )}
      </div>
  );
};

export default IzinCard;