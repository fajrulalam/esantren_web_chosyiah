"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchSelectOption {
  kode: string;
  nama: string;
  subtitle?: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string; // selected kode, "" if none selected
  onChange: (kode: string, nama: string) => void;
  id?: string;
  inputClassName: string;
  placeholder?: string;
  disabledPlaceholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  maxResults?: number;
  // Known informal abbreviations that can't be derived from the name itself
  // (e.g. "Sumut" for "Sumatera Utara"), keyed by the option's exact `nama`.
  synonyms?: Record<string, string[]>;
  // Leading words nobody actually abbreviates from — stripped before
  // computing an acronym so "Kabupaten Aceh Barat" acronyms as "AB", not
  // "KAB", and "S1 Sistem Informasi" acronyms as "SI", not "SSI".
  acronymIgnoreWords?: string[];
}

const DEFAULT_ACRONYM_IGNORE_WORDS = ["Kabupaten", "Kota"];

function acronymWords(nama: string, ignoreWords: string[]): string[] {
  const prefixRe = new RegExp(`^(${ignoreWords.join("|")})\\s+`, "i");
  return nama.replace(prefixRe, "").split(/\s+/).filter(Boolean);
}

function acronymOf(nama: string, ignoreWords: string[]): string {
  return acronymWords(nama, ignoreWords)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Higher score = better match. 0 = no match, filtered out.
function scoreOption(
  option: SearchSelectOption,
  query: string,
  synonyms: string[] | undefined,
  acronymIgnoreWords: string[]
): number {
  const q = query.trim();
  if (!q) return 1;

  const qLower = q.toLowerCase();
  const qUpper = q.toUpperCase();
  const namaLower = option.nama.toLowerCase();

  if (namaLower === qLower) return 100;

  const acronym = acronymOf(option.nama, acronymIgnoreWords);
  if (acronym === qUpper) return 90; // e.g. "NTT" === acronym of "Nusa Tenggara Timur"

  if (namaLower.startsWith(qLower)) return 80;

  // "DKI Jakarta"-style: leading word(s) as an acronym, remaining word(s) literal.
  const qTokens = q.split(/\s+/).filter(Boolean);
  if (qTokens.length > 1) {
    const firstToken = qTokens[0].toUpperCase();
    if (firstToken.length >= 2 && acronym.startsWith(firstToken)) {
      const words = acronymWords(option.nama, acronymIgnoreWords);
      const remainingWords = words.slice(firstToken.length).join(" ").toLowerCase();
      const remainingQuery = qTokens.slice(1).join(" ").toLowerCase();
      if (remainingWords.startsWith(remainingQuery)) return 75;
    }
  }

  if (qUpper.length >= 2 && acronym.startsWith(qUpper)) return 60; // partial acronym, e.g. typing "NT" toward "NTT"

  if (synonyms?.some((s) => s.toLowerCase() === qLower)) return 55;
  if (synonyms?.some((s) => s.toLowerCase().includes(qLower))) return 50;

  if (namaLower.includes(qLower)) return 40;
  if (option.subtitle?.toLowerCase().includes(qLower)) return 30;

  return 0;
}

export default function SearchSelect({
  options,
  value,
  onChange,
  id,
  inputClassName,
  placeholder = "Cari...",
  disabledPlaceholder,
  disabled = false,
  isLoading = false,
  maxResults = 100,
  synonyms,
  acronymIgnoreWords = DEFAULT_ACRONYM_IGNORE_WORDS,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedNama = options.find((o) => o.kode === value)?.nama ?? "";

  const filtered = useMemo(() => {
    return options
      .map((option) => ({
        option,
        score: scoreOption(
          option,
          searchTerm,
          synonyms?.[option.nama],
          acronymIgnoreWords
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.option.nama.localeCompare(b.option.nama)
      )
      .slice(0, maxResults)
      .map((entry) => entry.option);
  }, [options, searchTerm, synonyms, maxResults, acronymIgnoreWords]);

  const effectivePlaceholder = isLoading
    ? "Memuat..."
    : disabled
    ? disabledPlaceholder ?? placeholder
    : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        className={inputClassName}
        value={isOpen ? searchTerm : selectedNama}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => {
          setIsOpen(true);
          setSearchTerm("");
        }}
        placeholder={effectivePlaceholder}
        autoComplete="off"
        disabled={disabled || isLoading}
      />
      {isOpen && (
        <div className="absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-xl bg-white dark:bg-gray-700 border-2 border-amber-200 dark:border-gray-600 shadow-lg">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-amber-500 dark:text-gray-400">
              Tidak ditemukan
            </p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.kode}
                type="button"
                onClick={() => {
                  onChange(option.kode, option.nama);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                className="block w-full text-left px-4 py-2.5 hover:bg-amber-100 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="text-amber-900 dark:text-gray-100">
                  {option.nama}
                </span>
                {option.subtitle && (
                  <span className="block text-xs text-amber-500 dark:text-gray-400">
                    {option.subtitle}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
