'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, query, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { AttendanceType } from '@/types/attendance';

export default function AttendanceTypesPage() {
  const router = useRouter();
  const [types, setTypes] = useState<AttendanceType[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [isFrequent, setIsFrequent] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load attendance types
  useEffect(() => {
    const loadTypes = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "AttendanceTypes"));
        const snapshot = await getDocs(q);
        const typeData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as AttendanceType));

        setTypes(typeData);
      } catch (error) {
        console.error("Error loading attendance types:", error);
        setError("Gagal memuat jenis presensi. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };

    loadTypes();
  }, []);

  // Add new attendance type
  const handleAddType = async () => {
    if (!newTypeName.trim()) return;

    setIsAdding(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not authenticated");
      }

      const newType = {
        name: newTypeName.trim(),
        description: newTypeDescription.trim() || null,
        isFrequent,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, "AttendanceTypes"), newType);

      // Reset form and reload types
      setNewTypeName('');
      setNewTypeDescription('');
      setIsFrequent(true);

      // Reload types
      const q = query(collection(db, "AttendanceTypes"));
      const snapshot = await getDocs(q);
      const typeData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AttendanceType));

      setTypes(typeData);
    } catch (error) {
      console.error("Error adding attendance type:", error);
      setError("Gagal menambahkan jenis presensi. Silakan coba lagi.");
    } finally {
      setIsAdding(false);
    }
  };

  // Delete attendance type
  const handleDeleteType = async (id: string) => {
    const confirmDelete = window.confirm("Apakah Anda yakin ingin menghapus jenis presensi ini?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "AttendanceTypes", id));

      // Update local state
      setTypes(types.filter(type => type.id !== id));
    } catch (error) {
      console.error("Error deleting attendance type:", error);
      setError("Gagal menghapus jenis presensi. Silakan coba lagi.");
    }
  };

  return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Jenis Sesi Presensi</h1>
            <button
                onClick={() => router.push('/attendance')}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Kembali
            </button>
          </div>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded-lg">
              {error}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add new type form */}
          <div className="md:col-span-1">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">Tambah Jenis Baru</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Nama</label>
                <input
                    type="text"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="Contoh: Subuh, Maghrib, Ro'an"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Deskripsi (Opsional)</label>
                <textarea
                    value={newTypeDescription}
                    onChange={(e) => setNewTypeDescription(e.target.value)}
                    placeholder="Deskripsi singkat"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                />
              </div>

              <div className="mb-4">
                <label className="flex items-center">
                  <input
                      type="checkbox"
                      checked={isFrequent}
                      onChange={(e) => setIsFrequent(e.target.checked)}
                      className="mr-2"
                  />
                  <span>Sering Digunakan</span>
                </label>
              </div>

              <button
                  onClick={handleAddType}
                  disabled={isAdding || !newTypeName.trim()}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>

          {/* List of types */}
          <div className="md:col-span-2">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">Jenis Presensi yang Ada</h2>

              {loading ? (
                  <div className="py-8 text-center">
                    <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-2">Memuat jenis presensi...</p>
                  </div>
              ) : types.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    <p>Belum ada jenis presensi yang ditambahkan.</p>
                  </div>
              ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {types.map(type => (
                        <div key={type.id} className="py-4 flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{type.name}</h3>
                            {type.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{type.description}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                              {type.isFrequent && (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Sering Digunakan
                          </span>
                              )}
                            </div>
                          </div>
                          <button
                              onClick={() => handleDeleteType(type.id)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Hapus
                          </button>
                        </div>
                    ))}
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}