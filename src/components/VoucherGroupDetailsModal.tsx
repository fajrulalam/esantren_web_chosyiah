"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  deleteDoc, 
  updateDoc, 
  writeBatch,
  increment 
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { XMarkIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import VoucherCreationModal from './VoucherCreationModal';

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

interface Voucher {
  id: string;
  voucherGroupId: string;
  voucherName: string;
  value: number;
  activeDate: any;
  expireDate: any;
  isActive: boolean;
  isClaimed: boolean;
  userId: string;
  nama: string;
  kamar: string;
  semester: string;
  createdAt: any;
}

interface VoucherGroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherGroup: VoucherGroup | null;
  onRefresh: () => void;
}

export default function VoucherGroupDetailsModal({ 
  isOpen, 
  onClose, 
  voucherGroup, 
  onRefresh 
}: VoucherGroupDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'settings'>('list');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  
  // Summary statistics
  const [totalVouchers, setTotalVouchers] = useState(0);
  const [claimedVouchers, setClaimedVouchers] = useState(0);
  const [activeVouchers, setActiveVouchers] = useState(0);
  const [expiredVouchers, setExpiredVouchers] = useState(0);

  // Fetch vouchers for this group
  const fetchVouchers = async () => {
    if (!voucherGroup) return;
    
    try {
      setLoading(true);
      const vouchersRef = collection(db, 'vouchers');
      const q = query(vouchersRef, where('voucherGroupId', '==', voucherGroup.voucherGroupId));
      const snapshot = await getDocs(q);
      
      const vouchersList: Voucher[] = [];
      snapshot.forEach((doc) => {
        vouchersList.push({
          id: doc.id,
          ...doc.data()
        } as Voucher);
      });
      
      setVouchers(vouchersList);
      
      // Calculate summary statistics
      const now = new Date();
      const claimed = vouchersList.filter(v => v.isClaimed).length;
      const expired = vouchersList.filter(v => {
        const expireDate = v.expireDate.toDate ? v.expireDate.toDate() : new Date(v.expireDate);
        return expireDate < now;
      }).length;
      const active = vouchersList.filter(v => {
        const expireDate = v.expireDate.toDate ? v.expireDate.toDate() : new Date(v.expireDate);
        return expireDate >= now && !v.isClaimed;
      }).length;
      
      setTotalVouchers(vouchersList.length);
      setClaimedVouchers(claimed);
      setExpiredVouchers(expired);
      setActiveVouchers(active);
      
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      toast.error('Failed to fetch voucher details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && voucherGroup) {
      fetchVouchers();
      setActiveTab('list'); // Reset to list tab when opening
    }
  }, [isOpen, voucherGroup]);

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

  // Get voucher status
  const getVoucherStatus = (voucher: Voucher) => {
    if (voucher.isClaimed) {
      return { status: 'CLAIMED', color: 'bg-green-100 text-green-800' };
    }
    
    const now = new Date();
    const expireDate = voucher.expireDate.toDate ? voucher.expireDate.toDate() : new Date(voucher.expireDate);
    
    if (expireDate < now) {
      return { status: 'EXPIRED', color: 'bg-red-100 text-red-800' };
    }
    
    return { status: 'ACTIVE', color: 'bg-blue-100 text-blue-800' };
  };

  // Delete individual voucher
  const handleDeleteVoucher = async (voucherId: string) => {
    try {
      await deleteDoc(doc(db, 'vouchers', voucherId));
      
      // Update total vouchers count in parent group
      await updateDoc(doc(db, 'voucherGroup', voucherGroup!.id), {
        totalVouchers: increment(-1)
      });
      
      toast.success('Voucher deleted successfully');
      fetchVouchers(); // Refresh the list
      onRefresh(); // Refresh parent list
    } catch (error) {
      console.error('Error deleting voucher:', error);
      toast.error('Failed to delete voucher');
    }
  };

  // Delete entire voucher group
  const handleDeleteGroup = async () => {
    if (!voucherGroup) return;
    
    try {
      setLoading(true);
      
      // Delete all vouchers in this group
      const batch = writeBatch(db);
      vouchers.forEach((voucher) => {
        batch.delete(doc(db, 'vouchers', voucher.id));
      });
      
      // Delete the voucher group itself
      batch.delete(doc(db, 'voucherGroup', voucherGroup.id));
      
      await batch.commit();
      
      toast.success('Voucher group deleted successfully');
      onRefresh(); // Refresh parent list
      onClose(); // Close modal
    } catch (error) {
      console.error('Error deleting voucher group:', error);
      toast.error('Failed to delete voucher group');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  // Handle add member modal close
  const handleAddMemberClose = () => {
    setShowAddMember(false);
    fetchVouchers(); // Refresh vouchers list
    onRefresh(); // Refresh parent list
  };

  // Handle edit modal close
  const handleEditModalClose = () => {
    setShowEditModal(false);
    fetchVouchers(); // Refresh vouchers list
    onRefresh(); // Refresh parent list
  };

  if (!isOpen || !voucherGroup) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gray-50">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {voucherGroup.voucherName}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Voucher Group Details
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Summary Section */}
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totalVouchers}</div>
                <div className="text-sm text-gray-600">Total Vouchers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{claimedVouchers}</div>
                <div className="text-sm text-gray-600">Claimed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{activeVouchers}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{expiredVouchers}</div>
                <div className="text-sm text-gray-600">Expired</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-700">{formatCurrency(voucherGroup.value)}</div>
                <div className="text-sm text-gray-600">Value Each</div>
              </div>
            </div>
            <div className="text-center mt-4 text-sm text-gray-600">
              Created: {formatDate(voucherGroup.createdAt)}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'list'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Voucher List
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Settings
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 300px)' }}>
            {activeTab === 'list' && (
              <div className="space-y-6">
                {/* Add Member Button */}
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Manage Members</h3>
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Tambah Anggota
                  </button>
                </div>

                {/* Voucher List Table */}
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : vouchers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No vouchers found in this group.
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Recipient
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Room
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Semester
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Value
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {vouchers.map((voucher) => {
                            const statusInfo = getVoucherStatus(voucher);
                            return (
                              <tr key={voucher.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {voucher.nama}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {voucher.kamar}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {voucher.semester}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                  {formatCurrency(voucher.value)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
                                    {statusInfo.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <button
                                    onClick={() => handleDeleteVoucher(voucher.id)}
                                    className="text-red-600 hover:text-red-900 flex items-center"
                                  >
                                    <TrashIcon className="w-4 h-4 mr-1" />
                                    Hapus
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8">
                {/* Voucher Settings Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Voucher Settings</h3>
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <PencilIcon className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Voucher Name
                        </label>
                        <div className="text-sm text-gray-900 bg-white p-3 rounded border">
                          {voucherGroup.voucherName}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Voucher Value
                        </label>
                        <div className="text-sm text-gray-900 bg-white p-3 rounded border font-semibold text-green-600">
                          {formatCurrency(voucherGroup.value)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Active Date
                        </label>
                        <div className="text-sm text-gray-900 bg-white p-3 rounded border">
                          {formatDate(voucherGroup.activeDate)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expiry Date
                        </label>
                        <div className="text-sm text-gray-900 bg-white p-3 rounded border">
                          {formatDate(voucherGroup.expireDate)}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Status
                        </label>
                        <div className="text-sm bg-white p-3 rounded border">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            voucherGroup.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {voucherGroup.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="w-6 h-6 text-red-500 mr-3 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-red-800 font-medium mb-2">Delete Voucher Group</h4>
                        <p className="text-red-700 text-sm mb-4">
                          Once you delete this voucher group, there is no going back. This action will permanently delete the voucher group and all associated vouchers.
                        </p>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                        >
                          Hapus Grup Voucher
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <VoucherCreationModal
          isOpen={showAddMember}
          onClose={handleAddMemberClose}
          editingGroup={voucherGroup}
          startFromStep2={true}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <VoucherCreationModal
          isOpen={showEditModal}
          onClose={handleEditModalClose}
          editingGroup={voucherGroup}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-500 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">Confirm Delete</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this voucher group and all its associated vouchers? 
                This action cannot be undone.
              </p>
              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteGroup}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}