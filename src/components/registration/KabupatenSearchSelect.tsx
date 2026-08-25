"use client";

import { useEffect, useState } from "react";
import SearchSelect, { SearchSelectOption } from "./SearchSelect";

interface KabupatenSearchSelectProps {
  value: string; // stored as nama, e.g. "Kabupaten Jombang"
  onChange: (nama: string) => void;
  inputClassName: string;
  placeholder?: string;
}

export default function KabupatenSearchSelect({
  value,
  onChange,
  inputClassName,
  placeholder = "Cari kabupaten/kota...",
}: KabupatenSearchSelectProps) {
  const [options, setOptions] = useState<SearchSelectOption[]>([]);

  useEffect(() => {
    fetch("/data/wilayah/kabupaten-all.json")
      .then((res) => res.json())
      .then((data) =>
        setOptions(
          data.map((o: { kode: string; nama: string; provinsiNama: string }) => ({
            kode: o.kode,
            nama: o.nama,
            subtitle: o.provinsiNama,
          }))
        )
      )
      .catch((err) => console.error("Gagal memuat data kabupaten:", err));
  }, []);

  const selectedKode = options.find((o) => o.nama === value)?.kode ?? "";

  return (
    <SearchSelect
      options={options}
      value={selectedKode}
      onChange={(_, nama) => onChange(nama)}
      inputClassName={inputClassName}
      placeholder={placeholder}
    />
  );
}
