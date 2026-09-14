"use client";

import { useEffect } from "react";
import { KODE_ASRAMA } from "@/constants";
import { syncSantriSemesters } from "@/firebase/santriSemester";
import { useAuth } from "@/firebase/auth";

const SYNC_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Keeps the persisted numeric semester current while an authorized staff
 * session is open. A fresh session also reconciles missed boundaries.
 */
export default function SantriSemesterSync() {
  const { user, loading } = useAuth();
  const userRole = user?.role;

  useEffect(() => {
    if (loading || !userRole || userRole === "waliSantri") return;

    let isMounted = true;

    const reconcile = async () => {
      try {
        const result = await syncSantriSemesters(KODE_ASRAMA);
        if (!isMounted) return;

        if (result.updatedCount > 0 || result.baselinedCount > 0) {
          console.info("Santri semester reconciliation completed", result);
        }
        if (result.errorCount > 0) {
          console.warn(
            `${result.errorCount} Santri semester record(s) could not be synchronized.`
          );
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error synchronizing Santri semesters:", error);
        }
      }
    };

    void reconcile();
    const intervalId = window.setInterval(() => {
      void reconcile();
    }, SYNC_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [loading, userRole]);

  return null;
}
