"use client";

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

// This is a catch-all handler for any path under /rekapitulasi/detail/ that isn't otherwise matched
export default function RekapitulasiDetailCatchAllPage() {
  const router = useRouter();
  const params = useParams();
  
  useEffect(() => {
    // Since this is a catch-all route, params.slug will be an array
    const slug = params.slug as string[];
    
    console.log("Catch-all route hit with slug:", slug);
    
    // Redirect to the main rekapitulasi page
    router.replace('/rekapitulasi');
  }, [params.slug, router]);
  
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      <p className="ml-4 text-lg">Redirecting to rekapitulasi page...</p>
    </div>
  );
}