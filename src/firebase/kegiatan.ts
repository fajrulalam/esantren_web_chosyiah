/**
 * Firestore service for Kegiatan (Daily Activities) feature
 * Handles CRUD operations for daily activity tracking
 */

import {
    collection,
    doc,
    getDoc,
    setDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    orderBy,
    Timestamp, // Added Timestamp
} from "firebase/firestore";
import { db } from "./config";
import { KegiatanData, KegiatanFormData, Person } from "@/types/kegiatan";

const KEGIATAN_COLLECTION = "KegiatanCollection";
const SANTRI_COLLECTION = "SantriCollection";
const PENGURUS_COLLECTION = "PengurusCollection";

/**
 * Get all people (Santri + Pengurus) for dropdown selection
 * Only includes people from DU11_Chosyiah and DU11_ChosyiahJadid asrama
 * Deduplicates by name to show only unique names
 * Returns sorted list by name
 */
export async function getAllPeople(): Promise<Person[]> {
    try {
        const people: Person[] = [];
        const allowedKodeAsrama = ["DU11_Chosyiah", "DU11_ChosyiahJadid"];

        // Fetch active Santri from allowed asrama who are currently present
        const santriQuery = query(
            collection(db, SANTRI_COLLECTION),
            where("statusAktif", "==", "Aktif"),
            where("kodeAsrama", "in", allowedKodeAsrama),
            where("statusKehadiran", "==", "Ada")
        );
        const santriSnapshot = await getDocs(santriQuery);
        santriSnapshot.forEach((doc) => {
            const data = doc.data();
            people.push({
                uid: doc.id,
                name: data.nama || data.name || "Unknown",
                role: "santri",
            });
        });

        // Fetch Pengurus from allowed asrama
        const pengurusQuery = query(
            collection(db, PENGURUS_COLLECTION),
            where("kodeAsrama", "in", allowedKodeAsrama)
        );
        const pengurusSnapshot = await getDocs(pengurusQuery);
        pengurusSnapshot.forEach((doc) => {
            const data = doc.data();
            people.push({
                uid: doc.id,
                name: data.nama || data.name || "Unknown",
                role: "pengurus",
            });
        });

        // Step 1: Deduplicate by UID first (ensures unique UIDs for React)
        console.log(`[Kegiatan] Fetched ${people.length} total people before dedup`);
        const byUidMap = new Map<string, Person>();
        people.forEach((person) => {
            if (!byUidMap.has(person.uid)) {
                byUidMap.set(person.uid, person);
            } else {
                console.log(`[Kegiatan] Skipping duplicate UID: ${person.uid} - ${person.name}`);
            }
        });

        // Step 2: Deduplicate by lowercase name (removes visual duplicates)
        const uniquePeopleMap = new Map<string, Person>();
        byUidMap.forEach((person) => {
            const nameLower = person.name.toLowerCase();
            if (!uniquePeopleMap.has(nameLower)) {
                uniquePeopleMap.set(nameLower, person);
            } else {
                console.log(`[Kegiatan] Skipping duplicate name: ${person.name} (${person.role})`);
            }
        });

        // Convert Map back to array
        const uniquePeople = Array.from(uniquePeopleMap.values());
        console.log(`[Kegiatan] After dedup: ${uniquePeople.length} unique people`);

        // Sort alphabetically by name
        uniquePeople.sort((a, b) => a.name.localeCompare(b.name, "id-ID"));

        return uniquePeople;
    } catch (error) {
        console.error("Error fetching people:", error);
        throw new Error("Gagal memuat daftar orang");
    }
}

/**
 * Get kegiatan data for a specific date
 * @param date - Date string in YYYY-MM-DD format
 */
export async function getKegiatanByDate(
    date: string
): Promise<KegiatanData | null> {
    try {
        const docRef = doc(db, KEGIATAN_COLLECTION, date);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as KegiatanData;
        }
        return null;
    } catch (error) {
        console.error("Error fetching kegiatan:", error);
        throw new Error("Gagal memuat data kegiatan");
    }
}

/**
 * Save or update kegiatan data for a specific date
 * Uses upsert pattern - creates if doesn't exist, updates if exists
 */
