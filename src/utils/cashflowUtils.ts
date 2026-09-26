import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  CashflowAccount,
  CashflowTransaction,
  CashflowRow,
  OpeningBalance,
  CashflowMonthSettings,
} from "@/types/cashflow";

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

export const CASHFLOW_TRANSACTIONS_COLLECTION = "CashflowTransactions";
export const CASHFLOW_SETTINGS_COLLECTION = "CashflowSettings";

export const MIN_CASHFLOW_MONTH = "2026-09";
export const MIN_CASHFLOW_DATE = "2026-09-01";

export function getCurrentJakartaMonth(): string {
  const now = new Date();
  const jkt = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
  return `${jkt.getFullYear()}-${String(jkt.getMonth() + 1).padStart(2, "0")}`;
}

export function getCurrentJakartaDate(): string {
  const now = new Date();
  const jkt = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
  return `${jkt.getFullYear()}-${String(jkt.getMonth() + 1).padStart(2, "0")}-${String(jkt.getDate()).padStart(2, "0")}`;
}

export function formatDayLabel(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [yyyy, mm, dd] = parts;
  return `${parseInt(dd)}/${parseInt(mm)}/${yyyy}`;
}

export function formatMonthLabel(monthId: string): string {
  if (!monthId) return "";
  const [yearStr, monthStr] = monthId.split("-");
  const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  return date.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export function getAdjacentMonth(monthId: string, delta: number): string {
  if (!monthId) return getCurrentJakartaMonth();
  const [yearStr, monthStr] = monthId.split("-");
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10) + delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function formatDayFullLabel(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [yearStr, monthStr, dayStr] = parts;
  const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtAmount(n: number): string {
  if (n === 0) return "0";
  return new Intl.NumberFormat("id-ID").format(n);
}

// ---------------------------------------------------------------------------
// Firestore Queries & Mutations
// ---------------------------------------------------------------------------

export async function fetchAvailableMonths(db: Firestore): Promise<string[]> {
  const minMonth = MIN_CASHFLOW_MONTH;
  const maxMonth = getCurrentJakartaMonth();
  const months = new Set<string>();

  // 1. Check CashflowSettings
  try {
    const settingsRef = collection(db, CASHFLOW_SETTINGS_COLLECTION);
    const settingsSnap = await getDocs(settingsRef);
    settingsSnap.forEach((d) => {
      if (d.id >= minMonth && d.id <= maxMonth) {
        months.add(d.id);
      }
    });
  } catch (err) {
    console.warn("Error fetching months from CashflowSettings:", err);
  }

  // 2. Check CashflowTransactions
  try {
    const txnRef = collection(db, CASHFLOW_TRANSACTIONS_COLLECTION);
    const txnSnap = await getDocs(txnRef);
    txnSnap.forEach((d) => {
      const data = d.data();
      if (data.month && data.month >= minMonth && data.month <= maxMonth) {
        months.add(data.month);
      }
    });
  } catch (err) {
    console.warn("Error fetching months from CashflowTransactions:", err);
  }

  // Always generate all sequential months from minMonth up to maxMonth
  // so the user can easily navigate through every valid month even if there are no transactions yet
  let cur = minMonth;
  while (cur <= maxMonth) {
    months.add(cur);
    if (cur === maxMonth) break;
    cur = getAdjacentMonth(cur, 1);
  }

  const sorted = Array.from(months)
    .filter((m) => m >= minMonth && m <= maxMonth)
    .sort((a, b) => b.localeCompare(a));
  return sorted;
}

export async function fetchTransactionsForMonth(
  db: Firestore,
  monthId: string
): Promise<CashflowTransaction[]> {
  const ref = collection(db, CASHFLOW_TRANSACTIONS_COLLECTION);
  const q = query(
    ref,
    where("month", "==", monthId),
    orderBy("date", "asc")
  );
  const snapshot = await getDocs(q);

  const results: CashflowTransaction[] = [];
  snapshot.forEach((d) => {
    const data = d.data();
    results.push({
      id: d.id,
      date: data.date ?? "",
      month: data.month ?? monthId,
      type: data.type ?? "income",
      description: data.description ?? "",
      amount: data.amount ?? 0,
      account: data.account ?? "cash",
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      createdBy: data.createdBy,
    });
  });

  // Secondary sort by createdAt ascending within same date
  results.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return timeA - timeB;
  });

  return results;
}

