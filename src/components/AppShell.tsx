"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/firebase/auth";
import Navbar from "@/components/Navbar";
import UiPreviewBanner from "@/components/UiPreviewBanner";

export default function AppShell({ children }: { children: ReactNode }) {
  const { isPreviewing } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      <UiPreviewBanner />
      <Navbar />
      {/* Extra top padding makes room for the fixed preview banner above the navbar. */}
      <main
        className={`flex-grow bg-white dark:bg-gray-900 transition-colors ${
          isPreviewing ? "pt-36" : "pt-24"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
