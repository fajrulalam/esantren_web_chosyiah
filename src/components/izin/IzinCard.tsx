import Link from "next/link";
import type { Timestamp } from "firebase/firestore";
import type { IzinSakitPulang } from "@/types/izinSakitPulang";
import { isIzinOngoing, izinStatusLabel } from "@/utils/izinWorkflow";
import IzinCompletionAction from "./IzinCompletionAction";

export interface IzinCardProps {
  izin: IzinSakitPulang & { santriName?: string };
  formatDate: (timestamp: Timestamp) => string;
  detailLink: string;
  onCompleted?: () => void;
}

export default function IzinCard({ izin, formatDate, detailLink, onCompleted }: IzinCardProps) {
  const ongoing = isIzinOngoing(izin);
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-white">{izin.santriName || "Izin Saya"}</h2>
        <p className="text-sm text-indigo-600 dark:text-indigo-300">Izin {izin.izinType}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${ongoing ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100"}`}>
        {izinStatusLabel(izin)}
      </span>
    </div>
    <p className="mt-4 break-words text-sm text-slate-700 dark:text-slate-200">{izin.izinType === "Pulang" ? izin.alasan : izin.keluhan}</p>
    <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
      <div><dt className="font-medium">Dilaporkan</dt><dd>{formatDate(izin.timestamp)}</dd></div>
      {izin.izinType === "Pulang" && <>
        <div><dt className="font-medium">Tanggal Pulang</dt><dd>{formatDate(izin.tglPulang)}</dd></div>
        <div><dt className="font-medium">Rencana Kembali</dt><dd>{formatDate(izin.rencanaTanggalKembali)}</dd></div>
        {izin.tanggalKembali && <div><dt className="font-medium">Kembali</dt><dd>{formatDate(izin.tanggalKembali)}
          {typeof izin.kembaliSesuaiRencana === "boolean" && <span className="ml-2">({izin.kembaliSesuaiRencana ? "Tepat waktu" : "Terlambat"})</span>}
        </dd></div>}
      </>}
    </dl>
    {ongoing && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
      {izin.izinType === "Pulang" ? "Lapor pulang → Lapor kembali" : "Lapor sakit → Lapor sembuh"}
    </p>}
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <Link href={detailLink} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">Detail</Link>
      <IzinCompletionAction key={izin.id} izin={izin} onCompleted={onCompleted} />
    </div>
  </article>;
}
