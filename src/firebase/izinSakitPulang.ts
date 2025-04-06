import { db } from "./config";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  orderBy,
  collectionGroup,
  limit,
  DocumentData, deleteField
} from "firebase/firestore";
import { IzinSakitPulang, IzinStatus } from "@/types/izinSakitPulang";
import { UserData } from "@/firebase/auth";
import { formatDate } from "@/utils/date";

const COLLECTION_NAME = "SakitDanPulangCollection";

// Create a new izin application
export const createIzinApplication = async (
  izinData: Omit<IzinSakitPulang, "id" | "timestamp">,
  santriId: string
): Promise<string> => {
  try {
    // Add timestamp
    const dataWithTimestamp = {
      ...izinData,
      timestamp: Timestamp.now(),
      santriId: santriId
    };

    // Add to Firestore
    const docRef = await addDoc(collection(db, COLLECTION_NAME), dataWithTimestamp);
    return docRef.id;
  } catch (error) {
    console.error("Error creating izin application:", error);
    throw error;
  }
};

// Get all izin applications for a specific santri
export const getIzinApplicationsBySantri = async (santriId: string): Promise<IzinSakitPulang[]> => {
  try {
    const izinQuery = query(
      collection(db, COLLECTION_NAME),
      where("santriId", "==", santriId),
      orderBy("timestamp", "desc")
    );

    const querySnapshot = await getDocs(izinQuery);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as IzinSakitPulang));
  } catch (error) {
    console.error("Error getting izin applications:", error);
    throw error;
  }
};

// Delete an izin application
export const deleteIzinApplication = async (izinId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, izinId));
    return true;
  } catch (error) {
    console.error("Error deleting izin application:", error);
    throw error;
  }
};

// Get all pending izin applications that need approval
export const getPendingIzinApplications = async (): Promise<(IzinSakitPulang & { santriName?: string })[]> => {
  try {
    const pulangQuery = query(
      collection(db, COLLECTION_NAME),
      where("status", "==", "Menunggu Persetujuan Ustadzah"),
      orderBy("timestamp", "desc")
    );
    
    const sakitQuery = query(
      collection(db, COLLECTION_NAME),
      where("status", "==", "Menunggu Diperiksa Ustadzah"),
      orderBy("timestamp", "desc")
    );

    const [pulangSnapshot, sakitSnapshot] = await Promise.all([
      getDocs(pulangQuery),
      getDocs(sakitQuery)
    ]);

    const combinedResults: (IzinSakitPulang & { santriName?: string })[] = [];
    
    // Get all santri IDs to fetch their names
    const santriIds = new Set<string>();
    pulangSnapshot.docs.forEach(doc => santriIds.add(doc.data().santriId));
    sakitSnapshot.docs.forEach(doc => santriIds.add(doc.data().santriId));
    
    // Get santri names
    const santriNames = new Map<string, string>();
    await Promise.all(Array.from(santriIds).map(async (santriId) => {
      try {
        const santriDoc = await getDoc(doc(db, "SantriCollection", santriId));
        if (santriDoc.exists()) {
          santriNames.set(santriId, santriDoc.data().nama || "Unknown");
        }
      } catch (err) {
        console.error(`Error getting santri name for ID ${santriId}:`, err);
      }
    }));
    
    // Add data with santri names
    pulangSnapshot.docs.forEach(doc => {
      const data = doc.data();
      combinedResults.push({
        id: doc.id,
        ...data,
        santriName: santriNames.get(data.santriId)
      } as IzinSakitPulang & { santriName?: string });
    });
    
    sakitSnapshot.docs.forEach(doc => {
      const data = doc.data();
      combinedResults.push({
        id: doc.id,
        ...data,
        santriName: santriNames.get(data.santriId)
      } as IzinSakitPulang & { santriName?: string });
    });
    
    // Sort by timestamp (newest first)
    return combinedResults.sort((a, b) => 
      b.timestamp.toMillis() - a.timestamp.toMillis()
    );
  } catch (error) {
    console.error("Error getting pending izin applications:", error);
    throw error;
  }
};

