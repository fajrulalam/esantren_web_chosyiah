"use client";

import { useEffect, useState } from "react";
import SearchSelect, { SearchSelectOption } from "./SearchSelect";

interface KelurahanOption extends SearchSelectOption {
  kecamatanKode: string;
}

interface KecamatanKelurahanData {
  kecamatan: SearchSelectOption[];
  kelurahan: KelurahanOption[];
}

interface AlamatCascadeSelectProps {
  onChange: (composedAddress: string) => void;
  inputClassName: string;
}

// Well-known informal province abbreviations that aren't derivable from the
// official name algorithmically (e.g. "Sumut" is a syllable contraction, not
// an acronym). Keyed by the exact `nama` string in provinsi.json.
const PROVINSI_SYNONYMS: Record<string, string[]> = {
  "Aceh": ["nad", "nanggroe aceh darussalam"],
  "Sumatera Utara": ["sumut"],
  "Sumatera Barat": ["sumbar"],
  "Sumatera Selatan": ["sumsel"],
  "Kepulauan Riau": ["kepri"],
  "Kepulauan Bangka Belitung": ["babel", "bangka belitung"],
  "Daerah Khusus Ibukota Jakarta": ["dki jakarta", "jakarta"],
  "Jawa Barat": ["jabar"],
  "Jawa Tengah": ["jateng"],
  "Daerah Istimewa Yogyakarta": [
    "yogyakarta",
    "yogya",
    "jogja",
    "jogjakarta",
  ],
  "Jawa Timur": ["jatim"],
  "Kalimantan Barat": ["kalbar"],
  "Kalimantan Tengah": ["kalteng"],
  "Kalimantan Selatan": ["kalsel"],
  "Kalimantan Timur": ["kaltim"],
  "Kalimantan Utara": ["kaltara"],
  "Sulawesi Utara": ["sulut"],
  "Sulawesi Tengah": ["sulteng"],
  "Sulawesi Selatan": ["sulsel"],
  "Sulawesi Tenggara": ["sultra"],
  "Sulawesi Barat": ["sulbar"],
  "Maluku Utara": ["malut"],
};

export default function AlamatCascadeSelect({
  onChange,
  inputClassName,
}: AlamatCascadeSelectProps) {
  const [provinsiList, setProvinsiList] = useState<SearchSelectOption[]>([]);
  const [kabupatenList, setKabupatenList] = useState<SearchSelectOption[]>([]);
  const [kecKelData, setKecKelData] = useState<KecamatanKelurahanData>({
    kecamatan: [],
    kelurahan: [],
  });

  const [provinsiKode, setProvinsiKode] = useState("");
  const [kabupatenKode, setKabupatenKode] = useState("");
  const [kecamatanKode, setKecamatanKode] = useState("");
  const [kelurahanKode, setKelurahanKode] = useState("");

  const [loadingKabupaten, setLoadingKabupaten] = useState(false);
  const [loadingKecKel, setLoadingKecKel] = useState(false);

  useEffect(() => {
    fetch("/data/wilayah/provinsi.json")
      .then((res) => res.json())
      .then(setProvinsiList)
      .catch((err) => console.error("Gagal memuat data provinsi:", err));
  }, []);

  useEffect(() => {
    if (!provinsiKode) {
      setKabupatenList([]);
      return;
    }
    setLoadingKabupaten(true);
    fetch(`/data/wilayah/kabupaten/${provinsiKode}.json`)
      .then((res) => res.json())
      .then(setKabupatenList)
      .catch((err) => console.error("Gagal memuat data kabupaten:", err))
      .finally(() => setLoadingKabupaten(false));
  }, [provinsiKode]);

  useEffect(() => {
    if (!kabupatenKode) {
      setKecKelData({ kecamatan: [], kelurahan: [] });
      return;
    }
    setLoadingKecKel(true);
    fetch(`/data/wilayah/kecamatan-kelurahan/${kabupatenKode}.json`)
      .then((res) => res.json())
      .then(setKecKelData)
      .catch((err) => console.error("Gagal memuat data kecamatan/kelurahan:", err))
      .finally(() => setLoadingKecKel(false));
  }, [kabupatenKode]);

  const kelurahanOptions = kecKelData.kelurahan.filter(
    (k) => k.kecamatanKode === kecamatanKode
  );

  const findNama = (list: SearchSelectOption[], kode: string) =>
    list.find((o) => o.kode === kode)?.nama ?? "";

  useEffect(() => {
    const provinsiNama = findNama(provinsiList, provinsiKode);
    const kabupatenNama = findNama(kabupatenList, kabupatenKode);
    const kecamatanNama = findNama(kecKelData.kecamatan, kecamatanKode);
    const kelurahanNama = findNama(kecKelData.kelurahan, kelurahanKode);

    const parts = [
      kelurahanNama && `Kel./Ds. ${kelurahanNama}`,
      kecamatanNama && `Kec. ${kecamatanNama}`,
      kabupatenNama,
      provinsiNama,
    ].filter(Boolean);

    onChange(parts.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinsiKode, kabupatenKode, kecamatanKode, kelurahanKode, provinsiList, kabupatenList, kecKelData]);

  const composedPreview = [
    findNama(kecKelData.kelurahan, kelurahanKode) &&
      `Kel./Ds. ${findNama(kecKelData.kelurahan, kelurahanKode)}`,
    findNama(kecKelData.kecamatan, kecamatanKode) &&
      `Kec. ${findNama(kecKelData.kecamatan, kecamatanKode)}`,
    findNama(kabupatenList, kabupatenKode),
    findNama(provinsiList, provinsiKode),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            Provinsi
          </label>
          <SearchSelect
            options={provinsiList}
            value={provinsiKode}
            onChange={(kode) => {
              setProvinsiKode(kode);
              setKabupatenKode("");
              setKecamatanKode("");
              setKelurahanKode("");
            }}
            inputClassName={inputClassName}
            placeholder="Cari provinsi... (mis. NTT, DKI Jakarta, Jabar)"
            synonyms={PROVINSI_SYNONYMS}
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            Kabupaten/Kota
          </label>
          <SearchSelect
            options={kabupatenList}
            value={kabupatenKode}
            onChange={(kode) => {
              setKabupatenKode(kode);
              setKecamatanKode("");
              setKelurahanKode("");
            }}
            inputClassName={inputClassName}
            placeholder="Cari kabupaten/kota..."
            disabledPlaceholder="Pilih provinsi dahulu"
            disabled={!provinsiKode}
            isLoading={loadingKabupaten}
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            Kecamatan
          </label>
          <SearchSelect
            options={kecKelData.kecamatan}
            value={kecamatanKode}
            onChange={(kode) => {
              setKecamatanKode(kode);
              setKelurahanKode("");
            }}
            inputClassName={inputClassName}
            placeholder="Cari kecamatan..."
            disabledPlaceholder="Pilih kabupaten/kota dahulu"
            disabled={!kabupatenKode}
            isLoading={loadingKecKel}
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            Kelurahan/Desa
          </label>
          <SearchSelect
            options={kelurahanOptions}
            value={kelurahanKode}
            onChange={(kode) => setKelurahanKode(kode)}
            inputClassName={inputClassName}
            placeholder="Cari kelurahan/desa..."
            disabledPlaceholder="Pilih kecamatan dahulu"
            disabled={!kecamatanKode}
          />
        </div>
      </div>

      {composedPreview && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Alamat lengkap: {composedPreview}
        </p>
      )}
    </div>
  );
}
