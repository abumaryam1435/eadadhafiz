declare const XLSX: any;
export const exportSheetTemplate = (fileName: string) => {
  const headers = [
    "اسم الطالب",
    "اسم الحلقة",
    "اسم المعلم",
    "المرحلة الدراسية",
    "هاتف ولي الأمر",
    "الحفظ القديم",
    "مستوى الطالب",
    "من الأمين؟",
    "من جامع عبري؟",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws["!rightToLeft"] = true;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell_ref = XLSX.utils.encode_cell({ c: C, r: 0 });
    if (ws[cell_ref]) {
      ws[cell_ref].s = {
        font: { bold: true, color: { rgb: "FFFFFFFF" } },
        fill: { fgColor: { rgb: "FF006A4E" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      };
    }
  }
  const exampleRow = [
    "عبدالله فهد",
    "حلقة 1",
    "خالد محمد",
    "ثانوي",
    "0501234567",
    "1-21, 582-604",
    "المستوى الأول",
    "نعم",
    "نعم",
  ];
  XLSX.utils.sheet_add_aoa(ws, [exampleRow], { origin: -1 });
  const colWidths = headers.map((header) => ({ wch: header.length + 10 }));
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "قالب استيراد الطلاب");
  XLSX.writeFile(wb, `\${fileName}.xlsx`);
};
