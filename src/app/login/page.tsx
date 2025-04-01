"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/firebase/auth';
import Image from 'next/image';

export default function Login() {
    const [userType, setUserType] = useState<'waliSantri' | 'staff'>('waliSantri');
    const [namaSantri, setNamaSantri] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    
    const { user, signInWithEmail, signInWithGoogle, signInAsWaliSantri, loading } = useAuth();

    // Redirect if user is already logged in
    useEffect(() => {
        if (user && !loading) {
            if (user.role === 'waliSantri') {
                router.push('/payment-history');
            } else {
                router.push('/rekapitulasi');
            }
        }
    }, [user, loading, router]);

    const handleWaliSantriLogin = async () => {
        if (!namaSantri || !phoneNumber) {
            setError('Mohon isi semua kolom');
            return;
        }

        if (!/^\d+$/.test(phoneNumber)) {
            setError('Nomor telepon hanya boleh berisi angka');
            return;
        }
        
        setError('');
        setIsLoading(true);
        
        try {
            const formattedPhone = "+62" + phoneNumber;
            const success = await signInAsWaliSantri(namaSantri, formattedPhone);
            
            if (success) {
                router.push('/payment-history');
            } else {
                setError('Data tidak ditemukan. Mohon periksa kembali nama santri dan nomor telepon yang dimasukkan.');
            }
        } catch (err) {
            setError('Terjadi kesalahan. Silakan coba lagi.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStaffLogin = async () => {
        if (!email || !password) {
            setError('Mohon isi semua kolom');
            return;
        }
        
        setError('');
        setIsLoading(true);
        
        try {
            await signInWithEmail(email, password);
            router.push('/rekapitulasi');
        } catch (err: any) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Email atau password salah');
            } else {
                setError('Terjadi kesalahan. Silakan coba lagi.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setIsLoading(true);
        
        try {
            await signInWithGoogle();
            router.push('/rekapitulasi');
        } catch (err: any) {
            if (err.code === 'auth/user-cancelled') {
                setError('Email tidak terdaftar. Silakan gunakan email yang valid atau daftar terlebih dahulu.');
            } else {
                setError('Terjadi kesalahan saat login dengan Google');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userType === 'waliSantri') {
            handleWaliSantriLogin();
        } else {
            handleStaffLogin();
        }
    };

    // Claymorphism styles
    const containerStyle = `
        bg-amber-50 rounded-3xl p-10
        border-2 border-amber-200
        shadow-[8px_8px_16px_#d6d0c4,-8px_-8px_16px_#fffef4]
    `;

    const inputStyle = `
        w-full p-4 rounded-xl
        bg-amber-50 border-2 border-amber-200
        focus:outline-none focus:border-amber-400
        shadow-[inset_2px_2px_5px_#d6d0c4,inset_-2px_-2px_5px_#fffef4]
        text-amber-900 placeholder:text-amber-400
        transition-all duration-300
    `;

    const buttonStyle = `
        w-full py-4 px-8 mt-4 rounded-xl
        font-bold text-amber-900 
        bg-amber-200 border-2 border-amber-300
        hover:bg-amber-300 active:bg-amber-400
        transition-all duration-300
        shadow-[6px_6px_12px_#d6d0c4,-6px_-6px_12px_#fffef4]
        active:shadow-[2px_2px_4px_#d6d0c4,-2px_-2px_4px_#fffef4]
        active:translate-x-[2px] active:translate-y-[2px]
        disabled:opacity-70 disabled:cursor-not-allowed
    `;

    const tabStyle = `
        py-3 px-6 text-center
        rounded-xl font-medium transition-all duration-300
    `;

    const activeTabStyle = `
        ${tabStyle}
        bg-amber-200 text-amber-900
        shadow-[inset_2px_2px_5px_#d6d0c4,inset_-2px_-2px_5px_#fffef4]
    `;

    const inactiveTabStyle = `
        ${tabStyle}
        bg-amber-50 text-amber-600 hover:text-amber-800
        shadow-[4px_4px_8px_#d6d0c4,-4px_-4px_8px_#fffef4]
        hover:shadow-[6px_6px_12px_#d6d0c4,-6px_-6px_12px_#fffef4]
    `;

    return (
        <div className="flex justify-center items-center min-h-screen bg-amber-50 pt-24 px-4">
            <div className={`${containerStyle} w-full max-w-md`}>
                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-bold text-amber-900 mb-2">
                        Selamat Datang
                    </h2>
                    <p className="text-amber-700">
                        Silakan masuk untuk mengakses sistem pembayaran
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button
                        className={userType === 'waliSantri' ? activeTabStyle : inactiveTabStyle}
                        onClick={() => setUserType('waliSantri')}
                    >
                        Wali Santri
                    </button>
                    <button
                        className={userType === 'staff' ? activeTabStyle : inactiveTabStyle}
                        onClick={() => setUserType('staff')}
                    >
                        Staff / Admin
                    </button>
                </div>
                
                {error && (
                    <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-xl border-2 border-red-200 shadow-inner">
                        {error}
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    {userType === 'waliSantri' ? (
                        <>
                            <div className="mb-4">
                                <label className="block mb-2 text-sm font-medium text-amber-800">
                                    Nama Santri
                                </label>
                                <input
                                    type="text"
                                    className={inputStyle}
                                    value={namaSantri}
                                    onChange={(e) => setNamaSantri(e.target.value)}
                                    placeholder="Masukkan nama santri"
                                    disabled={isLoading}
                                />
                                <p className="mt-1 text-xs text-amber-600">
                                    Contoh: M. Fajrul Alam Ulin Nuha
                                </p>
                            </div>
                            <div className="mb-6">
                                <label className="block mb-2 text-sm font-medium text-amber-800">
                                    Nomor WhatsApp
                                </label>
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <div className={`w-16 p-4 rounded-l-xl bg-amber-200 border-y-2 border-l-2 border-amber-300 text-amber-900 font-medium shadow-inner text-center`}>
                                            +62
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        className={`${inputStyle} rounded-l-none border-l-0`}
                                        value={phoneNumber}
                                        onChange={(e) => {
                                            // Only allow digits
                                            const value = e.target.value.replace(/\D/g, '');
                                            setPhoneNumber(value);
                                        }}
                                        placeholder="8123456789"
                                        disabled={isLoading}
                                    />
                                </div>
                                <p className="mt-1 text-xs text-amber-600">
                                    Masukkan nomor tanpa awalan 0
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-4">
                                <label className="block mb-2 text-sm font-medium text-amber-800">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    className={inputStyle}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Masukkan email"
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block mb-2 text-sm font-medium text-amber-800">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    className={inputStyle}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Masukkan password"
                                    disabled={isLoading}
                                />
                            </div>
                        </>
                    )}
                    
                    <button
                        type="submit"
                        className={buttonStyle}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Memproses...' : 'Masuk'}
                    </button>
                    
                    {userType === 'staff' && (
                        <div className="mt-6">
                            <div className="relative flex items-center justify-center mb-6">
                                <div className="border-t-2 border-amber-200 flex-grow mr-3"></div>
                                <span className="text-amber-700 text-sm">Atau</span>
                                <div className="border-t-2 border-amber-200 flex-grow ml-3"></div>
                            </div>
                            
                            <button
                                type="button"
                                className={`
                                    w-full flex items-center justify-center 
                                    py-4 px-6 rounded-xl
                                    bg-white text-gray-700 
                                    border-2 border-amber-200
                                    shadow-[4px_4px_8px_#d6d0c4,-4px_-4px_8px_#fffef4]
                                    hover:shadow-[6px_6px_12px_#d6d0c4,-6px_-6px_12px_#fffef4]
                                    active:shadow-[2px_2px_4px_#d6d0c4,-2px_-2px_4px_#fffef4]
                                    active:translate-x-[1px] active:translate-y-[1px]
                                    transition-all duration-300
                                    font-medium
                                `}
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                            >
                                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"/>
                                    <path d="M12.2401 24.0008C15.4766 24.0008 18.2059 22.9382 20.1945 21.1039L16.3276 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.2401 24.0008Z" fill="#34A853"/>
                                    <path d="M5.50253 14.3003C4.99987 12.8099 4.99987 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z" fill="#FBBC04"/>
                                    <path d="M12.2401 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.2401 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.2401 4.74966Z" fill="#EA4335"/>
                                </svg>
                                Login dengan Google
                            </button>
                        </div>
                    )}
                </form>
                
                <div className="mt-8 text-center">
                    <Link href="/" className="text-amber-700 hover:text-amber-900 transition-colors">
                        ← Kembali ke Beranda
                    </Link>
                </div>
            </div>
        </div>
    );
}