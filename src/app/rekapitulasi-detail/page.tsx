"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Inner component that uses searchParams
function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Try to get id and name from query string
  const id = searchParams.get('id');
  const name = searchParams.get('name');
  
  useEffect(() => {
    // If query parameters exist, redirect to the new view URL
    if (id) {
      const queryString = new URLSearchParams({
        id,
        ...(name ? { name } : {})
      }).toString();
      
      router.replace(`/rekapitulasi/view?${queryString}`);
    } else {
      // Otherwise, redirect to the main rekapitulasi page
      router.replace('/rekapitulasi');
    }
  }, [id, name, router]);
  
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      <p className="ml-4 text-lg">Mengalihkan halaman...</p>
    </div>
  );
}

// Loading fallback component
function RedirectLoading() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      <p className="ml-4 text-lg">Memuat halaman...</p>
    </div>
  );
}

// Main component that wraps RedirectContent with Suspense
export default function RekapitulasiDetailRootRedirectPage() {
  return (
    <Suspense fallback={<RedirectLoading />}>
      <RedirectContent />
    </Suspense>
  );
}