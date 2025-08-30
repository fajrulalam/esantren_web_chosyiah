"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface VoucherProgressModalProps {
  isOpen: boolean;
  selectedCount: number;
  voucherName: string;
}

export default function VoucherProgressModal({ 
  isOpen, 
  selectedCount, 
  voucherName 
}: VoucherProgressModalProps) {
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (!isOpen) {
      setCurrentProgress(0);
      setIsComplete(false);
      return;
    }

    // Simulate progress
    const interval = setInterval(() => {
      setCurrentProgress(prev => {
        if (prev >= selectedCount) {
          setIsComplete(true);
          clearInterval(interval);
          return selectedCount;
        }
        
        // Simulate batch processing - increment by random amount
        const increment = Math.min(
          Math.floor(Math.random() * 5) + 1, // 1-5 vouchers at a time
          selectedCount - prev
        );
        
        return prev + increment;
      });
    }, 200); // Update every 200ms

    return () => clearInterval(interval);
  }, [isOpen, selectedCount]);

  const progressPercentage = selectedCount > 0 ? Math.round((currentProgress / selectedCount) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center w-16 h-16 mb-6">
            {isComplete ? (
              <CheckCircleIcon className="w-16 h-16 text-green-500" />
            ) : (
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            )}
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {isComplete ? 'Vouchers Created Successfully!' : 'Creating Vouchers...'}
          </h3>
          
          {/* Voucher Name */}
          <p className="text-sm text-gray-600 mb-6">
            {voucherName}
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className={`h-3 rounded-full transition-all duration-300 ease-out ${
                isComplete ? 'bg-green-500' : 'bg-blue-600'
              }`}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>

          {/* Progress Stats */}
          <div className="space-y-2">
            <div className="text-2xl font-bold text-gray-900">
              {progressPercentage}%
            </div>
            
            <div className="text-sm text-gray-600">
              <span className="font-medium">{currentProgress}</span>
              <span className="mx-1">/</span>
              <span className="font-medium">{selectedCount}</span>
              <span className="ml-1">vouchers {isComplete ? 'created' : 'creating...'}</span>
            </div>
          </div>

          {/* Status Messages */}
          {!isComplete && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">
                  Processing voucher creation...
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Please do not close this window
              </p>
            </div>
          )}

          {isComplete && (
            <div className="mt-6">
              <div className="flex items-center justify-center space-x-2 text-green-600 mb-2">
                <CheckCircleIcon className="w-5 h-5" />
                <span className="text-sm font-medium">
                  All vouchers have been created successfully!
                </span>
              </div>
              <p className="text-xs text-gray-500">
                You can now close this window
              </p>
            </div>
          )}

          {/* Progress Details */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-left">
                <div className="text-gray-500">Status:</div>
                <div className="font-medium text-gray-900">
                  {isComplete ? 'Completed' : 'In Progress'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-500">Remaining:</div>
                <div className="font-medium text-gray-900">
                  {selectedCount - currentProgress}
                </div>
              </div>
            </div>
          </div>

          {/* Retry Button (if needed) */}
          {isComplete && (
            <div className="mt-6">
              <div className="text-xs text-gray-500 mb-4">
                If some vouchers failed to create, you can edit the voucher group to retry.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}