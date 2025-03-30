"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { useState } from 'react';

export default function Navbar() {
    const { user, logOut } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await logOut();
            // Force navigation to home page and refresh
            window.location.href = '/';
        } catch (error) {
            console.error('Error logging out:', error);
            // Fallback redirect in case of error
            router.push('/');
        }
    };

    const isActive = (path: string) => {
        return pathname === path;
    };
    
    const activeClass = "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shadow-neumorphic-inset dark:shadow-neumorphic-inset-dark";
    const inactiveClass = "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-none";

    return (
        <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
            <div className="container mx-auto px-4">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex-shrink-0">
                        <Link href="/" className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            Sistem Pembayaran Asrama
                        </Link>
                    </div>

                    {user && (
                        <>
                            {/* Desktop navigation */}
                            <div className="hidden md:block">
                                <div className="flex items-center space-x-4">
                                    {user.role !== 'waliSantri' ? (
                                        <>
                                            <Link
                                                href="/rekapitulasi"
                                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                                    isActive('/rekapitulasi') ? activeClass : inactiveClass
                                                }`}
                                            >
                                                Rekap Pembayaran
                                            </Link>
                                            <Link
                                                href="/data-santri"
                                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                                    isActive('/data-santri') ? activeClass : inactiveClass
                                                }`}
                                            >
                                                Data Santri
                                            </Link>
                                            {user.role === 'superAdmin' && (
                                                <Link
                                                    href="/user-management"
                                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                                        isActive('/user-management') ? activeClass : inactiveClass
                                                    }`}
                                                >
                                                    User Management
                                                </Link>
                                            )}
                                        </>
                                    ) : (
                                        <Link
                                            href="/payment-history"
                                            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                                isActive('/payment-history') ? activeClass : inactiveClass
                                            }`}
                                        >
                                            History Pembayaran
                                        </Link>
                                    )}
                                    <button
                                        onClick={handleLogout}
                                        className="ml-4 px-3 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </div>

                            {/* Mobile menu button */}
                            <div className="md:hidden -mr-2 flex items-center">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                                >
                                    <span className="sr-only">Open main menu</span>
                                    {!isMenuOpen ? (
                                        <svg
                                            className="block h-6 w-6"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            aria-hidden="true"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M4 6h16M4 12h16M4 18h16"
                                            />
                                        </svg>
                                    ) : (
                                        <svg
                                            className="block h-6 w-6"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            aria-hidden="true"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile menu, show/hide based on menu state. */}
            {isMenuOpen && user && (
                <div className="md:hidden">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {user.role !== 'waliSantri' ? (
                            <>
                                <Link
                                    href="/rekapitulasi"
                                    className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                                        isActive('/rekapitulasi') ? activeClass : inactiveClass
                                    }`}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Rekapitulasi
                                </Link>
                                <Link
                                    href="/data-santri"
                                    className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                                        isActive('/data-santri') ? activeClass : inactiveClass
                                    }`}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Data Santri
                                </Link>
                                {user.role === 'superAdmin' && (
                                    <Link
                                        href="/user-management"
                                        className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                                            isActive('/user-management') ? activeClass : inactiveClass
                                        }`}
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        User Management
                                    </Link>
                                )}
                            </>
                        ) : (
                            <Link
                                href="/payment-history"
                                className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                                    isActive('/payment-history') ? activeClass : inactiveClass
                                }`}
                                onClick={() => setIsMenuOpen(false)}
                            >
                                History Pembayaran
                            </Link>
                        )}
                        <button
                            onClick={async () => {
                                setIsMenuOpen(false);
                                await handleLogout();
                            }}
                            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}