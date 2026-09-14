"use client";

import { useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useAuth } from "@/firebase/auth";
import { reportSantriReturn, reportSantriRecovered } from "@/firebase/izinSakitPulang";
import type { IzinSakitPulang } from "@/types/izinSakitPulang";
import { canReportIzinCompletion } from "@/utils/izinWorkflow";

function localDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function IzinCompletionAction({ izin, onCompleted }: {
  izin: IzinSakitPulang;
  onCompleted?: () => void;
}) {
  const { user, isPreviewing } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const isPulang = izin.izinType === "Pulang";
  const label = isPulang ? "Lapor Kembali" : "Lapor Sembuh";

  if (saved) return <span role="status" className="text-sm text-green-700 dark:text-green-300">{isPulang ? "Kembali" : "Sembuh"} sudah dicatat.</span>;
  if (!canReportIzinCompletion(izin, user)) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || isPreviewing || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      if (isPulang) await reportSantriReturn(izin.id, user, new Date(returnDate));
      else await reportSantriRecovered(izin.id, user);
      setSaved(true);
      setOpen(false);
      onCompleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan laporan. Silakan coba lagi.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return <>
    <button type="button" disabled={isPreviewing}
      title={isPreviewing ? "Keluar dari Preview UI untuk mencatat laporan." : label}
      onClick={() => { setReturnDate(localDateTime(new Date())); setError(null); setOpen(true); }}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
      {label}
    </button>
    <Dialog open={open} onClose={() => { if (!saving) setOpen(false); }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <DialogPanel
        className="w-full max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-xl dark:bg-gray-800 dark:text-white">
        <DialogTitle className="text-lg font-semibold">{label}</DialogTitle>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {isPulang ? "Catat waktu santri benar-benar kembali ke asrama." : "Catat bahwa santri sudah sembuh."}
        </p>
        <form onSubmit={submit} className="mt-4">
          <fieldset disabled={saving}>
            {isPulang && <label className="block text-sm font-medium">
              Tanggal dan waktu kembali
              <input type="datetime-local" required value={returnDate}
                min={izin.izinType === "Pulang" ? localDateTime(izin.tglPulang.toDate()) : undefined}
                max={localDateTime(new Date())}
                onChange={event => setReturnDate(event.target.value)}
                className="mt-2 block w-full rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-900" />
            </label>}
            {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">Batal</button>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan Laporan"}
              </button>
            </div>
          </fieldset>
          {saving && <p role="status" className="mt-3 text-sm">Sedang menyimpan laporan. Mohon tunggu.</p>}
        </form>
      </DialogPanel>
    </Dialog>
  </>;
}
