/**
 * Type definitions for Kegiatan (Daily Activities) feature
 */

import { Timestamp } from "firebase/firestore";

/**
 * Custom activity entry allowing flexible activity tracking
 */
export interface CustomActivity {
    name: string; // Activity name (e.g., "Piket Dapur", "Mengajar Komputer")
    people: Person[]; // People assigned to this activity
}

/**
 * Person object - represents a Santri or Pengurus
 */
export interface Person {
    uid: string;
    name: string;
    role: "santri" | "pengurus";
}

/**
 * Complete Kegiatan document structure as stored in Firestore
 */
export interface KegiatanData {
    date: string; // YYYY-MM-DD format
    imamSubuh: Person | null;
    imamMaghrib: Person | null;
    mengajarNgaji: Person[];
    mengajarPegon: Person[];
    customActivities: CustomActivity[]; // User-defined activities (Internal)
    luarAsramaActivities: LuarAsramaActivity[]; // External activities
    createdByUid: string;
    updatedByUid: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * Form data structure for the kegiatan page
 */
export interface KegiatanFormData {
    date: string;
    imamSubuh: Person | null;
    imamMaghrib: Person | null;
    mengajarNgaji: Person[];
    mengajarPegon: Person[];
    customActivities: CustomActivity[];
    luarAsramaActivities: LuarAsramaActivity[];
}

/**
 * Structure for Outside Dormitory Activities
 */
export interface LuarAsramaActivity {
    id: string; // Unique ID for keying in lists
    name: string;
    startTime: string;
    endTime: string;
    partTimer: Person[]; // Changed to Person[] for PersonSelector compatibility
    isCustom?: boolean; // UI state for custom activity input
}

/**
 * Monthly kegiatan data for reporting
 */
export interface MonthlyKegiatanReport {
    month: number;
    year: number;
    activities: KegiatanData[];
    summary?: ActivitySummary;
}

/**
 * Summary statistics for PDF report
 */
export interface ActivitySummary {
    [personUid: string]: {
        name: string;
        role: "santri" | "pengurus";
        imamSubuhCount: number;
        imamMaghribCount: number;
        mengajarNgajiCount: number;
        mengajarPegonCount: number;
    };
}
