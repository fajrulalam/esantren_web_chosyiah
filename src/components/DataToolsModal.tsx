"use client";

import ModalPortal from "./ModalPortal";
import { ArrowDownTrayIcon, ArrowUpTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface DataToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
}

export default function DataToolsModal({
  isOpen,
  onClose,
  onExport,
  onImport,
}: DataToolsModalProps) {
  return (
    <ModalPortal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Import / Export Data
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => {
            onExport();
            onClose();
          }}
          className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left"
        >
          <div className="shrink-0 h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <ArrowDownTrayIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Export Excel</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Unduh data santri yang sedang ditampilkan sebagai file Excel
            </p>
          </div>
        </button>

        <button
          onClick={() => {
            onImport();
            onClose();
          }}
          className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-left"
        >
          <div className="shrink-0 h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
            <ArrowUpTrayIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Import CSV</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tambahkan banyak santri sekaligus dari file CSV
            </p>
          </div>
        </button>
      </div>
    </ModalPortal>
  );
}
