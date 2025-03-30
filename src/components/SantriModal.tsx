"use client";

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Santri, SantriFormData } from '@/types/santri';
import SantriForm from './SantriForm';

interface SantriModalProps {
  isOpen: boolean;
  onClose: () => void;
  santri?: Santri;
  onSubmit: (data: SantriFormData) => Promise<void>;
  onDelete?: (santri: Santri) => Promise<void>;
  isSubmitting: boolean;
  title: string;
}

export default function SantriModal({
  isOpen,
  onClose,
  santri,
  onSubmit,
  onDelete,
  isSubmitting,
  title
}: SantriModalProps) {
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4"
                >
                  {title}
                </Dialog.Title>
                
                <SantriForm
                  santri={santri}
                  onSubmit={onSubmit}
                  onCancel={onClose}
                  isSubmitting={isSubmitting}
                  onDelete={onDelete}
                />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}