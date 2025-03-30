"use client";

import { Fragment, useState, useRef, useEffect, ChangeEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { SantriFormData } from '@/types/santri';
import { processCSVFile } from '@/utils/csvImport';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: SantriFormData[]) => Promise<void>;
  isImporting: boolean;
}

export default function CSVImportModal({
  isOpen,
  onClose,
  onImport,
  isImporting
}: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<SantriFormData[]>([]);
  const [validationPassed, setValidationPassed] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setErrors([]);
      setPreviewData([]);
      setValidationPassed(false);
      setDragging(false);
    }
  }, [isOpen]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      await processFile(droppedFile);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      await processFile(selectedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrors([]);
    setPreviewData([]);
    setValidationPassed(false);
    
    // Check file type (CSV or Excel)
    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      setErrors(['File harus berformat CSV atau Excel (.csv, .xlsx, .xls)']);
      return;
    }
    
    try {
      const result = await processCSVFile(selectedFile);
      
      if (!result.isValid) {
        setErrors(result.errors);
        return;
      }
      
      setPreviewData(result.data);
      setValidationPassed(true);
    } catch (error) {
      console.error("Error processing file:", error);
      setErrors(['Terjadi kesalahan saat memproses file. Silakan coba lagi.']);
    }
  };

  const handleImport = async () => {
    if (validationPassed && previewData.length > 0) {
      await onImport(previewData);
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Import Data Santri dari CSV/Excel
                </Dialog.Title>
                
                <div className="space-y-4">
                  {/* File drop area */}
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                      ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                      ${file ? 'bg-gray-50' : ''}
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={handleBrowseClick}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                    />
                    
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      
                      {file ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(2)} KB • Klik untuk mengganti file
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Drag & drop file CSV/Excel di sini
                          </p>
                          <p className="text-xs text-gray-500">
                            atau <span className="text-blue-600 font-medium">klik untuk browse</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Validation errors */}
                  {errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                      <h4 className="text-sm font-medium text-red-800 mb-2">
                        Terdapat {errors.length} kesalahan:
                      </h4>
                      <ul className="text-xs text-red-700 list-disc pl-5 space-y-1">
                        {errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Data preview when validation passes */}
                  {validationPassed && previewData.length > 0 && (
                    <div className="border border-green-200 rounded-md overflow-hidden">
                      <div className="bg-green-50 p-3 border-b border-green-200">
                        <h4 className="text-sm font-medium text-green-800">
                          Data valid! {previewData.length} santri siap diimport.
                        </h4>
                        <p className="text-xs text-green-700 mt-1">
                          Berikut adalah preview 5 data pertama:
                        </p>
                      </div>
                      
                      <div className="max-h-60 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Nama
                              </th>
                              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                No Wali Santri
                              </th>
                              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status Aktif
                              </th>
                              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tanggal Lahir
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {previewData.slice(0, 5).map((santri, index) => (
                              <tr key={index}>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {santri.nama}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {santri.nomorWalisantri}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {santri.statusAktif}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {santri.tanggalLahir}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Import instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">
                      Petunjuk import:
                    </h4>
                    <ul className="text-xs text-blue-700 list-disc pl-5 space-y-1">
                      <li>File harus dalam format CSV atau Excel (.csv, .xlsx, .xls)</li>
                      <li>Data wajib memiliki kolom: <strong>kodeAsrama, nama, statusAktif</strong></li>
                      <li>Kolom opsional: <strong>nomorWalisantri, tanggalLahir, kamar, kelas, tahunMasuk, jenjangPendidikan</strong></li>
                      <li>Kolom tambahan lainnya akan diimpor secara otomatis</li>
                      <li>
                        Contoh format: {' '}
                        <a 
                          href="#" 
                          className="text-blue-600 underline"
                          onClick={(e) => {
                            e.preventDefault();
                            // Functionality to download template would go here
                            alert('Fitur download template akan segera tersedia');
                          }}
                        >
                          Download Template
                        </a>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleImport}
                      disabled={!validationPassed || isImporting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                    >
                      {isImporting ? 'Mengimport...' : 'Import Data'}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}