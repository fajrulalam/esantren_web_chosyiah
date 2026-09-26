import { db, auth } from "./config";
import {
  collection, query, where, getDocs, doc, getDoc, Timestamp,
  orderBy, limit, runTransaction, deleteField,
  type QueryDocumentSnapshot, type DocumentData, type QueryConstraint,
} from "firebase/firestore";
import type { IzinSakitPulang, IzinActor, NewIzinReport } from "@/types/izinSakitPulang";
import type { UserData } from "@/firebase/auth";
import {
  ONGOING_IZIN_STATUSES, HISTORY_IZIN_STATUSES, isIzinOngoing,
  canReportIzinCompletion, validateIzinReport, validateReturnDate,
} from "@/utils/izinWorkflow";

const COLLECTION_NAME = "SakitDanPulangCollection";
const asIzin = (snapshot: QueryDocumentSnapshot): IzinSakitPulang =>
  ({ ...snapshot.data(), id: snapshot.id } as IzinSakitPulang);
const actor = (user: UserData, timestamp: Timestamp, fallbackName = "Santri"): IzinActor => ({
  uid: user.uid, name: user.name || user.email || fallbackName, role: user.role, timestamp,
});

// A report and its attendance projection commit together. Reading the santri
// document in the transaction also serializes concurrent reports of the same type.
export async function createIzinApplication(
  input: NewIzinReport, user: UserData, reportId?: string,
): Promise<string> {
  if (user.role !== "waliSantri" || !user.santriId) {
    throw new Error("Hanya santri yang dapat melaporkan izinnya sendiri.");
  }
  validateIzinReport(input);
  const izinRef = reportId ? doc(db, COLLECTION_NAME, reportId) : doc(collection(db, COLLECTION_NAME));
  const santriRef = doc(db, "SantriCollection", user.santriId);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(izinRef);
    if (existing.exists()) {
      const data = existing.data();
      if (data.santriId !== user.santriId || data.reportedBy?.uid !== user.uid) {
        throw new Error("Laporan tidak sesuai dengan akun santri.");
      }
      return; // Retry after an uncertain network response keeps the original report.
    }
    const santriSnapshot = await transaction.get(santriRef);
    if (!santriSnapshot.exists()) throw new Error("Data santri tidak ditemukan.");
    const santri = santriSnapshot.data();
    const field = input.izinType === "Pulang" ? "statusKepulangan" : "statusSakit";
    const activeId = santri[field]?.izinId;
    if (activeId) {
      const active = await transaction.get(doc(db, COLLECTION_NAME, activeId));
      if (active.exists() && isIzinOngoing({ ...active.data(), id: active.id } as IzinSakitPulang)) {
        throw new Error(input.izinType === "Pulang"
          ? "Masih ada laporan pulang yang aktif. Laporkan kembali terlebih dahulu."
          : "Masih ada laporan sakit yang aktif. Laporkan sembuh terlebih dahulu.");
      }
    }
    const timestamp = Timestamp.now();
    const reportedBy = actor(user, timestamp, santri.nama);
    const common = { santriId: user.santriId, timestamp, workflowVersion: 2, reportedBy };
    if (input.izinType === "Pulang") {
      const details = {
        alasan: input.alasan.trim(), tglPulang: input.tglPulang,
        rencanaTanggalKembali: input.rencanaTanggalKembali,
        sudahKembali: false, kembaliSesuaiRencana: null,
      };
      transaction.set(izinRef, {
        ...common, ...details, izinType: "Pulang", status: "Proses Pulang",
        jumlahTunggakan: Number(santri.jumlahTunggakan) || 0,
      });
      transaction.update(santriRef, {
        statusKehadiran: "Pulang",
        statusKepulangan: { ...details, izinId: izinRef.id, reportedBy, timestamp },
      });
    } else {
      const details = { keluhan: input.keluhan.trim(), timestamp, reportedBy };
      transaction.set(izinRef, { ...common, ...details, izinType: "Sakit", status: "Dalam Masa Sakit" });
      transaction.update(santriRef, {
        // A santri who reports being sick while away remains away in attendance.
        statusKehadiran: santri.statusKehadiran === "Pulang" ? "Pulang" : "Sakit",
        statusSakit: { ...details, izinId: izinRef.id },
      });
    }
  });
  return izinRef.id;
}

export async function getIzinApplicationsBySantri(santriId: string): Promise<IzinSakitPulang[]> {
  const snapshot = await getDocs(query(collection(db, COLLECTION_NAME),
    where("santriId", "==", santriId), orderBy("timestamp", "desc")));
  return snapshot.docs.map(asIzin);
}