export async function fetchOpeningBalance(
  db: Firestore,
  monthId: string
): Promise<OpeningBalance> {
  // 1. Check explicit override in CashflowSettings
  const settingsRef = doc(db, CASHFLOW_SETTINGS_COLLECTION, monthId);
  const settingsSnap = await getDoc(settingsRef);

  if (settingsSnap.exists()) {
    const data = settingsSnap.data() as CashflowMonthSettings;
    return {
      openingCash: data.openingCash ?? 0,
      openingEmoney: data.openingEmoney ?? 0,
    };
  }

  // 2. Calculate from previous month's closing balance
  const [yearStr, monthStr] = monthId.split("-");
  let prevYear = parseInt(yearStr);
  let prevMonth = parseInt(monthStr) - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMonthId = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  // Check if prev month settings or transactions exist
  const prevSettingsRef = doc(db, CASHFLOW_SETTINGS_COLLECTION, prevMonthId);
  const prevSettingsSnap = await getDoc(prevSettingsRef);

  // If previous month has data, compute its closing balance
  const prevTxns = await fetchTransactionsForMonth(db, prevMonthId);
  if (prevSettingsSnap.exists() || prevTxns.length > 0) {
    const prevOpening: OpeningBalance = prevSettingsSnap.exists()
      ? {
          openingCash: prevSettingsSnap.data().openingCash ?? 0,
          openingEmoney: prevSettingsSnap.data().openingEmoney ?? 0,
        }
      : { openingCash: 0, openingEmoney: 0 };

    const prevRows = buildCashflowRows(prevTxns, prevOpening);
    const closingRow = prevRows.find((r) => r.rowType === "closing");
    if (closingRow) {
      return {
        openingCash: closingRow.cashBalance,
        openingEmoney: closingRow.emoneyBalance,
      };
    }
  }

  return { openingCash: 0, openingEmoney: 0 };
}

export async function saveOpeningBalance(
  db: Firestore,
  monthId: string,
  balance: OpeningBalance,
  user?: { uid: string; name: string }
): Promise<void> {
  const settingsRef = doc(db, CASHFLOW_SETTINGS_COLLECTION, monthId);
  const payload: Record<string, unknown> = {
    openingCash: balance.openingCash,
    openingEmoney: balance.openingEmoney,
    updatedAt: Timestamp.now(),
  };
  if (user) {
    payload.updatedBy = user.name || user.uid;
  }
  await setDoc(settingsRef, payload, { merge: true });
}

export async function addCashflowTransaction(
  db: Firestore,
  data: {
    date: string;
    type: "income" | "expense";
    description: string;
    amount: number;
    account: CashflowAccount;
    createdBy?: { uid: string; name: string; role: string };
  }
): Promise<string> {
  const month = data.date.substring(0, 7);
  const ref = collection(db, CASHFLOW_TRANSACTIONS_COLLECTION);
  const docRef = await addDoc(ref, {
    date: data.date,
    month,
    type: data.type,
    description: data.description.trim(),
    amount: data.amount,
    account: data.account,
    createdAt: Timestamp.now(),
    createdBy: data.createdBy || null,
  });
  return docRef.id;
}

