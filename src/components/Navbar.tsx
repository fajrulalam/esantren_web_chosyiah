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

    return (
        <nav className="bg-white border-b border-gray-200 shadow-sm">
            <div className="container mx-auto px-4">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex-shrink-0">
                        <Link href="/" className="text-xl font-bold text-blue-600">
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
                                                className={`px-3 py-2 rounded-md text-sm font-medium ${
                                                    isActive('/rekapitulasi')
                                                        ? 'bg-blue-50 text-blue-700'
                                                        : 'text-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                Rekapitulasi
                                            </Link>
                                            <Link
                                                href="/data-santri"
                                                className={`px-3 py-2 rounded-md text-sm font-medium ${
                                                    isActive('/data-santri')
                                                        ? 'bg-blue-50 text-blue-700'
                                                        : 'text-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                Data Santri
                                            </Link>
                                            {user.role === 'superAdmin' && (
                                                <Link
                                                    href="/user-management"
                                                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                                                        isActive('/user-management')
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'text-gray-700 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    User Management
                                                </Link>
                                            )}
                                        </>
                                    ) : (
                                        <Link
                                            href="/payment-history"
                                            className={`px-3 py-2 rounded-md text-sm font-medium ${
                                                isActive('/payment-history')
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            History Pembayaran
                                        </Link>
                                    )}
                                    <button
                                        onClick={handleLogout}
                                        className="ml-4 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </div>

                            {/* Mobile menu button */}
                            <div className="md:hidden -mr-2 flex items-center">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
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
                                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                                        isActive('/rekapitulasi')
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Rekapitulasi
                                </Link>
                                <Link
                                    href="/data-santri"
                                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                                        isActive('/data-santri')
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Data Santri
                                </Link>
                                {user.role === 'superAdmin' && (
                                    <Link
                                        href="/user-management"
                                        className={`block px-3 py-2 rounded-md text-base font-medium ${
                                            isActive('/user-management')
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'text-gray-700 hover:bg-gray-100'
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
                                className={`block px-3 py-2 rounded-md text-base font-medium ${
                                    isActive('/payment-history')
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-100'
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
                            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}