// Get izin applications that need ndalem approval (for pengasuh/superAdmin)
export const getNdalemPendingIzinApplications = async (): Promise<(IzinSakitPulang & { santriName?: string })[]> => {
  try {
    const query1 = query(
      collection(db, COLLECTION_NAME),
      where("status", "==", "Menunggu Persetujuan Ndalem"),
      orderBy("timestamp", "desc")
    );
    
    const snapshot = await getDocs(query1);
    
    const results: (IzinSakitPulang & { santriName?: string })[] = [];
    
    // Get all santri IDs to fetch their names
    const santriIds = new Set<string>();
    snapshot.docs.forEach(doc => santriIds.add(doc.data().santriId));
    
    // Get santri names
    const santriNames = new Map<string, string>();
    await Promise.all(Array.from(santriIds).map(async (santriId) => {
      try {
        const santriDoc = await getDoc(doc(db, "SantriCollection", santriId));
        if (santriDoc.exists()) {
          santriNames.set(santriId, santriDoc.data().nama || "Unknown");
        }
      } catch (err) {
        console.error(`Error getting santri name for ID ${santriId}:`, err);
      }
    }));
    
    // Add data with santri names
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      results.push({
        id: doc.id,
        ...data,
        santriName: santriNames.get(data.santriId)
      } as IzinSakitPulang & { santriName?: string });
    });
    
    return results;
  } catch (error) {
    console.error("Error getting ndalem pending applications:", error);
    throw error;
  }
};

// Get all ongoing izin applications (approved but not completed)
export const getOngoingIzinApplications = async (): Promise<(IzinSakitPulang & { santriName?: string })[]> => {
  try {
    const ongoingStatuses = [
      "Disetujui", 
      "Proses Pulang", 
      "Dalam Masa Sakit"
    ];
    
    // We need to query for each status separately
    const queryPromises = ongoingStatuses.map(status => {
      return getDocs(
        query(
          collection(db, COLLECTION_NAME),
          where("status", "==", status),
          orderBy("timestamp", "desc")
        )
      );
    });
    
    const snapshots = await Promise.all(queryPromises);
    
    const combinedResults: (IzinSakitPulang & { santriName?: string })[] = [];
    const santriIds = new Set<string>();
    
    // Collect all santri IDs first
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        santriIds.add(doc.data().santriId);
      });
    });
    
    // Get santri names
    const santriNames = new Map<string, string>();
    await Promise.all(Array.from(santriIds).map(async (santriId) => {
      try {
        const santriDoc = await getDoc(doc(db, "SantriCollection", santriId));
        if (santriDoc.exists()) {
          santriNames.set(santriId, santriDoc.data().nama || "Unknown");
        }
      } catch (err) {
        console.error(`Error getting santri name for ID ${santriId}:`, err);
      }
    }));
    
    // Combine all results with santri names
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        combinedResults.push({
          id: doc.id,
          ...data,
          santriName: santriNames.get(data.santriId)
        } as IzinSakitPulang & { santriName?: string });
      });
    });
    
    // Sort by timestamp (newest first)
    return combinedResults.sort((a, b) => 
      b.timestamp.toMillis() - a.timestamp.toMillis()
    );
  } catch (error) {
    console.error("Error getting ongoing izin applications:", error);
    throw error;
  }
};

