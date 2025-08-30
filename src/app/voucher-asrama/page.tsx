"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { db } from '@/firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import VoucherCreationModal from '@/components/VoucherCreationModal';
import VoucherGroupDetailsModal from '@/components/VoucherGroupDetailsModal';

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

export default function VoucherAsramaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [voucherGroups, setVoucherGroups] = useState<VoucherGroup[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VoucherGroup | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<VoucherGroup | null>(null);

  // Access control check
  useEffect(() => {
    if (!loading && (!user || user.role !== 'superAdmin')) {
      toast.error('Access denied. Only Super Admin can access this page.');
      router.push('/');
      return;
    }
  }, [user, loading, router]);

  // Fetch voucher groups
  const fetchVoucherGroups = async () => {
    try {
      setLoadingData(true);
      const voucherGroupsRef = collection(db, 'voucherGroup');
      const q = query(voucherGroupsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const groups: VoucherGroup[] = [];
      snapshot.forEach((doc) => {
        groups.push({
          id: doc.id,
          ...doc.data()
        } as VoucherGroup);
      });
      
      setVoucherGroups(groups);
    } catch (error) {
      console.error('Error fetching voucher groups:', error);
      toast.error('Failed to fetch voucher groups');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'superAdmin') {
      fetchVoucherGroups();
    }
  }, [user]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).format(date);
  };

  // Handle create new voucher
  const handleCreateVoucher = () => {
    setEditingGroup(null);
    setShowModal(true);
  };

  // Handle edit voucher group - now opens details modal
  const handleEditVoucherGroup = (group: VoucherGroup) => {
    setSelectedGroup(group);
    setShowDetailsModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowModal(false);
    setEditingGroup(null);
    fetchVoucherGroups(); // Refresh data
  };

  // Handle details modal close
  const handleDetailsModalClose = () => {
    setShowDetailsModal(false);
    setSelectedGroup(null);
    fetchVoucherGroups(); // Refresh data
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role !== 'superAdmin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only Super Admin can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voucher Asrama</h1>
          <p className="text-gray-600 mt-2">Manage voucher groups for dormitory members</p>
        </div>
        <button
          onClick={handleCreateVoucher}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-200"
        >
          Buat Voucher
        </button>
      </div>

      {/* Voucher Groups List */}
      {loadingData ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : voucherGroups.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📱</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Voucher Groups</h3>
          <p className="text-gray-600 mb-6">Create your first voucher group to get started.</p>
          <button
            onClick={handleCreateVoucher}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Buat Voucher
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Voucher Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expire Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipients
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {voucherGroups.map((group) => (
                  <tr
                    key={group.id}
                    onClick={() => handleEditVoucherGroup(group)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {group.voucherName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(group.value)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(group.activeDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(group.expireDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {group.totalVouchers} recipients
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        group.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {group.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Voucher Creation/Edit Modal */}
      {showModal && (
        <VoucherCreationModal
          isOpen={showModal}
          onClose={handleModalClose}
          editingGroup={editingGroup}
        />
      )}

      {/* Voucher Group Details Modal */}
      {showDetailsModal && (
        <VoucherGroupDetailsModal
          isOpen={showDetailsModal}
          onClose={handleDetailsModalClose}
          voucherGroup={selectedGroup}
          onRefresh={fetchVoucherGroups}
        />
      )}
    </div>
  );
}