"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { toast } from "react-hot-toast";
import {
  ALL_ROOM_IDS,
  DORM_BLOCKS,
  KODE_ASRAMA,
  ROOM_CAPACITY,
  ROOM_LETTERS,
  VALID_ROOM_IDS,
  FloorLevel,
} from "@/constants";
import { useAuth } from "@/firebase/auth";
import { db } from "@/firebase/config";
import { Santri } from "@/types/santri";

function normalizeRoom(value?: string | null) {
  const match = (value ?? "")
    .trim()
    .toUpperCase()
    .match(/^(\d{3})\s*[-/_]?\s*([A-D])$/);

  if (!match) return null;

  const roomId = `${match[1]} ${match[2]}`;
  return VALID_ROOM_IDS.has(roomId) ? roomId : null;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

interface RoomCardProps {
  roomId: string;
  occupants: Santri[];
  onManage: () => void;
}

function RoomCard({ roomId, occupants, onManage }: RoomCardProps) {
  const roomLetter = roomId.split(" ")[1];
  const emptySlots = Math.max(ROOM_CAPACITY - occupants.length, 0);
  const isOverCapacity = occupants.length > ROOM_CAPACITY;

  return (
    <article
      className={`rounded-2xl border bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-800 ${
        isOverCapacity
          ? "border-red-300 dark:border-red-800"
          : occupants.length === ROOM_CAPACITY
          ? "border-emerald-200 dark:border-emerald-900"
          : "border-slate-200 dark:border-gray-700"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-gray-500">
            Kamar
          </p>
          <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">
            {roomLetter}
          </h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            isOverCapacity
              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
              : occupants.length === ROOM_CAPACITY
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
          }`}
        >
          {occupants.length}/{ROOM_CAPACITY}
        </span>
      </div>

      <div className="space-y-2">
        {occupants.map((santri) => (
          <div
            key={santri.id}
            className="flex min-h-14 items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-gray-900/70"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-extrabold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
              {getInitials(santri.nama)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-800 dark:text-gray-100" title={santri.nama}>
                {santri.nama}
              </span>
              <span className="block truncate text-[11px] text-slate-500 dark:text-gray-400">
                {santri.jenjangPendidikan || "Jenjang belum diisi"}
              </span>
            </span>
          </div>
        ))}

        {Array.from({ length: emptySlots }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="flex min-h-14 items-center gap-2.5 rounded-xl border border-dashed border-slate-300 px-2.5 py-2 text-slate-400 dark:border-gray-600 dark:text-gray-500"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-current">
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold">Tempat tidur tersedia</span>
          </div>
        ))}
      </div>

      {isOverCapacity && (
        <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
          Kamar melebihi kapasitas.
        </p>
      )}

      <button
        type="button"
        onClick={onManage}
        className="mt-3 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70 dark:focus:ring-offset-gray-800"
        aria-label={`Atur penghuni kamar ${roomId}`}
      >
        Atur penghuni
      </button>
    </article>
  );
}

interface AssignmentDialogProps {
  roomId: string;
  occupants: Santri[];
  santris: Santri[];
  savingSantriId: string | null;
  onAssign: (santri: Santri) => Promise<void>;
  onRemove: (santri: Santri) => Promise<void>;
  onClose: () => void;
}

function AssignmentDialog({
  roomId,
  occupants,
  santris,
  savingSantriId,
  onAssign,
  onRemove,
  onClose,
}: AssignmentDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const isFull = occupants.length >= ROOM_CAPACITY;
  const occupantIds = useMemo(
    () => new Set(occupants.map((santri) => santri.id)),
    [occupants]
  );

  const candidates = useMemo(() => {
    const search = searchQuery.trim().toLocaleLowerCase("id-ID");

    return santris
      .filter((santri) => !occupantIds.has(santri.id))
      .filter((santri) => santri.nama.toLocaleLowerCase("id-ID").includes(search))
      .sort((a, b) => {
        const roomA = normalizeRoom(a.kamar);
        const roomB = normalizeRoom(b.kamar);

        if (roomA === null && roomB !== null) return -1;
        if (roomA !== null && roomB === null) return 1;
        return a.nama.localeCompare(b.nama, "id-ID");
      });
  }, [occupantIds, santris, searchQuery]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Tutup pengaturan kamar"
      />

      <section className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-800 sm:rounded-3xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-gray-700 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
              Atur penghuni
            </p>
            <h2
              id="assignment-dialog-title"
              className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white"
            >
              Kamar {roomId}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
              {occupants.length} dari {ROOM_CAPACITY} tempat tidur terisi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Tutup"
          >
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-gray-100">
              Penghuni saat ini
            </h3>
            <div className="mt-3 space-y-2">
              {occupants.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-gray-600 dark:text-gray-400">
                  Kamar ini masih kosong.
                </div>
              ) : (
                occupants.map((santri) => (
                  <div
                    key={santri.id}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-gray-900/70"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-extrabold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                      {getInitials(santri.nama)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-gray-100">
                        {santri.nama}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-gray-400">
                        {santri.jenjangPendidikan || "Jenjang belum diisi"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(santri)}
                      disabled={savingSantriId !== null}
                      className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      {savingSantriId === santri.id ? "Menyimpan..." : "Keluarkan"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-gray-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-gray-100">
                  Pilih santri
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                  Santri yang sudah memiliki kamar akan dipindahkan ke kamar ini.
                </p>
              </div>
              <label className="relative block sm:w-64">
                <span className="sr-only">Cari nama santri</span>
                <MagnifyingGlassIcon
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari nama santri..."
                  className="w-full rounded-xl border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 focus:border-amber-500 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </label>
            </div>

            {isFull && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Kamar sudah penuh. Keluarkan salah satu penghuni sebelum menambahkan santri lain.
              </p>
            )}

            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {candidates.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-gray-900/70 dark:text-gray-400">
                  Tidak ada santri yang cocok dengan pencarian.
                </p>
              ) : (
                candidates.map((santri) => {
                  const currentRoom = normalizeRoom(santri.kamar);
                  const isSaving = savingSantriId === santri.id;

                  return (
                    <div
                      key={santri.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-gray-700"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                        {getInitials(santri.nama)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900 dark:text-gray-100">
                          {santri.nama}
                        </span>
                        <span
                          className={`block text-xs ${
                            currentRoom
                              ? "text-slate-500 dark:text-gray-400"
                              : "font-semibold text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {currentRoom ? `Saat ini: ${currentRoom}` : "Belum ditempatkan"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onAssign(santri)}
                        disabled={isFull || savingSantriId !== null}
                        className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-gray-600"
                      >
                        {isSaving ? "Menyimpan..." : currentRoom ? "Pindahkan" : "Tempatkan"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function DenahKamarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [santris, setSantris] = useState<Santri[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<FloorLevel>(1);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [savingSantriId, setSavingSantriId] = useState<string | null>(null);
  const [layoutSearch, setLayoutSearch] = useState("");

  const fetchSantris = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const santriQuery = query(
        collection(db, "SantriCollection"),
        where("kodeAsrama", "==", KODE_ASRAMA)
      );
      const snapshot = await getDocs(santriQuery);
      const data = snapshot.docs.map((santriDoc) => ({
        id: santriDoc.id,
        ...santriDoc.data(),
      })) as Santri[];

      setSantris(data);
    } catch (error) {
      console.error("Error fetching santri for room layout:", error);
      setLoadError("Data penghuni belum dapat dimuat. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role === "waliSantri") {
      router.replace("/payment-history");
      return;
    }

    setIsAuthorized(true);
    void fetchSantris();
  }, [authLoading, fetchSantris, router, user]);

  useEffect(() => {
    if (!selectedRoomId) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && savingSantriId === null) {
        setSelectedRoomId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [savingSantriId, selectedRoomId]);

  const activeSantris = useMemo(
    () =>
      santris
        .filter((santri) => santri.statusAktif === "Aktif")
        .sort((a, b) => a.nama.localeCompare(b.nama, "id-ID")),
    [santris]
  );

  const occupantsByRoom = useMemo(() => {
    const roomMap: Record<string, Santri[]> = Object.fromEntries(
      ALL_ROOM_IDS.map((roomId) => [roomId, []])
    );

    activeSantris.forEach((santri) => {
      const roomId = normalizeRoom(santri.kamar);
      if (roomId) roomMap[roomId].push(santri);
    });

    Object.values(roomMap).forEach((occupants) =>
      occupants.sort((a, b) => a.nama.localeCompare(b.nama, "id-ID"))
    );

    return roomMap;
  }, [activeSantris]);

  const unassignedSantris = useMemo(
    () => activeSantris.filter((santri) => normalizeRoom(santri.kamar) === null),
    [activeSantris]
  );

  const assignedCount = activeSantris.length - unassignedSantris.length;
  const availableBeds = ALL_ROOM_IDS.reduce(
    (total, roomId) =>
      total + Math.max(ROOM_CAPACITY - occupantsByRoom[roomId].length, 0),
    0
  );
  const overCapacityRooms = ALL_ROOM_IDS.filter(
    (roomId) => occupantsByRoom[roomId].length > ROOM_CAPACITY
  ).length;

  const floorBlocks = DORM_BLOCKS.filter((block) => block.floor === selectedFloor);
  const normalizedLayoutSearch = layoutSearch.trim().toLocaleLowerCase("id-ID");
  const visibleBlocks = floorBlocks
    .map((block) => {
      const roomIds = ROOM_LETTERS.map((letter) => `${block.id} ${letter}`).filter(
        (roomId) =>
          normalizedLayoutSearch === "" ||
          roomId.toLocaleLowerCase("id-ID").includes(normalizedLayoutSearch) ||
          occupantsByRoom[roomId].some((santri) =>
            santri.nama.toLocaleLowerCase("id-ID").includes(normalizedLayoutSearch)
          )
      );

      return { ...block, roomIds };
    })
    .filter((block) => block.roomIds.length > 0);

  const floorResidentCount = floorBlocks.reduce(
    (total, block) =>
      total +
      ROOM_LETTERS.reduce(
        (roomTotal, letter) => roomTotal + occupantsByRoom[`${block.id} ${letter}`].length,
        0
      ),
    0
  );

  const selectedRoomOccupants = selectedRoomId
    ? occupantsByRoom[selectedRoomId]
    : [];

  const updateSantriRoom = async (santri: Santri, nextRoom: string) => {
    if (savingSantriId !== null) return;

    try {
      setSavingSantriId(santri.id);
      await updateDoc(doc(db, "SantriCollection", santri.id), {
        kamar: nextRoom,
      });

      setSantris((current) =>
        current.map((item) =>
          item.id === santri.id ? { ...item, kamar: nextRoom } : item
        )
      );
    } catch (error) {
      console.error("Error updating santri room:", error);
      toast.error("Perubahan kamar gagal disimpan. Silakan coba lagi.");
      throw error;
    } finally {
      setSavingSantriId(null);
    }
  };

  const handleAssign = async (santri: Santri) => {
    if (!selectedRoomId) return;

    if (occupantsByRoom[selectedRoomId].length >= ROOM_CAPACITY) {
      toast.error(`Kamar ${selectedRoomId} sudah penuh.`);
      return;
    }

    try {
      await updateSantriRoom(santri, selectedRoomId);
      toast.success(`${santri.nama} ditempatkan di kamar ${selectedRoomId}.`);
    } catch {
      // The shared updater already shows an error toast.
    }
  };

  const handleRemove = async (santri: Santri) => {
    const previousRoom = normalizeRoom(santri.kamar);

    try {
      await updateSantriRoom(santri, "-");
      toast.success(
        `${santri.nama} dikeluarkan dari kamar ${previousRoom ?? selectedRoomId ?? ""}.`
      );
    } catch {
      // The shared updater already shows an error toast.
    }
  };

  if (authLoading || !isAuthorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-amber-100 border-t-amber-600 dark:border-gray-700 dark:border-t-amber-400" />
          <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-gray-400">
            Memeriksa akses...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-slate-50 pb-14 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/data-santri"
              className="inline-flex items-center gap-2 text-sm font-bold text-amber-700 transition-colors hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:text-amber-400 dark:hover:text-amber-300 dark:focus:ring-offset-gray-900"
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              Data Santri
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                <BuildingOffice2Icon className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                  Asrama Chosyi&apos;ah
                </p>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                  Denah Kamar
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-gray-400 sm:text-base">
              Lihat penghuni setiap kamar dan atur penempatan santri berdasarkan lantai dan blok.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600 dark:text-gray-300">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
              {DORM_BLOCKS.length} blok
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
              {ALL_ROOM_IDS.length} kamar
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
              2 orang/kamar
            </span>
          </div>
        </header>

        {loadError ? (
          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900 dark:bg-gray-800">
            <p className="font-bold text-red-700 dark:text-red-300">{loadError}</p>
            <button
              type="button"
              onClick={() => void fetchSantris()}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              Coba lagi
            </button>
          </section>
        ) : isLoading ? (
          <div className="flex min-h-[45vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-amber-100 border-t-amber-600 dark:border-gray-700 dark:border-t-amber-400" />
              <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-gray-400">
                Menyusun denah kamar...
              </p>
            </div>
          </div>
        ) : (
          <>
            <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">
                  Kapasitas
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  {ALL_ROOM_IDS.length * ROOM_CAPACITY}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400">tempat tidur</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">
                  Ditempatkan
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {assignedCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400">santri aktif</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">
                  Tersedia
                </p>
                <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                  {availableBeds}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400">tempat tidur</p>
              </div>
              <div
                className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-800 ${
                  unassignedSantris.length > 0 || overCapacityRooms > 0
                    ? "border-red-200 dark:border-red-900"
                    : "border-slate-200 dark:border-gray-700"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">
                  Perlu diatur
                </p>
                <p
                  className={`mt-1 text-2xl font-black ${
                    unassignedSantris.length > 0 || overCapacityRooms > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {unassignedSantris.length}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  santri belum ditempatkan
                </p>
              </div>
            </section>

            {overCapacityRooms > 0 && (
              <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {overCapacityRooms} kamar melebihi kapasitas. Buka kamar yang ditandai merah untuk mengaturnya.
              </p>
            )}

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex w-full rounded-2xl bg-slate-100 p-1 dark:bg-gray-900 lg:w-auto">
                  {([1, 2] as FloorLevel[]).map((floor) => {
                    const blockCount = DORM_BLOCKS.filter((block) => block.floor === floor).length;
                    const isSelected = selectedFloor === floor;

                    return (
                      <button
                        key={floor}
                        type="button"
                        onClick={() => setSelectedFloor(floor)}
                        aria-pressed={isSelected}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all lg:flex-none ${
                          isSelected
                            ? "bg-white text-amber-800 shadow-sm dark:bg-gray-700 dark:text-amber-300"
                            : "text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        Lantai {floor}
                        <span className="ml-2 text-xs font-semibold opacity-60">
                          {blockCount} blok
                        </span>
                      </button>
                    );
                  })}
                </div>

                <label className="relative block w-full lg:max-w-sm">
                  <span className="sr-only">Cari kamar atau santri</span>
                  <MagnifyingGlassIcon
                    className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={layoutSearch}
                    onChange={(event) => setLayoutSearch(event.target.value)}
                    placeholder="Cari kamar atau nama santri..."
                    className="w-full rounded-2xl border-slate-300 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-800 focus:border-amber-500 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-gray-700 dark:text-gray-400">
                <p>
                  Menampilkan {floorBlocks.length} blok di lantai {selectedFloor}
                </p>
                <p className="font-bold text-slate-700 dark:text-gray-200">
                  {floorResidentCount} penghuni
                </p>
              </div>
            </section>

            {visibleBlocks.length === 0 ? (
              <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-800">
                <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-slate-300 dark:text-gray-600" aria-hidden="true" />
                <p className="mt-3 font-bold text-slate-700 dark:text-gray-200">
                  Kamar atau santri tidak ditemukan
                </p>
                <button
                  type="button"
                  onClick={() => setLayoutSearch("")}
                  className="mt-2 text-sm font-bold text-amber-700 hover:text-amber-900 dark:text-amber-400"
                >
                  Hapus pencarian
                </button>
              </section>
            ) : (
              <section className="mt-6 grid gap-5 xl:grid-cols-2">
                {visibleBlocks.map((block) => {
                  const blockResidentCount = ROOM_LETTERS.reduce(
                    (total, letter) => total + occupantsByRoom[`${block.id} ${letter}`].length,
                    0
                  );

                  return (
                    <section
                      key={block.id}
                      className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100/70 shadow-sm dark:border-gray-700 dark:bg-gray-800/70"
                    >
                      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white dark:bg-amber-500 dark:text-gray-950">
                            {block.id}
                          </span>
                          <div>
                            <h2 className="font-extrabold text-slate-900 dark:text-white">
                              Blok {block.id}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-gray-400">
                              Lantai {block.floor} · 4 kamar
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-gray-300">
                          <UserGroupIcon className="h-4 w-4" aria-hidden="true" />
                          {blockResidentCount}/8
                        </span>
                      </header>

                      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
                        {block.roomIds.map((roomId) => (
                          <RoomCard
                            key={roomId}
                            roomId={roomId}
                            occupants={occupantsByRoom[roomId]}
                            onManage={() => setSelectedRoomId(roomId)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </section>
            )}

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Belum ditempatkan
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                    Pilih “Atur penghuni” pada kamar tujuan untuk menempatkan santri.
                  </p>
                </div>
                <span
                  className={`self-start rounded-full px-3 py-1 text-sm font-extrabold sm:self-auto ${
                    unassignedSantris.length > 0
                      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  }`}
                >
                  {unassignedSantris.length} santri
                </span>
              </div>

              {unassignedSantris.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-5 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Semua santri aktif sudah memiliki kamar.
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {unassignedSantris.map((santri) => (
                    <span
                      key={santri.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-2 pr-3 text-sm font-bold text-slate-700 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-200"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-[10px] font-black text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                        {getInitials(santri.nama)}
                      </span>
                      {santri.nama}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedRoomId && (
        <AssignmentDialog
          roomId={selectedRoomId}
          occupants={selectedRoomOccupants}
          santris={activeSantris}
          savingSantriId={savingSantriId}
          onAssign={handleAssign}
          onRemove={handleRemove}
          onClose={() => {
            if (savingSantriId === null) setSelectedRoomId(null);
          }}
        />
      )}
    </div>
  );
}
