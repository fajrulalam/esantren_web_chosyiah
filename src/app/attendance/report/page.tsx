'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { format } from 'date-fns';
import { generateAttendanceReport, getAttendanceTypes } from '@/firebase/attendance';
import { AttendanceReport, AttendanceType } from '@/types/attendance';
import { KODE_ASRAMA } from '@/constants';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';

type SortField = 'nama' | 'presentCount' | 'absentCount' | 'sickCount' | 'pulangCount' | 'dispenCount' | 'studentSessionCount' | 'attendanceRate';
type SortDirection = 'asc' | 'desc';

export default function AttendanceReportScreen() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<AttendanceReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [attendanceTypes, setAttendanceTypes] = useState<AttendanceType[]>([]);
  const [selectedAttendanceTypeId, setSelectedAttendanceTypeId] = useState<string>('');
  const [sessionType, setSessionType] = useState<'all' | 'scheduled' | 'incidental'>('all');
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [sortField, setSortField] = useState<SortField>('nama');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch attendance types on component mount
  useEffect(() => {
    const fetchAttendanceTypes = async () => {
      setIsLoadingTypes(true);
      try {
        // Get all attendance types (both frequent and non-frequent)
        const frequentTypes = await getAttendanceTypes(true);
        const nonFrequentTypes = await getAttendanceTypes(false);
        const allTypes = [...frequentTypes, ...nonFrequentTypes];

        // Filter for this asrama's types only
        const asramaTypes = allTypes.filter(type =>
            !type.kodeAsrama || type.kodeAsrama === KODE_ASRAMA
        );

        setAttendanceTypes(asramaTypes);
      } catch (error) {
        console.error("Error fetching attendance types:", error);
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchAttendanceTypes();
  }, []);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      // Build filters object based on selected options
      const filters: {
        attendanceTypeId?: string;
        sessionType?: 'scheduled' | 'incidental' | 'all';
      } = {};

      if (selectedAttendanceTypeId) {
        filters.attendanceTypeId = selectedAttendanceTypeId;
      }

      if (sessionType !== 'all') {
        filters.sessionType = sessionType;
      }

      const report = await generateAttendanceReport(
          KODE_ASRAMA,
          new Date(startDate),
          new Date(endDate + 'T23:59:59'),
          filters
      );
      setReportData(report);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Gagal membuat laporan. Silakan coba lagi.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCsv = () => {
    if (!reportData) return;

    // Generate CSV content - only include students with at least one session
    const headers = "Nama,Hadir,Alfa,Sakit,Pulang,Dispensasi,Total Kegiatan,Persentase Kehadiran\n";
    const rows = getSortedStudentReports()
        .map(student =>
            `"${student.nama}",${student.presentCount},${student.absentCount - student.sickCount - student.pulangCount - student.dispenCount},${student.sickCount},${student.pulangCount},${student.dispenCount || 0},${student.studentSessionCount},${student.attendanceRate}`
        ).join("\n");

    // Create and download CSV file
    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-kehadiran-${reportData.kodeAsrama}-${format(reportData.startDate, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedStudentReports = () => {
    if (!reportData) return [];

    const filteredStudents = reportData.studentReports
        .filter(student => student.studentSessionCount > 0);

    return [...filteredStudents].sort((a, b) => {
      // Special handling for attendance rate which is a string percentage
      if (sortField === 'attendanceRate') {
        const rateA = parseFloat(a.attendanceRate.replace('%', ''));
        const rateB = parseFloat(b.attendanceRate.replace('%', ''));
        return sortDirection === 'asc' ? rateA - rateB : rateB - rateA;
      }

      // For absentCount, we need to calculate actual alfa (absent excluding sick, pulang, dispen)
      if (sortField === 'absentCount') {
        let alfaA = a.absentCount - a.sickCount - a.pulangCount - (a.dispenCount || 0);
        let alfaB = b.absentCount - b.sickCount - b.pulangCount - (b.dispenCount || 0);
        return sortDirection === 'asc' ? alfaA - alfaB : alfaB - alfaA;
      }

      // For other numeric fields
      if (sortField !== 'nama') {
        const valA = a[sortField] || 0;
        const valB = b[sortField] || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      // For name (string comparison)
      return sortDirection === 'asc'
          ? a.nama.localeCompare(b.nama)
          : b.nama.localeCompare(a.nama);
    });
  };

  return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Laporan Kehadiran</h1>
            <button
                onClick={() => router.push('/attendance')}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Kembali
            </button>
          </div>
        </div>

        <div className="report-controls bg-white dark:bg-gray-800 p-5 rounded-lg shadow-md mb-8">
          <h2 className="text-lg font-semibold mb-4">Filter Laporan</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group">
              <label className="block text-sm font-medium mb-2">Tanggal Mulai</label>
              <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              />
            </div>

            <div className="form-group">
              <label className="block text-sm font-medium mb-2">Tanggal Akhir</label>
              <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group">
              <label className="block text-sm font-medium mb-2">Tipe Absensi</label>
              <select
                  value={selectedAttendanceTypeId}
                  onChange={(e) => setSelectedAttendanceTypeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  disabled={isLoadingTypes}
              >
                <option value="">Semua Tipe Absensi</option>
                {attendanceTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="block text-sm font-medium mb-2">Jenis Sesi</label>
              <select
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value as 'all' | 'scheduled' | 'incidental')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="all">Semua Jenis Sesi</option>
                <option value="scheduled">Terjadwal</option>
                <option value="incidental">Insidental</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="w-1/3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Menghasilkan Laporan...' : 'Hasilkan Laporan'}
            </button>
          </div>
        </div>

        {reportData && (
            <>


              <div className="report-actions flex gap-3 mb-6">
                <button
                    onClick={handleExportCsv}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                >
                  Ekspor CSV
                </button>
                <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
                >
                  Cetak Laporan
                </button>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[70vh] bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <table className="report-table w-full border-collapse"> {/* Added border-collapse */}
                  <thead className="sticky top-0 z-30">
                  <tr>
                    {/* Explicitly add background to TH cells to prevent transparency */}
                    <th
                        className={`px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-pointer group ${sortField === 'nama' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-200'}`}
                        onClick={() => handleSort('nama')}
                    >
                      <div className="flex items-center">
                        <span>Nama</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 ${sortField === 'nama' && sortDirection === 'asc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                          <ChevronDownIcon className={`h-3 w-3 ${sortField === 'nama' && sortDirection === 'desc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                        className={`px-4 py-3 text-center text-sm font-medium bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-pointer group ${sortField === 'presentCount' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-200'}`}
                        onClick={() => handleSort('presentCount')}
                    >
                      <div className="flex items-center justify-center">
                        <span>Hadir</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 ${sortField === 'presentCount' && sortDirection === 'asc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                          <ChevronDownIcon className={`h-3 w-3 ${sortField === 'presentCount' && sortDirection === 'desc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                        className={`px-4 py-3 text-center text-sm font-medium bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-pointer group ${sortField === 'absentCount' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-200'}`}
                        onClick={() => handleSort('absentCount')}
                    >
                      <div className="flex items-center justify-center">
                        <span>Alfa</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 ${sortField === 'absentCount' && sortDirection === 'asc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                          <ChevronDownIcon className={`h-3 w-3 ${sortField === 'absentCount' && sortDirection === 'desc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                        className={`px-4 py-3 text-center text-sm font-medium bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-pointer group ${sortField === 'sickCount' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-200'}`}
                        onClick={() => handleSort('sickCount')}
                    >
                      <div className="flex items-center justify-center">
                        <span>Sakit</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 ${sortField === 'sickCount' && sortDirection === 'asc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                          <ChevronDownIcon className={`h-3 w-3 ${sortField === 'sickCount' && sortDirection === 'desc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                        className={`px-4 py-3 text-center text-sm font-medium bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-pointer group ${sortField === 'pulangCount' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-200'}`}
                        onClick={() => handleSort('pulangCount')}
                    >
                      <div className="flex items-center justify-center">
                        <span>Pulang</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 ${sortField === 'pulangCount' && sortDirection === 'asc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                          <ChevronDownIcon className={`h-3 w-3 ${sortField === 'pulangCount' && sortDirection === 'desc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                        className={`px-4 py-3 text-center text-sm font-medium bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-pointer group ${sortField === 'dispenCount' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-200'}`}
                        onClick={() => handleSort('dispenCount')}
                    >
                      <div className="flex items-center justify-center">
                        <span>Dispensasi</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 ${sortField === 'dispenCount' && sortDirection === 'asc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                          <ChevronDownIcon className={`h-3 w-3 ${sortField === 'dispenCount' && sortDirection === 'desc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                        className={`px-4 py-3 text-center text-sm font-medium bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-pointer group ${sortField === 'studentSessionCount' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-200'}`}
                        onClick={() => handleSort('studentSessionCount')}
                    >
                      <div className="flex items-center justify-center">
                        <span>Total Sesi</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 ${sortField === 'studentSessionCount' && sortDirection === 'asc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                          <ChevronDownIcon className={`h-3 w-3 ${sortField === 'studentSessionCount' && sortDirection === 'desc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                        className={`px-4 py-3 text-center text-sm font-medium bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-pointer group ${sortField === 'attendanceRate' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-200'}`}
                        onClick={() => handleSort('attendanceRate')}
                    >
                      <div className="flex items-center justify-center">
                        <span>Persentase Kehadiran</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 ${sortField === 'attendanceRate' && sortDirection === 'asc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                          <ChevronDownIcon className={`h-3 w-3 ${sortField === 'attendanceRate' && sortDirection === 'desc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {/* Use the sorted student reports */}
                  {getSortedStudentReports().map(student => (
                      <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        {/* Use text-gray-900 dark:text-white for better contrast */}
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{student.nama}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">{student.presentCount}</td>
                        {/* Calculate Alfa correctly */}
                        <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">{student.absentCount}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">{student.sickCount}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">{student.pulangCount}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">{student.dispenCount || 0}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">{student.studentSessionCount}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-gray-900 dark:text-white">
                          {student.attendanceRate}
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </>
        )}
      </div>
  );
}