"use client";

import { useRouter } from "next/navigation";
import { EyeIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/firebase/auth";

const ROLE_LABELS: Record<string, string> = {
  waliSantri: "Santri",
  pengurus: "Pengurus",
  pengasuh: "Pengasuh",
  superAdmin: "Super Admin",
};

export default function UiPreviewBanner() {
  const { user, isPreviewing, stopUiPreview } = useAuth();
  const router = useRouter();

  if (!isPreviewing || !user) return null;

  const handleStop = () => {
    stopUiPreview();
    router.push("/user-management");
  };

  return (
    <div className="fixed top-0 inset-x-0 z-40 h-10 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 px-4 text-xs font-medium text-white shadow-md sm:text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <EyeIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Mode Preview UI &mdash; melihat sebagai{" "}
          <strong>{user.name || user.email || user.uid}</strong>{" "}
          ({ROLE_LABELS[user.role] || user.role})
        </span>
      </div>
      <button
        type="button"
        onClick={handleStop}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1 font-bold text-amber-800 transition-colors hover:bg-white"
      >
        <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Kembali ke Super Admin</span>
        <span className="sm:hidden">Kembali</span>
      </button>
    </div>
  );
}
