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
                };
            }
            summary[person.uid].mengajarPegonCount++;
        });
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
 * Generate and download PDF report for monthly kegiatan
 */
export function generateKegiatanPDF(
    activities: KegiatanData[],
    month: number,
    year: number,
    includeSummary: boolean = true
): void {
    // Create new PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Laporan Kegiatan Harian", pageWidth / 2, 15, { align: "center" });

    // Subtitle with month and year
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(
        `${getMonthName(month)} ${year}`,
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
        const summaryData = Object.values(summary)
            .sort((a, b) => a.name.localeCompare(b.name, "id-ID"))
            .map((person) => [
                person.name,
                person.role === "santri" ? "Santri" : "Pengurus",
                person.imamSubuhCount.toString(),
                person.imamMaghribCount.toString(),
                person.mengajarNgajiCount.toString(),
                person.mengajarPegonCount.toString(),
            ]);

        // Add new page for summary
        doc.addPage();

        // Summary title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Ringkasan Kegiatan per Orang", pageWidth / 2, 15, {
            align: "center",
        });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(
            `Total ${activities.length} hari dengan data kegiatan`,
            pageWidth / 2,
            22,
            { align: "center" }
        );

        // Generate summary table
        autoTable(doc, {
            startY: 28,
            head: [
                [
                    "Nama",
                    "Peran",
                    "Imam Subuh",
                    "Imam Maghrib",
                    "Mengajar Ngaji",
                    "Mengajar Pegon",
                ],
            ],
            body: summaryData,
            theme: "grid",
            headStyles: {
                fillColor: [245, 158, 11],
                textColor: 255,
                fontStyle: "bold",
                fontSize: 9,
            },
            bodyStyles: {
                fontSize: 8,
            },
            columnStyles: {
                0: { cellWidth: 50 }, // Name
                1: { cellWidth: 30 }, // Role
                2: { cellWidth: 25, halign: "center" }, // Imam Subuh count
                3: { cellWidth: 25, halign: "center" }, // Imam Maghrib count
                4: { cellWidth: 30, halign: "center" }, // Mengajar Ngaji count
                5: { cellWidth: 30, halign: "center" }, // Mengajar Pegon count
            },
        });
    }

    // Save PDF
    const fileName = `Kegiatan-${getMonthName(month)}-${year}.pdf`;
    doc.save(fileName);
}