async function withSantriNames(records: IzinSakitPulang[]) {
  const names = new Map<string, string>();
  await Promise.all([...new Set(records.map(record => record.santriId))].map(async (id) => {
    const santri = await getDoc(doc(db, "SantriCollection", id));
    names.set(id, santri.exists() ? santri.data().nama || "Santri" : "Data santri tidak ditemukan");
  }));
  return records.map(record => ({ ...record, santriName: names.get(record.santriId) }));
}

export async function getOngoingIzinApplications() {
  // Single-field queries work with the existing indexes, including old pending states.
  const snapshots = await Promise.all(ONGOING_IZIN_STATUSES.map(status => getDocs(query(
    collection(db, COLLECTION_NAME), where("status", "==", status),
  ))));
  const records = snapshots.flatMap(snapshot => snapshot.docs.map(asIzin))
    .filter(isIzinOngoing).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  return withSantriNames(records);
}

export async function getIzinHistory(startDate?: Date | null, endDate?: Date | null) {
  const constraints: QueryConstraint[] = [];
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      throw new Error("Rentang tanggal tidak valid.");
    }
    if (end.getTime() - start.getTime() > 90 * 86400000) {
      throw new Error("Rentang tanggal tidak boleh melebihi 90 hari.");
    }
    constraints.push(where("timestamp", ">=", Timestamp.fromDate(start)),
      where("timestamp", "<=", Timestamp.fromDate(end)));
  }
  const snapshots = await Promise.all(HISTORY_IZIN_STATUSES.map(status => getDocs(query(
    collection(db, COLLECTION_NAME), where("status", "==", status),
    ...constraints, orderBy("timestamp", "desc"),
    ...(!startDate || !endDate ? [limit(8)] : []),
  ))));
  const records = snapshots.flatMap(snapshot => snapshot.docs.map(asIzin))
    .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  return withSantriNames(startDate && endDate ? records : records.slice(0, 8));
}

// Shared by the santri, pengurus, and attendance screens. Closing an old report
// must never reset attendance belonging to a newer/different report.
async function completeIzin(
  izinId: string, user: UserData, type: "Pulang" | "Sakit", returnDate?: Date,
): Promise<boolean> {
  const izinRef = doc(db, COLLECTION_NAME, izinId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(izinRef);
    if (!snapshot.exists()) throw new Error("Laporan tidak ditemukan.");
    const izin = { ...snapshot.data(), id: snapshot.id } as IzinSakitPulang;
    const ownsReport = user.role === "waliSantri" && user.santriId === izin.santriId;
    const isStaff = (["pengurus", "admin", "superAdmin", "pengasuh"] as string[]).includes(user.role);
    if (!ownsReport && !isStaff) {
      throw new Error("Hanya santri yang bersangkutan atau pengurus yang dapat melaporkan selesai.");
    }
    if (isStaff) {
      if (auth.currentUser?.uid !== user.uid) throw new Error("Sesi pengurus tidak valid.");
      const profile = await transaction.get(doc(db, "PengurusCollection", user.uid));
      if (!profile.exists() || !["pengurus", "admin", "superAdmin", "pengasuh"].includes(profile.data().role)) {
        throw new Error("Akun tidak terdaftar sebagai pengurus.");
      }
      user = { ...user, name: profile.data().name || profile.data().nama, email: profile.data().email || null };
    }
    if (izin.izinType !== type) throw new Error("Jenis laporan tidak sesuai.");
    if (izin.status === (type === "Pulang" ? "Sudah Kembali" : "Sudah Sembuh")) return true;
    if (!canReportIzinCompletion(izin, user)) throw new Error("Laporan ini sudah tidak aktif.");
    const now = Timestamp.now();
    const completedAt = returnDate ? Timestamp.fromDate(returnDate) : now;
    if (type === "Pulang") validateReturnDate(izin, completedAt.toDate(), now.toMillis());
    const santriRef = doc(db, "SantriCollection", izin.santriId);
    const santriSnapshot = await transaction.get(santriRef);
    const santri = santriSnapshot.data();
    const reportedBy = actor(user, now, santri?.nama);
    const field = type === "Pulang" ? "statusKepulangan" : "statusSakit";
    const otherField = type === "Pulang" ? "statusSakit" : "statusKepulangan";
    // Verify the other projection before restoring it (some legacy maps are stale).
    let otherIsActive = false;
    if (santri?.[field]?.izinId === izinId && santri[otherField]?.izinId) {
      const other = await transaction.get(doc(db, COLLECTION_NAME, santri[otherField].izinId));
      otherIsActive = other.exists() && isIzinOngoing({ ...other.data(), id: other.id } as IzinSakitPulang);
    }
    const update: DocumentData = type === "Pulang" && izin.izinType === "Pulang" ? {
      status: "Sudah Kembali", sudahKembali: true, tanggalKembali: completedAt,
      kembaliSesuaiRencana: completedAt.toMillis() <= izin.rencanaTanggalKembali.toMillis(),
      returnReportedBy: reportedBy,
    } : { status: "Sudah Sembuh", tanggalSembuh: completedAt, recoveryReportedBy: reportedBy };
    transaction.update(izinRef, update);
    if (santriSnapshot.exists() && santri?.[field]?.izinId === izinId) {
      transaction.update(santriRef, {
        [field]: deleteField(),
        statusKehadiran: otherIsActive ? (type === "Pulang" ? "Sakit" : "Pulang") : "Ada",
      });
    }
    return true;
  });
}

