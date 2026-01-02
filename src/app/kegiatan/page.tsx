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
    getKegiatanByDateRange,
    migratePersonName,
} from "@/firebase/kegiatan";
import { Person, KegiatanFormData, LuarAsramaActivity } from "@/types/kegiatan";
import PersonSelector from "@/components/kegiatan/PersonSelector";
import ActivitySelector from "@/components/kegiatan/ActivitySelector";
import { generateDalamAsramaPDF, generateLuarAsramaPDF } from "@/utils/pdfGenerator";
import { toast } from "react-hot-toast";
import {
    CalendarIcon,
    DocumentArrowDownIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
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
        luarAsramaActivities: [],
    });
    const [loading, setLoading] = useState(false);
    const [loadingPeople, setLoadingPeople] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

    // Export State
    const [exportType, setExportType] = useState<"dalam" | "luar">("dalam");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [exportingPdf, setExportingPdf] = useState(false);
    const [migrating, setMigrating] = useState(false);

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

    // Initialize date to today and defaults for export
    useEffect(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        setSelectedDate(dateStr);
        setFormData((prev) => ({ ...prev, date: dateStr }));

        // Default export range (first to last day of current month)
        const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
        setStartDate(`${year}-${month}-01`);
        setEndDate(`${year}-${month}-${lastDay}`);
    }, []);

    // Load people list
    useEffect(() => {
        async function fetchPeople() {
            try {
                setLoadingPeople(true);
                const peopleList = await getAllPeople();
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

    // Load kegiatan data when date changes
    useEffect(() => {
        async function fetchKegiatanData() {
            if (!selectedDate) return;

            try {
                setLoading(true);
                const data = await getKegiatanByDate(selectedDate);

                if (data) {
                    // Ensure at least 2 rows for Luar Asrama if empty
                    let loadedLuarActivities = data.luarAsramaActivities || [];

                    // Map loaded activities to include isCustom UI state
                    loadedLuarActivities = loadedLuarActivities.map(a => ({
                        ...a,
                        isCustom: !["UniMart", "Canteen 375"].includes(a.name) && a.name !== ""
                    }));

                    if (loadedLuarActivities.length < 2) {
                        const needed = 2 - loadedLuarActivities.length;
                        for (let i = 0; i < needed; i++) {
                            loadedLuarActivities.push({
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 9) + i,
                                name: "",
                                startTime: "",
                                endTime: "",
                                partTimer: [],
                                isCustom: false
                            });
                        }
                    }

                    setFormData({
                        date: selectedDate,
                        imamSubuh: data.imamSubuh,
                        imamMaghrib: data.imamMaghrib,
                        mengajarNgaji: data.mengajarNgaji,
                        mengajarPegon: data.mengajarPegon,
                        customActivities: data.customActivities || [],
                        luarAsramaActivities: loadedLuarActivities,
                    });
                } else {
                    // No data for this date, reset form with 2 default rows
                    const defaultLuarActivities = [
                        { id: Date.now().toString() + Math.random().toString(36).substr(2, 9), name: "", startTime: "", endTime: "", partTimer: [], isCustom: false },
                        { id: Date.now().toString() + Math.random().toString(36).substr(2, 9) + "1", name: "", startTime: "", endTime: "", partTimer: [], isCustom: false }
                    ];

                    setFormData({
                        date: selectedDate,
                        imamSubuh: null,
                        imamMaghrib: null,
                        mengajarNgaji: [],
                        mengajarPegon: [],
                        customActivities: [],
                        luarAsramaActivities: defaultLuarActivities,
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
        if (!startDate || !endDate) {
            toast.error("Mohon pilih tanggal mulai dan akhir");
            return;
        }

        try {
            setExportingPdf(true);
            const activities = await getKegiatanByDateRange(startDate, endDate);

            if (activities.length === 0) {
                toast.error("Tidak ada data untuk rentang tanggal yang dipilih");
                return;
            }

            if (exportType === "dalam") {
                generateDalamAsramaPDF(activities, startDate, endDate, true);
            } else {
                generateLuarAsramaPDF(activities, startDate, endDate);
            }

            toast.success("PDF berhasil dibuat");
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast.error("Gagal membuat PDF");
        } finally {
            setExportingPdf(false);
        }
    };

    // Handle Migration (Temporary Fix)
    const handleMigration = async () => {
        const oldName = "Shafira Agila Syafa Adika";
        const newName = "Shafira Agil Syafa'adhika";

        if (!confirm(`Apakah Anda yakin ingin mengubah nama "${oldName}" menjadi "${newName}" pada semua data lama?`)) return;

        try {
            setMigrating(true);
            const count = await migratePersonName(oldName, newName);
            toast.success(`Berhasil memperbarui ${count} dokumen.`);
        } catch (error) {
            console.error(error);
            toast.error("Gagal melakukan migrasi.");
        } finally {
            setMigrating(false);
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

    // Helper to add Luar Asrama Activity
    const addLuarActivity = () => {
        setFormData({
            ...formData,
            luarAsramaActivities: [
                ...formData.luarAsramaActivities,
                { id: Date.now().toString() + Math.random().toString(36).substr(2, 9), name: "", startTime: "", endTime: "", partTimer: [], isCustom: false },
            ],
        });
    };

    // Helper to ignore lint error for generic field update but special handle others
    const updateLuarActivity = (index: number, field: keyof LuarAsramaActivity, value: any) => {
        const updated = [...formData.luarAsramaActivities];
        // @ts-ignore - dynamic assignment
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, luarAsramaActivities: updated });
    };

    // Helper to remove Luar Asrama Activity
    const removeLuarActivity = (index: number) => {
        const updated = formData.luarAsramaActivities.filter((_, i) => i !== index);
        setFormData({ ...formData, luarAsramaActivities: updated });
    };

    if (authLoading) return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div></div>;
    if (!user || user.role === "waliSantri") return null;

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Sistem Pelaporan Kegiatan Asrama</h1>
            </div>

            {/* Date Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex-1 w-full sm:w-auto">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <CalendarIcon className="h-5 w-5 inline mr-2" />
                            Tanggal
                        </label>
                        <div className="flex gap-4 items-center">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                            <button
                                type="button"
                                onClick={handleCopyYesterday}
                                disabled={loading || loadingPeople}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                            >
                                <ArrowPathIcon className="h-5 w-5" />
                                Salin Kemarin
                            </button>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatDateDisplay(selectedDate)}</p>
                    </div>
                </div>
            </div>

            {/* Data Kegiatan Dalam Asrama */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                    Data Kegiatan Dalam Asrama
                </h2>

                {loadingPeople ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500 mx-auto"></div>
                        <p className="mt-3 text-gray-600 dark:text-gray-400">Memuat data...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <PersonSelector label="Imam Subuh" people={people} selectedPeople={formData.imamSubuh ? [formData.imamSubuh] : []} onSelect={(s) => setFormData({ ...formData, imamSubuh: s[0] || null })} multiSelect={false} placeholder="Pilih imam subuh..." disabled={loading} />
                        <PersonSelector label="Imam Maghrib" people={people} selectedPeople={formData.imamMaghrib ? [formData.imamMaghrib] : []} onSelect={(s) => setFormData({ ...formData, imamMaghrib: s[0] || null })} multiSelect={false} placeholder="Pilih imam maghrib..." disabled={loading} />
                        <PersonSelector label="Mengajar Ngaji" people={people} selectedPeople={formData.mengajarNgaji} onSelect={(s) => setFormData({ ...formData, mengajarNgaji: s })} multiSelect={true} placeholder="Pilih pengajar ngaji..." disabled={loading} />
                        <PersonSelector label="Mengajar Pegon" people={people} selectedPeople={formData.mengajarPegon} onSelect={(s) => setFormData({ ...formData, mengajarPegon: s })} multiSelect={true} placeholder="Pilih pengajar pegon..." disabled={loading} />

                        {/* Kegiatan Lainnya Internal */}
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kegiatan Lainnya</h3>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, customActivities: [...formData.customActivities, { name: "", people: [] }] })}
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                                >
                                    <PlusIcon className="h-4 w-4" /> Tambah Kegiatan
                                </button>
                            </div>
                            {formData.customActivities.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Belum ada kegiatan lainnya. Klik &quot;Tambah Kegiatan&quot; untuk menambah.</p>
                            ) : (
                                <div className="space-y-4">
                                    {formData.customActivities.map((activity, index) => (
                                        <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                                            <div className="flex items-start gap-4">
                                                <div className="flex-1 space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nama Kegiatan</label>
                                                        <input
                                                            type="text"
                                                            value={activity.name}
                                                            onChange={(e) => {
                                                                const updated = [...formData.customActivities];
                                                                updated[index].name = e.target.value;
                                                                setFormData({ ...formData, customActivities: updated });
                                                            }}
                                                            placeholder="Contoh: Piket Dapur, Mengajar Komputer..."
                                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                            disabled={loading}
                                                        />
                                                    </div>
                                                    <PersonSelector label="Penanggung Jawab" people={people} selectedPeople={activity.people} onSelect={(s) => {
                                                        const updated = [...formData.customActivities];
                                                        updated[index].people = s;
                                                        setFormData({ ...formData, customActivities: updated });
                                                    }} multiSelect={true} placeholder="Pilih penanggung jawab..." disabled={loading} />
                                                </div>
                                                <button type="button" onClick={() => setFormData({ ...formData, customActivities: formData.customActivities.filter((_, i) => i !== index) })} disabled={loading} className="mt-8 p-2 text-red-500 hover:text-red-700 transition-colors">
                                                    <TrashIcon className="h-5 w-5" />
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
                            {saveStatus === "error" && <div className="text-red-600 dark:text-red-400 font-medium">Gagal menyimpan</div>}
                        </div>
                    </div>
                )}
            </div>

            {/* Data Kegiatan Luar Asrama */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Data Kegiatan Luar Asrama
                </h2>

                {/* Headers */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-2 px-1">
                    <div className="md:col-span-4 text-sm font-handwriting font-bold">Nama Kegiatan</div>
                    <div className="md:col-span-4 text-sm font-handwriting font-bold">Jam Mulai - Jam Akhir</div>
                    <div className="md:col-span-4 text-sm font-handwriting font-bold">Nama Part-Timer</div>
                </div>

                {/* Form Rows */}
                <div className="space-y-4 mb-6">
                    {formData.luarAsramaActivities.map((activity, index) => (
                        <div key={activity.id || index} className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-gray-50 p-4 rounded-lg border dark:bg-gray-700/30 dark:border-gray-600 relative group">
                            <div className="md:col-span-4">
                                {activity.isCustom ? (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={activity.name}
                                            onChange={(e) => updateLuarActivity(index, "name", e.target.value)}
                                            placeholder="Tulis nama kegiatan..."
                                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 pr-10"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updated = [...formData.luarAsramaActivities];
                                                updated[index] = { ...updated[index], isCustom: false, name: "" };
                                                setFormData({ ...formData, luarAsramaActivities: updated });
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                            title="Kembali ke pilihan"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ) : (

                                    <ActivitySelector
                                        value={activity.name}
                                        options={["UniMart", "Canteen 375", "Lainnya"]}
                                        onChange={(val) => {
                                            if (val === "Lainnya") {
                                                const updated = [...formData.luarAsramaActivities];
                                                updated[index] = { ...updated[index], isCustom: true, name: "" };
                                                setFormData({ ...formData, luarAsramaActivities: updated });
                                            } else {
                                                updateLuarActivity(index, "name", val);
                                            }
                                        }}
                                        placeholder="Pilih nama kegiatan"
                                    />
                                )}
                            </div>
                            <div className="md:col-span-4 flex gap-2 items-center">
                                <input
                                    type="time" // Using time input for better UX
                                    value={activity.startTime}
                                    onChange={(e) => updateLuarActivity(index, "startTime", e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                                />
                                <span className="dark:text-gray-100">-</span>
                                <input
                                    type="time"
                                    value={activity.endTime}
                                    onChange={(e) => updateLuarActivity(index, "endTime", e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                                />
                            </div>
                            <div className="md:col-span-4">
                                <PersonSelector
                                    label="" // Empty label as header handles it
                                    people={people}
                                    selectedPeople={activity.partTimer}
                                    onSelect={(s) => {
                                        const updated = [...formData.luarAsramaActivities];
                                        updated[index].partTimer = s;
                                        setFormData({ ...formData, luarAsramaActivities: updated });
                                    }}
                                    multiSelect={false}
                                    placeholder="Pilih Nama Part-Timer"
                                    disabled={loading}
                                />
                            </div>
                            <button
                                onClick={() => removeLuarActivity(index)}
                                className="text-red-500 hover:text-red-700 p-2 self-center"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Kegiatan Lainnya Header + Button */}
                <div className="flex items-center justify-between mb-4 mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kegiatan Lainnya</h3>
                    <button
                        type="button"
                        onClick={addLuarActivity}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                    >
                        <PlusIcon className="h-4 w-4" /> Tambah Kegiatan
                    </button>
                </div>

                {formData.luarAsramaActivities.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-6">Belum ada kegiatan lainnya. Klik &quot;Tambah Kegiatan&quot; untuk menambah.</p>
                )}

                {/* Save Button for Luar Asrama (Duplicate saving logic) */}
                <div className="flex items-center gap-4 pt-4 border-t dark:border-gray-700">
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
                </div>
            </div>

            {/* Export Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex flex-col gap-4">
                    <select
                        value={exportType}
                        onChange={(e) => setExportType(e.target.value as "dalam" | "luar")}
                        className="w-full sm:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
                    >
                        <option value="dalam">Cetak Laporan Kegiatan Dalam Asrama</option>
                        <option value="luar">Cetak Laporan Kegiatan Luar Asrama</option>
                    </select>

                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium font-handwriting mb-2 dark:text-gray-300">Tanggal Mulai</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100"
                            />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium font-handwriting mb-2 dark:text-gray-300">Tanggal Akhir</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleExportPdf}
                            disabled={exportingPdf}
                            className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium h-[42px]"
                        >
                            {exportingPdf ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                            ) : (
                                <>
                                    <DocumentArrowDownIcon className="h-5 w-5" />
                                    Export PDF
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Maintenance Section */}
                <div className="mt-8 border-t pt-4 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={handleMigration}
                        disabled={migrating}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
                    >
                        {migrating ? "Sedang Memperbaiki Data..." : "Perbaiki Nama Shafira (Maintenance)"}
                    </button>
                </div>
            </div>
        </div >
    );
}