"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { useState, useEffect } from 'react';
import DarkModeToggle from '@/components/DarkModeToggle';

export default function Navbar() {
    const { user, logOut } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogout = async () => {
        try {
            await logOut();
            window.location.href = '/';
        } catch (error) {
            console.error('Error logging out:', error);
            router.push('/');
        }
    };

    const isActive = (path: string) => {
        const currentPath = pathname?.replace(/\/$/, '');
        const targetPath = path.replace(/\/$/, '');
        
        return currentPath === targetPath || 
               (targetPath !== '/' && currentPath?.startsWith(targetPath));
    };

    // Claymorphism styling for the navbar with dark mode support
    const navbarClasses = `
        fixed top-0 left-0 right-0 z-30 transition-all duration-300
        ${isScrolled 
            ? 'bg-amber-50/90 dark:bg-gray-900/90 backdrop-blur-md py-3 shadow-lg' 
            : 'bg-amber-50 dark:bg-gray-900 py-5'}
    `;

    // Claymorphism button styling with dark mode support
    const buttonClasses = `
        relative px-5 py-2 font-medium text-amber-900 dark:text-gray-100 rounded-xl
        ${isScrolled ? 'bg-amber-100 dark:bg-gray-800' : 'bg-amber-200 dark:bg-gray-700'} 
        border-2 border-amber-200 dark:border-gray-600
        hover:bg-amber-300 dark:hover:bg-gray-600 active:bg-amber-400 dark:active:bg-gray-700
        transition-all duration-300
        shadow-[4px_4px_10px_#d6d0c4,-4px_-4px_10px_#fffef4] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.3),-4px_-4px_10px_rgba(0,0,0,0.1)]
        active:shadow-[2px_2px_5px_#d6d0c4,-2px_-2px_5px_#fffef4] dark:active:shadow-[2px_2px_5px_rgba(0,0,0,0.3)]
        active:translate-x-[1px] active:translate-y-[1px]
    `;
    
    // Claymorphism active link styling with dark mode support
    const activeClass = `
        bg-amber-200 dark:bg-gray-700 text-amber-900 dark:text-gray-100 rounded-xl px-4 py-2
        shadow-[inset_2px_2px_5px_#d6d0c4,inset_-2px_-2px_5px_#fffef4] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)]
    `;
    
    const inactiveClass = `
        text-amber-900 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-gray-800 rounded-xl px-4 py-2
        transition-all duration-200
    `;

    return (
        <nav className={navbarClasses}>
            <div className="container mx-auto px-4">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex-shrink-0">
                        <Link href="/" className="text-2xl font-bold text-amber-800 dark:text-amber-300">
                            Asrama Chosyi'ah
                        </Link>
                    </div>

                    {/* Desktop navigation */}
                    <div className="hidden md:flex items-center space-x-4">
                        {user ? (
                            <>
                                {/* User is logged in - show dashboard links */}
                                {user.role !== 'waliSantri' ? (
                                    <>
                                        <Link
                                            href="/rekapitulasi"
                                            className={isActive('/rekapitulasi') ? activeClass : inactiveClass}
                                        >
                                            Rekapitulasi
                                        </Link>
                                        <Link
                                            href="/data-santri"
                                            className={isActive('/data-santri') ? activeClass : inactiveClass}
                                        >
                                            Data Santri
                                        </Link>
                                        {user.role === 'superAdmin' && (
                                            <Link
                                                href="/user-management"
                                                className={isActive('/user-management') ? activeClass : inactiveClass}
                                            >
                                                User Management
                                            </Link>
                                        )}
                                    </>
                                ) : (
                                    <Link
                                        href="/payment-history"
                                        className={isActive('/payment-history') ? activeClass : inactiveClass}
                                    >
                                        History Pembayaran
                                    </Link>
                                )}
                                <DarkModeToggle />
                                <button
                                    onClick={handleLogout}
                                    className={`${buttonClasses} bg-red-100 text-red-900 hover:bg-red-200 active:bg-red-300 border-red-200`}
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                {/* User is not logged in - show login button */}
                                <Link href="/login" className={buttonClasses}>
                                    Masuk
                                </Link>
                                <DarkModeToggle />
                            </>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden flex items-center">
                        <DarkModeToggle />
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="ml-2 inline-flex items-center justify-center p-2 rounded-xl text-amber-800 dark:text-gray-200 hover:bg-amber-100 dark:hover:bg-gray-700 transition-colors duration-200"
                            aria-controls="mobile-menu"
                            aria-expanded={isMenuOpen}
                        >
                            <span className="sr-only">Open main menu</span>
                            {!isMenuOpen ? (
                                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            ) : (
                                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isMenuOpen && (
                <div className="md:hidden" id="mobile-menu">
                    <div className="px-4 pt-2 pb-3 space-y-2 bg-amber-50 dark:bg-gray-800 shadow-inner">
                        {user ? (
                            <>
                                {user.role !== 'waliSantri' ? (
                                    <>
                                        <Link
                                            href="/rekapitulasi"
                                            className={`block ${isActive('/rekapitulasi') ? activeClass : inactiveClass}`}
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            Rekapitulasi
                                        </Link>
                                        <Link
                                            href="/data-santri"
                                            className={`block ${isActive('/data-santri') ? activeClass : inactiveClass}`}
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            Data Santri
                                        </Link>
                                        {user.role === 'superAdmin' && (
                                            <Link
                                                href="/user-management"
                                                className={`block ${isActive('/user-management') ? activeClass : inactiveClass}`}
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                User Management
                                            </Link>
                                        )}
                                    </>
                                ) : (
                                    <Link
                                        href="/payment-history"
                                        className={`block ${isActive('/payment-history') ? activeClass : inactiveClass}`}
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
                                    className="w-full text-left mt-4 text-red-900 px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 transition-colors"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <Link
                                href="/login"
                                className="block px-4 py-2 text-amber-900 bg-amber-200 rounded-xl shadow-[4px_4px_10px_#d6d0c4,-4px_-4px_10px_#fffef4]"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Masuk
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}