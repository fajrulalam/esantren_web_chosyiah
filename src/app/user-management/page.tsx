"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { db } from '@/firebase/config';
import { collection, getDocs, query, deleteDoc, doc } from 'firebase/firestore';

export default function UserManagementPage() {
  const { user, createNewUser } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('pengurus');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [honoraryPronoun, setHonoraryPronoun] = useState('Pak');
  const [kodeAsrama, setKodeAsrama] = useState('');
  const [namaPanggilan, setNamaPanggilan] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Redirect if user is not superAdmin
  if (user && user.role !== 'superAdmin') {
    router.push('/');
    return null;
  }
  
  // If not logged in
  if (!user) {
    router.push('/login');
    return null;
  }
  
  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'PengurusCollection'));
        const querySnapshot = await getDocs(q);
        const usersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(usersList);
      } catch (error) {
        console.error('Error fetching users:', error);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await createNewUser({
        email,
        name,
        role,
        phoneNumber,
        honoraryPronoun,
        kodeAsrama,
        namaPanggilan,
        tanggalLahir,
      });
      
      setSuccess(`User ${email} successfully created with role: ${role}`);
      
      // Reset form
      setEmail('');
      setName('');
      setRole('pengurus');
      setPhoneNumber('');
      setHonoraryPronoun('Pak');
      setKodeAsrama('');
      setNamaPanggilan('');
      setTanggalLahir('');
      
      // Refresh user list
      const q = query(collection(db, 'PengurusCollection'));
      const querySnapshot = await getDocs(q);
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete user
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'PengurusCollection', userId));
        setUsers(users.filter(user => user.id !== userId));
        setSuccess('User deleted successfully');
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">User Management</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <h3 className="text-xl font-semibold mb-4">Create New User</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                This email will be used to sign in with Google
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="role">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="pengurus">Pengurus</option>
                <option value="pengasuh">Pengasuh</option>
                <option value="superAdmin">Super Admin</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phoneNumber">
                Phone Number
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone Number (Optional)"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="honoraryPronoun">
                Honorary Pronoun <span className="text-red-500">*</span>
              </label>
              <select
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="honoraryPronoun"
                value={honoraryPronoun}
                onChange={(e) => setHonoraryPronoun(e.target.value)}
                required
              >
                <option value="Ustad">Ustad</option>
                <option value="Ustadzah">Ustadzah</option>
                <option value="Ning">Ning</option>
                <option value="Abah">Abah</option>
                <option value="Ayah">Ayah</option>
                <option value="Bapak">Bapak</option>
                <option value="Gus">Gus</option>
                <option value="Pak">Pak</option>
                <option value="Cak">Cak</option>
                <option value="Mbak">Mbak</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="kodeAsrama">
                Kode Asrama <span className="text-red-500">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="kodeAsrama"
                type="text"
                value={kodeAsrama}
                onChange={(e) => setKodeAsrama(e.target.value)}
                placeholder="Kode Asrama"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="namaPanggilan">
                Nama Panggilan <span className="text-red-500">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="namaPanggilan"
                type="text"
                value={namaPanggilan}
                onChange={(e) => setNamaPanggilan(e.target.value)}
                placeholder="Nama Panggilan"
                required
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tanggalLahir">
                Tanggal Lahir <span className="text-red-500">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="tanggalLahir"
                type="date"
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating User...' : 'Create User'}
            </button>
          </form>
        </div>
        
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <h3 className="text-xl font-semibold mb-4">Existing Users</h3>
          {loading ? (
            <p className="text-center py-4">Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 border-b text-left">Name</th>
                    <th className="py-2 px-4 border-b text-left">Email</th>
                    <th className="py-2 px-4 border-b text-left">Role</th>
                    <th className="py-2 px-4 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="py-2 px-4 border-b">{user.name}</td>
                      <td className="py-2 px-4 border-b">{user.email}</td>
                      <td className="py-2 px-4 border-b">{user.role}</td>
                      <td className="py-2 px-4 border-b text-center">
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 px-4 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              Important: Users will need to sign in with their Google account using the email address you provide here.
              Their access will be determined by the role you've assigned.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}