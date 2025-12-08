import { Timestamp } from "firebase/firestore";

// Santri interface for student selection
export interface Santri {
  id: string;
  nama: string;
  kamar?: string;
  kelas?: string;
  jenjangPendidikan?: string;
  statusAktif: string;
  tahunMasuk?: string;
  programStudi?: string;
  semester?: string;
  kodeAsrama: string;
}

// Attendance type record
export interface AttendanceType {
  id: string;
  name: string;
  description?: string;
  isFrequent: boolean;
  kodeAsrama?: string;
  listOfSantriIds?: string[]; // List of specific santri IDs this attendance type applies to
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Student status in an attendance session
export interface StudentAttendanceStatus {
  status: 'present' | 'absent' | 'excusedSick' | 'excusedPulang' | 'overridePresent' | 'dispen';
  updatedAt: Timestamp;
  updatedBy: string;
}

// Status for leaving the dormitory
export interface StatusKepulangan {
  alasan: string;
  idPemberiIzin: string;
  pemberiIzin: string;
  rencanaTanggalKembali: Timestamp;
  sudahKembali: boolean;
  kembaliSesuaiRencana?: boolean;
  sudahSowan?: boolean;
  tglPulang: Timestamp;
}

// Attendance session record
export interface AttendanceRecord {
  id: string;
  attendanceType: string;
  kodeAsrama: string;
  timestamp: Timestamp;
  createdBy: string;
  studentStatuses: Record<string, StudentAttendanceStatus>;
  isActive: boolean;
  closedAt?: Timestamp;
  closedBy?: string;
  attendanceTypeId?: string | null; // Reference to the attendance type document
}

// Teacher/pengurus data
export interface Teacher {
  id: string;
  displayName: string;
  email: string;
  role: string;
  allowedAsramaCodes: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Extended santri model with attendance fields
export interface SantriWithAttendance {
  id: string;
  nama: string;
  kodeAsrama: string;
  statusKehadiran: 'Ada' | 'Sakit' | 'Pulang';
  statusKepulangan?: StatusKepulangan;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Report data structure
export interface AttendanceReportData {
  id: string;
  nama: string;
  presentCount: number;
  absentCount: number;
  sickCount: number;
  pulangCount: number;
  dispenCount: number; // Count of dispensation status
  unknownCount: number;
  studentSessionCount: number; // Number of sessions this student was part of
  attendanceRate: string;
}

export interface AttendanceReport {
  startDate: Date;
  endDate: Date;
  kodeAsrama: string;
  totalSessions: number;
  studentReports: AttendanceReportData[];
}