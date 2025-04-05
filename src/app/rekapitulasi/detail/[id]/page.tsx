"use client";

import { useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';

// This is a simple redirect page to maintain backward compatibility
export default function RekapitulasiDetailRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Get the ID from the URL parameters
    const id = params.id as string;
    
    // Create a base64 encoded version of the decoded ID
    // First decode the ID from the URL (it was previously URL encoded)
    try {
      const decodedId = decodeURIComponent(id);
      const base64Id = btoa(decodedId);
      
      // Construct the new URL with the base64 encoded ID
      const name = searchParams.get('name') || '';
      const queryString = name ? `?name=${encodeURIComponent(name)}` : '';
      
      // Redirect to the new URL format
      router.replace(`/rekapitulasi-detail/${base64Id}${queryString}`);
    } catch (error) {
      console.error("Error redirecting:", error);
      // If there's an error, just redirect to the main rekapitulasi page
      router.replace('/rekapitulasi');
    }
  }, [params.id, router, searchParams]);
  
  // Show a loading indicator while redirecting
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      <p className="ml-4 text-lg">Mengalihkan ke halaman baru...</p>
    </div>
  );
}