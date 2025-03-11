"use client";

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { KODE_ASRAMA } from '@/constants';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

interface TagihanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TagihanModal({
  isOpen,
  onClose,
  onSuccess
}: TagihanModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    paymentName: '',
    nominal: '',
    description: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Format today's date for the invoice ID
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      const timestamp = Date.now(); // Current timestamp in milliseconds
      
      // Create a human-readable invoice ID
      const invoiceId = `${formattedDate}_${formData.paymentName.replace(/\s+/g, '_')}_${timestamp}`;
      
      // Create the invoice with a custom ID
      const invoiceDocRef = doc(db, 'Invoices', invoiceId);
      
      await setDoc(invoiceDocRef, {
        paymentName: formData.paymentName,
        nominal: parseFloat(formData.nominal),
        description: formData.description,
        kodeAsrama: KODE_ASRAMA,
        timestamp: serverTimestamp(),
        numberOfPaid: 0,
        numberOfWaitingVerification: 0,
        numberOfSantriInvoiced: 0,
        createdAt: serverTimestamp()
      });

      onSuccess();
      onClose();
      // Reset form
      setFormData({
        paymentName: '',
        nominal: '',
        description: ''
      });
    } catch (error) {
      console.error("Error creating tagihan:", error);
      alert("Gagal membuat tagihan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Buat Tagihan Baru
                </Dialog.Title>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="paymentName" className="block text-sm font-medium text-gray-700">
                      Nama Pembayaran
                    </label>
                    <input
                      type="text"
                      id="paymentName"
                      name="paymentName"
                      value={formData.paymentName}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="SPP Bulan Januari 2023"
                    />
                  </div>

                  <div>
                    <label htmlFor="nominal" className="block text-sm font-medium text-gray-700">
                      Nominal (Rp)
                    </label>
                    <input
                      type="number"
                      id="nominal"
                      name="nominal"
                      value={formData.nominal}
                      onChange={handleChange}
                      required
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="450000"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Deskripsi (opsional)
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Deskripsi tambahan tentang tagihan ini"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                    >
                      {isSubmitting ? 'Menyimpan...' : 'Buat Tagihan'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}