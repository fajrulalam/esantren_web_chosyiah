import { Timestamp } from "firebase/firestore";

export type CashflowAccount = "cash" | "emoney";
export type CashflowType = "income" | "expense";

export interface CashflowTransaction {
  id: string;
  date: string;               // "YYYY-MM-DD" in Asia/Jakarta
  month: string;              // "YYYY-MM"
  type: CashflowType;         // "income" | "expense"
  description: string;        // e.g. "Donasi Asrama", "Beli Beras 50kg"
  amount: number;             // IDR amount (> 0)
  account: CashflowAccount;   // "cash" | "emoney"
  createdAt: Timestamp | Date;
  createdBy?: {
    uid: string;
    name: string;
    role: string;
  };
}

export interface OpeningBalance {
  openingCash: number;
  openingEmoney: number;
}

export interface CashflowMonthSettings {
  openingCash: number;
  openingEmoney: number;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface CashflowRow {
  id?: string;                // ID of original transaction (if applicable)
  date: string;               // Formatted display date (e.g. "26/09/2026") or empty string if same day
  rawDate: string;            // "YYYY-MM-DD"
  description: string;
  cashAmount: number;
  cashBalance: number;
  emoneyAmount: number;
  emoneyBalance: number;
  rowType: "opening" | "income" | "expense" | "closing";
  sourceAccount?: CashflowAccount;
  createdAt?: Date;
  createdBy?: {
    uid: string;
    name: string;
    role: string;
  };
  originalTransaction?: CashflowTransaction;
}
