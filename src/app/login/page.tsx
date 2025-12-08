"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/auth";
import Image from "next/image";

export default function Login() {
  const [userType, setUserType] = useState<"waliSantri" | "staff">(
    "waliSantri"
  );
  const [namaSantri, setNamaSantri] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [nameFound, setNameFound] = useState<boolean | null>(null);
  const [phoneCorrect, setPhoneCorrect] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    user,
    signInWithEmail,
    signInWithGoogle,
    signInAsSantri,
    loading,
    checkSantriName,
    checkSantriPhone,
  } = useAuth();

  // Redirect if user is already logged in
  useEffect(() => {
    if (user && !loading) {
      if (user.role === "waliSantri") {
        router.push("/payment-history");
      } else {
        router.push("/rekapitulasi");
      }
    }
  }, [user, loading, router]);

  const handleWaliSantriLogin = async () => {
    if (!namaSantri || !phoneNumber) {
      setError("Mohon isi semua kolom");
      setNameFound(null);
      setPhoneCorrect(null);
      return;
    }

    if (!/^\d+$/.test(phoneNumber)) {
      setError("Nomor telepon hanya boleh berisi angka");
      setNameFound(null);
      setPhoneCorrect(null);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const formattedPhone = "+62" + phoneNumber;

      // First try the direct login (matches both name and phone)
      const success = await signInAsSantri(namaSantri, formattedPhone);

      if (success) {
        // Both name and phone matched - direct login successful
        setNameFound(true);
        setPhoneCorrect(true);
        router.push("/payment-history");
        return;
      }

      // Login failed, now check if just the name exists
      const isNameFound = await checkSantriName(namaSantri);
      setNameFound(isNameFound);

      if (!isNameFound) {
        // Name doesn't exist
        setError(
          "Nama santri tidak ditemukan. Mohon periksa kembali penulisan nama."
        );
        setPhoneCorrect(null);
      } else {
        // Name exists but phone doesn't match
        setPhoneCorrect(false);
        setError(
          "Nama santri ditemukan, tetapi nomor telepon tidak sesuai dengan data yang terdaftar."
        );
      }
    } catch (err) {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      console.error(err);
      setNameFound(null);
      setPhoneCorrect(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportPhoneNumber = () => {
    if (!namaSantri) return;

    const message = encodeURIComponent(
      `Assalamu'alaikum, Saya ${namaSantri} tidak bisa masuk website Esantren Chosyi'ah meskipun menurut saya nomor sudah sesuai. Mohon bantuannya untuk mengecek / memperbarui data saya dengan nomor ini.`
    );

    // Open WhatsApp with pre-filled message
    window.open(`https://wa.me/+6281336500027?text=${message}`, "_blank");
  };

  const handleStaffLogin = async () => {
    if (!email || !password) {
      setError("Mohon isi semua kolom");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await signInWithEmail(email, password);
      router.push("/rekapitulasi");
    } catch (err: any) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Email atau password salah");
      } else {
        setError("Terjadi kesalahan. Silakan coba lagi.");
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setIsLoading(true);

    try {
      await signInWithGoogle();
      router.push("/rekapitulasi");
    } catch (err: any) {
      if (err.code === "auth/user-cancelled") {
        setError(
          "Email tidak terdaftar. Silakan gunakan email yang valid atau daftar terlebih dahulu."
        );
      } else {
        setError("Terjadi kesalahan saat login dengan Google");
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userType === "waliSantri") {
      handleWaliSantriLogin();
    } else {
      handleStaffLogin();
    }
  };

  // Claymorphism styles
  const containerStyle = `
        bg-amber-50 dark:bg-gray-800 rounded-3xl p-10
        border-2 border-amber-200 dark:border-gray-700
        shadow-[8px_8px_16px_#d6d0c4,-8px_-8px_16px_#fffef4]
        dark:shadow-[8px_8px_16px_#1f2937,-8px_-8px_16px_#374151]
    `;

  const inputStyle = `
        w-full p-4 rounded-xl
        bg-amber-50 dark:bg-gray-900 border-2 border-amber-200 dark:border-gray-700
        focus:outline-none focus:border-amber-400 dark:focus:border-amber-500
        shadow-[inset_2px_2px_5px_#d6d0c4,inset_-2px_-2px_5px_#fffef4]
        dark:shadow-[inset_2px_2px_5px_#111827,inset_-2px_-2px_5px_#1f2937]
        text-amber-900 dark:text-amber-300 placeholder:text-amber-400 dark:placeholder:text-amber-600
        transition-all duration-300
    `;

  const buttonStyle = `
        w-full py-4 px-8 mt-4 rounded-xl
        font-bold text-amber-900 dark:text-amber-900
        bg-amber-200 dark:bg-amber-400 border-2 border-amber-300 dark:border-amber-500
        hover:bg-amber-300 dark:hover:bg-amber-500 active:bg-amber-400 dark:active:bg-amber-600
        transition-all duration-300
        shadow-[6px_6px_12px_#d6d0c4,-6px_-6px_12px_#fffef4]
        dark:shadow-[6px_6px_12px_#1f2937,-6px_-6px_12px_#374151]
        active:shadow-[2px_2px_4px_#d6d0c4,-2px_-2px_4px_#fffef4]
        dark:active:shadow-[2px_2px_4px_#1f2937,-2px_-2px_4px_#374151]
        active:translate-x-[2px] active:translate-y-[2px]
        disabled:opacity-70 disabled:cursor-not-allowed
    `;

  const tabStyle = `
        py-3 px-6 text-center
        rounded-xl font-medium transition-all duration-300
    `;

  const activeTabStyle = `
        ${tabStyle}
        bg-amber-200 dark:bg-amber-500 text-amber-900 dark:text-amber-950
        shadow-[inset_2px_2px_5px_#d6d0c4,inset_-2px_-2px_5px_#fffef4]
        dark:shadow-[inset_2px_2px_5px_#92400e,inset_-2px_-2px_5px_#fcd34d]
    `;

  const inactiveTabStyle = `
        ${tabStyle}
        bg-amber-50 dark:bg-gray-700 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300
        shadow-[4px_4px_8px_#d6d0c4,-4px_-4px_8px_#fffef4]
        dark:shadow-[4px_4px_8px_#1f2937,-4px_-4px_8px_#374151]
        hover:shadow-[6px_6px_12px_#d6d0c4,-6px_-6px_12px_#fffef4]
        dark:hover:shadow-[6px_6px_12px_#1f2937,-6px_-6px_12px_#374151]
    `;

  return (
    <div className="flex justify-center items-center min-h-screen bg-amber-50 dark:bg-gray-900 pt-24 px-4">
      <div className={`${containerStyle} w-full max-w-md`}>
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-amber-900 dark:text-amber-400 mb-2">
            Selamat Datang
          </h2>
          <p className="text-amber-700 dark:text-amber-300">
            Silakan masuk untuk mengakses sistem pembayaran
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            className={
              userType === "waliSantri" ? activeTabStyle : inactiveTabStyle
            }
            onClick={() => setUserType("waliSantri")}
          >
            Santri
          </button>
          <button
            className={userType === "staff" ? activeTabStyle : inactiveTabStyle}
            onClick={() => setUserType("staff")}
          >
            Staff / Admin
          </button>
        </div>

        {error &&
          !(
            nameFound === false ||
            (nameFound === true && phoneCorrect === false)
          ) && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-xl border-2 border-red-200 dark:border-red-800/50 shadow-inner">
              {error}
            </div>
          )}

        <form onSubmit={handleSubmit}>
          {userType === "waliSantri" ? (
            <>
              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-amber-800">
                  Nama Santri
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className={`${inputStyle} ${
                      nameFound === true
                        ? "border-green-400 pr-10"
                        : nameFound === false
                        ? "border-red-400 pr-10"
                        : ""
                    }`}
                    value={namaSantri}
                    onChange={(e) => {
                      setNamaSantri(e.target.value);
                      // Reset validation states when input changes
                      if (nameFound !== null || phoneCorrect !== null) {
                        setNameFound(null);
                        setPhoneCorrect(null);
                        setError("");
                      }
                    }}
                    placeholder="Masukkan nama santri"
                    disabled={isLoading}
                  />
                  {nameFound === true && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6 text-green-500 absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {nameFound === false && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-amber-600">
                    <span className="font-medium">Penting:</span> Pastikan
                    penulisan nama sudah benar.
                  </p>
                  <p className="text-xs text-amber-700">
                    Contoh format yang benar:{" "}
                    <span className="font-medium">Ahmad Baihaqi</span>,{" "}
                    <span className="font-medium">M. Fajrul Alam</span>
                  </p>
                  <p className="text-xs text-amber-700">
                    Sistem akan otomatis memperbaiki kapitalisasi nama.
                  </p>
                </div>

                {nameFound === false && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <div className="flex items-start">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0"
                      >
                        <path
                          fillRule="evenodd"
                          d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <p className="font-medium">Nama tidak ditemukan</p>
                        <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                          <li>
                            Periksa kembali ejaan nama (sistem akan memperbaiki
                            kapitalisasi)
                          </li>
                          <li>
                            Gunakan nama lengkap seperti yang terdaftar saat
                            pendaftaran
                          </li>
                          <li>
                            Jika menggunakan inisial, pastikan format dengan
                            titik (contoh: M. Ahmad)
                          </li>
                          <li>
                            Jika masih gagal, coba tanpa inisial atau
                            menggunakan nama panggilan
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-sm font-medium text-amber-800">
                  Nomor WhatsApp (Wali Santri)
                </label>
                <div className="flex relative">
                  <div className="flex-shrink-0">
                    <div
                      className={`w-16 p-4 rounded-l-xl bg-amber-200 border-y-2 border-l-2 border-amber-300 text-amber-900 font-medium shadow-inner text-center`}
                    >
                      +62
                    </div>
                  </div>
                  <input
                    type="text"
                    className={`${inputStyle} rounded-l-none border-l-0 ${
                      phoneCorrect === true
                        ? "border-green-400 pr-10"
                        : phoneCorrect === false
                        ? "border-red-400 pr-10"
                        : ""
                    }`}
                    value={phoneNumber}
                    onChange={(e) => {
                      // Only allow digits
                      const value = e.target.value.replace(/\D/g, "");
                      setPhoneNumber(value);
                      // Reset validation states when input changes
                      if (nameFound !== null || phoneCorrect !== null) {
                        setNameFound(null);
                        setPhoneCorrect(null);
                        setError("");
                      }
                    }}
                    placeholder="8123456789"
                    disabled={isLoading}
                  />
                  {phoneCorrect === true && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6 text-green-500 absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {phoneCorrect === false && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <p className="mt-1 text-xs text-amber-600">
                  Masukkan nomor tanpa awalan 0
                </p>

                {/* Phone validation failed but name was found */}
                {nameFound === true && phoneCorrect === false && (
                  <div className="mt-3">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 mb-3">
                      <div className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0"
                        >
                          <path
                            fillRule="evenodd"
                            d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <p className="font-medium">
                            Nama santri ditemukan, tetapi nomor telepon tidak
                            sesuai
                          </p>
                          <p className="text-xs mt-1">
                            Periksa kembali nomor yang Anda masukkan. Jika Anda
                            yakin nomor tersebut benar, klik tombol di bawah
                            untuk menghubungi kami via WhatsApp.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleReportPhoneNumber}
                      className="w-full py-3 px-4 rounded-lg
                                                    font-medium text-amber-900 bg-yellow-100
                                                    border-2 border-yellow-200 hover:bg-yellow-200
                                                    transition-all duration-200 flex items-center justify-center"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                      </svg>
                      Hubungi Admin via WhatsApp
                    </button>
                  </div>
                )}
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

          <button type="submit" className={buttonStyle} disabled={isLoading}>
            {isLoading ? "Memproses..." : "Masuk"}
          </button>

          {userType === "staff" && (
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
                <svg
                  className="w-5 h-5 mr-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12.2401 24.0008C15.4766 24.0008 18.2059 22.9382 20.1945 21.1039L16.3276 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.2401 24.0008Z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.50253 14.3003C4.99987 12.8099 4.99987 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z"
                    fill="#FBBC04"
                  />
                  <path
                    d="M12.2401 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.2401 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.2401 4.74966Z"
                    fill="#EA4335"
                  />
                </svg>
                Login dengan Google
              </button>
            </div>
          )}
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 transition-colors"
          >
            ← Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
