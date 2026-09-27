"use client";

import { useEffect, type ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface FacilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
  /** Keeps the dialog open while a save or upload is in flight. */
  busy?: boolean;
}

// Same shell as the cashflow modals: a bottom sheet on phones, a centered
// card from the sm breakpoint up.
export default function FacilityModal({
  isOpen,
  onClose,
  title,
  icon,
  description,
  children,
  size = "md",
  busy = false,
}: FacilityModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={busy ? undefined : onClose}
      />

      <div
        className={`relative w-full ${size === "lg" ? "max-w-lg" : "max-w-md"} bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto z-10 transition-all`}
      >
        {/* Mobile handle indicator */}
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            {icon}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
            aria-label="Tutup"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">{description}</p>
        )}

        {children}
      </div>
    </div>
  );
}