export const reportSantriReturn = (izinId: string, user: UserData, returnDate?: Date) =>
  completeIzin(izinId, user, "Pulang", returnDate);
export const reportSantriRecovered = (izinId: string, user: UserData) =>
  completeIzin(izinId, user, "Sakit");

export interface IzinReportItem {
  santriId: string;
  nama: string;
  kamar: string;
  semester: number;
  jumlahIzinPulang: number;
  jumlahIzinSakit: number;
  jumlahTerlambatKembali: number;
  alasanPulang: string;
  keluhanSakit: string;
}

// Group and count occurrences of a string in an array
const groupAndCountStrings = (items: string[]): string => {
  const counted = items.reduce((acc: {[key: string]: number}, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(counted)
    .map(([item, count]) => count > 1 ? `${item} (${count})` : item)
    .join(", ");
};

// Get izin report data
export const getIzinReport = async (
  startDate: Date,
  endDate: Date
): Promise<IzinReportItem[]> => {
  try {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    // Query SakitDanPulangCollection for items within date range
    const izinQuery = query(
      collection(db, COLLECTION_NAME),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp),
      orderBy("timestamp", "desc")
    );
    
    const querySnapshot = await getDocs(izinQuery);
    const izinRecords = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as (IzinSakitPulang & { id: string })[];
    
    if (izinRecords.length === 0) {
      return [];
    }
    
    // Get unique santri IDs
    const santriIds = Array.from(new Set(izinRecords.map(record => record.santriId)));
    
    // Fetch santri data
    const santriData = new Map<string, { nama: string; kamar: string; semester: number }>();
    await Promise.all(
      santriIds.map(async (santriId) => {
        const santriDoc = await getDoc(doc(db, "SantriCollection", santriId));
        if (santriDoc.exists()) {
          const data = santriDoc.data();
          santriData.set(santriId, {
            nama: data.nama || "Unknown",
            kamar: data.kamar || "-",
            semester: data.semester || 0
          });
        }
      })
    );
    
    // Process data for each santri
    const reportItems: IzinReportItem[] = santriIds.map(santriId => {
      const santriIzinRecords = izinRecords.filter(record => record.santriId === santriId && !record.status.startsWith("Ditolak"));
      const pulangRecords = santriIzinRecords.filter(record => record.izinType === "Pulang");
      const sakitRecords = santriIzinRecords.filter(record => record.izinType === "Sakit");
      
      // Count late returns - only for returned students with kembaliSesuaiRencana field
      const terlambatKembali = pulangRecords.filter(record => 
        record.sudahKembali === true && 
        record.kembaliSesuaiRencana === false
      ).length;
      
      // Collect all unique alasan pulang
      const alasanList = pulangRecords
        .map(record => record.alasan)
        .filter(Boolean);
      
      // Collect all unique keluhan sakit  
      const keluhanList = sakitRecords
        .map(record => record.keluhan)
        .filter(Boolean);
      
      // Group and format alasan and keluhan
      const formattedAlasan = groupAndCountStrings(alasanList);
      const formattedKeluhan = groupAndCountStrings(keluhanList);
      
      const santri = santriData.get(santriId) || { nama: "Unknown", kamar: "-", semester: 0 };
      
      return {
        santriId,
        nama: santri.nama,
        kamar: santri.kamar,
        semester: santri.semester,
        jumlahIzinPulang: pulangRecords.length,
        jumlahIzinSakit: sakitRecords.length,
        jumlahTerlambatKembali: terlambatKembali,
        alasanPulang: formattedAlasan,
        keluhanSakit: formattedKeluhan
      };
    });
    
    // Sort by name
    return reportItems.sort((a, b) => a.nama.localeCompare(b.nama));
  } catch (error) {
    console.error("Error generating izin report:", error);
    throw error;
  }
};
