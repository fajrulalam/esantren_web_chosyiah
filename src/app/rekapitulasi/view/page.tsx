"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RekapDetailView from "@/components/RekapDetailView";
import { useAuth } from "@/firebase/auth";

function RekapitulasiViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const paymentId = searchParams.get("id") || "";
  const paymentName = searchParams.get("name") || "Detail Pembayaran";

  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
    else if (user.role === "waliSantri") router.push("/payment-history");
    else if (!paymentId) router.push("/rekapitulasi");
  }, [loading, paymentId, router, user]);

  if (loading || !user || user.role === "waliSantri" || !paymentId) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900" />;
  }

  return (
    <RekapDetailView
      payment={{ id: paymentId, paymentName }}
      onClose={() => router.push("/rekapitulasi")}
    />
  );
}

export default function RekapitulasiViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900" />}>
      <RekapitulasiViewContent />
    </Suspense>
  );
}
