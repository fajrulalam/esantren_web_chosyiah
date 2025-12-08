/**
 * PersonSelector component
 * Reusable dropdown for selecting people (single or multi-select)
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Person } from "@/types/kegiatan";
import { XMarkIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface PersonSelectorProps {
    label: string;
    people: Person[];
    selectedPeople: Person[];
    onSelect: (people: Person[]) => void;
    multiSelect?: boolean;
    placeholder?: string;
    disabled?: boolean;
}

export default function PersonSelector({
    label,
    people,
    selectedPeople,
    onSelect,
    multiSelect = false,
    placeholder = "Pilih...",
    disabled = false,
}: PersonSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter people based on search term
    const filteredPeople = people.filter((person) =>
        person.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Debug: Check for duplicates in the people prop
    useEffect(() => {
        const nameCount = new Map<string, number>();
        people.forEach((person) => {
            const nameLower = person.name.toLowerCase();
            nameCount.set(nameLower, (nameCount.get(nameLower) || 0) + 1);
        });
        const duplicates = Array.from(nameCount.entries()).filter(([_, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log(`[PersonSelector "${label}"] Found duplicates in people prop:`, duplicates);
        }
    }, [people, label]);

    // Handle person selection
    const handlePersonClick = (person: Person) => {
        if (multiSelect) {
            // Multi-select: toggle person in array
            const isSelected = selectedPeople.some((p) => p.uid === person.uid);
            if (isSelected) {
                onSelect(selectedPeople.filter((p) => p.uid !== person.uid));
            } else {
                onSelect([...selectedPeople, person]);
            }
        } else {
            // Single select: replace selection and close dropdown
            onSelect([person]);
            setIsOpen(false);
        }
        setSearchTerm("");
    };

    // Remove person (for multi-select chips)
    const handleRemovePerson = (uid: string) => {
        onSelect(selectedPeople.filter((p) => p.uid !== uid));
    };

    // Clear all selections
    const handleClear = () => {
        onSelect([]);
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </label>

            {/* Multi-select chips display */}
            {multiSelect && selectedPeople.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {selectedPeople.map((person) => (
                        <div
                            key={person.uid}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm"
                        >
                            <span>{person.name}</span>
                            <button
                                type="button"
                                onClick={() => handleRemovePerson(person.uid)}
                                className="hover:bg-amber-200 dark:hover:bg-amber-800/50 rounded-full p-0.5"
                                disabled={disabled}
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Dropdown container */}
            <div className="relative" ref={dropdownRef}>
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`w-full px-4 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-gray-900 dark:text-gray-100">
                            {!multiSelect && selectedPeople.length > 0
                                ? selectedPeople[0].name
                                : multiSelect && selectedPeople.length > 0
                                    ? `${selectedPeople.length} dipilih`
                                    : placeholder}
                        </span>
                        <ChevronDownIcon
                            className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "transform rotate-180" : ""
                                }`}
                        />
                    </div>
                </button>

                {/* Dropdown menu */}
                {isOpen && (
                    <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
                        {/* Search input */}
                        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                            <input
                                type="text"
                                placeholder="Cari nama..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                        </div>

                        {/* People list */}
                        <div className="overflow-y-auto max-h-48">
                            {filteredPeople.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                                    Tidak ada hasil
                                </div>
                            ) : (
                                <>
                                    {(() => {
                                        // Debug: Log what we're about to render
                                        const nameCount = new Map<string, number>();
                                        filteredPeople.forEach((person) => {
                                            const nameLower = person.name.toLowerCase();
                                            nameCount.set(nameLower, (nameCount.get(nameLower) || 0) + 1);
                                        });
                                        const duplicates = Array.from(nameCount.entries()).filter(([_, count]) => count > 1);
                                        if (duplicates.length > 0) {
                                            console.log(`[PersonSelector "${label}"] RENDERING duplicates:`, duplicates);
                                            console.log(`[PersonSelector "${label}"] Full filtered list:`, filteredPeople.map(p => `${p.name} (${p.uid})`));
                                        }
                                        return null;
                                    })()}
                                    {filteredPeople.map((person) => {
                                        const isSelected = selectedPeople.some(
                                            (p) => p.uid === person.uid
                                        );
                                        return (
                                            <button
                                                key={person.uid}
                                                type="button"
                                                onClick={() => handlePersonClick(person)}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${isSelected
                                                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300"
                                                    : "text-gray-900 dark:text-gray-100"
                                                    }`}
                                            >
                                                <span className="flex-1">{person.name}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                                    {person.role}
                                                </span>
                                                {isSelected && multiSelect && (
                                                    <svg
                                                        className="h-4 w-4 ml-2 text-amber-600 dark:text-amber-400"
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        {/* Clear button for multi-select */}
                        {multiSelect && selectedPeople.length > 0 && (
                            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="w-full px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                                >
                                    Hapus Semua
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
