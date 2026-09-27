"use client";

import { useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface FacilityPhotoLightboxProps {
  photo: { url: string; title: string } | null;
  onClose: () => void;
}

export default function FacilityPhotoLightbox({ photo, onClose }: FacilityPhotoLightboxProps) {
  useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="min-w-0 truncate text-sm font-semibold">{photo.title}</p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Tutup foto"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4 pt-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.title}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}
