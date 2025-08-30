"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { db } from '@/firebase/config';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { 
  TicketIcon
} from '@heroicons/react/24/outline';
import { 
  XCircleIcon
} from '@heroicons/react/24/solid';

interface Voucher {
  id: string;
  voucherGroupId: string;
  voucherName: string;
  value: number;
  activeDate: any;
  expireDate: any;
  isActive: boolean;
  isClaimed: boolean;
  userId: string;
  nama: string;
  kamar: string;
  semester: string;
  createdAt: any;
}

export default function MyVouchersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Access control check - only for non-staff users (santri and waliSantri)
  useEffect(() => {
    if (!loading && (!user || ['pengurus', 'pengasuh', 'superAdmin'].includes(user.role))) {
      toast.error('Access denied. This page is only for santri.');
      router.push('/');
      return;
    }
  }, [user, loading, router]);

  // Fetch user's vouchers with real-time updates
  useEffect(() => {
    if (!user) return;

    // For waliSantri users, use santriId; for other users, use uid
    const userId = user.role === 'waliSantri' && user.santriId ? user.santriId : user.uid;
    if (!userId) return;

    const vouchersRef = collection(db, 'vouchers');
    const q = query(
      vouchersRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(8)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vouchersList: Voucher[] = [];
      snapshot.forEach((doc) => {
        vouchersList.push({
          id: doc.id,
          ...doc.data()
        } as Voucher);
      });
      
      setVouchers(vouchersList);
      setLoadingData(false);
    }, (error) => {
      console.error('Error fetching vouchers:', error);
      toast.error('Failed to fetch vouchers');
      setLoadingData(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [user]);

  // Format currency for Indonesian Rupiah
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format date for Indonesian locale
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).format(date);
  };

  // Format date range for same day vouchers
  const formatDateRange = (activeDate: any, expireDate: any) => {
    if (!activeDate || !expireDate) return '-';
    const active = activeDate.toDate ? activeDate.toDate() : new Date(activeDate);
    const expire = expireDate.toDate ? expireDate.toDate() : new Date(expireDate);
    
    // Check if same day
    const sameDay = active.toDateString() === expire.toDateString();
    
    if (sameDay) {
      const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(active);
      const dateStr = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(active);
      const activeTime = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(active);
      const expireTime = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(expire);
      
      return `Aktif ${dayName}, ${dateStr} ${activeTime} - ${expireTime}`;
    } else {
      return `${formatDate(activeDate)} - ${formatDate(expireDate)}`;
    }
  };

  // Check if voucher is expired
  const isExpired = (expireDate: any) => {
    if (!expireDate) return false;
    const now = new Date();
    const expire = expireDate.toDate ? expireDate.toDate() : new Date(expireDate);
    return expire < now;
  };

  // Get voucher status with styling
  const getVoucherStatus = (voucher: Voucher) => {
    if (voucher.isClaimed) {
      return {
        status: 'Terpakai',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
        cardBg: 'bg-gray-50',
        borderColor: 'border-gray-200',
        accent: 'bg-gray-400'
      };
    }
    
    if (isExpired(voucher.expireDate)) {
      return {
        status: 'Kedaluwarsa',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        cardBg: 'bg-red-50',
        borderColor: 'border-red-200',
        accent: 'bg-red-400'
      };
    }

    // Check if voucher is not yet active
    const now = new Date();
    const activeDate = voucher.activeDate.toDate ? voucher.activeDate.toDate() : new Date(voucher.activeDate);
    if (activeDate > now) {
      return {
        status: 'Belum Aktif',
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-700',
        cardBg: 'bg-amber-50',
        borderColor: 'border-amber-200',
        accent: 'bg-amber-400'
      };
    }
    
    return {
      status: 'Aktif',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-700',
      cardBg: 'bg-gradient-to-br from-emerald-50 to-blue-50',
      borderColor: 'border-emerald-200',
      accent: 'bg-emerald-400'
    };
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || ['pengurus', 'pengasuh', 'superAdmin'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="text-center p-8">
          <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">This page is only accessible to santri.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4 px-4">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Voucher Canteen 375</h1>
        </div>
      </div>

      {/* Vouchers List */}
      <div className="max-w-md mx-auto">
        {loadingData ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 shadow-sm animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : vouchers.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center shadow-sm">
            <TicketIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Voucher</h3>
            <p className="text-gray-500">Anda belum memiliki voucher apapun.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {vouchers.map((voucher) => {
              const status = getVoucherStatus(voucher);
              
              return (
                <div
                  key={voucher.id}
                  className={`relative ${status.cardBg} rounded-xl border-2 ${status.borderColor} shadow-lg overflow-hidden transform transition-all duration-300 ${voucher.isClaimed ? 'opacity-75 grayscale' : 'hover:scale-[1.02]'}`}
                >
                  {/* Gift Card Design Elements */}
                  <div className="absolute top-0 right-0 w-20 h-20 opacity-10">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white to-transparent transform rotate-12"></div>
                  </div>
                  
                  {/* Status Ribbon - Top Right Corner */}
                  <div className="absolute -top-1 -right-1 z-10">
                    <div className={`${status.accent} text-white text-xs font-bold px-3 py-1 rounded-bl-lg shadow-md`}>
                      {status.status}
                    </div>
                  </div>

                  {/* Decorative Corner Pattern */}
                  <div className="absolute top-4 left-4">
                    <div className="flex space-x-1">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className={`w-2 h-2 ${status.accent} rounded-full opacity-60`}></div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Main Content Area */}
                    <div className="flex items-start justify-between mb-4">
                      {/* Left Side - Voucher Code */}
                      <div className="flex-1 mt-4">
                        <code className="text-xl font-mono font-bold text-gray-800 bg-white/70 px-3 py-2 rounded border-2 border-dashed border-gray-300 tracking-wider">
                          {voucher.id}
                          {/*{voucher.id.replace(/(.{3})/g, '$1•').slice(0, -1)}*/}
                        </code>
                      </div>

                      {/* Right Side - Value */}
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500 mb-1">NOMINAL</div>
                        <div className="text-2xl font-black text-green-600">
                          {formatCurrency(voucher.value)}
                        </div>
                      </div>
                    </div>

                    {/* Voucher Name */}
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-gray-700 bg-white/50 rounded-lg px-3 py-2 border border-white/60">
                        {voucher.voucherName}
                      </div>
                    </div>

                    {/* Date Information - Clever Horizontal Layout */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <div className={`w-2 h-2 ${status.accent} rounded-full`}></div>
                        <span className="font-medium">{formatDateRange(voucher.activeDate, voucher.expireDate)}</span>
                      </div>
                      
                      {/* Decorative Pattern */}
                      <div className="flex space-x-1">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="w-1 h-1 bg-gray-300 rounded-full"></div>
                        ))}
                      </div>
                    </div>

                    {/* Special Effects for Different States */}
                    {voucher.isClaimed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 rounded-xl">
                        <div className="transform -rotate-12 bg-gray-700 text-white px-6 py-2 rounded-lg font-bold text-lg shadow-xl">
                          TERPAKAI
                        </div>
                      </div>
                    )}

                    {isExpired(voucher.expireDate) && !voucher.isClaimed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 rounded-xl">
                        <div className="transform rotate-12 bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-xl">
                          KEDALUWARSA
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Decorative Border */}
                  <div className={`h-2 ${status.accent} opacity-60`}></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Footer */}
    </div>
  );
}