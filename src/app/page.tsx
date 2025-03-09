"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'waliSantri') {
          router.push('/payment-history');
        } else {
          router.push('/rekapitulasi');
        }
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-center text-3xl font-bold mb-8">Selamat Datang di Sistem Pembayaran Hurun Inn</h1>
        
        <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="p-6 border rounded-lg bg-blue-50">
                <h2 className="text-xl font-bold mb-4">Memudahkan Pembayaran</h2>
                <p className="text-gray-700">
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-green-50">
                <h2 className="text-xl font-bold mb-4">Lacak Pembayaran</h2>
              </div>
            </div>

            {!user && (
              <div className="text-center mt-8">
                <Link
                  href="/login"
                  className="bg-blue-600 text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}