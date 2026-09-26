"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RekapDetailView from "@/components/RekapDetailView";
import { useAuth } from "@/firebase/auth";

function PaymentDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  let paymentId = params.id || "";

  try {
    paymentId = atob(paymentId);
  } catch {
    // Older links may contain the raw invoice ID.
  }

  const paymentName = searchParams.get("name") || "Detail Pembayaran";

  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
    else if (user.role === "waliSantri" || user.role === "bendahara") router.push(user.role === "bendahara" ? "/cashflow" : "/payment-history");
    else if (!paymentId) router.push("/rekapitulasi");
  }, [loading, paymentId, router, user]);

  if (loading || !user || user.role === "waliSantri" || user.role === "bendahara" || !paymentId) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900" />;
  }

  return (
    <RekapDetailView
      payment={{ id: paymentId, paymentName }}
      onClose={() => router.push("/rekapitulasi")}
    />
  );
}

export default function PaymentDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900" />}>
      <PaymentDetailContent />
    </Suspense>
  );
}
