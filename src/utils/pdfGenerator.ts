/**
 * PDF Generator utility for Kegiatan monthly reports
 * Uses jsPDF and jspdf-autotable for table generation
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { KegiatanData, ActivitySummary } from "@/types/kegiatan";

/**
 * Generate a summary of activities by person
 */
function generateActivitySummary(activities: KegiatanData[]): ActivitySummary {
    const summary: ActivitySummary = {};

    activities.forEach((activity) => {
        // Count Imam Subuh
        if (activity.imamSubuh) {
            const uid = activity.imamSubuh.uid;
            if (!summary[uid]) {
                summary[uid] = {
                    name: activity.imamSubuh.name,
                    role: activity.imamSubuh.role,
                    imamSubuhCount: 0,
                    imamMaghribCount: 0,
                    mengajarNgajiCount: 0,
                    mengajarPegonCount: 0,
                    customActivitiesCount: {},
                };
            }
            summary[uid].imamSubuhCount++;
        }

        // Count Imam Maghrib
        if (activity.imamMaghrib) {
            const uid = activity.imamMaghrib.uid;
            if (!summary[uid]) {
                summary[uid] = {
                    name: activity.imamMaghrib.name,
                    role: activity.imamMaghrib.role,
                    imamSubuhCount: 0,
                    imamMaghribCount: 0,
                    mengajarNgajiCount: 0,
                    mengajarPegonCount: 0,
                    customActivitiesCount: {},
                };
            }
            summary[uid].imamMaghribCount++;
        }

        // Count Mengajar Ngaji
        activity.mengajarNgaji.forEach((person) => {
            if (!summary[person.uid]) {
                summary[person.uid] = {
                    name: person.name,
                    role: person.role,
                    imamSubuhCount: 0,
                    imamMaghribCount: 0,
                    mengajarNgajiCount: 0,
                    mengajarPegonCount: 0,
                    customActivitiesCount: {},
                };
            }
            summary[person.uid].mengajarNgajiCount++;
        });

        // Count Mengajar Pegon
        activity.mengajarPegon.forEach((person) => {
            if (!summary[person.uid]) {
                summary[person.uid] = {
                    name: person.name,
                    role: person.role,
                    imamSubuhCount: 0,
                    imamMaghribCount: 0,
                    mengajarNgajiCount: 0,
                    mengajarPegonCount: 0,
                    customActivitiesCount: {},
                };
            }
            summary[person.uid].mengajarPegonCount++;
        });

        // Count Custom Activities
        if (activity.customActivities) {
            activity.customActivities.forEach((ca) => {
                const activityName = ca.name;
                ca.people.forEach((person) => {
                    if (!summary[person.uid]) {
                        summary[person.uid] = {
                            name: person.name,
                            role: person.role,
                            imamSubuhCount: 0,
                            imamMaghribCount: 0,
                            mengajarNgajiCount: 0,
                            mengajarPegonCount: 0,
                            customActivitiesCount: {},
                        };
                    }
                    if (!summary[person.uid].customActivitiesCount[activityName]) {
                        summary[person.uid].customActivitiesCount[activityName] = 0;
                    }
                    summary[person.uid].customActivitiesCount[activityName]++;
                });
            });
        }
    });

    return summary;
}

/**
 * Format date from YYYY-MM-DD to readable format
 */
function formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * Get month name in Indonesian
 */
function getMonthName(month: number): string {
    const months = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
    ];
    return months[month - 1] || "";
}

/**
 * Generate and download PDF report for monthly kegiatan (Dalam Asrama)
 */
