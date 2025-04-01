"use client";

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '@/firebase/config';
import { KODE_ASRAMA } from '@/constants';

// Placeholder image for success page
const PLACEHOLDER_IMAGE = '/join us.png';

export default function Registration() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    namaLengkap: '',
    tempatLahir: '',
    tanggalLahir: '',
    namaOrangTua: '',
    alamatRumah: '',
    nomorTelpon: '', // Santri's phone (WA)
    nomorWalisantri: '', // Parent's phone
    programStudi: '',
    sekolahAsal: '',
    paymentOption: 'pangkalOnly', // pangkalOnly | pangkalAndSyahriah
  });
  
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredData, setRegisteredData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPaymentProof(e.target.files[0]);
    }
  };

  const handleNext = () => {
    setStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const handlePrev = () => {
    setStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  // Handle the registration directly via Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Process the file upload first (this doesn't require authentication)
      let paymentProofUrl = '';
      if (paymentProof) {
        const storageRef = ref(storage, `public-uploads/registration-proofs/${Date.now()}-${paymentProof.name}`);
        await uploadBytes(storageRef, paymentProof);
        paymentProofUrl = await getDownloadURL(storageRef);
      }
      
      // Prepare Santri data
      const santriData = {
        // Required fields from formData
        email: formData.email,
        nama: formData.namaLengkap,
        tempatLahir: formData.tempatLahir,
        tanggalLahir: formData.tanggalLahir,
        namaOrangTua: formData.namaOrangTua,
        alamatRumah: formData.alamatRumah,
        nomorTelpon: formData.nomorTelpon,
        nomorWalisantri: formData.nomorWalisantri,
        programStudi: formData.programStudi,
        sekolahAsal: formData.sekolahAsal,
        
        // Automatic fields
        kodeAsrama: KODE_ASRAMA,
        statusTanggungan: 'Menunggu Verifikasi',
        kamar: '-',
        statusAktif: 'Pending', // This is required by security rules
        
        // Other required fields from Santri interface
        kelas: formData.programStudi, // Can be updated later by admin
        tahunMasuk: new Date().getFullYear().toString(),
        jenjangPendidikan: 'PT', // Assuming higher education
        semester: '1', // Default to 1 as requested
        jumlahTunggakan: 0,
        
        // Payment related fields
        paymentOption: formData.paymentOption,
        paymentProofUrl: paymentProofUrl,
        
        // Timestamp fields
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      console.log("Registration data:", santriData);
      
      // Directly add to Firestore collection (now allowed by security rules)
      const docRef = await addDoc(collection(db, 'SantriCollection'), santriData);
      
      console.log("Document written with ID: ", docRef.id);
      
      // Save registered data for WhatsApp link
      setRegisteredData({
        id: docRef.id,
        ...santriData
      });
      
      // Show success message
      setRegistrationComplete(true);
    } catch (error) {
      console.error('Error submitting registration:', error);
      alert('Terjadi kesalahan saat mendaftar. Silakan coba lagi nanti atau hubungi admin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate WhatsApp link with prefilled message
  const getWhatsAppLink = () => {
    if (!registeredData) return '#';
    
    const paymentType = registeredData.paymentOption === 'pangkalOnly' 
      ? 'pembayaran uang pangkal' 
      : 'pembayaran uang pangkal dan syahriah 6 bulan';
    
    const message = encodeURIComponent(
      `Assalamu'alaikum Ustadzah, saya ${registeredData.nama} ingin mengonfirmasi ${paymentType} yang sudah saya lakukan. Mohon untuk diverifikasi. Terima kasih.`
    );
    
    return `https://wa.me/+628123456789?text=${message}`;
  };

  // Claymorphism styles
  const containerStyle = `
    bg-amber-50 rounded-3xl p-8 md:p-10
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
    py-4 px-8 rounded-xl font-bold text-amber-900 
    bg-amber-200 border-2 border-amber-300
    hover:bg-amber-300 active:bg-amber-400
    transition-all duration-300
    shadow-[6px_6px_12px_#d6d0c4,-6px_-6px_12px_#fffef4]
    active:shadow-[2px_2px_4px_#d6d0c4,-2px_-2px_4px_#fffef4]
    active:translate-x-[2px] active:translate-y-[2px]
    disabled:opacity-70 disabled:cursor-not-allowed
  `;

  const fileUploadStyle = `
    border-2 border-dashed border-amber-300 
    bg-amber-50 rounded-xl p-6
    flex flex-col items-center justify-center
    cursor-pointer
    transition-all duration-300
    hover:border-amber-400 hover:bg-amber-100
  `;

  // Success view after registration
  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-amber-50 pt-24 px-4">
        <div className="max-w-4xl mx-auto mt-10 mb-20">
          <div className={containerStyle}>
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-amber-900 mb-4">Selamat bergabung!</h2>
              <div className="my-6">
                <Image 
                  src={PLACEHOLDER_IMAGE} 
                  alt="Selamat Bergabung" 
                  width={300} 
                  height={300} 
                  className="mx-auto rounded-lg"
                />
              </div>
              <p className="text-amber-800 mb-8">
                InshaAllah pembayaran sudah kami terima. Tunggu dihubungi ustadzah untuk verifikasi dan 
                informasi kamu mendapat kamar mana. Atau, hubungi mereka langsung saja!
              </p>
              <div className="flex flex-col md:flex-row gap-4 justify-center">
                <a 
                  href={getWhatsAppLink()} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`${buttonStyle} bg-green-500 border-green-600 text-white hover:bg-green-600`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                    Hubungi Ustadzah
                  </span>
                </a>
                <Link href="/" className={buttonStyle}>
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 pt-24 px-4">
      <div className="max-w-4xl mx-auto mt-10 mb-20">
        <div className={containerStyle}>
          <h1 className="text-3xl font-bold text-amber-900 mb-2 text-center">Pendaftaran Santri Baru</h1>
          <p className="text-amber-700 mb-8 text-center">Tahun Ajaran {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
          
          <div className="flex justify-between mb-8">
            <div className={`w-full h-2 ${step >= 1 ? 'bg-amber-500' : 'bg-amber-200'} rounded-full`}></div>
            <div className="w-4"></div>
            <div className={`w-full h-2 ${step >= 2 ? 'bg-amber-500' : 'bg-amber-200'} rounded-full`}></div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-amber-800 mb-4">Data Diri Santri</h2>
                
                <div>
                  <label className="block mb-2 text-sm font-medium text-amber-800">Email</label>
                  <input
                    type="email"
                    name="email"
                    className={inputStyle}
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Masukkan email"
                    required
                  />
                </div>
                
                <div>
                  <label className="block mb-2 text-sm font-medium text-amber-800">Nama Lengkap</label>
                  <input
                    type="text"
                    name="namaLengkap"
                    className={inputStyle}
                    value={formData.namaLengkap}
                    onChange={handleChange}
                    placeholder="Masukkan nama lengkap"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-amber-800">Tempat Lahir</label>
                    <input
                      type="text"
                      name="tempatLahir"
                      className={inputStyle}
                      value={formData.tempatLahir}
                      onChange={handleChange}
                      placeholder="Masukkan tempat lahir"
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-amber-800">Tanggal Lahir</label>
                    <input
                      type="date"
                      name="tanggalLahir"
                      className={inputStyle}
                      value={formData.tanggalLahir}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-amber-800">Nama Orang Tua/Wali</label>
                  <input
                    type="text"
                    name="namaOrangTua"
                    className={inputStyle}
                    value={formData.namaOrangTua}
                    onChange={handleChange}
                    placeholder="Masukkan nama orang tua/wali"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-amber-800">Alamat Rumah</label>
                  <textarea
                    name="alamatRumah"
                    className={inputStyle}
                    value={formData.alamatRumah}
                    onChange={handleChange}
                    placeholder="Masukkan alamat lengkap"
                    rows={3}
                    required
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-amber-800">Nomor HP Santri (WhatsApp)</label>
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className={`w-16 p-4 rounded-l-xl bg-amber-200 border-y-2 border-l-2 border-amber-300 text-amber-900 font-medium shadow-inner text-center`}>
                          +62
                        </div>
                      </div>
                      <input
                        type="text"
                        name="nomorTelpon"
                        className={`${inputStyle} rounded-l-none border-l-0`}
                        value={formData.nomorTelpon}
                        onChange={handleChange}
                        placeholder="8123456789"
                        required
                      />
                    </div>
                    <p className="mt-1 text-xs text-amber-600">Tanpa awalan 0</p>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-amber-800">Nomor HP Orang Tua</label>
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className={`w-16 p-4 rounded-l-xl bg-amber-200 border-y-2 border-l-2 border-amber-300 text-amber-900 font-medium shadow-inner text-center`}>
                          +62
                        </div>
                      </div>
                      <input
                        type="text"
                        name="nomorWalisantri"
                        className={`${inputStyle} rounded-l-none border-l-0`}
                        value={formData.nomorWalisantri}
                        onChange={handleChange}
                        placeholder="8123456789"
                        required
                      />
                    </div>
                    <p className="mt-1 text-xs text-amber-600">Tanpa awalan 0</p>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <button 
                    type="button" 
                    onClick={handleNext}
                    className={buttonStyle}
                  >
                    Lanjutkan
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-amber-800 mb-4">Informasi Pendaftaran</h2>
                
                <div>
                  <label className="block mb-2 text-sm font-medium text-amber-800">Program Studi</label>
                  <input
                    type="text"
                    name="programStudi"
                    className={inputStyle}
                    value={formData.programStudi}
                    onChange={handleChange}
                    placeholder="Masukkan program studi"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-amber-800">Sekolah Asal</label>
                  <input
                    type="text"
                    name="sekolahAsal"
                    className={inputStyle}
                    value={formData.sekolahAsal}
                    onChange={handleChange}
                    placeholder="Masukkan sekolah asal"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-amber-800">Opsi Pembayaran</label>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="pangkalOnly"
                        name="paymentOption"
                        value="pangkalOnly"
                        checked={formData.paymentOption === 'pangkalOnly'}
                        onChange={handleChange}
                        className="w-5 h-5 text-amber-600 bg-amber-100 border-amber-300 focus:ring-amber-500"
                      />
                      <label htmlFor="pangkalOnly" className="ml-3 text-amber-800">
                        Membayar uang pangkal saja
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="pangkalAndSyahriah"
                        name="paymentOption"
                        value="pangkalAndSyahriah"
                        checked={formData.paymentOption === 'pangkalAndSyahriah'}
                        onChange={handleChange}
                        className="w-5 h-5 text-amber-600 bg-amber-100 border-amber-300 focus:ring-amber-500"
                      />
                      <label htmlFor="pangkalAndSyahriah" className="ml-3 text-amber-800">
                        Membayar uang pangkal dan syahriah 6 bulan
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-amber-800">Lampiran Bukti Pembayaran</label>
                  <div 
                    className={fileUploadStyle}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,.pdf"
                      className="hidden"
                      required
                    />
                    {paymentProof ? (
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-amber-700">{paymentProof.name}</p>
                        <p className="text-sm text-amber-500 mt-2">Klik untuk mengubah file</p>
                      </div>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-amber-700 font-medium mb-1">Klik untuk mengunggah bukti pembayaran</p>
                        <p className="text-sm text-amber-500">atau seret dan lepas file di sini</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-amber-100 p-6 rounded-xl shadow-inner mt-8">
                  <h3 className="text-lg font-bold text-amber-800 mb-4">Informasi Pembayaran</h3>
                  <p className="text-amber-900 mb-4">
                    Silakan lakukan pembayaran sesuai opsi yang dipilih ke rekening berikut:
                  </p>
                  <div className="bg-white p-4 rounded-lg border border-amber-200">
                    <p className="font-medium">Bank BRI</p>
                    <p className="text-lg font-bold">1234-5678-9012-3456</p>
                    <p>a.n. Yayasan Pesantren Hurun Inn</p>
                  </div>
                  <p className="mt-4 text-amber-700 text-sm">
                    Pastikan bukti pembayaran menunjukkan nominal dan tanggal pembayaran dengan jelas.
                  </p>
                </div>

                <div className="flex justify-between mt-8">
                  <button 
                    type="button" 
                    onClick={handlePrev}
                    className={`${buttonStyle} bg-white hover:bg-gray-50 active:bg-gray-100`}
                  >
                    Kembali
                  </button>
                  <button 
                    type="submit" 
                    className={buttonStyle}
                    disabled={isSubmitting || !paymentProof}
                  >
                    {isSubmitting ? 'Memproses...' : 'Daftar Sekarang'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}