export async function updateCashflowTransaction(
  db: Firestore,
  id: string,
  data: {
    date: string;
    type: "income" | "expense";
    description: string;
    amount: number;
    account: CashflowAccount;
  }
): Promise<void> {
  const month = data.date.substring(0, 7);
  const ref = doc(db, CASHFLOW_TRANSACTIONS_COLLECTION, id);
  await updateDoc(ref, {
    date: data.date,
    month,
    type: data.type,
    description: data.description.trim(),
    amount: data.amount,
    account: data.account,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteCashflowTransaction(
  db: Firestore,
  id: string
): Promise<void> {
  const ref = doc(db, CASHFLOW_TRANSACTIONS_COLLECTION, id);
  await deleteDoc(ref);
}

// ---------------------------------------------------------------------------
// Ledger Calculation Engine
// ---------------------------------------------------------------------------

export function buildCashflowRows(
  transactions: CashflowTransaction[],
  opening: OpeningBalance
): CashflowRow[] {
  const rows: CashflowRow[] = [];

  let cashBal = opening.openingCash;
  let emoneyBal = opening.openingEmoney;

  // 1. Opening Balance Row
  rows.push({
    date: "",
    rawDate: "",
    description: "Saldo Awal (Opening Balance)",
    cashAmount: 0,
    cashBalance: cashBal,
    emoneyAmount: 0,
    emoneyBalance: emoneyBal,
    rowType: "opening",
  });

  // 2. Sort transactions chronologically
  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return timeA - timeB;
  });

  let prevRawDate = "";

  for (const txn of sorted) {
    const isNewDay = txn.date !== prevRawDate;
    prevRawDate = txn.date;

    let cashDelta = 0;
    let emoneyDelta = 0;

    if (txn.type === "income") {
      if (txn.account === "cash") {
        cashDelta = txn.amount;
      } else {
        emoneyDelta = txn.amount;
      }
    } else if (txn.type === "expense") {
      if (txn.account === "cash") {
        cashDelta = -txn.amount;
      } else {
        emoneyDelta = -txn.amount;
      }
    }

    cashBal += cashDelta;
    emoneyBal += emoneyDelta;

    rows.push({
      id: txn.id,
      date: isNewDay ? formatDayLabel(txn.date) : "",
      rawDate: txn.date,
      description: txn.description,
      cashAmount: cashDelta,
      cashBalance: cashBal,
      emoneyAmount: emoneyDelta,
      emoneyBalance: emoneyBal,
      rowType: txn.type,
      sourceAccount: txn.account,
      createdAt: txn.createdAt instanceof Date ? txn.createdAt : undefined,
      createdBy: txn.createdBy,
      originalTransaction: txn,
    });
  }

  // 3. Closing Balance Row
  rows.push({
    date: "",
    rawDate: "",
    description: "Saldo Akhir (Closing Balance)",
    cashAmount: 0,
    cashBalance: cashBal,
    emoneyAmount: 0,
    emoneyBalance: emoneyBal,
    rowType: "closing",
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Account Filter
// ---------------------------------------------------------------------------

export function filterRowsByAccount(
  rows: CashflowRow[],
  account: CashflowAccount
): CashflowRow[] {
  return rows.filter((r) => {
    if (r.rowType === "opening" || r.rowType === "closing") return true;
    if (account === "cash") {
      return r.cashAmount !== 0 || r.sourceAccount === "cash";
    }
    if (account === "emoney") {
      return r.emoneyAmount !== 0 || r.sourceAccount === "emoney";
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// PDF Generation
// ---------------------------------------------------------------------------

export function generateCashflowPDF(
  rows: CashflowRow[],
  monthLabel: string
): void {
  const cleanLabel = monthLabel.replace(" (berjalan)", "");
  const pdf = new jsPDF({ orientation: "landscape" });

  // Header Title
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("Laporan Arus Kas Asrama", 14, 16);

  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Periode: ${cleanLabel}`, 14, 23);

  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `Dicetak pada: ${new Date().toLocaleDateString("id-ID", { dateStyle: "long", timeStyle: "short" })}`,
    14,
    29
  );
  pdf.setTextColor(0, 0, 0);

  const head = [
    [
      { content: "Tanggal", rowSpan: 2 },
      { content: "Keterangan", rowSpan: 2 },
      { content: "Kas Tunai", colSpan: 2 },
      { content: "E-Money", colSpan: 2 },
    ],
    ["Mutasi", "Saldo", "Mutasi", "Saldo"],
  ];

  const fmtPdfAmt = (n: number) => {
    if (n === 0) return "—";
    const prefix = n > 0 ? "+" : "";
    return `${prefix}${fmtAmount(n)}`;
  };

  const body = rows.map((r) => {
    const isHighlight = r.rowType === "opening" || r.rowType === "closing";
    return [
      r.date,
      r.description,
      isHighlight ? "" : fmtPdfAmt(r.cashAmount),
      fmtAmount(r.cashBalance),
      isHighlight ? "" : fmtPdfAmt(r.emoneyAmount),
      fmtAmount(r.emoneyBalance),
    ];
  });

  autoTable(pdf, {
    head,
    body,
    startY: 34,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      textColor: [30, 30, 30],
      lineColor: [209, 213, 219],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [31, 41, 55], // charcoal dark
      textColor: [243, 244, 246],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
      lineColor: [55, 65, 81],
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { cellWidth: 90 },
      2: { halign: "right", cellWidth: 38 },
      3: { halign: "right", cellWidth: 42 },
      4: { halign: "right", cellWidth: 38 },
      5: { halign: "right", cellWidth: 42 },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      if (!row) return;

      if (row.rowType === "opening") {
        data.cell.styles.fillColor = [248, 250, 252];
        data.cell.styles.fontStyle = "bold";
      } else if (row.rowType === "closing") {
        data.cell.styles.fillColor = [226, 232, 240]; // slate-200
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 8.5;
      } else if (row.rowType === "income") {
        data.cell.styles.fillColor = [240, 253, 244]; // emerald-50
      } else if (row.rowType === "expense") {
        data.cell.styles.fillColor = [254, 242, 242]; // red-50
      }

      // Column 2 (Cash Mutasi) and Column 4 (E-Money Mutasi) coloring
      if (data.column.index === 2) {
        if (row.cashAmount > 0) data.cell.styles.textColor = [16, 185, 129];
        else if (row.cashAmount < 0) data.cell.styles.textColor = [239, 68, 68];
        else data.cell.styles.textColor = [156, 163, 175];
      }
      if (data.column.index === 4) {
        if (row.emoneyAmount > 0) data.cell.styles.textColor = [16, 185, 129];
        else if (row.emoneyAmount < 0) data.cell.styles.textColor = [239, 68, 68];
        else data.cell.styles.textColor = [156, 163, 175];
      }

      // Border separation for account groups (cols 2 & 4)
      if (data.column.index === 2 || data.column.index === 4) {
        data.cell.styles.lineWidth = { top: 0.3, bottom: 0.3, left: 0.8, right: 0.3 };
      }
    },
  });

  const safeName = cleanLabel.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  pdf.save(`arus-kas-${safeName}.pdf`);
}