export function generateDalamAsramaPDF(
    activities: KegiatanData[],
    startDate: string,
    endDate: string,
    includeSummary: boolean = true
): void {
    // Create new PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Laporan Kegiatan Dalam Asrama", pageWidth / 2, 15, { align: "center" });

    // Subtitle with Date Range
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(
        `${formatDate(startDate)} - ${formatDate(endDate)}`,
        pageWidth / 2,
        22,
        { align: "center" }
    );

    // Asrama name
    doc.setFontSize(10);
    doc.text("Asrama Mahasiswi Chosyi'ah", pageWidth / 2, 28, {
        align: "center",
    });

    // Generated timestamp
    const now = new Date();
    const timestamp = now.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",

    });
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Dibuat: ${timestamp}`, pageWidth / 2, 33, { align: "center" });
    doc.setTextColor(0);

    // Prepare table data
    const tableData = activities.map((activity) => {
        // Format custom activities as "Activity: Person1, Person2"
        const customActivitiesStr = activity.customActivities
            .map((ca) => `${ca.name}: ${ca.people.map((p) => p.name).join(", ")}`)
            .join("; ") || "-";

        return [
            formatDate(activity.date),
            activity.imamSubuh?.name || "-",
            activity.imamMaghrib?.name || "-",
            activity.mengajarNgaji.map((p) => p.name).join(", ") || "-",
            activity.mengajarPegon.map((p) => p.name).join(", ") || "-",
            customActivitiesStr,
        ];
    });

    // Generate main table
    autoTable(doc, {
        startY: 38,
        head: [
            [
                "Tanggal",
                "Imam Subuh",
                "Imam Maghrib",
                "Mengajar Ngaji",
                "Mengajar Pegon",
                "Kegiatan Lainnya",
            ],
        ],
        body: tableData,
        theme: "grid",
        headStyles: {
            fillColor: [245, 158, 11], // Amber color to match app theme
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
        },
        bodyStyles: {
            fontSize: 8,
        },
        columnStyles: {
            0: { cellWidth: 25 }, // Date
            1: { cellWidth: 28 }, // Imam Subuh
            2: { cellWidth: 28 }, // Imam Maghrib
            3: { cellWidth: 35 }, // Mengajar Ngaji
            4: { cellWidth: 35 }, // Mengajar Pegon
            5: { cellWidth: 35 }, // Custom Activities
        },
        styles: {
            overflow: "linebreak",
            cellPadding: 2,
        },
    });

    // Add summary page if requested
    if (includeSummary && activities.length > 0) {
        const summary = generateActivitySummary(activities);

        // Collect all unique custom activity names from the summary
        const allCustomActivities = new Set<string>();
        Object.values(summary).forEach((person) => {
            Object.keys(person.customActivitiesCount).forEach((actName) =>
                allCustomActivities.add(actName)
            );
        });
        const sortedCustomActivities = Array.from(allCustomActivities).sort();

        const summaryData = Object.values(summary)
            .sort((a, b) => a.name.localeCompare(b.name, "id-ID"))
            .map((person) => {
                const standardTotal =
                    person.imamSubuhCount +
                    person.imamMaghribCount +
                    person.mengajarNgajiCount +
                    person.mengajarPegonCount;

                const customTotal = Object.values(person.customActivitiesCount).reduce((sum, count) => sum + count, 0);
                const total = standardTotal + customTotal;

                const customCounts = sortedCustomActivities.map(actName =>
                    (person.customActivitiesCount[actName] || 0).toString()
                );

                return [
                    person.name,
                    person.role === "santri" ? "Santri" : "Pengurus",
                    person.imamSubuhCount.toString(),
                    person.imamMaghribCount.toString(),
                    person.mengajarNgajiCount.toString(),
                    person.mengajarPegonCount.toString(),
                    ...customCounts,
                    total.toString(),
                ];
            });

        // Add new page for summary in Landscape mode
        doc.addPage("a4", "landscape"); // Switch to landscape
        const landscapePageWidth = doc.internal.pageSize.getWidth();

        // Summary title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Ringkasan Kegiatan per Orang", landscapePageWidth / 2, 15, {
            align: "center",
        });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(
            `Total ${activities.length} hari dengan data kegiatan`,
            landscapePageWidth / 2,
            22,
            { align: "center" }
        );

        // Generate dynamic table headers
        // Use shorter headers where possible to prevent wrapping
        const tableHeaders = [
            "Nama",
            "Peran",
            "Imam\nSubuh",
            "Imam\nMaghrib",
            "Mengajar\nNgaji",
            "Mengajar\nPegon",
            ...sortedCustomActivities,
            "Total\nKegiatan",
        ];

        // Calculate dynamic column widths for Landscape (A4 Landscape width ~297mm)
        // Margins default is ~14mm (10-15mm). Usable width ~270mm.

        // Fixed columns: Name, Role
        const nameColWidth = 50;
        const roleColWidth = 25;
        const fixedWidthUsed = nameColWidth + roleColWidth;

        // Available width for activity columns
        // A4 Landscape is 297mm. With 14mm margins (left+right), usable is ~269mm. 
        // Let's be safe and assume ~265mm usable total width for table.
        const totalUsableWidth = 265;
        const remainingWidth = totalUsableWidth - fixedWidthUsed;

        const totalActivityColumns = 4 + sortedCustomActivities.length + 1; // 4 standard + custom + total

        // Calculate width per activity column
        // We want at least 25mm per column if possible to avoid wrapping "Mengajar ..."
        const activityColWidth = Math.floor(remainingWidth / totalActivityColumns);

        // Define column styles
        const columnStyles: any = {
            0: { cellWidth: nameColWidth }, // Name
            1: { cellWidth: roleColWidth }, // Role
        };

        // Add styles for all activity columns including Total
        // Columns start at index 2 (0=Name, 1=Role)
        for (let i = 0; i < totalActivityColumns; i++) {
            columnStyles[i + 2] = { cellWidth: activityColWidth, halign: "center" };
        }

        // Generate summary table
        autoTable(doc, {
            startY: 28,
            head: [tableHeaders],
            body: summaryData,
            theme: "grid",
            headStyles: {
                fillColor: [245, 158, 11],
                textColor: 255,
                fontStyle: "bold",
                fontSize: 9,
                halign: "center",
                valign: "middle"
            },
            bodyStyles: {
                fontSize: 8,
                valign: "middle"
            },
            columnStyles: columnStyles,
            margin: { left: 14, right: 14 } // Ensure we use the calculated width
        });
    }

    // Save PDF
    const fileName = `Kegiatan-Dalam-${startDate}-to-${endDate}.pdf`;
    doc.save(fileName);
}

/**
 * Generate and download PDF report for Luar Asrama Activities
 */
export function generateLuarAsramaPDF(
    activities: KegiatanData[],
    startDate: string,
    endDate: string
): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Laporan Kegiatan Luar Asrama", pageWidth / 2, 15, { align: "center" });

    // Subtitle with Date Range
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(
        `${formatDate(startDate)} - ${formatDate(endDate)}`,
        pageWidth / 2,
        22,
        { align: "center" }
    );

    // Asrama name
    doc.setFontSize(10);
    doc.text("Asrama Mahasiswi Chosyi'ah", pageWidth / 2, 28, {
        align: "center",
    });

    const now = new Date();
    const timestamp = now.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Dibuat: ${timestamp}`, pageWidth / 2, 33, { align: "center" });
    doc.setTextColor(0);

    // Prepare table data
    const tableData: string[][] = [];

    activities.forEach((dayData) => {
        if (dayData.luarAsramaActivities && dayData.luarAsramaActivities.length > 0) {
            dayData.luarAsramaActivities.forEach((activity, idx) => {
                tableData.push([
                    idx === 0 ? formatDate(dayData.date) : "", // Only show date on first row of the day
                    activity.name || "-",
                    (activity.startTime && activity.endTime)
                        ? `${activity.startTime} - ${activity.endTime}`
                        : (activity.startTime || activity.endTime || "-"),
                    Array.isArray(activity.partTimer)
                        ? activity.partTimer.map(p => p.name).join(", ")
                        : (activity.partTimer || "-")
                ]);
            });
            // Add a separator row if needed or just handle via date grouping visually
            // For simple table, we just list them.
        }
    });

    if (tableData.length === 0) {
        // No data handling? Just show empty table or message
        tableData.push(["-", "Tidak ada kegiatan", "-", "-"]);
    }

    autoTable(doc, {
        startY: 38,
        head: [
            [
                "Tanggal",
                "Nama Kegiatan",
                "Jam Mulai - Akhir",
                "Part-Timer",
            ],
        ],
        body: tableData,
        theme: "grid",
        headStyles: {
            fillColor: [59, 130, 246], // Blue for Luar Asrama
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
        },
        bodyStyles: {
            fontSize: 8,
        },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 70 },
            2: { cellWidth: 40 },
            3: { cellWidth: 40 },
        },
        styles: {
            overflow: "linebreak",
            cellPadding: 2,
        },
    });

    // --- Generate Summary Table for Luar Asrama ---
    if (activities.length > 0) {
        // Aggregate Data
        interface LuarAsramaSummary {
            [uid: string]: {
                name: string;
                role: string;
                totalDurationMinutes: number;
                totalActivityCount: number;
                activityCounts: { [activityName: string]: number };
            }
        }

        const summary: LuarAsramaSummary = {};
        const allActivityNames = new Set<string>();

        activities.forEach((dayData) => {
            if (dayData.luarAsramaActivities) {
                dayData.luarAsramaActivities.forEach((act) => {
                    const activityName = act.name || "Tanpa Nama";
                    allActivityNames.add(activityName);

                    // Calculate duration
                    let durationMinutes = 0;
                    if (act.startTime && act.endTime) {
                        const [startH, startM] = act.startTime.split(":").map(Number);
                        const [endH, endM] = act.endTime.split(":").map(Number);

                        // Simple duration calculation (assuming same day)
                        let startTotal = startH * 60 + startM;
                        let endTotal = endH * 60 + endM;

                        // Handle crossing midnight (e.g. 23:00 to 01:00)
                        if (endTotal < startTotal) {
                            endTotal += 24 * 60;
                        }

                        durationMinutes = endTotal - startTotal;
                    }

                    // Process each person involved
                    const people = Array.isArray(act.partTimer) ? act.partTimer : (act.partTimer ? [act.partTimer] : []);

                    people.forEach((person: any) => { // Use explicit type if possible, here simplified
                        if (!person || !person.uid) return;

                        if (!summary[person.uid]) {
                            summary[person.uid] = {
                                name: person.name,
                                role: person.role || "Unknown",
                                totalDurationMinutes: 0,
                                totalActivityCount: 0,
                                activityCounts: {}
                            };
                        }

                        summary[person.uid].totalDurationMinutes += durationMinutes;
                        summary[person.uid].totalActivityCount++;

                        if (!summary[person.uid].activityCounts[activityName]) {
                            summary[person.uid].activityCounts[activityName] = 0;
                        }
                        summary[person.uid].activityCounts[activityName]++;
                    });
                });
            }
        });

        // Format duration helper
        const formatDuration = (minutes: number) => {
            if (minutes === 0) return "-";
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            if (h > 0 && m > 0) return `${h} jam ${m} menit`;
            if (h > 0) return `${h} jam`;
            return `${m} menit`;
        };

        const sortedActivityNames = Array.from(allActivityNames).sort();

        // Prepare summary rows
        const summaryData = Object.values(summary)
            .sort((a, b) => a.name.localeCompare(b.name, "id-ID"))
            .map(person => {
                const activityCols = sortedActivityNames.map(name =>
                    (person.activityCounts[name] || 0).toString()
                );

                return [
                    person.name,
                    person.role === "santri" ? "Santri" : "Pengurus",
                    ...activityCols,
                    formatDuration(person.totalDurationMinutes),
                    person.totalActivityCount.toString()
                ];
            });

        // Add Landscape Page
        doc.addPage("a4", "landscape");
        const landscapePageWidth = doc.internal.pageSize.getWidth();

        // Title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Ringkasan Kegiatan Luar Asrama per Orang", landscapePageWidth / 2, 15, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(
            `${formatDate(startDate)} - ${formatDate(endDate)}`,
            landscapePageWidth / 2,
            22,
            { align: "center" }
        );

        // Table Headers
        const tableHeaders = [
            "Nama",
            "Peran",
            ...sortedActivityNames,
            "Total Waktu",
            "Total Kegiatan"
        ];

        // Column optimization logic (Borrowed from generateDalamAsramaPDF)
        const nameColWidth = 50;
        const roleColWidth = 25;
        const totalWaktuColWidth = 35;
        const totalKegiatanColWidth = 25;
        const fixedWidthUsed = nameColWidth + roleColWidth + totalWaktuColWidth + totalKegiatanColWidth; // 135

        const totalUsableWidth = 265; // ~A4 Landscape usable
        const remainingWidth = totalUsableWidth - fixedWidthUsed;
        const activityColWidth = sortedActivityNames.length > 0
            ? Math.floor(remainingWidth / sortedActivityNames.length)
            : 30;

        const columnStyles: any = {
            0: { cellWidth: nameColWidth },
            1: { cellWidth: roleColWidth },
        };

        // Dynamic activity columns
        sortedActivityNames.forEach((_, idx) => {
            columnStyles[idx + 2] = { cellWidth: activityColWidth, halign: "center" };
        });

        // Final columns
        const lastIdx = 2 + sortedActivityNames.length;
        columnStyles[lastIdx] = { cellWidth: totalWaktuColWidth, halign: "center" };
        columnStyles[lastIdx + 1] = { cellWidth: totalKegiatanColWidth, halign: "center" };

        autoTable(doc, {
            startY: 28,
            head: [tableHeaders],
            body: summaryData,
            theme: "grid",
            headStyles: {
                fillColor: [59, 130, 246], // Blue match
                textColor: 255,
                fontStyle: "bold",
                fontSize: 9,
                halign: "center",
                valign: "middle"
            },
            bodyStyles: {
                fontSize: 8,
                valign: "middle"
            },
            columnStyles: columnStyles,
            margin: { left: 14, right: 14 }
        });
    }

    const fileName = `Kegiatan-Luar-${startDate}-to-${endDate}.pdf`;
    doc.save(fileName);
}
