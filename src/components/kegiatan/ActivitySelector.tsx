"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

interface ActivitySelectorProps {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function ActivitySelector({
    value,
    options,
    onChange,
    placeholder = "Pilih...",
    disabled = false,
}: ActivitySelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
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

    const handleSelect = (option: string) => {
        onChange(option);
        setIsOpen(false);
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 flex items-center justify-between ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                    }`}
            >
                <span className={`block truncate ${!value ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
                    {value || placeholder}
                </span>
                <ChevronDownIcon
                    className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "transform rotate-180" : ""
                        }`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-auto">
                    <div className="py-1">
                        {options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => handleSelect(option)}
                                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${value === option
                                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300"
                                    : "text-gray-900 dark:text-gray-100"
                                    }`}
                            >
                                {option}
                                {value === option && (
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
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
