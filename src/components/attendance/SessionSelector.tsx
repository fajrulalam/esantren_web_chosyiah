import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveSessions, createAttendanceSession, getAttendanceTypes, deleteAttendanceSession } from '@/firebase/attendance';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/firebase/config';
import { format } from 'date-fns';
import { AttendanceRecord, AttendanceType } from '@/types/attendance';
import {Santri} from "@/types/santri";

interface SessionSelectorProps {
  kodeAsrama: string;
  teacherId: string;
}

export default function SessionSelector({ kodeAsrama, teacherId }: SessionSelectorProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<AttendanceRecord[]>([]);
  const [newSessionType, setNewSessionType] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(undefined);
  const [attendanceTypes, setAttendanceTypes] = useState<AttendanceType[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [showEditTypeModal, setShowEditTypeModal] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({
    name: '',
    description: ''
  });
  const [editTypeForm, setEditTypeForm] = useState<{
    id: string;
    name: string;
    description: string;
    originalSantriIds: string[];
  }>({
    id: '',
    name: '',
    description: '',
    originalSantriIds: []
  });
  const [santris, setSantris] = useState<Santri[]>([]);
  const [filteredSantris, setFilteredSantris] = useState<Santri[]>([]);
  const [selectedSantriIds, setSelectedSantriIds] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [isLoadingSantris, setIsLoadingSantris] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [filters, setFilters] = useState({
    statusAktif: 'Aktif',
    kamar: '',
    jenjangPendidikan: '',
    semester: '',
  });
  const [isAddingType, setIsAddingType] = useState(false);
  const [isUpdatingType, setIsUpdatingType] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [showDeleteTypeModal, setShowDeleteTypeModal] = useState(false);
  const [selectedTypeToDelete, setSelectedTypeToDelete] = useState<AttendanceType | null>(null);
  const [isDeletingType, setIsDeletingType] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Load attendance types
  useEffect(() => {
    const loadAttendanceTypes = async () => {
      try {
        const types = await getAttendanceTypes(true);
        setAttendanceTypes(types);
      } catch (error) {
        console.error("Error loading attendance types:", error);
      }
    };

    loadAttendanceTypes();
  }, []);
  
  // Fetch santris when add modal opens
  useEffect(() => {
    if (showAddTypeModal) {
      fetchSantris();
    } else {
      // Reset selections when modal closes
      setSelectedSantriIds(new Set());
      setIsSelectAll(false);
    }
  }, [showAddTypeModal, kodeAsrama]);
  
  // Fetch santris when edit modal opens and set selected santris
  useEffect(() => {
    if (showEditTypeModal) {
      fetchSantris();
      
      // Set selected santris based on the type being edited
      if (editTypeForm.originalSantriIds && editTypeForm.originalSantriIds.length > 0) {
        setSelectedSantriIds(new Set(editTypeForm.originalSantriIds));
      }
    } else {
      // Reset form and selections when modal closes
      setSelectedSantriIds(new Set());
      setIsSelectAll(false);
      setHasChanges(false);
    }
  }, [showEditTypeModal, kodeAsrama]);

  // Load active sessions
  useEffect(() => {
    const loadSessions = async () => {
      if (!kodeAsrama) return;
      
      setIsLoading(true);
      try {
        const activeSessions = await getActiveSessions(kodeAsrama);
        setSessions(activeSessions);
      } catch (error) {
        console.error("Error loading sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, [kodeAsrama]);

  // Handle creating a new session
  const handleCreateSession = async () => {
    if (!newSessionType.trim()) return;
    
    setIsCreatingSession(true);
    try {
      // Use the state variable as the primary source of truth
      // If that's empty, check DOM elements as fallbacks
      let typeId = selectedTypeId;
      
      if (!typeId) {
        // Fallback 1: Check hidden input 
        const hiddenInput = document.getElementById('selected-type-id') as HTMLInputElement;
        // Fallback 2: Check input element's data attribute
        const inputEl = document.getElementById('session-type-input') as HTMLInputElement;
        
        typeId = hiddenInput?.value || inputEl?.dataset?.typeId || undefined;
      }
      
      // Debug logging
      console.log("Type ID from state:", selectedTypeId);
      console.log("Final type ID being used:", typeId);
      
      // Log what type of creation is happening (from selection or manual input)
      console.log("Creating session from:", typeId ? "SELECTED TYPE" : "MANUAL INPUT", 
        { name: newSessionType, typeId: typeId || "none" });
      
      // Create the session, passing the type ID if available
      const sessionId = await createAttendanceSession(newSessionType, kodeAsrama, teacherId, typeId);
      
      // Reset all state
      setNewSessionType('');
      setSelectedTypeId(undefined);
      setIsCreatingNew(false);
      
      // Clear DOM elements as well (redundant but thorough)
      const hiddenInput = document.getElementById('selected-type-id') as HTMLInputElement;
      if (hiddenInput) {
        hiddenInput.value = '';
      }
      
      const inputEl = document.getElementById('session-type-input') as HTMLInputElement;
      if (inputEl) {
        delete inputEl.dataset.typeId;
      }

      // Navigate to the new session
      router.push(`/attendance/${sessionId}`);
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Gagal membuat sesi presensi. Silakan coba lagi.");
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Handle selecting a type from chips
  const handleSelectType = (typeName: string, typeId: string) => {
    // Store both the name and ID for use when creating the session
    setNewSessionType(typeName);
    
    // Store the type ID in state
    setSelectedTypeId(typeId);
    
    // Create or use an existing hidden input to store the type ID as a backup
    let hiddenInput = document.getElementById('selected-type-id') as HTMLInputElement;
    if (!hiddenInput) {
      hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.id = 'selected-type-id';
      document.body.appendChild(hiddenInput);
    }
    hiddenInput.value = typeId;
    
    // Also store the ID as a data attribute on the visible input element as a backup
    const inputEl = document.getElementById('session-type-input') as HTMLInputElement;
    if (inputEl) {
      inputEl.dataset.typeId = typeId;
    }
    
    console.log(`Selected attendance type: ${typeName} (ID: ${typeId})`);
    setIsCreatingNew(true);
  };

  // Format time function
  const formatTime = (date: Date) => {
    return format(date, 'HH:mm');
  };
  
  // Fetch santris function
  const fetchSantris = async () => {
    setIsLoadingSantris(true);
    try {
      const santriRef = collection(db, "SantriCollection");
      // Get all santris from the current asrama
      const q = query(
        santriRef, 
        where("kodeAsrama", "==", kodeAsrama)
      );
      const querySnapshot = await getDocs(q);
      
      const santriData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        nama: doc.data().nama || '',
        kamar: doc.data().kamar || '',
        jenjangPendidikan: doc.data().jenjangPendidikan || '',
        statusAktif: doc.data().statusAktif || '',
        tahunMasuk: doc.data().tahunMasuk || '',
        programStudi: doc.data().programStudi || '',
        semester: doc.data().kelas || '',
        kodeAsrama: doc.data().kodeAsrama
      }));
      
      setSantris(santriData);
      
      // Apply initial filters
      applyFilters(santriData, filters);
    } catch (error) {
      console.error("Error fetching santri data:", error);
    } finally {
      setIsLoadingSantris(false);
    }
  };
  
  // Apply filters
  const applyFilters = (data: Santri[], currentFilters: typeof filters) => {
    let filtered = [...data];
    
    if (currentFilters.statusAktif) {
      filtered = filtered.filter(santri => santri.statusAktif === currentFilters.statusAktif);
    }
    
    if (currentFilters.kamar) {
      filtered = filtered.filter(santri => santri.kamar === currentFilters.kamar);
    }
    
    if (currentFilters.jenjangPendidikan) {
      filtered = filtered.filter(santri => santri.jenjangPendidikan === currentFilters.jenjangPendidikan);
    }

    if (currentFilters.semester) {
      filtered = filtered.filter(santri => santri.semester === currentFilters.semester);
    }
    
    setFilteredSantris(filtered);
    setIsSelectAll(false);
  };
  
  // Handle filter changes
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    applyFilters(santris, newFilters);
  };
  
  // Check if selections have changed from original
  const checkForChanges = (currentSelection: Set<string>) => {
    if (!showEditTypeModal) return; // Only check in edit mode
    
    const originalIds = new Set(editTypeForm.originalSantriIds);
    
    // If sizes are different, there are changes
    if (currentSelection.size !== originalIds.size) {
      setHasChanges(true);
      return;
    }
    
    // Check if any IDs are different
    let changed = false;
    
    // Check for additions (in current but not in original)
    for (const id of currentSelection) {
      if (!originalIds.has(id)) {
        changed = true;
        break;
      }
    }
    
    // Check for removals (in original but not in current)
    if (!changed) {
      for (const id of originalIds) {
        if (!currentSelection.has(id)) {
          changed = true;
          break;
        }
      }
    }
    
    setHasChanges(changed);
  };
  
  // Handle select all
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedSantriIds(new Set());
    } else {
      const newSelectedIds = new Set<string>();
      filteredSantris.forEach(santri => newSelectedIds.add(santri.id));
      setSelectedSantriIds(newSelectedIds);
    }
    setIsSelectAll(!isSelectAll);
    
    // Check for changes in edit mode
    if (showEditTypeModal) {
      const newSelectedIds = isSelectAll ? new Set() : new Set(filteredSantris.map(s => s.id));
      checkForChanges(newSelectedIds);
    }
  };
  
  // Handle individual selection
  const handleSelectSantri = (santriId: string) => {
    const newSelectedIds = new Set(selectedSantriIds);
    if (newSelectedIds.has(santriId)) {
      newSelectedIds.delete(santriId);
    } else {
      newSelectedIds.add(santriId);
    }
    setSelectedSantriIds(newSelectedIds);
    setIsSelectAll(newSelectedIds.size === filteredSantris.length && filteredSantris.length > 0);
    
    // Check for changes in edit mode
    if (showEditTypeModal) {
      checkForChanges(newSelectedIds);
    }
  };
  
  // Handle adding a new attendance type
  const handleAddAttendanceType = async () => {
    if (!newTypeForm.name.trim()) return;
    
    setIsAddingType(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not authenticated");
      }

      const newType = {
        name: newTypeForm.name.trim(),
        description: newTypeForm.description.trim() || null,
        isFrequent: true, // Always true, as per requirement
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        kodeAsrama,
        // Add the selected santri IDs
        listOfSantriIds: selectedSantriIds.size > 0 ? Array.from(selectedSantriIds) : null
      };

      await addDoc(collection(db, "AttendanceTypes"), newType);
      
      // Reset form
      setNewTypeForm({
        name: '',
        description: ''
      });
      setSelectedSantriIds(new Set());
      setIsSelectAll(false);
      
      // Close modal
      setShowAddTypeModal(false);
      
      // Reload types
      const types = await getAttendanceTypes(true);
      setAttendanceTypes(types);
    } catch (error) {
      console.error("Error adding attendance type:", error);
      alert("Gagal menambahkan jenis presensi. Silakan coba lagi.");
    } finally {
      setIsAddingType(false);
    }
  };
  
  // Handle deleting a session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    
    const confirmation = window.confirm("Apakah Anda yakin ingin menghapus sesi presensi ini? Tindakan ini tidak dapat dibatalkan.");
    if (!confirmation) return;
    
    setIsDeletingSession(true);
    try {
      const success = await deleteAttendanceSession(sessionId);
      if (success) {
        // Remove from local state
        setSessions(sessions.filter(session => session.id !== sessionId));
      } else {
        alert("Gagal menghapus sesi. Silakan coba lagi.");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      alert("Terjadi kesalahan saat menghapus sesi.");
    } finally {
      setIsDeletingSession(false);
    }
  };
  
  // Handle type long press to show edit modal
  const handleTypeLongPress = (type: AttendanceType) => {
    longPressTimer.current = setTimeout(() => {
      // Setup edit form with type data
      setEditTypeForm({
        id: type.id,
        name: type.name,
        description: type.description || '',
        originalSantriIds: type.listOfSantriIds || []
      });
      
      // Initialize selected santri IDs with existing ones
      setSelectedSantriIds(new Set(type.listOfSantriIds || []));
      
      // Show edit modal instead of delete modal
      setShowEditTypeModal(true);
    }, 700);
  };
  
  // Handle type press end to cancel long press
  const handleTypePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  
  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);
  
  // Handle updating an attendance type
  const handleUpdateAttendanceType = async () => {
    if (!editTypeForm.id) return;
    
    setIsUpdatingType(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not authenticated");
      }

      // Update the attendance type with new data
      const typeRef = doc(db, "AttendanceTypes", editTypeForm.id);
      await updateDoc(typeRef, {
        name: editTypeForm.name.trim(),
        description: editTypeForm.description.trim() || null,
        listOfSantriIds: Array.from(selectedSantriIds),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
      
      // Close modal
      setShowEditTypeModal(false);
      
      // Reload types
      const types = await getAttendanceTypes(true);
      setAttendanceTypes(types);
    } catch (error) {
      console.error("Error updating attendance type:", error);
      alert("Gagal memperbarui jenis presensi. Silakan coba lagi.");
    } finally {
      setIsUpdatingType(false);
    }
  };
  
  // Handle deleting an attendance type (from edit modal)
  const handleDeleteTypeFromEditModal = async () => {
    if (!editTypeForm.id) return;
    
    const confirmation = window.confirm(`Apakah Anda yakin ingin menghapus jenis presensi "${editTypeForm.name}"? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmation) return;
    
    setIsDeletingType(true);
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "AttendanceTypes", editTypeForm.id));
      
      // Update local state
      setAttendanceTypes(attendanceTypes.filter(type => type.id !== editTypeForm.id));
      
      // Close modal
      setShowEditTypeModal(false);
    } catch (error) {
      console.error("Error deleting attendance type:", error);
      alert("Gagal menghapus jenis presensi. Silakan coba lagi.");
    } finally {
      setIsDeletingType(false);
    }
  };
  
  // Handle deleting an attendance type
  const handleDeleteAttendanceType = async () => {
    if (!selectedTypeToDelete) return;
    
    // Debug info to see the structure of the type
    console.log("Type to delete:", selectedTypeToDelete);
    
    // Check if the type has an ID
    if (!selectedTypeToDelete.id) {
      console.error("Cannot delete type without ID");
      alert("Tidak dapat menghapus jenis presensi karena ID tidak ditemukan.");
      setShowDeleteTypeModal(false);
      setSelectedTypeToDelete(null);
      setIsDeletingType(false);
      return;
    }
    
    setIsDeletingType(true);
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "AttendanceTypes", selectedTypeToDelete.id));
      
      // Update local state
      setAttendanceTypes(attendanceTypes.filter(type => type.id !== selectedTypeToDelete.id));
      
      // Close modal
      setShowDeleteTypeModal(false);
      setSelectedTypeToDelete(null);
    } catch (error) {
      console.error("Error deleting attendance type:", error);
      alert("Gagal menghapus jenis presensi. Silakan coba lagi.");
    } finally {
      setIsDeletingType(false);
    }
  };

  return (
    <div className="session-selector bg-white dark:bg-gray-900 rounded-xl shadow-[5px_5px_15px_rgba(0,0,0,0.1),-5px_-5px_15px_rgba(255,255,255,0.1)] dark:shadow-[5px_5px_15px_rgba(0,0,0,0.3),-5px_-5px_15px_rgba(255,255,255,0.05)] p-6 border border-gray-100 dark:border-gray-800">
      <h2 className="text-xl font-bold mb-5 text-gray-800 dark:text-gray-100">Pilih Jadwal Presensi</h2>

      {/* Attendance Type Quick Select with Add Button */}
      {!isCreatingNew && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Jadwal Presensi</h3>
            <button 
              onClick={() => setShowAddTypeModal(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gradient-to-br 
                       from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800
                       text-gray-600 dark:text-gray-300 text-lg
                       shadow-[2px_2px_5px_rgba(0,0,0,0.05),-2px_-2px_5px_rgba(255,255,255,0.8)]
                       dark:shadow-[2px_2px_5px_rgba(0,0,0,0.2),-2px_-2px_5px_rgba(255,255,255,0.05)]
                       hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05),inset_-2px_-2px_5px_rgba(255,255,255,0.8)]
                       dark:hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2),inset_-2px_-2px_5px_rgba(255,255,255,0.05)]
                       transition-all duration-200"
              aria-label="Add new attendance type"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {attendanceTypes.length > 0 ? attendanceTypes.map((type, index) => (
              <button
                key={type.id || `type-${index}`}
                onClick={() => handleSelectType(type.name, type.id)}
                onTouchStart={() => handleTypeLongPress(type)}
                onMouseDown={() => handleTypeLongPress(type)}
                onTouchEnd={handleTypePressEnd}
                onMouseUp={handleTypePressEnd}
                onMouseLeave={handleTypePressEnd}
                className="px-3 py-2 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100 
                          dark:from-indigo-800/80 dark:to-indigo-700/80 
                          text-indigo-700 dark:text-indigo-300 text-sm font-medium
                          shadow-[2px_2px_5px_rgba(0,0,0,0.05),-2px_-2px_5px_rgba(255,255,255,0.8)]
                          dark:shadow-[2px_2px_5px_rgba(0,0,0,0.2),-2px_-2px_5px_rgba(255,255,255,0.05)]
                          hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05),inset_-2px_-2px_5px_rgba(255,255,255,0.8)]
                          dark:hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2),inset_-2px_-2px_5px_rgba(255,255,255,0.05)]
                          transition-all duration-200"
              >
                {type.name}
                {type.listOfSantriIds && type.listOfSantriIds.length > 0 && (
                  <span className="ml-1 text-xs text-blue-500">[{type.listOfSantriIds.length}]</span>
                )}
              </button>
            )) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Klik tombol + untuk menambahkan jenis presensi
              </p>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2">Memuat sesi...</p>
        </div>
      ) : (
        <>
          {/* Active sessions */}
          {sessions.length > 0 && (
            <div className="active-sessions mb-6">
              <h3 className="font-medium text-lg mb-3 text-gray-800 dark:text-gray-200">Sesi Aktif</h3>
              <div className="grid gap-3">
                {sessions.map(session => (
                  <div key={session.id} className="relative">
                    <button
                      onClick={() => router.push(`/attendance/${session.id}`)}
                      className="session-button w-full text-left px-5 py-4 pr-10 rounded-lg transition-all duration-200
                                bg-gradient-to-br from-indigo-50 to-indigo-100 
                                dark:from-indigo-800/80 dark:to-indigo-700/80
                                shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.8)]
                                dark:shadow-[3px_3px_8px_rgba(0,0,0,0.3),-3px_-3px_8px_rgba(255,255,255,0.05)]
                                hover:shadow-[1px_1px_4px_rgba(0,0,0,0.1),-1px_-1px_4px_rgba(255,255,255,0.8)]
                                dark:hover:shadow-[1px_1px_4px_rgba(0,0,0,0.3),-1px_-1px_4px_rgba(255,255,255,0.05)]
                                hover:translate-y-[1px]"
                    >
                      <span className="font-bold block text-lg text-indigo-800 dark:text-indigo-300">
                        {session.attendanceType}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {session.timestamp && format(session.timestamp.toDate(), 'dd MMM yyyy')} - {session.timestamp && formatTime(session.timestamp.toDate())}
                      </span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      disabled={isDeletingSession}
                      className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full
                                bg-red-100 dark:bg-red-900/50 text-red-500 dark:text-red-300
                                hover:bg-red-200 dark:hover:bg-red-800/60
                                transition-colors duration-200"
                      aria-label="Hapus sesi"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No active sessions message */}
          {sessions.length === 0 && !isCreatingNew && (
            <div className="mb-6 py-6 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p>Tidak ada sesi aktif saat ini.</p>
            </div>
          )}

          {/* Create new session */}
          {isCreatingNew ? (
            <div className="new-session-form p-5 rounded-lg
                           bg-gradient-to-br from-gray-50 to-gray-100 
                           dark:from-gray-800/60 dark:to-gray-800/30
                           shadow-[inset_3px_3px_8px_rgba(0,0,0,0.05),inset_-3px_-3px_8px_rgba(255,255,255,0.8)]
                           dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.2),inset_-3px_-3px_8px_rgba(255,255,255,0.05)]">
              <label className="block mb-2 font-medium text-gray-800 dark:text-gray-200">Nama Sesi</label>
              <input
                id="session-type-input"
                type="text"
                value={newSessionType}
                onChange={(e) => setNewSessionType(e.target.value)}
                placeholder="Contoh: Subuh, Maghrib, Isya, Ro'an"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 
                           bg-white dark:bg-gray-900 
                           shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05),inset_-2px_-2px_5px_rgba(255,255,255,0.2)]
                           dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2)]
                           focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent"
                list="attendance-types"
                autoFocus
              />
              <datalist id="attendance-types">
                {attendanceTypes.map((type, index) => (
                  <option key={type.id || `type-option-${index}`} value={type.name} />
                ))}
              </datalist>
              <div className="form-actions flex gap-3">
                <button 
                  onClick={handleCreateSession}
                  className="px-5 py-3 bg-gradient-to-br from-indigo-500 to-indigo-600 
                            text-white font-medium rounded-lg 
                            shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.1)]
                            hover:shadow-[1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.1)]
                            transition-all duration-200 hover:translate-y-[1px]
                            disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                  disabled={!newSessionType.trim() || isCreatingSession}
                >
                  {isCreatingSession ? 'Membuat Sesi...' : 'Mulai Sesi'}
                </button>
                <button 
                  onClick={() => {
                    setIsCreatingNew(false);
                    setNewSessionType('');
                  }}
                  className="px-5 py-3 bg-gradient-to-br from-gray-200 to-gray-300 
                            dark:from-gray-700 dark:to-gray-800
                            text-gray-800 dark:text-gray-200 font-medium rounded-lg 
                            shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.8)]
                            dark:shadow-[3px_3px_8px_rgba(0,0,0,0.3),-3px_-3px_8px_rgba(255,255,255,0.05)]
                            hover:shadow-[1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.8)]
                            dark:hover:shadow-[1px_1px_3px_rgba(0,0,0,0.3),-1px_-1px_3px_rgba(255,255,255,0.05)]
                            transition-all duration-200 hover:translate-y-[1px]"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button
              className="create-session-button w-full py-4 px-6 bg-gradient-to-br from-indigo-500 to-indigo-600 
                         text-white font-bold rounded-lg text-lg
                         shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.1)]
                         hover:shadow-[2px_2px_5px_rgba(0,0,0,0.1),-2px_-2px_5px_rgba(255,255,255,0.1)]
                         active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2)]
                         transition-all duration-200 hover:translate-y-[1px] active:translate-y-[2px]"
              onClick={() => setIsCreatingNew(true)}
            >
              Buat Jadwal Insidental
            </button>
          )}
        </>
      )}

      {/* Add Attendance Type Modal */}
      {showAddTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-md w-full
                         border border-gray-200 dark:border-gray-700
                         shadow-[5px_5px_15px_rgba(0,0,0,0.1),-5px_-5px_15px_rgba(255,255,255,0.1)]
                         dark:shadow-[5px_5px_15px_rgba(0,0,0,0.3),-5px_-5px_15px_rgba(255,255,255,0.05)]">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Tambah Jenis Presensi</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Nama</label>
              <input
                type="text"
                value={newTypeForm.name}
                onChange={(e) => setNewTypeForm({...newTypeForm, name: e.target.value})}
                placeholder="Contoh: Subuh, Maghrib, Ro'an"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-900 
                         shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05),inset_-2px_-2px_5px_rgba(255,255,255,0.2)]
                         dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2)]
                         focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent"
                autoFocus
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Deskripsi (Opsional)</label>
              <textarea
                value={newTypeForm.description}
                onChange={(e) => setNewTypeForm({...newTypeForm, description: e.target.value})}
                placeholder="Deskripsi singkat"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-900 
                         shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05),inset_-2px_-2px_5px_rgba(255,255,255,0.2)]
                         dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2)]
                         focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
            
            {/* Santri selection section */}
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Pilih Santri untuk Presensi Ini</h4>
              
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label htmlFor="statusAktif" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Status Aktif
                  </label>
                  <select
                    id="statusAktif"
                    name="statusAktif"
                    value={filters.statusAktif}
                    onChange={handleFilterChange}
                    className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                  >
                    <option value="">Semua Status</option>
                    <option value="Aktif">Aktif</option>
                    <option value="Boyong">Boyong</option>
                    <option value="Lulus">Lulus</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="kamar" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Kamar
                  </label>
                  <select
                    id="kamar"
                    name="kamar"
                    value={filters.kamar}
                    onChange={handleFilterChange}
                    className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                  >
                    <option value="">Semua Kamar</option>
                    {[...new Set(santris.map(s => s.kamar))].filter(Boolean).sort().map(kamar => (
                      <option key={kamar} value={kamar}>{kamar}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="semester" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Semester
                  </label>
                  <select
                    id="semester"
                    name="semester"
                    value={filters.semester}
                    onChange={handleFilterChange}
                    className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                  >
                    <option value="">Semua</option>
                    {[...new Set(santris.map(s => s.semester))].filter(Boolean).sort().map(jenjang => (
                      <option key={jenjang} value={jenjang}>{jenjang}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Santri list */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    checked={isSelectAll}
                    onChange={handleSelectAll}
                  />
                  <span className="ml-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                    {isSelectAll 
                      ? `Semua Terpilih (${filteredSantris.length})`
                      : selectedSantriIds.size > 0
                        ? `${selectedSantriIds.size} Terpilih dari ${filteredSantris.length}`
                        : `Pilih Semua (${filteredSantris.length})`
                    }
                  </span>
                </div>
                
                <div className="max-h-60 overflow-y-auto">
                  {isLoadingSantris ? (
                    <div className="flex flex-col justify-center items-center py-8 space-y-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Memuat data santri...
                      </span>
                    </div>
                  ) : filteredSantris.length === 0 ? (
                    <div className="py-4 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Tidak ada santri yang sesuai dengan filter
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th scope="col" className="px-2 py-2 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10"></th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-8 bg-gray-50 dark:bg-gray-800 z-10">
                              Nama
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Status
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Kamar
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredSantris.map((santri) => (
                            <tr 
                              key={santri.id}
                              className={selectedSantriIds.has(santri.id) 
                                ? "bg-blue-50 dark:bg-blue-900/30" 
                                : "hover:bg-gray-50 dark:hover:bg-gray-800"}
                            >
                              <td className={`px-2 py-2 whitespace-nowrap sticky left-0 z-10 ${
                                selectedSantriIds.has(santri.id) 
                                  ? "bg-blue-50 dark:bg-blue-900/30" 
                                  : "bg-white dark:bg-gray-900"
                              }`}>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                                  checked={selectedSantriIds.has(santri.id)}
                                  onChange={() => handleSelectSantri(santri.id)}
                                />
                              </td>
                              <td className={`px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white sticky left-8 z-10 ${
                                selectedSantriIds.has(santri.id) 
                                  ? "bg-blue-50 dark:bg-blue-900/30" 
                                  : "bg-white dark:bg-gray-900"
                              }`}>
                                {santri.nama}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${santri.statusAktif === 'Aktif' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' : 
                                  santri.statusAktif === 'Boyong' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400' : 
                                  santri.statusAktif === 'Lulus' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                  {santri.statusAktif}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                {santri.kamar || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {selectedSantriIds.size === 0 
                  ? 'Jika tidak ada santri dipilih, presensi akan menampilkan semua santri Aktif'
                  : `${selectedSantriIds.size} santri akan ditampilkan di presensi ini`
                }
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={() => {
                  setShowAddTypeModal(false);
                  setNewTypeForm({name: '', description: ''});
                  setSelectedSantriIds(new Set());
                }}
                className="px-4 py-2 bg-gradient-to-br from-gray-200 to-gray-300 
                          dark:from-gray-700 dark:to-gray-800
                          text-gray-800 dark:text-gray-200 font-medium rounded-lg 
                          shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.8)]
                          dark:shadow-[3px_3px_8px_rgba(0,0,0,0.3),-3px_-3px_8px_rgba(255,255,255,0.05)]
                          hover:shadow-[1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.8)]
                          dark:hover:shadow-[1px_1px_3px_rgba(0,0,0,0.3),-1px_-1px_3px_rgba(255,255,255,0.05)]
                          transition-all duration-200 hover:translate-y-[1px]"
              >
                Batal
              </button>
              <button 
                onClick={handleAddAttendanceType}
                disabled={isAddingType || !newTypeForm.name.trim()}
                className="px-4 py-2 bg-gradient-to-br from-indigo-500 to-indigo-600 
                          text-white font-medium rounded-lg min-w-32
                          shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.1)]
                          hover:shadow-[1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.1)]
                          transition-all duration-200 hover:translate-y-[1px]
                          disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingType ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Attendance Type Modal */}
      {showEditTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-4xl w-full
                         border border-gray-200 dark:border-gray-700
                         shadow-[5px_5px_15px_rgba(0,0,0,0.1),-5px_-5px_15px_rgba(255,255,255,0.1)]
                         dark:shadow-[5px_5px_15px_rgba(0,0,0,0.3),-5px_-5px_15px_rgba(255,255,255,0.05)]">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Edit Jenis Presensi</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Nama</label>
              <input
                type="text"
                value={editTypeForm.name}
                onChange={(e) => {
                  setEditTypeForm({...editTypeForm, name: e.target.value});
                  setHasChanges(true);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-900 
                         shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05),inset_-2px_-2px_5px_rgba(255,255,255,0.2)]
                         dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2)]
                         focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent"
                autoFocus
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Deskripsi (Opsional)</label>
              <textarea
                value={editTypeForm.description}
                onChange={(e) => {
                  setEditTypeForm({...editTypeForm, description: e.target.value});
                  setHasChanges(true);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-900 
                         shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05),inset_-2px_-2px_5px_rgba(255,255,255,0.2)]
                         dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2)]
                         focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
            
            {/* Santri selection section */}
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Pilih Santri untuk Presensi Ini</h4>
              
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label htmlFor="statusAktif" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Status Aktif
                  </label>
                  <select
                    id="statusAktif"
                    name="statusAktif"
                    value={filters.statusAktif}
                    onChange={handleFilterChange}
                    className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                  >
                    <option value="">Semua Status</option>
                    <option value="Aktif">Aktif</option>
                    <option value="Boyong">Boyong</option>
                    <option value="Lulus">Lulus</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="kamar" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Kamar
                  </label>
                  <select
                    id="kamar"
                    name="kamar"
                    value={filters.kamar}
                    onChange={handleFilterChange}
                    className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                  >
                    <option value="">Semua Kamar</option>
                    {[...new Set(santris.map(s => s.kamar))].filter(Boolean).sort().map(kamar => (
                      <option key={kamar} value={kamar}>{kamar}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="semester" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    semester
                  </label>
                  <select
                    id="semester"
                    name="semester"
                    value={filters.semester}
                    onChange={handleFilterChange}
                    className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                  >
                    <option value="">Semua Jenjang</option>
                    {[...new Set(santris.map(s => s.semester))].filter(Boolean).sort().map(jenjang => (
                      <option key={jenjang} value={jenjang}>{jenjang}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Santri list */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    checked={isSelectAll}
                    onChange={handleSelectAll}
                  />
                  <span className="ml-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                    {isSelectAll 
                      ? `Semua Terpilih (${filteredSantris.length})`
                      : selectedSantriIds.size > 0
                        ? `${selectedSantriIds.size} Terpilih dari ${filteredSantris.length}`
                        : `Pilih Semua (${filteredSantris.length})`
                    }
                  </span>
                </div>
                
                <div className="max-h-60 overflow-y-auto">
                  {isLoadingSantris ? (
                    <div className="flex flex-col justify-center items-center py-8 space-y-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Memuat data santri...
                      </span>
                    </div>
                  ) : filteredSantris.length === 0 ? (
                    <div className="py-4 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Tidak ada santri yang sesuai dengan filter
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th scope="col" className="px-2 py-2 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10"></th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-8 bg-gray-50 dark:bg-gray-800 z-10">
                              Nama
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Status
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Kamar
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredSantris.map((santri) => (
                            <tr 
                              key={santri.id}
                              className={selectedSantriIds.has(santri.id) 
                                ? "bg-blue-50 dark:bg-blue-900/30" 
                                : "hover:bg-gray-50 dark:hover:bg-gray-800"}
                            >
                              <td className={`px-2 py-2 whitespace-nowrap sticky left-0 z-10 ${
                                selectedSantriIds.has(santri.id) 
                                  ? "bg-blue-50 dark:bg-blue-900/30" 
                                  : "bg-white dark:bg-gray-900"
                              }`}>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                                  checked={selectedSantriIds.has(santri.id)}
                                  onChange={() => handleSelectSantri(santri.id)}
                                />
                              </td>
                              <td className={`px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white sticky left-8 z-10 ${
                                selectedSantriIds.has(santri.id) 
                                  ? "bg-blue-50 dark:bg-blue-900/30" 
                                  : "bg-white dark:bg-gray-900"
                              }`}>
                                {santri.nama}
                                {editTypeForm.originalSantriIds.includes(santri.id) && (
                                  <span className="ml-1 text-blue-500 text-xs" title="Sudah termasuk sebelumnya">●</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${santri.statusAktif === 'Aktif' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' : 
                                  santri.statusAktif === 'Boyong' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400' : 
                                  santri.statusAktif === 'Lulus' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                  {santri.statusAktif}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                {santri.kamar || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {selectedSantriIds.size === 0 
                  ? 'Jika tidak ada santri dipilih, presensi akan menampilkan semua santri Aktif'
                  : `${selectedSantriIds.size} santri akan ditampilkan di presensi ini`
                }
              </div>
            </div>
            
            <div className="flex justify-between mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={handleDeleteTypeFromEditModal}
                className="px-4 py-2 bg-gradient-to-br from-red-500 to-red-600 
                          text-white font-medium rounded-lg
                          shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.1)]
                          hover:shadow-[1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.1)]
                          transition-all duration-200 hover:translate-y-[1px]
                          disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hapus
              </button>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowEditTypeModal(false)}
                  className="px-4 py-2 bg-gradient-to-br from-gray-200 to-gray-300 
                            dark:from-gray-700 dark:to-gray-800
                            text-gray-800 dark:text-gray-200 font-medium rounded-lg 
                            shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.8)]
                            dark:shadow-[3px_3px_8px_rgba(0,0,0,0.3),-3px_-3px_8px_rgba(255,255,255,0.05)]
                            hover:shadow-[1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.8)]
                            dark:hover:shadow-[1px_1px_3px_rgba(0,0,0,0.3),-1px_-1px_3px_rgba(255,255,255,0.05)]
                            transition-all duration-200 hover:translate-y-[1px]"
                >
                  Batal
                </button>
                <button 
                  onClick={handleUpdateAttendanceType}
                  disabled={isUpdatingType || !editTypeForm.name.trim() || !hasChanges}
                  className="px-4 py-2 bg-gradient-to-br from-indigo-500 to-indigo-600 
                            text-white font-medium rounded-lg min-w-32
                            shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.1)]
                            hover:shadow-[1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.1)]
                            transition-all duration-200 hover:translate-y-[1px]
                            disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingType ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Attendance Type Modal */}
      {showDeleteTypeModal && selectedTypeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-md w-full
                         border border-gray-200 dark:border-gray-700
                         shadow-[5px_5px_15px_rgba(0,0,0,0.1),-5px_-5px_15px_rgba(255,255,255,0.1)]
                         dark:shadow-[5px_5px_15px_rgba(0,0,0,0.3),-5px_-5px_15px_rgba(255,255,255,0.05)]">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Hapus Jenis Presensi</h3>
            
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Apakah Anda yakin ingin menghapus jenis presensi "{selectedTypeToDelete.name}"? Tindakan ini tidak dapat dibatalkan.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={handleDeleteAttendanceType}
                disabled={isDeletingType}
                className="px-4 py-2 bg-gradient-to-br from-red-500 to-red-600 
                          text-white font-medium rounded-lg flex-1
                          shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.1)]
                          hover:shadow-[1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.1)]
                          transition-all duration-200 hover:translate-y-[1px]
                          disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingType ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
              <button 
                onClick={() => {
                  setShowDeleteTypeModal(false);
                  setSelectedTypeToDelete(null);
                }}
                className="px-4 py-2 bg-gradient-to-br from-gray-200 to-gray-300 
                          dark:from-gray-700 dark:to-gray-800
                          text-gray-800 dark:text-gray-200 font-medium rounded-lg 
                          shadow-[3px_3px_8px_rgba(0,0,0,0.1),-3px_-3px_8px_rgba(255,255,255,0.8)]
                          dark:shadow-[3px_3px_8px_rgba(0,0,0,0.3),-3px_-3px_8px_rgba(255,255,255,0.05)]
                          hover:shadow-[1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(255,255,255,0.8)]
                          dark:hover:shadow-[1px_1px_3px_rgba(0,0,0,0.3),-1px_-1px_3px_rgba(255,255,255,0.05)]
                          transition-all duration-200 hover:translate-y-[1px]"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}