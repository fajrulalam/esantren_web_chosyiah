/**
 * Kegiatan (Daily Activities) Page
 * Allows Pengurus to record daily activities and export monthly reports
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase/auth";
import {
    getAllPeople,
    getKegiatanByDate,
    saveKegiatan,
    copyYesterdayKegiatan,
    getKegiatanByMonth,
} from "@/firebase/kegiatan";
import { Person, KegiatanFormData } from "@/types/kegiatan";
import PersonSelector from "@/components/kegiatan/PersonSelector";
import { generateKegiatanPDF } from "@/utils/pdfGenerator";
import { toast } from "react-hot-toast";
import {
    CalendarIcon,
    DocumentArrowDownIcon,
    ArrowPathIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";

export default function KegiatanPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    // State
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [people, setPeople] = useState<Person[]>([]);
    const [formData, setFormData] = useState<KegiatanFormData>({
        date: "",
        imamSubuh: null,
        imamMaghrib: null,
        mengajarNgaji: [],
        mengajarPegon: [],
        customActivities: [],
    });
    const [loading, setLoading] = useState(false);
    const [loadingPeople, setLoadingPeople] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [pdfMonth, setPdfMonth] = useState<number>(new Date().getMonth() + 1);
    const [pdfYear, setPdfYear] = useState<number>(new Date().getFullYear());
    const [exportingPdf, setExportingPdf] = useState(false);

    // Role-based access control
    useEffect(() => {
        if (!authLoading && user) {
            if (user.role === "waliSantri") {
                router.push("/payment-history");
            }
        } else if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    // Initialize date to today
    useEffect(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        setSelectedDate(dateStr);
        setFormData((prev) => ({ ...prev, date: dateStr }));
    }, []);

    // Load people list
    useEffect(() => {
        async function fetchPeople() {
            try {
                setLoadingPeople(true);
                const peopleList = await getAllPeople();
                console.log(`[KegiatanPage] Setting people state with ${peopleList.length} people`);
                setPeople(peopleList);
            } catch (error) {
                console.error("Error loading people:", error);
                toast.error("Gagal memuat daftar orang");
            } finally {
                setLoadingPeople(false);
            }
        }
        fetchPeople();
    }, []);

    // Debug: Log people state after it changes
    useEffect(() => {
        if (people.length > 0) {
            console.log(`[KegiatanPage] People state updated: ${people.length} people`);
            const nameCount = new Map<string, number>();
            people.forEach((person) => {
                const nameLower = person.name.toLowerCase();
                nameCount.set(nameLower, (nameCount.get(nameLower) || 0) + 1);
            });
            const duplicates = Array.from(nameCount.entries()).filter(([_, count]) => count > 1);
            if (duplicates.length > 0) {
                console.error(`[KegiatanPage] CRITICAL: People state contains duplicates!`, duplicates);
            } else {
                console.log(`[KegiatanPage] ✓ People state has no duplicate names`);
            }
        }
    }, [people]);

    // Load kegiatan data when date changes
    useEffect(() => {
        async function fetchKegiatanData() {
            if (!selectedDate) return;

            try {
                setLoading(true);
                const data = await getKegiatanByDate(selectedDate);

                if (data) {
                    setFormData({
                        date: selectedDate,
                        imamSubuh: data.imamSubuh,
                        imamMaghrib: data.imamMaghrib,
                        mengajarNgaji: data.mengajarNgaji,
                        mengajarPegon: data.mengajarPegon,
                        customActivities: data.customActivities,
                    });
                } else {
                    // No data for this date, reset form
                    setFormData({
                        date: selectedDate,
                        imamSubuh: null,
                        imamMaghrib: null,
                        mengajarNgaji: [],
                        mengajarPegon: [],
                        customActivities: [],
                    });
                }
                setSaveStatus("idle");
            } catch (error) {
                console.error("Error loading kegiatan:", error);
                toast.error("Gagal memuat data kegiatan");
            } finally {
                setLoading(false);
            }
        }

        fetchKegiatanData();
    }, [selectedDate]);

    // Handle save
    const handleSave = async () => {
        if (!user) return;

        try {
            setSaveStatus("saving");
            await saveKegiatan(formData, user.uid);
            setSaveStatus("saved");
            toast.success("Kegiatan berhasil disimpan");

            // Reset form fields after successful save
            setFormData({
                date: selectedDate,
                imamSubuh: null,
                imamMaghrib: null,
                mengajarNgaji: [],
                mengajarPegon: [],
                customActivities: [],
            });

            // Reset to idle after 2 seconds
            setTimeout(() => {
                setSaveStatus("idle");
            }, 2000);
        } catch (error) {
            console.error("Error saving kegiatan:", error);
            setSaveStatus("error");
            toast.error("Gagal menyimpan kegiatan");
        }
    };

    // Handle copy yesterday
    const handleCopyYesterday = async () => {
        if (!user || !selectedDate) return;

        try {
            setLoading(true);
            const yesterdayData = await copyYesterdayKegiatan(selectedDate, user.uid);

            if (yesterdayData) {
                setFormData(yesterdayData);
                toast.success("Data kemarin berhasil disalin");
            } else {
                toast.error("Tidak ada data kemarin");
            }
        } catch (error) {
            console.error("Error copying yesterday:", error);
            toast.error("Gagal menyalin data kemarin");
        } finally {
            setLoading(false);
        }
    };

    // Handle PDF export
    const handleExportPdf = async () => {
        try {
            setExportingPdf(true);
            const activities = await getKegiatanByMonth(pdfYear, pdfMonth);

            if (activities.length === 0) {
                toast.error("Tidak ada data untuk bulan yang dipilih");
                return;
            }

            generateKegiatanPDF(activities, pdfMonth, pdfYear, true);
            toast.success("PDF berhasil dibuat");
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast.error("Gagal membuat PDF");
        } finally {
            setExportingPdf(false);
        }
    };

    // Format date for display
    const formatDateDisplay = (dateStr: string): string => {
        if (!dateStr) return "";
        const [year, month, day] = dateStr.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    // Don't render until auth is checked
    if (authLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    // Only render for authorized users
    if (!user || user.role === "waliSantri") {
        return null;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Kegiatan Harian
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Catat kegiatan harian asrama dan buat laporan bulanan
                </p>
            </div>

            {/* Date Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex-1 w-full sm:w-auto">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <CalendarIcon className="h-5 w-5 inline mr-2" />
                            Tanggal
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {formatDateDisplay(selectedDate)}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleCopyYesterday}
                        disabled={loading || loadingPeople}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <ArrowPathIcon className="h-5 w-5" />
                        Salin Kemarin
                    </button>
                </div>
            </div>

            {/* Activity Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                    Data Kegiatan
                </h2>

                {loadingPeople ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500 mx-auto"></div>
                        <p className="mt-3 text-gray-600 dark:text-gray-400">Memuat data...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Imam Subuh */}
                        <PersonSelector
                            label="Imam Subuh"
                            people={people}
                            selectedPeople={formData.imamSubuh ? [formData.imamSubuh] : []}
                            onSelect={(selected) =>
                                setFormData({ ...formData, imamSubuh: selected[0] || null })
                            }
                            multiSelect={false}
                            placeholder="Pilih imam subuh..."
                            disabled={loading}
                        />

                        {/* Imam Maghrib */}
                        <PersonSelector
                            label="Imam Maghrib"
                            people={people}
                            selectedPeople={formData.imamMaghrib ? [formData.imamMaghrib] : []}
                            onSelect={(selected) =>
                                setFormData({ ...formData, imamMaghrib: selected[0] || null })
                            }
                            multiSelect={false}
                            placeholder="Pilih imam maghrib..."
                            disabled={loading}
                        />

                        {/* Mengajar Ngaji */}
                        <PersonSelector
                            label="Mengajar Ngaji"
                            people={people}
                            selectedPeople={formData.mengajarNgaji}
                            onSelect={(selected) =>
                                setFormData({ ...formData, mengajarNgaji: selected })
                            }
                            multiSelect={true}
                            placeholder="Pilih pengajar ngaji..."
                            disabled={loading}
                        />

                        {/* Mengajar Pegon */}
                        <PersonSelector
                            label="Mengajar Pegon"
                            people={people}
                            selectedPeople={formData.mengajarPegon}
                            onSelect={(selected) =>
                                setFormData({ ...formData, mengajarPegon: selected })
                            }
                            multiSelect={true}
                            placeholder="Pilih pengajar pegon..."
                            disabled={loading}
                        />

                        {/* Custom Activities */}
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    Kegiatan Lainnya
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData({
                                            ...formData,
                                            customActivities: [
                                                ...formData.customActivities,
                                                { name: "", people: [] },
                                            ],
                                        });
                                    }}
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    + Tambah Kegiatan
                                </button>
                            </div>

                            {formData.customActivities.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                    Belum ada kegiatan lainnya. Klik &quot;Tambah Kegiatan&quot; untuk menambah.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {formData.customActivities.map((activity, index) => (
                                        <div
                                            key={index}
                                            className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="flex-1 space-y-4">
                                                    {/* Activity Name Input */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                            Nama Kegiatan
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={activity.name}
                                                            onChange={(e) => {
                                                                const updated = [...formData.customActivities];
                                                                updated[index].name = e.target.value;
                                                                setFormData({
                                                                    ...formData,
                                                                    customActivities: updated,
                                                                });
                                                            }}
                                                            placeholder="Contoh: Piket Dapur, Mengajar Komputer..."
                                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                            disabled={loading}
                                                        />
                                                    </div>

                                                    {/* Person Selector */}
                                                    <PersonSelector
                                                        label="Penanggung Jawab"
                                                        people={people}
                                                        selectedPeople={activity.people}
                                                        onSelect={(selected) => {
                                                            const updated = [...formData.customActivities];
                                                            updated[index].people = selected;
                                                            setFormData({
                                                                ...formData,
                                                                customActivities: updated,
                                                            });
                                                        }}
                                                        multiSelect={true}
                                                        placeholder="Pilih penanggung jawab..."
                                                        disabled={loading}
                                                    />
                                                </div>

                                                {/* Remove Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            customActivities: formData.customActivities.filter(
                                                                (_, i) => i !== index
                                                            ),
                                                        });
                                                    }}
                                                    disabled={loading}
                                                    className="mt-8 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Save Button */}
                        <div className="flex items-center gap-4 pt-4">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={loading || saveStatus === "saving"}
                                className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                            >
                                {saveStatus === "saving" ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                        Menyimpan...
                                    </>
                                ) : (
                                    "Simpan Kegiatan"
                                )}
                            </button>

                            {saveStatus === "saved" && (
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                    <CheckCircleIcon className="h-6 w-6" />
                                    <span className="font-medium">Tersimpan</span>
                                </div>
                            )}

                            {saveStatus === "error" && (
                                <div className="text-red-600 dark:text-red-400 font-medium">
                                    Gagal menyimpan
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* PDF Export Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                    <DocumentArrowDownIcon className="h-6 w-6 inline mr-2" />
                    Export Laporan PDF
                </h2>

                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Bulan
                        </label>
                        <select
                            value={pdfMonth}
                            onChange={(e) => setPdfMonth(parseInt(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                            <option value={1}>Januari</option>
                            <option value={2}>Februari</option>
                            <option value={3}>Maret</option>
                            <option value={4}>April</option>
                            <option value={5}>Mei</option>
                            <option value={6}>Juni</option>
                            <option value={7}>Juli</option>
                            <option value={8}>Agustus</option>
                            <option value={9}>September</option>
                            <option value={10}>Oktober</option>
                            <option value={11}>November</option>
                            <option value={12}>Desember</option>
                        </select>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tahun
                        </label>
                        <input
                            type="number"
                            value={pdfYear}
                            onChange={(e) => setPdfYear(parseInt(e.target.value))}
                            min={2020}
                            max={2099}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleExportPdf}
                        disabled={exportingPdf}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                    >
                        {exportingPdf ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                Membuat PDF...
                            </>
                        ) : (
                            <>
                                <DocumentArrowDownIcon className="h-5 w-5" />
                                Export PDF
                            </>
                        )}
                    </button>
                </div>

                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    PDF akan berisi tabel kegiatan harian dan ringkasan per orang untuk bulan yang
                    dipilih.
                </p>
            </div>
        </div>
    );
}
