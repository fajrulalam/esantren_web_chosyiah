"use client";

import { useState } from "react";
import { useAuth } from "@/firebase/auth";
import { createIzinApplication } from "@/firebase/izinSakitPulang";
import { useRouter } from "next/navigation";
import { IzinType, IzinStatus, ALASAN_PULANG_OPTIONS, KELUHAN_SAKIT_OPTIONS } from "@/types/izinSakitPulang";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function NewIzinPage() {
  const { user, loading, santriName } = useAuth();
  const router = useRouter();
  
  // Form states
  const [izinType, setIzinType] = useState<IzinType>("Sakit");
  const [alasan, setAlasan] = useState(ALASAN_PULANG_OPTIONS[0]);
  const [customAlasan, setCustomAlasan] = useState("");
  const [keluhan, setKeluhan] = useState(KELUHAN_SAKIT_OPTIONS[0]);
  const [customKeluhan, setCustomKeluhan] = useState("");
  const [tglPulang, setTglPulang] = useState<Date | null>(new Date());
  const [rencanaTglKembali, setRencanaTglKembali] = useState<Date | null>(
    new Date(new Date().setDate(new Date().getDate() + 3)) // Default to 3 days from now
  );
  
  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || user.role !== "waliSantri" || !user.santriId) {
      setError("Anda tidak memiliki akses untuk mengirimkan permohonan.");
      return;
    }
    
    // Get the actual alasan/keluhan value (including custom input)
    const finalAlasan = alasan === "Lainnya" ? customAlasan : alasan;
    const finalKeluhan = keluhan === "Lainnya" ? customKeluhan : keluhan;
    
    // Validate form fields
    if (izinType === "Sakit") {
      if (keluhan === "Lainnya" && !customKeluhan.trim()) {
        setError("Silakan isi keluhan terlebih dahulu.");
        return;
      }
    } else {
      if (alasan === "Lainnya" && !customAlasan.trim()) {
        setError("Silakan isi alasan terlebih dahulu.");
        return;
      }
      
      if (!tglPulang) {
        setError("Silakan pilih tanggal pulang.");
        return;
      }
      
      if (!rencanaTglKembali) {
        setError("Silakan pilih rencana tanggal kembali.");
        return;
      }
      
      // Ensure rencanaTglKembali is after tglPulang
      if (rencanaTglKembali < tglPulang) {
        setError("Rencana tanggal kembali harus setelah tanggal pulang.");
        return;
      }
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      // Create data object based on izin type
      const izinData = izinType === "Sakit" 
        ? {
            izinType: "Sakit" as IzinType,
            keluhan: finalKeluhan,
            sudahDapatIzinUstadzah: false,
            status: "Menunggu Diperiksa Ustadzah" as IzinStatus
          }
        : {
            izinType: "Pulang" as IzinType,
            alasan: finalAlasan,
            tglPulang: Timestamp.fromDate(tglPulang as Date),
            rencanaTanggalKembali: Timestamp.fromDate(rencanaTglKembali as Date),
            idPemberiIzin: null,
            pemberiIzin: null,
            sudahKembali: null,
            kembaliSesuaiRencana: null,
            sudahDapatIzinUstadzah: null,
            sudahDapatIzinNdalem: false,
            jumlahTunggakan: 0,
            status: "Menunggu Persetujuan Ustadzah" as IzinStatus
          };
      
      // Submit to Firebase
      const newIzinId = await createIzinApplication(izinData, user.santriId);
      
      if (newIzinId) {
        // Redirect to the list page on success
        router.push("/izin-santri");
      }
    } catch (err) {
      console.error("Error submitting application:", err);
      setError("Gagal mengirimkan permohonan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  // Redirect if not waliSantri
  if (!loading && (!user || user.role !== "waliSantri")) {
    router.push("/");
    return null;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link 
          href="/izin-santri" 
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" /> Kembali ke Daftar Permohonan
        </Link>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Buat Permohonan Izin Baru
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {santriName ? `Santri: ${santriName}` : 'Silakan isi formulir di bawah ini'}
          </p>
        </div>
        
        <div className="px-4 py-5 sm:p-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
              <p>{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Izin Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Jenis Izin
                </label>
                <div className="mt-2 space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-10">
                  <div className="flex items-center">
                    <input
                      id="sakit"
                      name="izinType"
                      type="radio"
                      checked={izinType === "Sakit"}
                      onChange={() => setIzinType("Sakit")}
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                    />
                    <label htmlFor="sakit" className="ml-3 block text-sm font-medium text-gray-700">
                      Izin Sakit
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="pulang"
                      name="izinType"
                      type="radio"
                      checked={izinType === "Pulang"}
                      onChange={() => setIzinType("Pulang")}
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                    />
                    <label htmlFor="pulang" className="ml-3 block text-sm font-medium text-gray-700">
                      Izin Pulang
                    </label>
                  </div>
                </div>
              </div>
              
              {/* Conditionally render form fields based on izin type */}
              {izinType === "Sakit" ? (
                <div>
                  <label htmlFor="keluhan" className="block text-sm font-medium text-gray-700">
                    Keluhan <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1">
                    <select
                      id="keluhan"
                      name="keluhan"
                      value={keluhan}
                      onChange={(e) => setKeluhan(e.target.value)}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      required
                    >
                      {KELUHAN_SAKIT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Show custom input field if "Lainnya" is selected */}
                  {keluhan === "Lainnya" && (
                    <div className="mt-3">
                      <label htmlFor="customKeluhan" className="block text-sm font-medium text-gray-700">
                        Sebutkan Keluhan <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1">
                        <textarea
                          id="customKeluhan"
                          name="customKeluhan"
                          rows={3}
                          value={customKeluhan}
                          onChange={(e) => setCustomKeluhan(e.target.value)}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          placeholder="Jelaskan keluhan yang dialami"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="alasan" className="block text-sm font-medium text-gray-700">
                      Alasan <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <select
                        id="alasan"
                        name="alasan"
                        value={alasan}
                        onChange={(e) => setAlasan(e.target.value)}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        required
                      >
                        {ALASAN_PULANG_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Show custom input field if "Lainnya" is selected */}
                    {alasan === "Lainnya" && (
                      <div className="mt-3">
                        <label htmlFor="customAlasan" className="block text-sm font-medium text-gray-700">
                          Sebutkan Alasan <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="customAlasan"
                            name="customAlasan"
                            rows={3}
                            value={customAlasan}
                            onChange={(e) => setCustomAlasan(e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="Jelaskan alasan kepulangan"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="tglPulang" className="block text-sm font-medium text-gray-700">
                        Tanggal Pulang <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1">
                        <DatePicker
                          id="tglPulang"
                          selected={tglPulang}
                          onChange={(date) => setTglPulang(date)}
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                          dateFormat="MMMM d, yyyy HH:mm"
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="rencanaTglKembali" className="block text-sm font-medium text-gray-700">
                        Rencana Tanggal Kembali <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1">
                        <DatePicker
                          id="rencanaTglKembali"
                          selected={rencanaTglKembali}
                          onChange={(date) => setRencanaTglKembali(date)}
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                          dateFormat="MMMM d, yyyy HH:mm"
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          minDate={tglPulang || new Date()}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              <div className="flex justify-end pt-5">
                <Link
                  href="/izin-santri"
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Mengirim...
                    </>
                  ) : (
                    'Kirim Permohonan'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}