// Get completed or rejected izin applications (history) with date filtering
export const getIzinHistory = async (
  startDate?: Date | null,
  endDate?: Date | null
): Promise<(IzinSakitPulang & { santriName?: string })[]> => {
  try {
    const historyStatuses = [
      "Sudah Kembali", 
      "Sudah Sembuh", 
      "Ditolak", 
      "Ditolak Ustadzah", 
      "Ditolak Ndalem"
    ];
    
    const results: (IzinSakitPulang & { santriName?: string })[] = [];
    let combinedDocs: { id: string; data: any }[] = [];
    
    // If date range is provided, use it for filtering
    if (startDate && endDate) {
      const startTimestamp = Timestamp.fromDate(startDate);
      // Set end date to end of day
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);
      const endTimestamp = Timestamp.fromDate(adjustedEndDate);
      
      // Check if date range is more than 3 months
      const diffTime = Math.abs(adjustedEndDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 90) {
        throw new Error("Date range cannot exceed 3 months");
      }
      
      // Query with date filters for each status
      const queryPromises = historyStatuses.map(status => {
        return getDocs(
          query(
            collection(db, COLLECTION_NAME),
            where("status", "==", status),
            where("timestamp", ">=", startTimestamp),
            where("timestamp", "<=", endTimestamp),
            orderBy("timestamp", "desc")
          )
        );
      });
      
      const snapshots = await Promise.all(queryPromises);
      
      // Collect all docs
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          combinedDocs.push({ id: doc.id, data: doc.data() });
        });
      });
    } else {
      // No date range provided, get limited recent history
      const queryPromises = historyStatuses.map(status => {
        return getDocs(
          query(
            collection(db, COLLECTION_NAME),
            where("status", "==", status),
            orderBy("timestamp", "desc"),
            limit(8 / historyStatuses.length) // Limit to 8 total entries across all statuses
          )
        );
      });
      
      const snapshots = await Promise.all(queryPromises);
      
      // Collect all docs
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          combinedDocs.push({ id: doc.id, data: doc.data() });
        });
      });
    }
    
    if (combinedDocs.length === 0) {
      return [];
    }
    
    // Get santri names for all documents
    const santriIds = new Set<string>();
    combinedDocs.forEach(doc => {
      santriIds.add(doc.data.santriId);
    });
    
    const santriNames = new Map<string, string>();
    await Promise.all(Array.from(santriIds).map(async (santriId) => {
      try {
        const santriDoc = await getDoc(doc(db, "SantriCollection", santriId));
        if (santriDoc.exists()) {
          santriNames.set(santriId, santriDoc.data().nama || "Unknown");
        }
      } catch (err) {
        console.error(`Error getting santri name for ID ${santriId}:`, err);
      }
    }));
    
    // Format results with santri names
    combinedDocs.forEach(doc => {
      results.push({
        id: doc.id,
        ...doc.data,
        santriName: santriNames.get(doc.data.santriId)
      } as IzinSakitPulang & { santriName?: string });
    });
    
    // Sort by timestamp (newest first)
    return results.sort((a, b) => 
      b.timestamp.toMillis() - a.timestamp.toMillis()
    );
  } catch (error) {
    console.error("Error getting izin history:", error);
    throw error;
  }
};

// Approve or reject an izin application by ustadzah/pengurus
export const updateIzinApplicationStatus = async (
  izinId: string,
  isApproved: boolean,
  user: UserData,
  reason?: string
): Promise<boolean> => {
  try {
    const izinRef = doc(db, COLLECTION_NAME, izinId);
    const izinDoc = await getDoc(izinRef);
    
    if (!izinDoc.exists()) {
      throw new Error("Izin application not found");
    }
    
    const izinData = izinDoc.data() as IzinSakitPulang;
    const updateData: Record<string, any> = {
      sudahDapatIzinUstadzah: isApproved,
      approvedBy: {
        uid: user.uid,
        name: user.name || user.email,
        role: user.role,
        timestamp: Timestamp.now()
      }
    };
    
    // Set appropriate status based on application type and approval decision
    if (izinData.izinType === "Pulang") {
      if (isApproved) {
        updateData.status = "Menunggu Persetujuan Ndalem" as IzinStatus;
      } else {
        updateData.status = "Ditolak" as IzinStatus;
      }
    } else { // Sakit
      if (isApproved) {
        updateData.status = "Dalam Masa Sakit" as IzinStatus;
        
        // Update santri status to "Sakit" in SantriCollection when approved
        try {
          const santriRef = doc(db, "SantriCollection", izinData.santriId);
          const santriDoc = await getDoc(santriRef);
          
          if (santriDoc.exists()) {
            // Create statusSakit object with all the details from the application
            const statusSakit = {
              keluhan: (izinData as any).keluhan,
              timestamp: izinData.timestamp,
              approvedBy: updateData.approvedBy,
              izinId: izinId
            };
            
            // Update santri document
            await updateDoc(santriRef, {
              statusKehadiran: "Sakit",
              statusSakit: statusSakit
            });
          }
        } catch (err) {
          console.error("Error updating santri status for sakit:", err);
          // Continue with the approval even if updating santri fails
        }
      } else {
        updateData.status = "Ditolak" as IzinStatus;
      }
    }
    
    // Add rejection reason if provided
    if (!isApproved && reason) {
      updateData.rejectionReason = reason;
    }
    
    await updateDoc(izinRef, updateData);
    return true;
  } catch (error) {
    console.error("Error updating izin application status:", error);
    throw error;
  }
};