export async function saveKegiatan(
    data: KegiatanFormData,
    userId: string
): Promise<void> {
    try {
        const docRef = doc(db, KEGIATAN_COLLECTION, data.date);
        const existingDoc = await getDoc(docRef);

        const kegiatanData: Partial<KegiatanData> = {
            date: data.date,
            imamSubuh: data.imamSubuh,
            imamMaghrib: data.imamMaghrib,
            mengajarNgaji: data.mengajarNgaji,
            mengajarPegon: data.mengajarPegon,
            customActivities: data.customActivities, // Add customActivities
            luarAsramaActivities: data.luarAsramaActivities || [], // Add luarAsramaActivities
            updatedByUid: userId,
            updatedAt: serverTimestamp() as any,
        };

        // If document doesn't exist, add createdBy fields
        if (!existingDoc.exists()) {
            kegiatanData.createdByUid = userId;
            kegiatanData.createdAt = serverTimestamp() as any;
        }

        await setDoc(docRef, kegiatanData, { merge: true });
    } catch (error) {
        console.error("Error saving kegiatan:", error);
        throw new Error("Gagal menyimpan data kegiatan");
    }
}

/**
 * Get all kegiatan data for a specific month
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12)
 */
export async function getKegiatanByMonth(
    year: number,
    month: number
): Promise<KegiatanData[]> {
    try {
        // Format month with leading zero if needed
        const monthStr = month.toString().padStart(2, "0");
        const startDate = `${year}-${monthStr}-01`;

        // Calculate end date (last day of month)
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthStr}-${lastDay}`;

        const kegiatanQuery = query(
            collection(db, KEGIATAN_COLLECTION),
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "asc")
        );

        const querySnapshot = await getDocs(kegiatanQuery);
        const activities: KegiatanData[] = [];

        querySnapshot.forEach((doc) => {
            activities.push(doc.data() as KegiatanData);
        });

        return activities;
    } catch (error) {
        console.error("Error fetching monthly kegiatan:", error);
        throw new Error("Gagal memuat data kegiatan bulanan");
    }
}

/**
 * Get all kegiatan data for a specific date range
 * @param startDate - Start date YYYY-MM-DD
 * @param endDate - End date YYYY-MM-DD
 */
export async function getKegiatanByDateRange(
    startDate: string,
    endDate: string
): Promise<KegiatanData[]> {
    try {
        const kegiatanQuery = query(
            collection(db, KEGIATAN_COLLECTION),
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "asc")
        );

        const querySnapshot = await getDocs(kegiatanQuery);
        const activities: KegiatanData[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data() as KegiatanData;
            // Ensure arrays exist
            if (!data.luarAsramaActivities) data.luarAsramaActivities = [];
            if (!data.customActivities) data.customActivities = [];
            activities.push(data);
        });

        return activities;
    } catch (error) {
        console.error("Error fetching range kegiatan:", error);
        throw new Error("Gagal memuat data kegiatan rentang tanggal");
    }
}

/**
 * Copy yesterday's kegiatan to current date
 * @param currentDate - Current date in YYYY-MM-DD format
 * @param userId - Current user ID
 */
export async function copyYesterdayKegiatan(
    currentDate: string,
    userId: string
): Promise<KegiatanFormData | null> {
    try {
        // Calculate yesterday's date
        const currentDateObj = new Date(currentDate);
        const yesterdayObj = new Date(currentDateObj);
        yesterdayObj.setDate(yesterdayObj.getDate() - 1);

        const year = yesterdayObj.getFullYear();
        const month = String(yesterdayObj.getMonth() + 1).padStart(2, "0");
        const day = String(yesterdayObj.getDate()).padStart(2, "0");
        const yesterdayDate = `${year}-${month}-${day}`;

        // Fetch yesterday's data
        const yesterdayData = await getKegiatanByDate(yesterdayDate);

        if (!yesterdayData) {
            return null;
        }

        // Return as form data (without timestamps and user IDs)
        return {
            date: currentDate,
            imamSubuh: yesterdayData.imamSubuh,
            imamMaghrib: yesterdayData.imamMaghrib,
            mengajarNgaji: yesterdayData.mengajarNgaji,
            mengajarPegon: yesterdayData.mengajarPegon,
            customActivities: yesterdayData.customActivities,
            luarAsramaActivities: yesterdayData.luarAsramaActivities || [],
        };
    } catch (error) {
        console.error("Error copying yesterday's kegiatan:", error);
        throw new Error("Gagal menyalin data kemarin");
    }
}

/**
 * Get dates in a month that have kegiatan entries
 * Used for calendar highlighting
 */
export async function getKegiatanDatesInMonth(
    year: number,
    month: number
): Promise<string[]> {
    try {
        const activities = await getKegiatanByMonth(year, month);
        return activities.map((activity) => activity.date);
    } catch (error) {
        console.error("Error fetching kegiatan dates:", error);
        return [];
    }
}
