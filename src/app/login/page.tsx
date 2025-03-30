"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/firebase/auth';

export default function Login() {
    const [userType, setUserType] = useState<'waliSantri' | 'staff'>('waliSantri');
    const [namaSantri, setNamaSantri] = useState('');
    const [tanggalLahirDay, setTanggalLahirDay] = useState('');
    const [tanggalLahirMonth, setTanggalLahirMonth] = useState('');
    const [tanggalLahirYear, setTanggalLahirYear] = useState('');
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

    const formatDate = (): string => {
        const day = tanggalLahirDay.padStart(2, '0');
        const month = tanggalLahirMonth.padStart(2, '0');
        const year = tanggalLahirYear;
        return `${day}/${month}/${year}`;
    };

    const handleWaliSantriLogin = async () => {
        if (!namaSantri || !tanggalLahirDay || !tanggalLahirMonth || !tanggalLahirYear) {
            setError('Mohon isi semua kolom');
            return;
        }

        if (!/^\d+$/.test(tanggalLahirDay) || !/^\d+$/.test(tanggalLahirMonth) || !/^\d+$/.test(tanggalLahirYear)) {
            setError('Format tanggal harus berupa angka');
            return;
        }

        const day = parseInt(tanggalLahirDay);
        const month = parseInt(tanggalLahirMonth);
        const year = parseInt(tanggalLahirYear);

        if (day < 1 || day > 31) {
            setError('Tanggal harus antara 1-31');
            return;
        }

        if (month < 1 || month > 12) {
            setError('Bulan harus antara 1-12');
            return;
        }

        if (year < 1900 || year > new Date().getFullYear()) {
            setError('Tahun tidak valid');
            return;
        }
        
        setError('');
        setIsLoading(true);
        
        try {
            const formattedDate = formatDate();
            const success = await signInAsWaliSantri(namaSantri, formattedDate);
            
            if (success) {
                router.push('/payment-history');
            } else {
                setError('Data tidak ditemukan. Mohon periksa kembali nama santri dan tanggal lahir yang dimasukkan.');
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

    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-10rem)] dark:bg-gray-900 transition-colors">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md transition-colors">
                <h2 className="text-2xl font-bold text-center mb-6 dark:text-white transition-colors">
                    Login {userType === 'waliSantri' ? 'Wali Santri' : 'Staff'}
                </h2>
                
                <div className="text-center mb-6">
                    <button
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={() => setUserType(userType === 'waliSantri' ? 'staff' : 'waliSantri')}
                    >
                        {userType === 'waliSantri' ? '[ Login sebagai staff ]' : '[ Login sebagai wali santri ]'}
                    </button>
                </div>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-md transition-colors">
                        {error}
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    {userType === 'waliSantri' ? (
                        <>
                            <div className="mb-4">
                                <label className="block mb-2 text-sm font-medium dark:text-gray-300 transition-colors">Nama Santri</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                    value={namaSantri}
                                    onChange={(e) => setNamaSantri(e.target.value)}
                                    placeholder="Masukkan nama santri"
                                    disabled={isLoading}
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 transition-colors">Contoh: M. Fajrul Alam Ulin Nuha</p>
                            </div>
                            <div className="mb-6">
                                <label className="block mb-2 text-sm font-medium dark:text-gray-300 transition-colors">Tanggal Lahir</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <input
                                            type="text"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            value={tanggalLahirDay}
                                            onChange={(e) => setTanggalLahirDay(e.target.value)}
                                            placeholder="cth: 09"
                                            maxLength={2}
                                            disabled={isLoading}
                                        />
                                        <label className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">Tanggal</label>
                                    </div>
                                    <div>
                                        <select
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            value={tanggalLahirMonth}
                                            onChange={(e) => setTanggalLahirMonth(e.target.value)}
                                            disabled={isLoading}
                                        >
                                            <option value="">Bulan</option>
                                            <option value="01">Januari</option>
                                            <option value="02">Februari</option>
                                            <option value="03">Maret</option>
                                            <option value="04">April</option>
                                            <option value="05">Mei</option>
                                            <option value="06">Juni</option>
                                            <option value="07">Juli</option>
                                            <option value="08">Agustus</option>
                                            <option value="09">September</option>
                                            <option value="10">Oktober</option>
                                            <option value="11">November</option>
                                            <option value="12">Desember</option>
                                        </select>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">Bulan</label>
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            value={tanggalLahirYear}
                                            onChange={(e) => setTanggalLahirYear(e.target.value)}
                                            placeholder="cth: 2001"
                                            maxLength={4}
                                            disabled={isLoading}
                                        />
                                        <label className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">Tahun</label>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-4">
                                <label className="block mb-2 text-sm font-medium dark:text-gray-300 transition-colors">Email</label>
                                <input
                                    type="email"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Masukkan email"
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block mb-2 text-sm font-medium dark:text-gray-300 transition-colors">Password</label>
                                <input
                                    type="password"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
                        className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition duration-300 disabled:bg-blue-400 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Loading...' : 'Login'}
                    </button>
                    
                    {userType === 'staff' && (
                        <div className="mt-4">
                            <div className="relative flex items-center justify-center mt-4 mb-4">
                                <div className="border-t border-gray-300 dark:border-gray-600 flex-grow mr-3 transition-colors"></div>
                                <span className="text-gray-500 dark:text-gray-400 text-sm transition-colors">Atau</span>
                                <div className="border-t border-gray-300 dark:border-gray-600 flex-grow ml-3 transition-colors"></div>
                            </div>
                            
                            <button
                                type="button"
                                className="w-full flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 py-3 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-300"
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                            >
                                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            </div>
        </div>
    );
}