// Approve or reject an izin pulang application by ndalem/pengasuh
export const updateNdalemApprovalStatus = async (
  izinId: string,
  isApproved: boolean,
  user: UserData,
  reason?: string
): Promise<boolean> => {
  try {
    const izinRef = doc(db, COLLECTION_NAME, izinId);
    const izinDoc = await getDoc(izinRef);
    
    if (!izinDoc.exists()) {
      throw new Error("Izin application not found");
    }
    
    const izinData = izinDoc.data() as IzinSakitPulang;
    
    // Only applicable for izin pulang
    if (izinData.izinType !== "Pulang") {
      throw new Error("This function is only for Izin Pulang applications");
    }
    
    const updateData: Record<string, any> = {
      sudahDapatIzinNdalem: isApproved,
      ndalemApproval: {
        uid: user.uid,
        name: user.name || user.email,
        role: user.role,
        timestamp: Timestamp.now()
      }
    };
    
    // Set appropriate status based on approval decision
    if (isApproved) {
      updateData.status = "Proses Pulang" as IzinStatus;
      updateData.idPemberiIzin = user.uid;
      updateData.pemberiIzin = user.name || user.email;
      
      // Update santri status to "Pulang" in SantriCollection when approved
      try {
        const santriRef = doc(db, "SantriCollection", izinData.santriId);
        const santriDoc = await getDoc(santriRef);
        
        if (santriDoc.exists()) {
          // Create statusKepulangan object with all the details from the application
          const statusKepulangan = {
            alasan: (izinData as any).alasan,
            rencanaTanggalKembali: (izinData as any).rencanaTanggalKembali,
            tglPulang: (izinData as any).tglPulang,
            pemberiIzin: user.name || user.email,
            idPemberiIzin: user.uid,
            approvedAt: Timestamp.now(),
            izinId: izinId
          };
          
          // Update santri document
          await updateDoc(santriRef, {
            statusKehadiran: "Pulang",
            statusKepulangan: statusKepulangan
          });
        }
      } catch (err) {
        console.error("Error updating santri status for pulang:", err);
        // Continue with the approval even if updating santri fails
      }
    } else {
      updateData.status = "Ditolak" as IzinStatus;
    }
    
    // Add rejection reason if provided
    if (!isApproved && reason) {
      updateData.ndalemRejectionReason = reason;
    }
    
    await updateDoc(izinRef, updateData);
    return true;
  } catch (error) {
    console.error("Error updating ndalem approval status:", error);
    throw error;
  }
};

