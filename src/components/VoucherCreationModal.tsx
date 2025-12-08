"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  setDoc, 
  writeBatch, 
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';
import VoucherProgressModal from './VoucherProgressModal';

interface VoucherGroup {
  id: string;
  voucherGroupId: string;
  voucherName: string;
  value: number;
  activeDate: any;
  expireDate: any;
  isActive: boolean;
  totalVouchers: number;
  createdAt: any;
}

interface SantriMember {
  id: string;
  nama: string;
  kamar: string;
  semester: string;
  statusTanggungan: string;
  [key: string]: any;
}

interface VoucherCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGroup: VoucherGroup | null;
  startFromStep2?: boolean;
}

export default function VoucherCreationModal({ isOpen, onClose, editingGroup, startFromStep2 }: VoucherCreationModalProps) {
  const [currentStep, setCurrentStep] = useState<'settings' | 'recipients'>(startFromStep2 ? 'recipients' : 'settings');
  const [showProgress, setShowProgress] = useState(false);
  
  // Step 1 form data
  const [voucherName, setVoucherName] = useState('');
  const [value, setValue] = useState('');
  const [activeDate, setActiveDate] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [startActiveNow, setStartActiveNow] = useState(false);
  
  // Step 2 data
  const [santriMembers, setSantriMembers] = useState<SantriMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<SantriMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [existingVoucherUserIds, setExistingVoucherUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [kamarFilter, setKamarFilter] = useState<string[]>([]);
  const [semesterFilter, setSemesterFilter] = useState<string[]>([]);
  const [availableKamars, setAvailableKamars] = useState<string[]>([]);
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);

  // Initialize form data for editing and handle step navigation
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(startFromStep2 ? 'recipients' : 'settings');
      
      if (editingGroup) {
        setVoucherName(editingGroup.voucherName);
        setValue(editingGroup.value.toString());
        
        const activeDateTime = editingGroup.activeDate.toDate();
        const expireDateTime = editingGroup.expireDate.toDate();
        
        setActiveDate(formatDateTimeForInput(activeDateTime));
        setExpireDate(formatDateTimeForInput(expireDateTime));
      } else {
        // Reset form for new voucher
        setVoucherName('');
        setValue('');
        setActiveDate('');
        setExpireDate('');
        setStartActiveNow(false);
      }
    }
  }, [editingGroup, isOpen, startFromStep2]);

  // Format date for datetime-local input
  const formatDateTimeForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Format value with thousand separator
  const formatValueInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Handle value input change
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatValueInput(inputValue);
    setValue(formatted);
  };

  // Get numeric value from formatted string
  const getNumericValue = (formattedValue: string) => {
    return parseInt(formattedValue.replace(/\D/g, '') || '0');
  };

  // Generate unique 6-digit voucher ID
  const generateVoucherId = async (): Promise<string> => {
    const generateId = () => Math.floor(100000 + Math.random() * 900000).toString();
    
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      const id = generateId();
      try {
        const voucherDoc = doc(db, 'vouchers', id);
        const docSnap = await getDocs(query(collection(db, 'vouchers'), where('__name__', '==', id)));
        if (docSnap.empty) {
          return id;
        }
      } catch (error) {
        console.error('Error checking voucher ID uniqueness:', error);
      }
      attempts++;
    }
    
    throw new Error('Failed to generate unique voucher ID after maximum attempts');
  };

  // Fetch santri members
  const fetchSantriMembers = async () => {
    try {
      setLoading(true);
      const santriRef = collection(db, 'SantriCollection');
      const q = query(
        santriRef,
        where('kodeAsrama', '==', 'DU11_ChosyiahJadid'),
        where('statusAktif', '==', 'Aktif')
      );
      
      const snapshot = await getDocs(q);
      const members: SantriMember[] = [];
      
      snapshot.forEach((doc) => {
        members.push({
          id: doc.id,
          ...doc.data()
        } as SantriMember);
      });
      
      setSantriMembers(members);
      setFilteredMembers(members);
      
      // Extract unique values for filters
      const kamars = [...new Set(members.map(m => m.kamar))].sort();
      const semesters = [...new Set(members.map(m => m.semester))].sort();
      
      setAvailableKamars(kamars);
      setAvailableSemesters(semesters);
      
      // If editing, fetch existing vouchers for this group
      if (editingGroup) {
        const vouchersQuery = query(
          collection(db, 'vouchers'),
          where('voucherGroupId', '==', editingGroup.voucherGroupId)
        );
        const vouchersSnapshot = await getDocs(vouchersQuery);
        const existingUserIds = new Set<string>();
        
        vouchersSnapshot.forEach((doc) => {
          const data = doc.data();
          existingUserIds.add(data.userId);
        });
        
        setExistingVoucherUserIds(existingUserIds);
        setSelectedMembers(existingUserIds);
      }
      
    } catch (error) {
      console.error('Error fetching santri members:', error);
      toast.error('Failed to fetch santri members');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = santriMembers;
    
    if (kamarFilter.length > 0) {
      filtered = filtered.filter(member => 
        kamarFilter.some(filter => {
          // Check for exact match or parent-child relationship
          return member.kamar === filter || 
                 member.kamar.startsWith(filter + ' ') ||
                 filter.includes(member.kamar.split(' ')[0]);
        })
      );
    }
    
    if (semesterFilter.length > 0) {
      filtered = filtered.filter(member => semesterFilter.includes(member.semester));
    }
    
    setFilteredMembers(filtered);
  }, [santriMembers, kamarFilter, semesterFilter]);

  // Create hierarchical room structure
  const getHierarchicalKamars = () => {
    const hierarchy: { [key: string]: string[] } = {};
    
    availableKamars.forEach(kamar => {
      const baseRoom = kamar.split(' ')[0];
      if (!hierarchy[baseRoom]) {
        hierarchy[baseRoom] = [];
      }
      if (kamar !== baseRoom) {
        hierarchy[baseRoom].push(kamar);
      }
    });
    
    return hierarchy;
  };

  // Handle step navigation
  const handleNext = () => {
    if (!validateStep1()) return;
    setCurrentStep('recipients');
    fetchSantriMembers();
  };

  const handlePrevious = () => {
    setCurrentStep('settings');
  };

  // Validate step 1
  const validateStep1 = () => {
    if (!voucherName.trim()) {
      toast.error('Voucher name is required');
      return false;
    }
    
    if (!value || getNumericValue(value) <= 0) {
      toast.error('Value must be greater than 0');
      return false;
    }
    
    if (!startActiveNow && !activeDate) {
      toast.error('Active date is required');
      return false;
    }
    
    if (!expireDate) {
      toast.error('Expire date is required');
      return false;
    }
    
    const activeDateTime = startActiveNow ? new Date() : new Date(activeDate);
    const expireDateTime = new Date(expireDate);
    
    if (expireDateTime <= activeDateTime) {
      toast.error('Expire date must be after active date');
      return false;
    }
    
    return true;
  };

  // Handle member selection
  const handleMemberSelect = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const handleSelectAll = () => {
    const visibleMemberIds = new Set(filteredMembers.map(m => m.id));
    if (filteredMembers.every(m => selectedMembers.has(m.id))) {
      // Deselect all visible members
      const newSelected = new Set(selectedMembers);
      visibleMemberIds.forEach(id => newSelected.delete(id));
      setSelectedMembers(newSelected);
    } else {
      // Select all visible members
      const newSelected = new Set([...selectedMembers, ...visibleMemberIds]);
      setSelectedMembers(newSelected);
    }
  };

  // Handle voucher creation/update
  const handleSubmit = async () => {
    if (selectedMembers.size === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    setShowProgress(true);
    
    try {
      if (editingGroup) {
        await updateVoucherGroup();
      } else {
        await createVoucherGroup();
      }
      
      toast.success(editingGroup ? 'Voucher group updated successfully!' : 'Voucher group created successfully!');
      onClose();
    } catch (error) {
      console.error('Error creating/updating voucher group:', error);
      toast.error('Failed to create/update voucher group');
    } finally {
      setShowProgress(false);
    }
  };

  // Create new voucher group
  const createVoucherGroup = async () => {
    const numericValue = getNumericValue(value);
    const activeDateTime = startActiveNow ? new Date() : new Date(activeDate);
    const expireDateTime = new Date(expireDate);
    
    // Generate voucherGroupId
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timestamp = Math.floor(now.getTime() / 1000);
    const sanitizedName = voucherName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const voucherGroupId = `${dateStr}_${sanitizedName}_${timestamp}`;
    
    // Create voucher group document
    const voucherGroupDoc = doc(db, 'voucherGroup', voucherGroupId);
    await setDoc(voucherGroupDoc, {
      voucherGroupId,
      voucherName,
      value: numericValue,
      activeDate: Timestamp.fromDate(activeDateTime),
      expireDate: Timestamp.fromDate(expireDateTime),
      isActive: true,
      totalVouchers: selectedMembers.size,
      createdAt: serverTimestamp()
    });
    
    // Create individual vouchers
    await createVouchers(voucherGroupId, numericValue, activeDateTime, expireDateTime);
  };

  // Update existing voucher group
  const updateVoucherGroup = async () => {
    if (!editingGroup) return;
    
    const numericValue = getNumericValue(value);
    const activeDateTime = startActiveNow ? new Date() : new Date(activeDate);
    const expireDateTime = new Date(expireDate);
    
    // Update voucher group document
    const voucherGroupDoc = doc(db, 'voucherGroup', editingGroup.id);
    await updateDoc(voucherGroupDoc, {
      voucherName,
      value: numericValue,
      activeDate: Timestamp.fromDate(activeDateTime),
      expireDate: Timestamp.fromDate(expireDateTime),
      totalVouchers: selectedMembers.size
    });
    
    // Handle member changes
    await handleMemberChanges(editingGroup.voucherGroupId, numericValue, activeDateTime, expireDateTime);
    
    // Update existing vouchers with new settings
    await updateExistingVouchers(editingGroup.voucherGroupId, {
      voucherName,
      value: numericValue,
      activeDate: Timestamp.fromDate(activeDateTime),
      expireDate: Timestamp.fromDate(expireDateTime)
    });
  };

  // Handle member additions and removals
  const handleMemberChanges = async (voucherGroupId: string, value: number, activeDate: Date, expireDate: Date) => {
    const currentSelected = selectedMembers;
    const previousSelected = existingVoucherUserIds;
    
    // Members to add (in currentSelected but not in previousSelected)
    const toAdd = new Set([...currentSelected].filter(id => !previousSelected.has(id)));
    
    // Members to remove (in previousSelected but not in currentSelected)
    const toRemove = new Set([...previousSelected].filter(id => !currentSelected.has(id)));
    
    // Add new members
    if (toAdd.size > 0) {
      await createVouchersForUsers(Array.from(toAdd), voucherGroupId, value, activeDate, expireDate);
    }
    
    // Remove members
    if (toRemove.size > 0) {
      await removeVouchersForUsers(Array.from(toRemove), voucherGroupId);
    }
  };

  // Create vouchers for selected members
  const createVouchers = async (voucherGroupId: string, value: number, activeDate: Date, expireDate: Date) => {
    const selectedMemberIds = Array.from(selectedMembers);
    await createVouchersForUsers(selectedMemberIds, voucherGroupId, value, activeDate, expireDate);
  };

  // Create vouchers for specific users
  const createVouchersForUsers = async (userIds: string[], voucherGroupId: string, value: number, activeDate: Date, expireDate: Date) => {
    const batch = writeBatch(db);
    const batchSize = 500; // Firestore batch limit
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batchUserIds = userIds.slice(i, i + batchSize);
      const currentBatch = writeBatch(db);
      
      for (const userId of batchUserIds) {
        const member = santriMembers.find(m => m.id === userId);
        if (!member) continue;
        
        const voucherId = await generateVoucherId();
        const voucherDoc = doc(db, 'vouchers', voucherId);
        
        currentBatch.set(voucherDoc, {
          voucherGroupId,
          voucherName,
          value,
          activeDate: Timestamp.fromDate(activeDate),
          expireDate: Timestamp.fromDate(expireDate),
          isActive: true,
          isClaimed: false,
          userId: member.id,
          nama: member.nama,
          kamar: member.kamar,
          semester: member.semester,
          createdAt: serverTimestamp()
        });
      }
      
      await currentBatch.commit();
    }
  };

  // Remove vouchers for specific users
  const removeVouchersForUsers = async (userIds: string[], voucherGroupId: string) => {
    const vouchersQuery = query(
      collection(db, 'vouchers'),
      where('voucherGroupId', '==', voucherGroupId),
      where('userId', 'in', userIds)
    );
    
    const snapshot = await getDocs(vouchersQuery);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    if (!snapshot.empty) {
      await batch.commit();
    }
  };

  // Update existing vouchers with new settings
  const updateExistingVouchers = async (voucherGroupId: string, updates: any) => {
    const vouchersQuery = query(
      collection(db, 'vouchers'),
      where('voucherGroupId', '==', voucherGroupId)
    );
    
    const snapshot = await getDocs(vouchersQuery);
    const batch = writeBatch(db);
    
    snapshot.forEach((docRef) => {
      batch.update(docRef.ref, updates);
    });
    
    if (!snapshot.empty) {
      await batch.commit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingGroup ? 'Edit Voucher Group' : 'Create New Voucher'}
            </h2>
            <div className="flex items-center mt-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'settings' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'
              }`}>
                1
              </div>
              <div className="mx-2 w-12 h-0.5 bg-gray-200"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'recipients' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                2
              </div>
              <div className="ml-4 text-sm text-gray-600">
                {currentStep === 'settings' ? 'Voucher Settings' : 'Select Recipients'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {currentStep === 'settings' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voucher Name *
                </label>
                <input
                  type="text"
                  value={voucherName}
                  onChange={(e) => setVoucherName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter voucher name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Value (Rupiah) *
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={handleValueChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="50.000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Active Date *
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="startActiveNow"
                      checked={startActiveNow}
                      onChange={(e) => setStartActiveNow(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="startActiveNow" className="ml-2 text-sm text-gray-700">
                      Mulai aktif sekarang
                    </label>
                  </div>
                  {!startActiveNow && (
                    <input
                      type="datetime-local"
                      value={activeDate}
                      onChange={(e) => setActiveDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={!startActiveNow}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Date *
                </label>
                <input
                  type="datetime-local"
                  value={expireDate}
                  onChange={(e) => setExpireDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          )}

          {currentStep === 'recipients' && (
            <div className="space-y-6">
              {/* Filters */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-medium text-gray-700">Filters</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Room
                    </label>
                    <select
                      multiple
                      value={kamarFilter}
                      onChange={(e) => setKamarFilter(Array.from(e.target.selectedOptions, option => option.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      size={4}
                    >
                      {Object.entries(getHierarchicalKamars()).map(([parent, children]) => (
                        <optgroup key={parent} label={parent}>
                          <option value={parent}>{parent}</option>
                          {children.map(child => (
                            <option key={child} value={child}>{child}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Semester
                    </label>
                    <select
                      multiple
                      value={semesterFilter}
                      onChange={(e) => setSemesterFilter(Array.from(e.target.selectedOptions, option => option.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      size={4}
                    >
                      {availableSemesters.map(semester => (
                        <option key={semester} value={semester}>{semester}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Members Table */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={filteredMembers.length > 0 && filteredMembers.every(m => selectedMembers.has(m.id))}
                              onChange={handleSelectAll}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Room
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Semester
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status Tanggungan
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedMembers.has(member.id)}
                                onChange={() => handleMemberSelect(member.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {member.nama}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {member.kamar}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {member.semester}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {member.statusTanggungan}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {filteredMembers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No members found matching the current filters.
                    </div>
                  )}
                </div>
              )}

              <div className="text-sm text-gray-600">
                Selected: {selectedMembers.size} members
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="flex space-x-3">
            {currentStep === 'recipients' && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Previous
              </button>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            
            {currentStep === 'settings' ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Kirim Voucher
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      {showProgress && (
        <VoucherProgressModal
          isOpen={showProgress}
          selectedCount={selectedMembers.size}
          voucherName={voucherName}
        />
      )}
    </div>
  );
}