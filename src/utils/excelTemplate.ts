import * as XLSX from "xlsx";
import { KODE_ASRAMA } from "@/constants";

interface TemplateField {
  name: string;
  required: boolean;
  example?: string;
}

export function downloadSantriTemplate() {
  // Define the template fields
  const fields: TemplateField[] = [
    { name: "nama", required: true, example: "Putri Ayu" },
    { name: "kodeAsrama", required: true, example: KODE_ASRAMA },
    { name: "statusAktif", required: true, example: "Aktif" },
    { name: "nomorTelpon", required: true, example: "6281234567890" },
    { name: "nomorWalisantri", required: false, example: "6281234567890" },
    { name: "tanggalLahir", required: false, example: "06/06/2006" },
    { name: "kamar", required: false, example: "A1" },
    // { name: "kelas", required: false, example: "10" },
    { name: "semester/kelas", required: false, example: "1" },
    { name: "tahunMasuk", required: false, example: "2025" },
    { name: "jenjangPendidikan", required: false, example: "SMA" },
    { name: "programStudi", required: false, example: "" },
  ];

  // Create worksheet
  let ws = XLSX.utils.aoa_to_sheet([
    // Header row
    fields.map((field) => field.name),
    // Example row
    fields.map((field) => field.example || ""),
  ]);

  // Set column widths
  const colWidths = fields.map((field) => ({
    wch: Math.max(field.name.length, (field.example || "").length, 15),
  }));
  ws["!cols"] = colWidths;

  // Apply bold formatting to required field headers
  const requiredCols = fields.reduce((acc, field, index) => {
    if (field.required) {
      acc[XLSX.utils.encode_cell({ r: 0, c: index })] = {
        t: "s", // text
        v: field.name, // value
        s: { font: { bold: true } }, // style
      };
    }
    return acc;
  }, {} as Record<string, XLSX.CellObject>);

  // Apply cell styles
  Object.keys(requiredCols).forEach((cellRef) => {
    if (!ws[cellRef]) ws[cellRef] = requiredCols[cellRef];
    else ws[cellRef].s = { font: { bold: true } };
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");

  // Generate file and trigger download
  XLSX.writeFile(wb, "santri_import_template.xlsx");
}
