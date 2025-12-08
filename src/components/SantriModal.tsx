"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Santri, SantriFormData } from "@/types/santri";
import SantriForm from "./SantriForm";

interface SantriModalProps {
  isOpen: boolean;
  onClose: () => void;
  santri?: Santri;
  onSubmit: (data: SantriFormData) => Promise<void>;
  onDelete?: (santri: Santri) => Promise<void>;
  isSubmitting: boolean;
  title: string;
}

export default function SantriModal({
  isOpen,
  onClose,
  santri,
  onSubmit,
  onDelete,
  isSubmitting,
  title,
}: SantriModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  // Create a portal to render the modal at the root level of the DOM
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 999999 }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        style={{ zIndex: 999999 }}
      />

      {/* Modal content */}
      <div
        className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all relative"
        style={{ zIndex: 1000000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
          {title}
        </h3>

        <SantriForm
          santri={santri}
          onSubmit={onSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          onDelete={onDelete}
        />
      </div>
    </div>,
    document.body
  );
}
