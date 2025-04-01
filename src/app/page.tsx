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
        <div className="flex justify-center items-center min-h-screen bg-amber-50">
          {/* Simple spinner */}
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        </div>
    );
  }

  // Main component render
  return (
      <div className="min-h-screen bg-amber-50 font-sans"> {/* Using a common sans-serif font */}

        {/* Header Placeholder (Optional - Add your actual header/nav here) */}
        {/* <header className="bg-white shadow-sm p-4 sticky top-0 z-50"> ... </header> */}

        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-amber-900 mb-4">
            Selamat Datang di Asrama Chosyi'ah
          </h1>
          <h2 className="text-xl md:text-2xl text-amber-700 mb-8 max-w-3xl mx-auto">
            Membentuk Generasi Islami yang Berakhlak Mulia, Cerdas, dan Mandiri di Lingkungan yang Mendukung.
          </h2>

          {/* Call to Action Button Area */}
          <div className="flex flex-col items-center gap-4">
            <Link
                href="/registration"
                className="
              inline-flex items-center justify-center px-8 py-3
              font-semibold text-white rounded-lg
              bg-gradient-to-r from-amber-500 to-amber-600
              hover:from-amber-600 hover:to-amber-700
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500
              transition duration-150 ease-in-out
              shadow-md hover:shadow-lg
              text-lg group
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
            <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="relative h-48 w-full">
                <Image
                    src="/room.png" // Replace with your actual image path
                    alt="Kamar santri yang nyaman"
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" // Optimize image loading
                    onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400/FFF0DB/92400E?text=Kamar+Nyaman'} // Placeholder
                />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-amber-800 mb-2">Fasilitas Kamar Nyaman</h3>
                <p className="text-sm text-amber-700">
                  Kamar bersih dan kondusif untuk istirahat dan belajar, dilengkapi fasilitas pendukung.
                </p>
              </div>
            </div>

            {/* Feature Card 2: Hallway */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1">
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
                <h3 className="text-lg font-semibold text-amber-800 mb-2">Lingkungan Belajar Tertib</h3>
                <p className="text-sm text-amber-700">
                  Suasana asri dan teratur yang mendukung fokus belajar dan pembentukan karakter Islami.
                </p>
              </div>
            </div>

            {/* Feature Card 3: Canteen */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1">
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
                <h3 className="text-lg font-semibold text-amber-800 mb-2">Makanan Sehat & Halal</h3>
                <p className="text-sm text-amber-700">
                  Menyediakan makanan bergizi, higienis, dan halal dengan menu bervariasi setiap hari.
                </p>
              </div>
            </div>

            {/* Feature Card 4: Bathroom */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1">
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
                <h3 className="text-lg font-semibold text-amber-800 mb-2">Sanitasi Bersih & Terjaga</h3>
                <p className="text-sm text-amber-700">
                  Fasilitas kamar mandi yang terawat baik dengan ketersediaan air bersih yang cukup.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Location Section - Simplified Styling */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl md:text-4xl font-bold text-amber-900 text-center mb-12">Lokasi Strategis & Mudah Diakses</h2>
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
            {/* Location Image */}
            <div className="md:w-1/2 w-full">
              <div className="relative h-64 sm:h-80 w-full rounded-xl overflow-hidden shadow-lg">
                <Image
                    src="/location.png" // Replace with your actual image path
                    alt="Peta Lokasi Asrama Chosyi'ah"
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    onError={(e) => e.currentTarget.src = 'https://placehold.co/800x600/FFF0DB/92400E?text=Lokasi+Asrama'} // Placeholder
                />
              </div>
            </div>
            {/* Location Details */}
            <div className="md:w-1/2 w-full">
              {/* Using a simple card style */}
              <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                <p className="text-amber-800 mb-4">
                  Terletak di lingkungan yang tenang dan kondusif untuk belajar, Asrama Chosyi'ah mudah dijangkau dari berbagai penjuru kota.
                </p>
                <p className="text-amber-800 mb-6">
                  Alamat kami di <span className="font-semibold">Jl. Pesantren No. 123, Kelurahan Contoh, Kecamatan Teladan, Kota Surabaya, Jawa Timur 60111</span>, dekat dengan fasilitas umum.
                </p>
                {/* Contact Info List */}
                <div className="space-y-3">
                  {/* Address */}
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 bg-amber-100 p-2 rounded-full">
                      {/* Lucide Icon Placeholder: map-pin */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <p className="text-amber-900 text-sm">Jl. Pesantren No. 123, Surabaya 60111</p>
                  </div>
                  {/* Phone */}
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 bg-amber-100 p-2 rounded-full">
                      {/* Lucide Icon Placeholder: phone */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </div>
                    <p className="text-amber-900 text-sm">+62 812-3456-7890</p>
                  </div>
                  {/* Email */}
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 bg-amber-100 p-2 rounded-full">
                      {/* Lucide Icon Placeholder: mail */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    </div>
                    <p className="text-amber-900 text-sm">info@pesantrenchosyiah.ac.id</p> {/* Updated Email */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Registration Section - Simplified Styling */}
        <section id="daftar" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Simple background, removed complex gradient and decorative elements */}
          <div className="bg-amber-100 rounded-2xl p-6 md:p-10 lg:p-12 border border-amber-200 shadow-sm">
            <h2 className="text-3xl md:text-4xl font-bold text-amber-800 mb-10 text-center">
              Mulai Perjalanan Pendidikan Islami Anda Bersama Kami
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
              {/* Registration Info Card */}
              <div className="order-2 md:order-1 bg-white rounded-xl shadow-lg p-6 md:p-8">
                {/* Icon and Title */}
                <div className="flex items-center mb-5">
                  <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0 mr-3 shadow-sm">
                    {/* Lucide Icon Placeholder: user-plus */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                  </div>
                  <h3 className="text-2xl font-semibold text-amber-800">Pendaftaran Santri Baru</h3>
                </div>

                <p className="text-amber-700 mb-5">
                  Kami membuka pendaftaran untuk tahun ajaran 2025/2026. Raih kesempatan belajar di lingkungan Islami yang berkualitas.
                </p>

                {/* Registration Details */}
                <div className="mb-6 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-amber-800">Tahun Ajaran:</span>
                    <span className="text-amber-900">2025/2026</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-amber-800">Biaya Pendaftaran:</span>
                    <span className="text-amber-900">Rp 500.000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-800">Status:</span>
                    <span className="font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Dibuka</span>
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
                     hover:from-amber-600 hover:to-amber-700
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500
                     transition duration-150 ease-in-out
                     shadow-md hover:shadow-lg
                     text-base group
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
                   text-xs font-medium text-red-800
                   bg-red-100 border border-red-200
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
                <div className="relative h-64 w-full rounded-xl overflow-hidden shadow-lg border border-amber-200">
                  <Image
                      src="/join us.png" // Replace with your actual image path
                      alt="Santri belajar di Asrama Chosyi'ah"
                      fill
                      style={{ objectFit: 'cover' }} // Changed to cover for better fit
                      sizes="(max-width: 768px) 100vw, 50vw"
                      onError={(e) => e.currentTarget.src = 'https://placehold.co/800x500/FFF0DB/92400E?text=Bergabunglah'} // Placeholder
                  />
                </div>

                {/* Contact Info Card */}
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-xl shadow-md border border-amber-100">
                  <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center">
                    {/* Lucide Icon Placeholder: phone-call */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-amber-600"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/></svg>
                    Informasi Pendaftaran
                  </h3>
                  <div className="space-y-2 text-sm">
                    {/* Phone Contact */}
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 rounded-full flex-shrink-0">
                        {/* Lucide Icon Placeholder: smartphone */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                      </div>
                      <p className="text-amber-900 font-medium">+62 812-3456-7890 (Admin)</p>
                    </div>
                    {/* Email Contact */}
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 rounded-full flex-shrink-0">
                        {/* Lucide Icon Placeholder: mail */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      </div>
                      <p className="text-amber-900 font-medium">pendaftaran@pesantrenchosyiah.ac.id</p> {/* Updated Email */}
                    </div>
                    {/* Office Hours */}
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 bg-amber-100 rounded-full flex-shrink-0 mt-0.5">
                        {/* Lucide Icon Placeholder: clock */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <div>
                        <p className="text-amber-900 font-medium">Senin - Jumat: 08.00 - 16.00 WIB</p>
                        <p className="text-amber-900 font-medium">Sabtu: 08.00 - 12.00 WIB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-amber-100 border-t border-amber-200 pt-12 pb-8 mt-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              {/* Footer Column 1: About */}
              <div>
                <h3 className="text-lg font-semibold text-amber-800 mb-3">Asrama Chosyi'ah</h3>
                <p className="text-sm text-amber-700 mb-4">
                  Membentuk generasi Islami yang berakhlak mulia, cerdas, dan mandiri.
                </p>
                {/* Optional: Add social media icons here */}
              </div>
              {/* Footer Column 2: Programs */}
              <div>
                <h3 className="text-lg font-semibold text-amber-800 mb-3">Program Unggulan</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="text-amber-700 hover:text-amber-900 transition duration-150">Program Tahfidz Al-Qur'an</a></li>
                  <li><a href="#" className="text-amber-700 hover:text-amber-900 transition duration-150">Kajian Kitab Kuning</a></li>
                  <li><a href="#" className="text-amber-700 hover:text-amber-900 transition duration-150">Pengembangan Diri</a></li>
                  <li><a href="#" className="text-amber-700 hover:text-amber-900 transition duration-150">Bahasa Arab & Inggris</a></li>
                </ul>
              </div>
              {/* Footer Column 3: Quick Links */}
              <div>
                <h3 className="text-lg font-semibold text-amber-800 mb-3">Tautan Cepat</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/" className="text-amber-700 hover:text-amber-900 transition duration-150">Beranda</Link></li>
                  <li><Link href="/tentang" className="text-amber-700 hover:text-amber-900 transition duration-150">Tentang Kami</Link></li>
                  <li><Link href="/program" className="text-amber-700 hover:text-amber-900 transition duration-150">Program</Link></li>
                  <li><Link href="/galeri" className="text-amber-700 hover:text-amber-900 transition duration-150">Galeri</Link></li>
                  <li><Link href="/kontak" className="text-amber-700 hover:text-amber-900 transition duration-150">Kontak</Link></li>
                </ul>
              </div>
              {/* Footer Column 4: Contact */}
              <div>
                <h3 className="text-lg font-semibold text-amber-800 mb-3">Hubungi Kami</h3>
                <ul className="space-y-2 text-sm text-amber-700">
                  <li className="flex items-start gap-2">
                    {/* Icon: map-pin */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 flex-shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>Jl. Pesantren No. 123, Surabaya</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {/* Icon: phone */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>+62 812-3456-7890</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {/* Icon: mail */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    <span>info@pesantrenchosyiah.ac.id</span> {/* Updated Email */}
                  </li>
                </ul>
              </div>
            </div>
            {/* Copyright */}
            <div className="border-t border-amber-200 pt-6 text-center text-sm text-amber-700">
              <p>&copy; {new Date().getFullYear()} Asrama Chosyi'ah. Hak Cipta Dilindungi.</p>
            </div>
          </div>
        </footer>
      </div>
  );
}
