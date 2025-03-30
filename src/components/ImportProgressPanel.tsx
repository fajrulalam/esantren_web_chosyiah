"use client";

import { useState, useEffect } from 'react';

interface ImportProgressPanelProps {
  isActive: boolean;
  totalItems: number;
  currentItemIndex: number;
  currentItemName: string;
  successCount: number;
  errorCount: number;
  operation: 'import' | 'delete';
  onClose?: () => void;
}

export default function ImportProgressPanel({
  isActive,
  totalItems,
  currentItemIndex,
  currentItemName,
  successCount,
  errorCount,
  operation,
  onClose
}: ImportProgressPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  
  useEffect(() => {
    if (isActive) {
      setShowProgress(true);
    }
  }, [isActive]);
  
  // Auto-hide after completion with a delay
  useEffect(() => {
    const isComplete = currentItemIndex >= totalItems && totalItems > 0;
    
    if (isComplete) {
      // Hide the panel after 5 seconds of completion
      const timer = setTimeout(() => {
        setShowProgress(false);
        if (onClose) onClose();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [currentItemIndex, totalItems, onClose]);
  
  if (!isActive && !showProgress) return null;
  
  const progressPercentage = Math.round(((currentItemIndex) / totalItems) * 100);
  const isComplete = currentItemIndex >= totalItems;
  
  const operationText = operation === 'import' ? 'Import' : 'Hapus';
  const statusText = isComplete 
    ? `${operationText} selesai! ${successCount} sukses, ${errorCount} gagal.`
    : `${operationText} data... (${currentItemIndex}/${totalItems})`;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-blue-600 text-white px-4 py-2 flex justify-between items-center">
        <h3 className="text-sm font-medium truncate">
          {operationText} Data {operation === 'import' ? 'Santri' : 'Terpilih'}
        </h3>
        <div className="flex">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="ml-2 text-white hover:text-blue-100"
          >
            {isMinimized ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 8a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {isComplete && onClose && (
            <button
              onClick={() => {
                setShowProgress(false);
                onClose();
              }}
              className="ml-2 text-white hover:text-blue-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {!isMinimized && (
        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">{statusText}</span>
            <span className="text-sm text-gray-500">{progressPercentage}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          {!isComplete && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 truncate">
                Memproses: <span className="font-medium text-gray-700">{currentItemName}</span>
              </p>
            </div>
          )}
          
          {isComplete && (
            <div className="mt-3 flex justify-between">
              <div className="text-xs text-gray-500">
                <span className="font-medium text-green-600">{successCount}</span> sukses
              </div>
              {errorCount > 0 && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium text-red-600">{errorCount}</span> gagal
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}