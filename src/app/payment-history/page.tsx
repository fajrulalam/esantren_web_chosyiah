"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import PaymentHistory from '@/components/PaymentHistory';
import { useTheme } from 'next-themes';

export default function PaymentHistoryPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Wait for component to mount to avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (user.role !== 'waliSantri') {
                router.push('/rekapitulasi');
            } else {
                setIsAuthorized(true);
            }
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-amber-500"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return null; // Will redirect in useEffect
    }

    if (!mounted) return null;

    return (
        <div className="container mx-auto py-6 px-4 dark:bg-gray-900 min-h-screen">
            <PaymentHistory />
        </div>
    );
}