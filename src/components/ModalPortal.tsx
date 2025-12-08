import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalPortalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";
}

export default function ModalPortal({
  isOpen,
  onClose,
  children,
  maxWidth = "lg",
}: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Map maxWidth to Tailwind classes
  const maxWidthClass = {
    sm: "max-w-sm", // 384px
    md: "max-w-md", // 448px
    lg: "max-w-lg", // 512px
    xl: "max-w-xl", // 576px
    "2xl": "max-w-2xl", // 672px
    "3xl": "max-w-3xl", // 768px
    "4xl": "max-w-4xl", // 896px
    "5xl": "max-w-5xl", // 1024px
    full: "max-w-full", // 100%
  }[maxWidth];

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 md:p-8"
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
        className={`w-full ${maxWidthClass} transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all relative mx-auto`}
        style={{ zIndex: 1000000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
