"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  getCurrentAcademicSemesterKey,
  isHigherEducationSantri,
} from "@/firebase/santriSemester";
import { MergedPaymentProof, Santri, SantriFormData } from "@/types/santri";
import { KODE_ASRAMA } from "@/constants";
import { Listbox } from "@headlessui/react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/20/solid";
import SantriModal from "@/components/SantriModal";
import SantriVerificationModal from "@/components/SantriVerificationModal";
import SantriMergeModal from "@/components/SantriMergeModal";
import CSVImportModal from "@/components/CSVImportModal";
import DataToolsModal from "@/components/DataToolsModal";
import ImportProgressPanel from "@/components/ImportProgressPanel";
import { exportToExcel } from "@/utils/excelExport";
import { getAcademicSemesterPeriod } from "@/utils/academicSemester";
import { formatName, formatNameForId } from "@/utils/nameFormatter";
import { removeUndefinedFields } from "@/utils/firestoreData";
import StickyHorizontalScroll from "@/components/StickyHorizontalScroll";
import { toast } from "react-hot-toast";

// Delete all PaymentStatuses tied to a santri and remove it from any linked Invoices
const cleanupSantriPaymentRecords = async (santriId: string) => {
  const paymentStatusesRef = collection(db, "PaymentStatuses");
  const paymentStatusQuery = query(
    paymentStatusesRef,
    where("santriId", "==", santriId)
  );
  const paymentStatusesSnapshot = await getDocs(paymentStatusQuery);

  const affectedInvoiceIds: string[] = [];
  const deletePromises = paymentStatusesSnapshot.docs.map(async (statusDoc) => {
    const statusData = statusDoc.data();
    if (statusData.invoiceId) {
      affectedInvoiceIds.push(statusData.invoiceId);
    }
    await deleteDoc(doc(db, "PaymentStatuses", statusDoc.id));
  });
  await Promise.all(deletePromises);

  const uniqueInvoiceIds = [...new Set(affectedInvoiceIds)];
  const invoiceUpdatePromises = uniqueInvoiceIds.map(async (invoiceId) => {
    const invoiceRef = doc(db, "Invoices", invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);

    if (invoiceSnap.exists()) {
      const invoiceData = invoiceSnap.data();
      if (
        invoiceData.selectedSantriIds &&
        Array.isArray(invoiceData.selectedSantriIds)
      ) {
        const updatedSantriIds = invoiceData.selectedSantriIds.filter(
          (id: string) => id !== santriId
        );

        await updateDoc(invoiceRef, {
          selectedSantriIds: updatedSantriIds,
        });
      }
    }
  });
  await Promise.all(invoiceUpdatePromises);
};

interface FilterOption {
  value: string;
  label: string;
  kind?: "group" | "option";
}

