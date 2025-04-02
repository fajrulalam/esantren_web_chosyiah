"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Assuming next/navigation
import { useAuth } from '@/firebase/auth'; // Assuming this path is correct
import Link from 'next/link';
import Image from 'next/image'; // Using Next.js Image for optimization

// Placeholder hook if useAuth is not available in this context
// const useAuth = () => ({ user: null, loading: false });

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect logged-in users
    if (!loading && user) {
      // Example redirection logic, adjust as needed
      if (user.role === 'waliSantri') {
        router.push('/payment-history');
      } else {
        router.push('/dashboard'); // Default dashboard or relevant page
      }
    }
  }, [user, loading, router]);

  // Loading State
  if (loading) {
    return (
        <div className="flex justify-center items-center min-h-screen bg-amber-50 dark:bg-gray-900">
          {/* Simple spinner */}
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 dark:border-amber-400"></div>
        </div>
    );
  }

  // Main component render
  return (
      <div className="min-h-screen bg-amber-50 dark:bg-gray-900 font-sans"> {/* Added dark mode background */}

        {/* Header Placeholder (Optional - Add your actual header/nav here) */}
        {/* <header className="bg-white dark:bg-gray-800 shadow-sm p-4 sticky top-0 z-50"> ... </header> */}

        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-amber-900 dark:text-amber-400 mb-4">
            Selamat Datang di Asrama Chosyi'ah
          </h1>
          <h2 className="text-xl md:text-2xl text-amber-700 dark:text-amber-300 mb-8 max-w-3xl mx-auto">
            Membentuk Generasi Islami yang Berakhlak Mulia, Cerdas, dan Mandiri di Lingkungan yang Mendukung.
          </h2>

          {/* Call to Action Button Area */}
          <div className="flex flex-col items-center gap-4">
            <Link
                href="/registration"
                className="
              inline-flex items-center justify-center px-8 py-4
              font-semibold text-white rounded-lg
              bg-gradient-to-r from-amber-500 to-amber-600
              hover:from-amber-500 hover:to-amber-500
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500
              transition-all duration-300 ease-in-out
              shadow-md hover:shadow-lg
              dark:shadow-amber-400/50 dark:hover:shadow-amber-300/70 dark:shadow-xl dark:hover:shadow-2xl
              dark:ring-4 dark:ring-amber-400/50 dark:hover:ring-amber-300/60
              dark:hover:scale-105
              relative dark:after:absolute dark:after:inset-0 dark:after:-z-10 dark:after:rounded-xl
              dark:after:bg-amber-400/30 dark:after:blur-xl dark:after:scale-125
              text-lg group
              z-10
            "
            >
              Daftar Sekarang
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform duration-150" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            {/* Urgency Nudge - positioned below the button */}
            <div className="
            inline-flex items-center px-3 py-1 rounded-full
            text-sm font-medium text-red-800
            bg-red-100 border border-red-200
            shadow-sm
          ">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Kuota Pendaftaran Terbatas!
            </div>
          </div>

          {/* Hero Images / Features Grid - Simplified */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mt-16 md:mt-24">
            {/* Feature Card 1: Room */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="relative h-48 w-full">
                <Image
                    src="/room.png" // Replace with your actual image path
                    alt="Kamar Nyaman dan Eksklusif"
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" // Optimize image loading
                    onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400/FFF0DB/92400E?text=Kamar+Nyaman'} // Placeholder
                />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-2">Kamar Eksklusif</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Dua orang per kamar. Fasilitas lengkap: 2 kasur, 2 meja, 2 kursi, dan lemari luas. Nyaman dan privat.
                </p>
              </div>
            </div>

            {/* Feature Card 2: Hallway */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="relative h-48 w-full">
                <Image
                    src="/hallway.png" // Replace with your actual image path
                    alt="Lingkungan asrama yang tertib"
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400/FFF0DB/92400E?text=Lingkungan+Tertib'} // Placeholder
                />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-2">Lingkungan Belajar Tertib</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Suasana asri dan teratur yang mendukung fokus belajar dan pembentukan karakter akhlakul karimah.
                </p>
              </div>
            </div>

            {/* Feature Card 3: Canteen */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="relative h-48 w-full">
                <Image
                    src="/canteen.jpg" // Replace with your actual image path
                    alt="Kantin asrama yang sehat"
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400/FFF0DB/92400E?text=Kantin+Sehat'} // Placeholder
                />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-2">Makanan Sehat & Halal</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Menyediakan makanan bergizi, higienis, dan halal dengan menu bervariasi.
                </p>
              </div>
            </div>

            {/* Feature Card 4: Bathroom */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="relative h-48 w-full">
                <Image
                    src="/bathroom.png" // Replace with your actual image path
                    alt="Kamar mandi asrama yang bersih"
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400/FFF0DB/92400E?text=Sanitasi+Terjaga'} // Placeholder
                />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-2">Sanitasi Bersih & Terjaga</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Fasilitas kamar mandi yang terawat baik dengan ketersediaan air bersih yang memadai.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Location Section - Simplified Styling */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl md:text-4xl font-bold text-amber-900 dark:text-amber-400 text-center mb-12">Lokasi Strategis & Mudah Diakses</h2>
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
            {/* Location Image with Map Link */}
            <div className="md:w-1/2 w-full">
              <a 
                href="https://www.google.com/maps/dir//PP.+Darul+Ulum,+Rejoso,+Jl.+KH.+Moh.+As'ad+Umar,+Wonokerto+Selatan,+Peterongan,+Kec.+Peterongan,+Kabupaten+Jombang,+Jawa+Timur+61481/@-7.5454306,112.1957389,12z/data=!4m8!4m7!1m0!1m5!1m1!1s0x2e786ada431d1f53:0x15df885880cd6a3b!2m2!1d112.278137!2d-7.5454451?entry=ttu&g_ep=EgoyMDI1MDMyNS4xIKXMDSoASAFQAw%3D%3D"
                target="_blank" 
                rel="noopener noreferrer"
                className="block cursor-pointer transition-transform hover:scale-[1.02] duration-300"
                title="Lihat di Google Maps"
              >
                <div className="relative h-64 sm:h-80 w-full rounded-xl overflow-hidden shadow-lg">
                  <Image
                      src="/location_updated.png" // Replace with your actual image path
                      alt="Peta Lokasi Asrama Chosyi'ah"
                      fill
                      style={{ objectFit: 'cover', backgroundColor: 'rgba(251, 191, 36, 0.1)' }}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      onError={(e) => e.currentTarget.src = 'https://placehold.co/800x600/FFF0DB/92400E?text=Lokasi+Asrama'} // Placeholder
                      className="hover:opacity-95 transition-opacity"
                  />
                  <div className="absolute bottom-2 right-2 bg-white dark:bg-gray-800 rounded-full px-2 py-1 text-xs text-amber-700 dark:text-amber-300 shadow-sm flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                    Buka Maps
                  </div>
                </div>
              </a>
            </div>
            {/* Location Details */}
            <div className="md:w-1/2 w-full">
              {/* Using a simple card style */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
                <p className="text-amber-800 dark:text-amber-300 mb-4">
                  <span className="font-semibold">Cuma 1 menit dari Kampus Utama Unipdu,</span> dengan jembatan khusus yang menghubungkan langsung asrama ke kampus!
                </p>
                <p className="text-amber-800 dark:text-amber-300 mb-6">
                  Asrama Chosyi’ah juga berdampingan dengan Canteen 375 (kantin sehat) dan Koperasi Unipdu. Mau makan atau jajan? Tinggal selangkah dari gerbang!
                </p>
                {/* Contact Info List */}
                <div className="space-y-3">
                  {/* Address */}
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">
                      {/* Lucide Icon Placeholder: map-pin */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700 dark:text-amber-400"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <p className="text-amber-900 dark:text-amber-300 text-sm">PP. Darul Ulum, Rejoso, Jl. KH. Moh. As'ad Umar, Wonokerto Selatan, Peterongan, Kec. Peterongan, Kabupaten Jombang, Jawa Timur 61481</p>
                  </div>
                  {/* Phone */}
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">
                      {/* Lucide Icon Placeholder: phone */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700 dark:text-amber-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </div>
                    <p className="text-amber-900 dark:text-amber-300 text-sm">(0321) 866686</p>
                  </div>
                  {/* Email */}
                  {/*<div className="flex items-start gap-3">*/}
                  {/*  <div className="mt-1 flex-shrink-0 bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">*/}
                  {/*    /!* Lucide Icon Placeholder: mail *!/*/}
                  {/*    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700 dark:text-amber-400"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>*/}
                  {/*  </div>*/}
                  {/*  <p className="text-amber-900 dark:text-amber-300 text-sm">info@pesantrenchosyiah.ac.id</p> /!* Updated Email *!/*/}
                  {/*</div>*/}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Registration Section - Simplified Styling */}
        <section id="daftar" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Simple background, removed complex gradient and decorative elements */}
          <div className="bg-amber-100 dark:bg-gray-800 rounded-2xl p-6 md:p-10 lg:p-12 border border-amber-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-3xl md:text-4xl font-bold text-amber-800 dark:text-amber-400 mb-10 text-center">
              Segera Daftar—Kamar Terbatas!
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
              {/* Registration Info Card */}
              <div className="order-2 md:order-1 bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 md:p-8">
                {/* Icon and Title */}
                <div className="flex items-center mb-5">
                  <div className="w-10 h-10 bg-amber-500 dark:bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0 mr-3 shadow-sm">
                    {/* Lucide Icon Placeholder: user-plus */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                  </div>
                  <h3 className="text-2xl font-semibold text-amber-800 dark:text-amber-400">Pendaftaran Santri Baru</h3>
                </div>

                <p className="text-amber-700 dark:text-amber-300 mb-5">
                  Jangan sampai kehabisan, nikmati pengalaman kuliah terbaikmu di lingkungan modern hanya selangkah dari kampus!
                </p>

                {/* Registration Details */}
                <div className="mb-6 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-amber-800 dark:text-amber-400">Tahun Ajaran:</span>
                    <span className="text-amber-900 dark:text-amber-300">2025/2026</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-amber-800 dark:text-amber-400">Uang Pangkal:</span>
                    <span className="text-amber-900 dark:text-amber-300">Rp 2.250.000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-800 dark:text-amber-400">Status:</span>
                    <span className="font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Dibuka</span>
                  </div>
                </div>

                {/* Action Button Area */}
                <div className="flex flex-col items-start gap-3">
                  <Link
                      href="/registration"
                      className="
                     inline-flex items-center justify-center w-full sm:w-auto px-6 py-3
                     font-semibold text-white rounded-lg
                     bg-gradient-to-r from-amber-500 to-amber-600
                     hover:from-amber-500 hover:to-amber-500
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500
                     transition-all duration-300 ease-in-out
                     shadow-md hover:shadow-lg
                     dark:shadow-amber-400/40 dark:hover:shadow-amber-300/60 dark:shadow-lg dark:hover:shadow-xl
                     dark:ring-2 dark:ring-amber-400/30 dark:hover:ring-amber-300/50
                     dark:hover:scale-102
                     relative dark:after:absolute dark:after:inset-0 dark:after:-z-10 dark:after:rounded-xl
                     dark:after:bg-amber-400/20 dark:after:blur-lg dark:after:scale-110
                     text-base group
                     z-10
                   "
                  >
                    Daftar Sekarang
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-150" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </Link>
                  {/* Urgency Nudge - positioned below */}
                  <div className="
                   inline-flex items-center px-3 py-1 rounded-full
                   text-xs font-medium text-red-800 dark:text-red-300
                   bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800
                   shadow-sm
                 ">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Kuota Terbatas! Segera Daftar!
                  </div>
                </div>
              </div>

              {/* Contact & Image Area */}
              <div className="order-1 md:order-2 space-y-6">
                {/* Image */}
                <div className="relative h-64 w-full rounded-xl overflow-hidden shadow-lg border border-amber-200 dark:border-gray-700">
                  <Image
                      src="/join us real.png" // Replace with your actual image path
                      alt="Santri belajar di Asrama Chosyi'ah"
                      fill
                      style={{ objectFit: 'cover' }} // Changed to cover for better fit
                      sizes="(max-width: 768px) 100vw, 50vw"
                      onError={(e) => e.currentTarget.src = 'https://placehold.co/800x500/FFF0DB/92400E?text=Bergabunglah'} // Placeholder
                  />
                </div>

                {/* Contact Info Card */}
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-5 rounded-xl shadow-md border border-amber-100 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-3 flex items-center">
                    {/* Lucide Icon Placeholder: phone-call */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-amber-600 dark:text-amber-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/></svg>
                    Informasi Pendaftaran
                  </h3>
                  <div className="space-y-2 text-sm">
                    {/* Phone Contact */}
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full flex-shrink-0">
                        {/* Lucide Icon Placeholder: smartphone */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700 dark:text-amber-400"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                      </div>
                      <p className="text-amber-900 dark:text-amber-300 font-medium">0852-3247-9151 (Ustadzah)</p>
                    </div>
                    {/* Email Contact */}
                    {/*<div className="flex items-center gap-2">*/}
                    {/*  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full flex-shrink-0">*/}
                    {/*    /!* Lucide Icon Placeholder: mail *!/*/}
                    {/*    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700 dark:text-amber-400"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>*/}
                    {/*  </div>*/}
                    {/*  <p className="text-amber-900 dark:text-amber-300 font-medium">pendaftaran@pesantrenchosyiah.ac.id</p> /!* Updated Email *!/*/}
                    {/*</div>*/}
                    {/* Office Hours */}
                    <div className="flex items-start gap-2">
                      {/*<div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full flex-shrink-0 mt-0.5">*/}
                      {/*  /!* Lucide Icon Placeholder: clock *!/*/}
                      {/*  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700 dark:text-amber-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>*/}
                      {/*</div>*/}
                      {/*<div>*/}
                      {/*  <p className="text-amber-900 dark:text-amber-300 font-medium">Senin - Jumat: 08.00 - 16.00 WIB</p>*/}
                      {/*  <p className="text-amber-900 dark:text-amber-300 font-medium">Sabtu: 08.00 - 12.00 WIB</p>*/}
                      {/*</div>*/}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-amber-100 dark:bg-gray-800 border-t border-amber-200 dark:border-gray-700 pt-12 pb-8 mt-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              {/* Footer Column 1: About */}
              <div>
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-3">Asrama Chosyi'ah</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                  Membentuk generasi Islami yang berakhlak mulia, cerdas, dan mandiri.
                </p>
                {/* Optional: Add social media icons here */}
              </div>
              {/* Footer Column 2: Programs */}
              <div>
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-3">Fasilitas Unggul</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition duration-150">Kamar Eksklusif</a></li>
                  <li><a href="#" className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition duration-150">Lingkungan Belajar Tertib</a></li>
                  <li><a href="#" className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition duration-150">Makanan Sehat & Halal</a></li>
                  <li><a href="#" className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition duration-150">Sanitasi Bersih & Terjaga</a></li>
                </ul>
              </div>
              {/* Footer Column 3: Quick Links */}
              <div>
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-3">Tautan Cepat</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/" className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition duration-150">Beranda</Link></li>
                  <li><Link href="/tentang" className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition duration-150">Tentang Kami</Link></li>
                  <li><Link href="/program" className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition duration-150">Program</Link></li>
                  <li><Link href="/galeri" className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition duration-150">Galeri</Link></li>
                  <li><Link href="/kontak" className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition duration-150">Kontak</Link></li>
                </ul>
              </div>
              {/* Footer Column 4: Contact */}
              <div>
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-3">Hubungi Kami</h3>
                <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                  <li className="flex items-start gap-2">
                    {/* Icon: map-pin */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 flex-shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>PP. Darul Ulum, Rejoso, Jl. KH. Moh. As'ad Umar, Wonokerto Selatan, Peterongan, Kec. Peterongan, Kabupaten Jombang, Jawa Timur 61481</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {/* Icon: phone */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>(0321) 866686</span>
                  </li>
                  {/*<li className="flex items-center gap-2">*/}
                  {/*  /!* Icon: mail *!/*/}
                  {/*  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>*/}
                  {/*  <span>info@pesantrenchosyiah.ac.id</span> /!* Updated Email *!/*/}
                  {/*</li>*/}
                </ul>
              </div>
            </div>
            {/* Copyright */}
            <div className="border-t border-amber-200 dark:border-gray-700 pt-6 text-center text-sm text-amber-700 dark:text-amber-300">
              <p>&copy; {new Date().getFullYear()} Asrama Chosyi'ah. Hak Cipta Dilindungi.</p>
            </div>
          </div>
        </footer>
      </div>
  );
}
