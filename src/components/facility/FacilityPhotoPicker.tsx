"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { ArrowPathIcon, CameraIcon, PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { UserData } from "@/firebase/auth";
import { uploadFacilityPhoto } from "@/firebase/facilityReports";
import { MAX_FACILITY_PHOTOS, type FacilityPhoto } from "@/utils/facilityReports";

interface FacilityPhotoPickerProps {
  photos: FacilityPhoto[];
  onPhotosChange: (update: (previous: FacilityPhoto[]) => FacilityPhoto[]) => void;
  /** "report" photos show the problem; "proof" photos show the fixed facility. */
  kind: "report" | "proof";
  user: UserData | null;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}

export default function FacilityPhotoPicker({
  photos,
  onPhotosChange,
  kind,
  user,
  disabled = false,
  onUploadingChange,
}: FacilityPhotoPickerProps) {
  const [uploading, setUploading] = useState(false);
  const isProof = kind === "proof";
  const photoLabel = isProof ? "Foto bukti perbaikan" : "Foto kondisi fasilitas";

  const setUploadingState = (value: boolean) => {
    setUploading(value);
    onUploadingChange?.(value);
  };

  const handleFiles = async (files: File[]) => {
    if (!user) {
      toast.error("Sesi akun Anda tidak valid. Silakan masuk kembali.");
      return;
    }
    const remainingSlots = MAX_FACILITY_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`Maksimal ${MAX_FACILITY_PHOTOS} foto.`);
      return;
    }
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length < files.length) toast.error("Berkas harus berupa foto.");
    if (images.length === 0) return;
    if (images.length > remainingSlots) {
      toast.error(`Hanya ${remainingSlots} foto lagi yang dapat ditambahkan (maks ${MAX_FACILITY_PHOTOS}).`);
    }

    setUploadingState(true);
    let uploadedCount = 0;
    try {
      // One at a time rather than in parallel: each photo is compressed first,
      // and a burst of concurrent uploads is slow on a mobile connection.
      for (const file of images.slice(0, remainingSlots)) {
        const photo = await uploadFacilityPhoto(file, kind, user);
        onPhotosChange((previous) => [...previous, photo]);
        uploadedCount += 1;
      }
      toast.success(uploadedCount > 1 ? `${uploadedCount} foto berhasil diunggah.` : "Foto berhasil diunggah.");
    } catch (error) {
      console.error("Error uploading facility photo:", error);
      toast.error(error instanceof Error ? error.message : "Gagal mengunggah foto.");
    } finally {
      setUploadingState(false);
    }
  };

  const tileTone = isProof
    ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
    : "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-600 dark:bg-gray-700/40 dark:hover:border-blue-700 dark:hover:bg-gray-700";
  const iconTone = isProof ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-400";
  const TileIcon = isProof ? CameraIcon : PhotoIcon;

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div
              key={photo.url}
              className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`${photoLabel} ${index + 1}`}
                decoding="async"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onPhotosChange((previous) => previous.filter((item) => item.url !== photo.url))}
                disabled={disabled || uploading}
                className="absolute top-1.5 right-1.5 rounded-md bg-white/95 dark:bg-gray-900/90 p-1 text-red-600 dark:text-red-400 shadow-sm hover:bg-white dark:hover:bg-gray-900 disabled:opacity-50"
                title="Hapus foto"
                aria-label={`Hapus ${photoLabel.toLowerCase()} ${index + 1}`}
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < MAX_FACILITY_PHOTOS && (
        <div
          className={`relative flex min-h-[96px] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${tileTone} ${
            disabled ? "opacity-60" : ""
          }`}
        >
          {/* The whole tile is the file input so phones offer both camera and gallery. */}
          <input
            type="file"
            accept="image/*"
            multiple
            aria-label={isProof ? "Tambah foto bukti perbaikan" : "Tambah foto kondisi fasilitas"}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            disabled={disabled || uploading}
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              event.target.value = "";
              if (files.length > 0) void handleFiles(files);
            }}
          />
          {uploading ? (
            <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
          ) : (
            <TileIcon className={`w-6 h-6 ${iconTone}`} />
          )}
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {uploading
              ? "Mengunggah foto..."
              : photos.length === 0
                ? isProof
                  ? "Ketuk untuk mengambil atau memilih foto bukti"
                  : "Ketuk untuk menambah foto"
                : "Tambah foto lagi"}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {photos.length}/{MAX_FACILITY_PHOTOS} foto · opsional
          </span>
        </div>
      )}
    </div>
  );
}