// Verify santri return from pulang
export const verifySantriReturn = async (
  izinId: string,
  user: UserData,
  returnDate: Date = new Date() // Default to current date if not provided
): Promise<boolean> => {
  try {
    const izinRef = doc(db, COLLECTION_NAME, izinId);
    const izinDoc = await getDoc(izinRef);
    
    if (!izinDoc.exists()) {
      throw new Error("Izin application not found");
    }
    
    const izinData = izinDoc.data() as any;
    
    // Only applicable for approved izin pulang
    if (izinData.izinType !== "Pulang" || !izinData.sudahDapatIzinNdalem) {
      throw new Error("This function is only for approved Izin Pulang applications");
    }
    
    // Check if already marked as returned
    if (izinData.sudahKembali === true) {
      throw new Error("Santri already marked as returned");
    }
    
    const returnTimestamp = Timestamp.fromDate(returnDate);
    
    // Check if return is on time
    const kembaliSesuaiRencana = returnTimestamp.toMillis() <= izinData.rencanaTanggalKembali.toMillis();
    
    const updateData = {
      sudahKembali: true,
      kembaliSesuaiRencana: kembaliSesuaiRencana,
      tanggalKembali: returnTimestamp,
      status: "Sudah Kembali" as IzinStatus,
      returnVerifiedBy: {
        uid: user.uid,
        name: user.name || user.email,
        role: user.role,
        timestamp: Timestamp.now()
      }
    };
    
    // Update the application
    await updateDoc(izinRef, updateData);
    
    // Update santri status back to "Ada" in SantriCollection
    try {
      const santriRef = doc(db, "SantriCollection", izinData.santriId);
      const santriDoc = await getDoc(santriRef);
      
      if (santriDoc.exists()) {
        // Update santri document
        await updateDoc(santriRef, {
          statusKehadiran: "Ada",
          // Keep statusKepulangan but add return info
          "statusKepulangan.sudahKembali": true,
          "statusKepulangan.tanggalKembali": returnTimestamp,
          "statusKepulangan.kembaliSesuaiRencana": kembaliSesuaiRencana,
          "statusKepulangan.returnVerifiedBy": {
            uid: user.uid,
            name: user.name || user.email,
            role: user.role,
            timestamp: Timestamp.now()
          }
        });
      }
    } catch (err) {
      console.error("Error updating santri status after return:", err);
      // Continue with the verification even if updating santri fails
    }
    
    return true;
  } catch (error) {
    console.error("Error verifying santri return:", error);
    throw error;
  }
};

// Mark santri as recovered from sickness
export const verifySantriRecovered = async (
  izinId: string,
  user: UserData
): Promise<boolean> => {
  try {
    const izinRef = doc(db, COLLECTION_NAME, izinId);
    const izinDoc = await getDoc(izinRef);
    
    if (!izinDoc.exists()) {
      throw new Error("Izin application not found");
    }
    
    const izinData = izinDoc.data() as any;
    
    // Only applicable for approved izin sakit
    if (izinData.izinType !== "Sakit" || !izinData.sudahDapatIzinUstadzah) {
      throw new Error("This function is only for approved Izin Sakit applications");
    }
    
    const updateData = {
      status: "Sudah Sembuh" as IzinStatus,
      recoveryVerifiedBy: {
        uid: user.uid,
        name: user.name || user.email,
        role: user.role,
        timestamp: Timestamp.now()
      }
    };
    
    // Update the application
    await updateDoc(izinRef, updateData);
    
    // Update santri status back to "Ada" in SantriCollection
    try {
      const santriRef = doc(db, "SantriCollection", izinData.santriId);
      const santriDoc = await getDoc(santriRef);
      
      if (santriDoc.exists()) {
        // Update santri document
        await updateDoc(santriRef, {
          statusKehadiran: "Ada",
          statusSakit: deleteField()
        });
      }
    } catch (err) {
      console.error("Error updating santri status after recovery:", err);
      // Continue with the verification even if updating santri fails
    }
    
    return true;
  } catch (error) {
    console.error("Error verifying santri recovery:", error);
    throw error;
  }
};

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
      const santriIzinRecords = izinRecords.filter(record => record.santriId === santriId);
      const pulangRecords = santriIzinRecords.filter(record => record.izinType === "Pulang");
      const sakitRecords = santriIzinRecords.filter(record => record.izinType === "Sakit");
      
      // Count late returns - only for returned students with kembaliSesuaiRencana field
      const terlambatKembali = pulangRecords.filter(record => 
        record.sudahKembali === true && 
        (record as any).kembaliSesuaiRencana === false
      ).length;
      
      // Collect all unique alasan pulang
      const alasanList = pulangRecords
        .map(record => (record as any).alasan)
        .filter(Boolean);
      
      // Collect all unique keluhan sakit  
      const keluhanList = sakitRecords
        .map(record => (record as any).keluhan)
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