interface CustomFilterDropdownProps {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

function CustomFilterDropdown({
  id,
  label,
  value,
  options,
  onChange,
}: CustomFilterDropdownProps) {
  const selectedOption =
    options.find((option) => option.value === value) ??
    options[0] ??
    { value: "", label: "" };

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors"
      >
        {label}
      </label>
      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <Listbox.Button
            id={id}
            className="relative w-full cursor-pointer rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <span className="block truncate">{selectedOption.label}</span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>
          <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-gray-700 sm:text-sm">
            {options.map((option) => (
              <Listbox.Option
                key={option.value}
                value={option.value}
                className={({ active }) =>
                  `relative select-none py-2 pr-9 ${
                    option.kind === "option" ? "pl-7" : "pl-3"
                  } ${
                    active
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-white"
                      : "text-gray-900 dark:text-gray-100"
                  }`
                }
              >
                {({ selected }) => (
                  <>
                    <span
                      className={`block truncate ${
                        selected ? "font-semibold" : "font-normal"
                      }`}
                    >
                      {option.label}
                    </span>
                    {selected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600 dark:text-blue-300">
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>
    </div>
  );
}

export default function DataSantriPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const currentAcademicPeriod = getAcademicSemesterPeriod();
  const isPengurus = user?.role === "pengurus";

  // Santri data state
  const [santris, setSantris] = useState<Santri[]>([]);
  const [filteredSantris, setFilteredSantris] = useState<Santri[]>([]);
  const [highlightedSantriId, setHighlightedSantriId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  // Sorting state
  type SortField =
    | "nama"
    | "kamar"
    | "semester"
    | "programStudi"
    | "statusTanggungan"
    | "statusAktif";
  type SortDirection = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("nama");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Filters state
  const [statusAktifFilter, setStatusAktifFilter] = useState<string>("Aktif");
  const [jenjangFilter, setJenjangFilter] = useState<string>("all");
  const [programStudiFilter, setProgramStudiFilter] = useState<string>("all");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [tahunMasukFilter, setTahunMasukFilter] = useState<string>("all");
  const [statusTanggunganFilter, setStatusTanggunganFilter] =
    useState<string>("all");
  const [kamarFilter, setKamarFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDataToolsModalOpen, setIsDataToolsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [selectedSantri, setSelectedSantri] = useState<Santri | undefined>(
    undefined
  );
  const [selectedSantriIdForVerification, setSelectedSantriIdForVerification] =
    useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk actions state
  const [selectedSantriIds, setSelectedSantriIds] = useState<Set<string>>(
    new Set()
  );
  const [isSelectAll, setIsSelectAll] = useState(false);

  // Import progress state
  const [importProgress, setImportProgress] = useState({
    isActive: false,
    totalItems: 0,
    currentItemIndex: 0,
    currentItemName: "",
    successCount: 0,
    errorCount: 0,
    operation: "import" as "import" | "delete",
  });

  // Get unique values for filter dropdowns
  const uniqueTahunMasuk = [
    ...new Set(
      santris
        .map((santri) => santri.tahunMasuk)
        .filter((t): t is string => Boolean(t))
    ),
  ].sort((a, b) => parseInt(b) - parseInt(a));
  const uniqueJenjang = [
    ...new Set(
      santris
        .map((santri) => santri.jenjangPendidikan)
        .filter((j): j is string => Boolean(j))
    ),
  ].sort();
  const uniqueSemester = [
    ...new Set(
      santris
        .map((santri) => santri.semester)
        .filter((s): s is string => Boolean(s))
    ),
  ].sort((a, b) => parseInt(a) - parseInt(b));

  // Get unique kamar values and organize them into room groups
  const uniqueKamar = [
    ...new Set(santris.map((santri) => santri.kamar)),
  ].sort();
  const roomGroups = new Map();

  // Extract room groups from individual room names
  uniqueKamar.forEach((room) => {
    if (!room) return; // Skip empty values

    // Extract the room group (e.g., "101" from "101 A")
    // This handles cases like "101 A", "101-A", "101A", etc.
    const roomGroupMatch = room.match(/^(\d+)[\s-]?[A-Za-z]?/);

    if (roomGroupMatch && roomGroupMatch[1]) {
      const groupNumber = roomGroupMatch[1];

      if (!roomGroups.has(groupNumber)) {
        roomGroups.set(groupNumber, []);
      }

      roomGroups.get(groupNumber).push(room);
    } else {
      // If no pattern match, treat the whole room name as its own group
      if (!roomGroups.has(room)) {
        roomGroups.set(room, [room]);
      }
    }
  });

  // Convert to array of objects for easier rendering
  const roomGroupsArray = Array.from(roomGroups.entries())
    .map(([groupName, rooms]) => ({
      groupName,
      rooms: rooms.sort(),
    }))
    .sort((a, b) => {
      // Try to sort numerically if possible
      const numA = parseInt(a.groupName, 10);
      const numB = parseInt(b.groupName, 10);

      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }

      // Fall back to string comparison
      return a.groupName.localeCompare(b.groupName);
    });

  const kamarFilterOptions: FilterOption[] = [
    { value: "all", label: "Semua Kamar" },
    ...roomGroupsArray.flatMap((group) => [
      {
        value: `group:${group.groupName}`,
        label: group.groupName,
        kind: "group" as const,
      },
      ...group.rooms.map((room: string) => ({
        value: room,
        label: `┗ ${room}`,
        kind: "option" as const,
      })),
    ]),
  ];

  // Normalize program studi capitalization for the filter dropdown
  const uniqueProgramStudi = [
    ...new Set(
      santris
        .map((santri) => santri.programStudi?.toUpperCase())
        .filter(Boolean)
    ),
  ]
    .sort()
    .map((prodi) => {
      // Find the first occurrence of this program studi (case insensitive) to use its original capitalization
    const firstMatch = santris.find(
      (santri) => santri.programStudi?.toUpperCase() === prodi
    );
    return firstMatch?.programStudi || prodi;
  })
    .filter((prodi): prodi is string => Boolean(prodi));

  // Selected santris eligible for merging (2+ selected, all still Pending)
  const selectedSantrisList = santris.filter((s) =>
    selectedSantriIds.has(s.id)
  );
  const canMergeSelected =
    !isPengurus &&
    selectedSantrisList.length >= 2 &&
    selectedSantrisList.every((s) => s.statusAktif === "Pending");

  // Auth check
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role === "waliSantri") {
        router.push("/payment-history");
      } else {
        setIsAuthorized(true);
        fetchSantris();
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (isPengurus) {
      setSelectedSantriIds(new Set());
      setIsSelectAll(false);
    }
  }, [isPengurus]);

  // Fetch santri data
  const fetchSantris = async () => {
    try {
      setIsLoading(true);

      const santriRef = collection(db, "SantriCollection");
      const q = query(santriRef, where("kodeAsrama", "==", KODE_ASRAMA));
      const querySnapshot = await getDocs(q);

      const santriData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Santri[];

      setSantris(santriData);
      setFilteredSantris(santriData);
    } catch (error) {
      console.error("Error fetching santri data:", error);
      alert("Terjadi kesalahan saat mengambil data santri");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sort column click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Function to sort the santris
  const getSortedSantris = (santris: Santri[]) => {
    return [...santris].sort((a, b) => {
      // For numeric fields like semester
      if (sortField === "semester") {
        const valA = a[sortField] ? parseInt(a[sortField].toString()) : 0;
        const valB = b[sortField] ? parseInt(b[sortField].toString()) : 0;
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      // For status fields (special ordering)
      if (sortField === "statusAktif") {
        // Define a priority order for statuses
        const statusOrder = {
          Aktif: 1,
          Pending: 2,
          Lulus: 3,
          Boyong: 4,
          Dikeluarkan: 5,
          Ditolak: 6,
        };

        const orderA =
          statusOrder[a.statusAktif as keyof typeof statusOrder] || 999;
        const orderB =
          statusOrder[b.statusAktif as keyof typeof statusOrder] || 999;

        return sortDirection === "asc" ? orderA - orderB : orderB - orderA;
      }

      if (sortField === "statusTanggungan") {
        // Define a priority order for statuses
        const statusOrder = {
          Lunas: 1,
          "Belum Ada Tagihan": 2,
          "Menunggu Verifikasi": 3,
          "Belum Lunas": 4,
        };

        const orderA =
          statusOrder[a.statusTanggungan as keyof typeof statusOrder] || 999;
        const orderB =
          statusOrder[b.statusTanggungan as keyof typeof statusOrder] || 999;

        return sortDirection === "asc" ? orderA - orderB : orderB - orderA;
      }

      // For visible string fields (name, kamar, programStudi)
      const valueA = String(a[sortField] || "").toLowerCase();
      const valueB = String(b[sortField] || "").toLowerCase();

      return sortDirection === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    });
  };

  // Apply filters to santri data
  useEffect(() => {
    let filtered = [...santris];

    if (statusAktifFilter !== "all") {
      filtered = filtered.filter(
        (santri) => santri.statusAktif === statusAktifFilter
      );
    }

    if (jenjangFilter !== "all") {
      filtered = filtered.filter(
        (santri) => santri.jenjangPendidikan === jenjangFilter
      );
    }

    if (programStudiFilter !== "all") {
      filtered = filtered.filter(
        (santri) =>
          santri.programStudi?.toLowerCase() ===
          programStudiFilter.toLowerCase()
      );
    }

    if (semesterFilter !== "all") {
      filtered = filtered.filter(
        (santri) => santri.semester === semesterFilter
      );
    }

    if (tahunMasukFilter !== "all") {
      filtered = filtered.filter(
        (santri) => santri.tahunMasuk === tahunMasukFilter
      );
    }

    if (statusTanggunganFilter !== "all") {
      filtered = filtered.filter(
        (santri) => santri.statusTanggungan === statusTanggunganFilter
      );
    }

    if (kamarFilter !== "all") {
      // Check if this is a room group filter (e.g., "group:101") or a specific room
      if (kamarFilter.startsWith("group:")) {
        const groupNumber = kamarFilter.replace("group:", "");
        // Filter for any rooms that start with this group number
        filtered = filtered.filter((santri) => {
          if (!santri.kamar) return false;
          const roomGroupMatch = santri.kamar.match(/^(\d+)[\s-]?[A-Za-z]?/);
          return roomGroupMatch && roomGroupMatch[1] === groupNumber;
        });
      } else {
        // Regular filter for exact room match
        filtered = filtered.filter((santri) => santri.kamar === kamarFilter);
      }
    }

    // Apply search query filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((santri) =>
        santri.nama.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered = getSortedSantris(filtered);

    setFilteredSantris(filtered);

    // Reset selection when filters change
    setSelectedSantriIds(new Set());
    setIsSelectAll(false);
  }, [
    santris,
    statusAktifFilter,
    jenjangFilter,
    programStudiFilter,
    semesterFilter,
    tahunMasukFilter,
    statusTanggunganFilter,
    kamarFilter,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  // Reset filters
  const resetFilters = () => {
    setStatusAktifFilter("all");
    setJenjangFilter("all");
    setProgramStudiFilter("all");
    setSemesterFilter("all");
    setTahunMasukFilter("all");
    setStatusTanggunganFilter("all");
    setKamarFilter("all");
    setSearchQuery("");
  };

  // Handle adding a new santri
  const handleAddSantri = () => {
    setSelectedSantri(undefined);
    setIsModalOpen(true);
  };

  // Handle editing a santri
  const handleEditSantri = (santri: Santri) => {
    setSelectedSantri(santri);
    setIsModalOpen(true);
  };

  const handleVerifySantri = (santriId: string) => {
    setSelectedSantriIdForVerification(santriId);
    setIsVerificationModalOpen(true);
  };

  // Handle form submission (add or update)
  const handleSantriSubmit = async (formData: SantriFormData) => {
    console.log("handleSantriSubmit called with data:", formData);
    try {
      setIsSubmitting(true);
      console.log("isSubmitting set to true");

      // Ensure kelas and semester are always synchronized
      const syncedFormData = {
        ...formData,
        kelas: formData.kelas || formData.semester || "", // Prefer kelas if available
        semester: formData.kelas || formData.semester || "", // Use same value for semester
      };
      console.log("Synchronized form data:", syncedFormData);

      if (selectedSantri) {
        console.log("Updating existing santri:", selectedSantri.id);
        // Format the name properly
        const formattedName = formatName(syncedFormData.nama);
        console.log("Formatted name:", formattedName);

        // Prepare update data - only include statusTanggungan if it's provided
        const updateData = removeUndefinedFields({
          ...syncedFormData,
          nama: formattedName, // Use properly formatted name
          kodeAsrama: KODE_ASRAMA,
          ...(syncedFormData.statusAktif === "Aktif" &&
          isHigherEducationSantri(syncedFormData)
            ? { semesterAutoUpdatedPeriod: getCurrentAcademicSemesterKey() }
            : {}),
        });

        // Include statusTanggungan if it's provided in the form data
        if (syncedFormData.statusTanggungan) {
          updateData.statusTanggungan = syncedFormData.statusTanggungan;
        }

        // Update existing santri with formatted name and synchronized fields
        const santriRef = doc(db, "SantriCollection", selectedSantri.id);
        console.log("Updating document in Firestore...");
        await updateDoc(santriRef, updateData);
        console.log("Firestore update successful");

        // Update local state
        console.log("Updating local state...");
        setSantris((prev) =>
          prev.map((s) =>
            s.id === selectedSantri.id
              ? {
                  ...s,
                  ...updateData,
                }
              : s
          )
        );
        console.log("Local state updated");

        setHighlightedSantriId(selectedSantri.id);
        setTimeout(() => {
          setHighlightedSantriId(null);
        }, 500);

        toast.success("Data santri berhasil diupdate");
      } else {
        console.log("Creating new santri...");
        // Format the name properly
        const formattedName = formatName(syncedFormData.nama);
        console.log("Formatted name:", formattedName);

        // Add new santri with formatted ID
        const timestamp = Date.now();
        const formattedNameForId = formatNameForId(formattedName);
        const docId = `${formattedNameForId}_${timestamp}`;
        console.log("Generated document ID:", docId);

        // Create santri data with properly formatted name
        const santriData = removeUndefinedFields({
          ...syncedFormData, // Use synchronized form data
          nama: formattedName, // Use the properly formatted name
          kodeAsrama: KODE_ASRAMA,
          statusTanggungan: "Belum Ada Tagihan",
          createdAt: timestamp,
          jumlahTunggakan: 0,
          ...(syncedFormData.statusAktif === "Aktif" &&
          isHigherEducationSantri(syncedFormData)
            ? { semesterAutoUpdatedPeriod: getCurrentAcademicSemesterKey() }
            : {}),
        });
        console.log("Prepared santri data:", santriData);

        try {
          // Create new document with custom ID using setDoc directly
          console.log("Creating document in Firestore...");
          const docRef = doc(db, "SantriCollection", docId);
          await setDoc(docRef, santriData);
          console.log("Document created successfully");

          // Get the new document
          console.log("Fetching the newly created document...");
          const newSantriSnap = await getDoc(docRef);
          if (!newSantriSnap.exists()) {
            console.error("Document was created but cannot be retrieved");
            throw new Error("Document was created but cannot be retrieved");
          }

          const newSantri = {
            id: docId,
            ...newSantriSnap.data(),
          } as Santri;
          console.log("Retrieved new santri data:", newSantri);

          // Update local state
          console.log("Updating local state with new santri...");
          setSantris((prev) => [...prev, newSantri]);
          console.log("Local state updated");
        } catch (error) {
          console.error("Error creating new santri:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          toast.error(
            `Terjadi kesalahan saat membuat santri baru: ${errorMessage}`
          );
          throw error; // Re-throw to be caught by the outer try-catch
        }

        toast.success("Santri baru berhasil ditambahkan");
      }

      console.log("Closing modal...");
      setIsModalOpen(false);
      console.log("Modal closed");
    } catch (error) {
      console.error("Error saving santri data:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan data santri";
      toast.error(errorMessage);
    } finally {
      console.log("Setting isSubmitting to false");
      setIsSubmitting(false);
    }
  };

  // Handle delete santri with associated payment statuses and invoice updates
  const handleDeleteSantri = async (santri: Santri) => {
    try {
      setIsSubmitting(true);

      await cleanupSantriPaymentRecords(santri.id);

      // Finally, delete the santri document
      const santriRef = doc(db, "SantriCollection", santri.id);
      await deleteDoc(santriRef);

      // Update local state
      setSantris((prev) => prev.filter((s) => s.id !== santri.id));

      setIsModalOpen(false);
    } catch (error) {
      console.error("Error deleting santri:", error);
      alert("Terjadi kesalahan saat menghapus data santri");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to Excel
  const handleExportToExcel = () => {
    // Use filtered data for export
    exportToExcel(
      filteredSantris,
      `Data-Santri-${new Date().toISOString().split("T")[0]}`
    );
  };

  // Handle CSV import modal
  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
  };

  // Process CSV import
  const handleBulkImport = async (santriDataList: SantriFormData[]) => {
    try {
      setIsImportModalOpen(false);

      // Setup progress tracking
      setImportProgress({
        isActive: true,
        totalItems: santriDataList.length,
        currentItemIndex: 0,
        currentItemName: "",
        successCount: 0,
        errorCount: 0,
        operation: "import",
      });

      // Process each santri data asynchronously
      for (let i = 0; i < santriDataList.length; i++) {
        const santriData = santriDataList[i];

        // Update progress
        setImportProgress((prev) => ({
          ...prev,
          currentItemIndex: i,
          currentItemName: santriData.nama,
        }));

        try {
          // Format the name properly
          const formattedName = formatName(santriData.nama);

          // Create a new document ID
          const timestamp = Date.now() + i; // Add index to ensure unique timestamps
          const formattedNameForId = formatNameForId(formattedName);
          const docId = `${formattedNameForId}_${timestamp}`;

          // Create document with formatted name
          await setDoc(doc(db, "SantriCollection", docId), {
            ...santriData,
            nama: formattedName, // Use the properly formatted name
            kodeAsrama: KODE_ASRAMA,
            statusTanggungan: "Belum Ada Tagihan",
            createdAt: timestamp,
            jumlahTunggakan: 0,
            ...(santriData.statusAktif === "Aktif" &&
            isHigherEducationSantri(santriData)
              ? { semesterAutoUpdatedPeriod: getCurrentAcademicSemesterKey() }
              : {}),
          });

          // Update success count
          setImportProgress((prev) => ({
            ...prev,
            successCount: prev.successCount + 1,
          }));

          // Small delay to avoid overwhelming Firestore
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error importing santri ${santriData.nama}:`, error);

          // Update error count
          setImportProgress((prev) => ({
            ...prev,
            errorCount: prev.errorCount + 1,
          }));
        }
      }

      // Complete the progress
      setImportProgress((prev) => ({
        ...prev,
        currentItemIndex: santriDataList.length,
        currentItemName: "Completed",
      }));

      // Refresh santri data after import
      fetchSantris();
    } catch (error) {
      console.error("Error during bulk import:", error);
      alert("Terjadi kesalahan saat mengimpor data santri");
    }
  };

  // Handle bulk delete with cleanup of related records
  const handleBulkDelete = async () => {
    if (isPengurus || selectedSantriIds.size === 0) return;

    const confirmDelete = window.confirm(
      `Yakin akan menghapus ${selectedSantriIds.size} santri terpilih?`
    );
    if (!confirmDelete) return;

    try {
      // Setup progress tracking
      setImportProgress({
        isActive: true,
        totalItems: selectedSantriIds.size,
        currentItemIndex: 0,
        currentItemName: "",
        successCount: 0,
        errorCount: 0,
        operation: "delete",
      });

      // Get selected santris
      const selectedSantriList = santris.filter((s) =>
        selectedSantriIds.has(s.id)
      );

      // Process santris in smaller batches for better performance
      const BATCH_SIZE = 10;
      for (let i = 0; i < selectedSantriList.length; i += BATCH_SIZE) {
        const currentBatch = selectedSantriList.slice(i, i + BATCH_SIZE);

        for (let j = 0; j < currentBatch.length; j++) {
          const santri = currentBatch[j];
          const currentIndex = i + j;

          // Update progress
          setImportProgress((prev) => ({
            ...prev,
            currentItemIndex: currentIndex,
            currentItemName: santri.nama,
          }));

          try {
            await cleanupSantriPaymentRecords(santri.id);

            // Finally delete the santri
            const santriRef = doc(db, "SantriCollection", santri.id);
            await deleteDoc(santriRef);

            // Update success count
            setImportProgress((prev) => ({
              ...prev,
              successCount: prev.successCount + 1,
            }));
          } catch (error) {
            console.error(`Error deleting santri ${santri.nama}:`, error);

            // Update error count
            setImportProgress((prev) => ({
              ...prev,
              errorCount: prev.errorCount + 1,
            }));
          }
        }

        // Small delay between batches to avoid overwhelming Firestore
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Complete the progress
      setImportProgress((prev) => ({
        ...prev,
        currentItemIndex: selectedSantriIds.size,
        currentItemName: "Completed",
      }));

      // Update local state
      setSantris((prev) => prev.filter((s) => !selectedSantriIds.has(s.id)));
      setSelectedSantriIds(new Set());
      setIsSelectAll(false);
    } catch (error) {
      console.error("Error during bulk delete:", error);
      alert("Terjadi kesalahan saat menghapus data santri");
    }
  };

  // Merge duplicate pending registrations into a single chosen record
  const handleMergeSantris = async (primaryId: string) => {
    if (isPengurus) return;

    const primary = selectedSantrisList.find((s) => s.id === primaryId);
    const duplicates = selectedSantrisList.filter((s) => s.id !== primaryId);

    if (!primary || duplicates.length === 0) return;

    try {
      setIsMerging(true);

      // Note what each duplicate had, so the payment info isn't lost once it's deleted
      const mergeNoteLines = duplicates.map((dup) => {
        const parts = [`Digabung dari pendaftaran duplikat "${dup.nama}"`];
        parts.push(
          dup.paymentOption === "pangkalOnly"
            ? "Uang Pangkal Saja"
            : "Uang Pangkal + Syahriah"
        );
        if (dup.paymentProofUrl) {
          parts.push(`Bukti: ${dup.paymentProofUrl}`);
        }
        return parts.join(" - ");
      });

      const mergedCatatan = [primary.catatan, ...mergeNoteLines]
        .filter(Boolean)
        .join("\n");

      // Keep each duplicate's receipt as an actual displayable entry too, not just a link in the note
      const now = Date.now();
      const newMergedProofs: MergedPaymentProof[] = duplicates
        .filter(
          (dup): dup is Santri & { paymentProofUrl: string } =>
            !!dup.paymentProofUrl
        )
        .map((dup) => {
          const entry: MergedPaymentProof = {
            nama: dup.nama,
            imageUrl: dup.paymentProofUrl,
            mergedAt: now,
          };
          if (dup.paymentOption) {
            entry.paymentOption = dup.paymentOption;
          }
          return entry;
        });

      const mergedPaymentProofs = [
        ...(primary.mergedPaymentProofs || []),
        ...newMergedProofs,
      ];

      await updateDoc(doc(db, "SantriCollection", primary.id), {
        catatan: mergedCatatan,
        mergedPaymentProofs,
      });

      // Remove the duplicates, cleaning up any payment records/invoice references tied to them
      for (const dup of duplicates) {
        await cleanupSantriPaymentRecords(dup.id);
        await deleteDoc(doc(db, "SantriCollection", dup.id));
      }

      setSantris((prev) =>
        prev
          .filter((s) => !duplicates.some((d) => d.id === s.id))
          .map((s) =>
            s.id === primary.id
              ? { ...s, catatan: mergedCatatan, mergedPaymentProofs }
              : s
          )
      );

      setSelectedSantriIds(new Set());
      setIsSelectAll(false);
      setIsMergeModalOpen(false);

      toast.success(
        `Berhasil menggabungkan ${duplicates.length + 1} pendaftaran menjadi 1 data`
      );
    } catch (error) {
      console.error("Error merging santri:", error);
      toast.error("Terjadi kesalahan saat menggabungkan data santri");
    } finally {
      setIsMerging(false);
    }
  };

  // Handle select all checkboxes
  const handleSelectAll = () => {
    if (isPengurus) return;

    if (isSelectAll) {
      // Deselect all
      setSelectedSantriIds(new Set());
    } else {
      // Select all filtered santris
      const newSelectedIds = new Set<string>();
      filteredSantris.forEach((santri) => newSelectedIds.add(santri.id));
      setSelectedSantriIds(newSelectedIds);
    }
    setIsSelectAll(!isSelectAll);
  };

  // Handle individual checkbox selection
  const handleSelectSantri = (santriId: string) => {
    if (isPengurus) return;

    const newSelectedIds = new Set(selectedSantriIds);
    if (newSelectedIds.has(santriId)) {
      newSelectedIds.delete(santriId);
    } else {
      newSelectedIds.add(santriId);
    }
    setSelectedSantriIds(newSelectedIds);

    // Update isSelectAll state
    setIsSelectAll(newSelectedIds.size === filteredSantris.length);
  };

  // Reset progress panel
  const handleResetProgress = () => {
    setImportProgress({
      isActive: false,
      totalItems: 0,
      currentItemIndex: 0,
      currentItemName: "",
      successCount: 0,
      errorCount: 0,
      operation: "import",
    });
  };

  if (loading || !isAuthorized) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 dark:bg-gray-900 transition-colors">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold dark:text-white transition-colors">
            Data Santri
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Periode saat ini: Semester {currentAcademicPeriod.name} (Tahun
            Akademik {currentAcademicPeriod.academicYear}). Semester numerik
            Perguruan Tinggi aktif maju otomatis setiap 1 Maret dan 1 September.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!isPengurus && (
            <>
              {canMergeSelected && (
                <button
                  onClick={() => setIsMergeModalOpen(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
                >
                  Gabungkan ({selectedSantriIds.size}) Terpilih
                </button>
              )}
              {selectedSantriIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  Hapus ({selectedSantriIds.size}) Terpilih
                </button>
              )}
            </>
          )}
          <button
            onClick={() => router.push("/data-santri/denah")}
            className="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-4 py-2 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            Denah Kamar
          </button>
          <button
            onClick={() => setIsDataToolsModalOpen(true)}
            className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Import / Export
          </button>
          <button
            onClick={handleAddSantri}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Tambah Santri Baru
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 transition-colors">
        {/* Search input */}
        <div className="mb-4">
          <label
            htmlFor="searchQuery"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors"
          >
            Cari Santri
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400 dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              id="searchQuery"
              placeholder="Cari berdasarkan nama santri..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
            />
            {searchQuery && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <CustomFilterDropdown
            id="statusAktifFilter"
            label="Status Aktif"
            value={statusAktifFilter}
            onChange={setStatusAktifFilter}
            options={[
              { value: "all", label: "Semua Status" },
              { value: "Aktif", label: "Aktif" },
              { value: "Pending", label: "Pending" },
              { value: "Ditolak", label: "Ditolak" },
              { value: "Boyong", label: "Boyong" },
              { value: "Lulus", label: "Lulus" },
              { value: "Dikeluarkan", label: "Dikeluarkan" },
            ]}
          />

          <CustomFilterDropdown
            id="jenjangFilter"
            label="Jenjang Pendidikan"
            value={jenjangFilter}
            onChange={setJenjangFilter}
            options={[
              { value: "all", label: "Semua Jenjang" },
              ...uniqueJenjang.map((jenjang) => ({
                value: jenjang,
                label: jenjang,
              })),
            ]}
          />

          <CustomFilterDropdown
            id="programStudiFilter"
            label="Program Studi"
            value={programStudiFilter}
            onChange={setProgramStudiFilter}
            options={[
              { value: "all", label: "Semua Program Studi" },
              ...uniqueProgramStudi.map((prodi) => ({
                value: prodi,
                label: prodi,
              })),
            ]}
          />

          <CustomFilterDropdown
            id="semesterFilter"
            label="Semester"
            value={semesterFilter}
            onChange={setSemesterFilter}
            options={[
              { value: "all", label: "Semua Semester" },
              ...uniqueSemester.map((semester) => ({
                value: semester,
                label: semester,
              })),
            ]}
          />

          <CustomFilterDropdown
            id="tahunMasukFilter"
            label="Tahun Masuk"
            value={tahunMasukFilter}
            onChange={setTahunMasukFilter}
            options={[
              { value: "all", label: "Semua Tahun" },
              ...uniqueTahunMasuk.map((tahun) => ({
                value: tahun,
                label: tahun,
              })),
            ]}
          />

          <CustomFilterDropdown
            id="statusTanggunganFilter"
            label="Status Tanggungan"
            value={statusTanggunganFilter}
            onChange={setStatusTanggunganFilter}
            options={[
              { value: "all", label: "Semua Status" },
              { value: "Lunas", label: "Lunas" },
              { value: "Belum Ada Tagihan", label: "Belum Ada Tagihan" },
              { value: "Belum Lunas", label: "Belum Lunas" },
              {
                value: "Menunggu Verifikasi",
                label: "Menunggu Verifikasi",
              },
            ]}
          />

          <CustomFilterDropdown
            id="kamarFilter"
            label="Kamar"
            value={kamarFilter}
            onChange={setKamarFilter}
            options={kamarFilterOptions}
          />

          <div className="flex items-end col-span-1 md:col-span-3 lg:col-span-8">
            <button
              onClick={resetFilters}
              className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Table */}

      <div className="p-4">
        <StickyHorizontalScroll className="mb-4">
          <div className="bg-white dark:bg-gray-800 py-6 rounded-lg shadow-md transition-colors min-w-max">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredSantris.length === 0 ? (
              <p className="text-xl text-center text-gray-500 dark:text-gray-400 py-12 transition-colors">
                Tidak ada data santri yang ditemukan
              </p>
            ) : (
              <div>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 transition-colors">
                  <thead className="bg-gray-50 dark:bg-gray-900 transition-colors">
                    <tr>
                      {!isPengurus && (
                        <th
                          scope="col"
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors sticky left-0 bg-gray-50 dark:bg-gray-900 z-10"
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:bg-gray-700 transition-colors"
                              checked={isSelectAll}
                              onChange={handleSelectAll}
                            />
                          </div>
                        </th>
                      )}
                      <th
                        scope="col"
                        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer sticky left-10 bg-gray-50 dark:bg-gray-900 z-10 ${
                          sortField === "nama"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                        style={{ left: isPengurus ? "0px" : "2.5rem" }}
                        onClick={() => handleSort("nama")}
                      >
                        <div className="flex items-center">
                          <span>Nama Santri</span>
                          <div className="flex flex-col ml-1">
                            <ChevronUpIcon
                              className={`h-3 w-3 ${
                                sortField === "nama" && sortDirection === "asc"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400"
                              }`}
                            />
                            <ChevronDownIcon
                              className={`h-3 w-3 ${
                                sortField === "nama" && sortDirection === "desc"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400"
                              }`}
                            />
                          </div>
                        </div>
                      </th>
                      <th
                        scope="col"
                        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                          sortField === "kamar"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                        onClick={() => handleSort("kamar")}
                      >
                        <div className="flex items-center">
                          <span>Kamar</span>
                          <div className="flex flex-col ml-1">
                            <ChevronUpIcon
                              className={`h-3 w-3 ${
                                sortField === "kamar" && sortDirection === "asc"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400"
                              }`}
                            />
                            <ChevronDownIcon
                              className={`h-3 w-3 ${
                                sortField === "kamar" &&
                                sortDirection === "desc"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400"
                              }`}
                            />
                          </div>
                        </div>
                      </th>
                      <th
                        scope="col"
                        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                          sortField === "semester"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                        onClick={() => handleSort("semester")}
                      >
                        <div className="flex items-center">
                          <span>Semester/Kelas</span>
                          <div className="flex flex-col ml-1">
                            <ChevronUpIcon
                              className={`h-3 w-3 ${
                                sortField === "semester" &&
                                sortDirection === "asc"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400"
                              }`}
                            />
                            <ChevronDownIcon
                              className={`h-3 w-3 ${
                                sortField === "semester" &&
                                sortDirection === "desc"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400"
                              }`}
                            />
                          </div>
                        </div>
                      </th>
                      <th
                        scope="col"
                        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                          sortField === "programStudi"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                        onClick={() => handleSort("programStudi")}
                      >
                        <div className="flex items-center">
                          <span>Program Studi</span>
                          <div className="flex flex-col ml-1">
                            <ChevronUpIcon
                              className={`h-3 w-3 ${
                                sortField === "programStudi" &&
                                sortDirection === "asc"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400"
                              }`}
                            />
                            <ChevronDownIcon
                              className={`h-3 w-3 ${
                                sortField === "programStudi" &&
                                sortDirection === "desc"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400"
                              }`}
                            />
                          </div>
                        </div>
                      </th>
                      {!isPengurus && (
                        <>
                          <th
                            scope="col"
                            className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                              sortField === "statusTanggungan"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-500 dark:text-gray-400"
                            }`}
                            onClick={() => handleSort("statusTanggungan")}
                          >
                            <div className="flex items-center">
                              <span>Status Tanggungan</span>
                              <div className="flex flex-col ml-1">
                                <ChevronUpIcon
                                  className={`h-3 w-3 ${
                                    sortField === "statusTanggungan" &&
                                    sortDirection === "asc"
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-gray-400"
                                  }`}
                                />
                                <ChevronDownIcon
                                  className={`h-3 w-3 ${
                                    sortField === "statusTanggungan" &&
                                    sortDirection === "desc"
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-gray-400"
                                  }`}
                                />
                              </div>
                            </div>
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                              sortField === "statusAktif"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-500 dark:text-gray-400"
                            }`}
                            onClick={() => handleSort("statusAktif")}
                          >
                            <div className="flex items-center">
                              <span>Status Aktif</span>
                              <div className="flex flex-col ml-1">
                                <ChevronUpIcon
                                  className={`h-3 w-3 ${
                                    sortField === "statusAktif" &&
                                    sortDirection === "asc"
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-gray-400"
                                  }`}
                                />
                                <ChevronDownIcon
                                  className={`h-3 w-3 ${
                                    sortField === "statusAktif" &&
                                    sortDirection === "desc"
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-gray-400"
                                  }`}
                                />
                              </div>
                            </div>
                          </th>
                        </>
                      )}
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors sticky right-0 bg-gray-50 dark:bg-gray-900 z-10"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 transition-colors">
                    {filteredSantris.map((santri) => {
                      const isSelected = selectedSantriIds.has(santri.id);
                      const isHighlighted = highlightedSantriId === santri.id;
                      const rowClasses = `
                          transition-colors duration-150
                          ${isSelected ? "bg-blue-50 dark:bg-blue-900/30" : ""}
                          ${
                            isHighlighted
                              ? "bg-yellow-100 dark:bg-blue-200"
                              : ""
                          }`;

                      const textClasses = `transition-colors duration-150 
                        px-6 py-4 whitespace-nowrap text-sm font-medium 
                        sticky left-10 
                        ${
                          isHighlighted
                            ? "dark:text-gray-300 dark:text-gray-500"
                            : "text-gray-500 dark:text-gray-300"
                        }
                        `;

                      return (
                        <tr key={santri.id} className={rowClasses}>
                          {!isPengurus && (
                            <td className="px-3 py-4 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:bg-gray-700 transition-colors"
                                  checked={selectedSantriIds.has(santri.id)}
                                  onChange={() => handleSelectSantri(santri.id)}
                                />
                              </div>
                            </td>
                          )}
                          <td
                            className={`${textClasses} bg-white dark:bg-gray-800 z-10`}
                            style={{ left: isPengurus ? "0px" : "2.5rem" }}
                          >
                            {santri.nama}
                          </td>
                          <td className={textClasses}>{santri.kamar}</td>
                          <td className={textClasses}>
                            {santri.semester || "-"}
                          </td>
                          <td className={textClasses}>
                            {santri.programStudi || "-"}
                          </td>
                          {!isPengurus && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full transition-colors
                            ${
                              santri.statusTanggungan === "Lunas"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400"
                                : santri.statusTanggungan === "Belum Lunas"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400"
                                : santri.statusTanggungan === "Belum Ada Tagihan"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400"
                                : santri.statusTanggungan === "Menunggu Verifikasi"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                                >
                                  {santri.statusTanggungan}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full transition-colors
                            ${
                              santri.statusAktif === "Aktif"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400"
                                : santri.statusAktif === "Boyong"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400"
                                : santri.statusAktif === "Lulus"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400"
                                : santri.statusAktif === "Dikeluarkan"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400"
                                : santri.statusAktif === "Pending"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400"
                                : santri.statusAktif === "Ditolak"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                                >
                                  {santri.statusAktif}
                                </span>
                              </td>
                            </>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 transition-colors sticky right-0 bg-white dark:bg-gray-800 z-10">
                            {santri.statusAktif === "Pending" ? (
                              <button
                                onClick={() => handleVerifySantri(santri.id)}
                                className="text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 transition-colors"
                              >
                                Verifikasi
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEditSantri(santri)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </StickyHorizontalScroll>
      </div>

      {/* Santri modal for add/edit */}
      <SantriModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        santri={selectedSantri}
        onSubmit={handleSantriSubmit}
        onDelete={handleDeleteSantri}
        isSubmitting={isSubmitting}
        title={selectedSantri ? "Edit Data Santri" : "Tambah Santri Baru"}
        hidePengurusFields={isPengurus && Boolean(selectedSantri)}
      />

      {/* Verification Modal */}
      {isVerificationModalOpen && (
        <SantriVerificationModal
          closeModal={() => setIsVerificationModalOpen(false)}
          santriId={selectedSantriIdForVerification}
          isMobile={window.innerWidth < 768}
          onVerificationComplete={fetchSantris}
        />
      )}

      {/* Merge Modal - combine duplicate pending registrations into one record */}
      {isMergeModalOpen && (
        <SantriMergeModal
          santris={selectedSantrisList}
          onClose={() => setIsMergeModalOpen(false)}
          onConfirm={handleMergeSantris}
          isSubmitting={isMerging}
        />
      )}

      {/* Data Tools choice modal (Export Excel / Import CSV) */}
      <DataToolsModal
        isOpen={isDataToolsModalOpen}
        onClose={() => setIsDataToolsModalOpen(false)}
        onExport={handleExportToExcel}
        onImport={handleOpenImportModal}
      />

      {/* CSV Import Modal - only show when explicitly opened */}
      {isImportModalOpen && (
        <CSVImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleBulkImport}
          isImporting={importProgress.isActive}
        />
      )}

      {/* Import Progress Panel - only show when active */}
      {importProgress.isActive && (
        <ImportProgressPanel
          isActive={importProgress.isActive}
          totalItems={importProgress.totalItems}
          currentItemIndex={importProgress.currentItemIndex}
          currentItemName={importProgress.currentItemName}
          successCount={importProgress.successCount}
          errorCount={importProgress.errorCount}
          operation={importProgress.operation}
          onClose={handleResetProgress}
        />
      )}
    </div>
  );
}
