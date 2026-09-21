import React, { useState, useContext, useMemo, useEffect, useRef } from "react";
import { AppContext } from "../App";
import { UserRole, Student } from "../types";
import { renderCell } from "../utils/exportWord";
import { exportToExcel } from "../utils/exportExcel";
import { exportToWord } from "../utils/exportWord";
import { exportToPdf, sharePdfDirectly } from "../utils/exportPdf";
import { shareHtmlViaWhatsApp } from "../utils/exportHtml";
import { isSmartMatch, formatWhatsAppNumber } from "../utils/searchUtils";
import Modal from "./Modal";
import { FilterItem } from "./FilterItem";
import { formatAndCountJuzs, parseJuzsToNumbers } from "../utils/juzUtils";
import { getMemorizedPagesData, calculateStudentLevel, getCompletedJuzs, getLastMemorizedPage, getLevelNumericRank, ALL_LEVEL_NAMES, normalizeStudentLevel } from "../utils/pageUtils";
import { WordExportModal } from "./WordExportModal";
import { ExcelExportModal } from "./ExcelExportModal";

interface CombinedDataItem {
  serialNumber?: number;
  studentId: number;
  studentName: string;
  halaqaId: number;
  halaqaName: string;
  teacherId: number;
  teacherName: string;
  schoolStage: string;
  parentPhone?: string;
  oldMemorizedPagesStr: string;
  newMemorizedPagesStr: string;
  combinedMemorizedPagesStr: string;
  totalMemorizedPagesCount: number;
  autoCompletedJuzsStr: string;
  autoCompletedJuzsCount: number;
  lastMemorizedPageStr?: string;
  studentLevel: string;
  isAlAmeenStr: string;
  isFromIbriStr: string;
}

const SURAH_JUZ_MAPPING: Record<string, number[]> = {
  الفاتحة: [1],
  البقرة: [1, 2, 3],
  "آل عمران": [3, 4],
  النساء: [4, 5, 6],
  المائدة: [6, 7],
  الأنعام: [7, 8],
  الأعراف: [8, 9],
  الأنفال: [9, 10],
  التوبة: [10, 11],
  يونس: [11],
  هود: [11, 12],
  يوسف: [12, 13],
  الرعد: [13],
  إبراهيم: [13],
  الحجر: [14],
  النحل: [14],
  الإسراء: [15],
  الكهف: [15, 16],
  مريم: [16],
  طه: [16],
  الأنبياء: [17],
  الحج: [17],
  المؤمنون: [18],
  النور: [18],
  الفرقان: [18, 19],
  الشعراء: [19],
  النمل: [19, 20],
  القصص: [20],
  العنكبوت: [20, 21],
  الروم: [21],
  لقمان: [21],
  السجدة: [21],
  الأحزاب: [21, 22],
  سبأ: [22],
  فاطر: [22],
  يس: [22, 23],
  الصافات: [23],
  ص: [23],
  الزمر: [23, 24],
  غافر: [24],
  فصلت: [24, 25],
  الشورى: [25],
  الزخرف: [25],
  الدخان: [25],
  الجاثية: [25],
  الأحقاف: [26],
  محمد: [26],
  الفتح: [26],
  الحجرات: [26],
  ق: [26],
  الذاريات: [26, 27],
  الطور: [27],
  النجم: [27],
  القمر: [27],
  الرحمن: [27],
  الواقعة: [27],
  الحديد: [27],
  المجادلة: [28],
  الحشر: [28],
  الممتحنة: [28],
  الصف: [28],
  الجمعة: [28],
  المنافقون: [28],
  التغابن: [28],
  الطلاق: [28],
  التحريم: [28],
  الملك: [29],
  القلم: [29],
  الحاقة: [29],
  المعارج: [29],
  نوح: [29],
  الجن: [29],
  المزمل: [29],
  المدثر: [29],
  القيامة: [29],
  الإنسان: [29],
  المرسلات: [29],
  النبأ: [30],
  النازعات: [30],
  عبس: [30],
  التكوير: [30],
  الإنفطار: [30],
  المطففين: [30],
  الإنشقاق: [30],
  البروج: [30],
  الطارق: [30],
  الأعلى: [30],
  الغاشية: [30],
  الفجر: [30],
  البلد: [30],
  الشمس: [30],
  الليل: [30],
  الضحى: [30],
  الشرح: [30],
  التين: [30],
  العلق: [30],
  القدر: [30],
  البينة: [30],
  الزلزلة: [30],
  العاديات: [30],
  القارعة: [30],
  التكاثر: [30],
  العصر: [30],
  الهمزة: [30],
  الفيل: [30],
  قريش: [30],
  الماعون: [30],
  الكوثر: [30],
  الكافرون: [30],
  النصر: [30],
  المسد: [30],
  الإخلاص: [30],
  الفلق: [30],
  الناس: [30],
};

const isValueEffectivelyEmpty = (value: any): boolean => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  let stringValue = String(value).trim();
  if (stringValue === "" || stringValue === "—" || stringValue === "-") return true;
  return false;
};


function countOldPages(str: string): number {
  if (!str) return 0;
  let count = 0;
  const parts = str.split(/[,،]/);
  for (const part of parts) {
    const range = part.trim().split('-');
    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        count += (Math.abs(end - start) + 1);
      }
    } else if (range.length === 1) {
      const num = parseInt(range[0], 10);
      if (!isNaN(num)) count += 1;
    }
  }
  return count;
}

function numbersToRanges(nums: number[]): string {
  if (!nums || nums.length === 0) return "";
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  let ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

export const OverviewTable: React.FC = () => {
  const context = useContext(AppContext);
  const students = context?.students || [];
  const halaqas = context?.halaqas || [];
  const users = context?.users || [];
  const evaluations = context?.evaluations || [];
  const deleteStudent = context?.deleteStudent || (() => {});
  const updateStudent = context?.updateStudent || (() => {});
  const showToast = context?.showToast || (() => {});
  const hijriAdjustments = context?.hijriAdjustments;

  const [searchTerm, setSearchTerm] = useState("");
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const scrollTable = (direction: 'right' | 'left') => {
    if (tableContainerRef.current) {
      const delta = direction === 'right' ? 300 : -300;
      tableContainerRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  const [sortConfig, setSortConfig] = useState<{
    key: keyof CombinedDataItem;
    direction: "ascending" | "descending";
  } | null>({ key: "halaqaName", direction: "ascending" });

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editHalaqaId, setEditHalaqaId] = useState<number>(0);
  const [editSchoolStage, setEditSchoolStage] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");
  const [editStudentLevel, setEditStudentLevel] = useState("");
  const [editOldMemorizedPages, setEditOldMemorizedPages] = useState("");
  const [editIsAlAmeen, setEditIsAlAmeen] = useState(false);
  const [editIsFromIbri, setEditIsFromIbri] = useState(true);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedHalaqaIds, setSelectedHalaqaIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  
  const [selectedStudentLevels, setSelectedStudentLevels] = useState<string[]>([]);
  const [selectedAlAmeen, setSelectedAlAmeen] = useState<string[]>([]);
  const [selectedFromIbri, setSelectedFromIbri] = useState<string[]>(['نعم']);

  const [studentSearch, setStudentSearch] = useState("");
  const [halaqaSearch, setHalaqaSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  
  const [studentLevelSearch, setStudentLevelSearch] = useState("");
  const [alAmeenSearch, setAlAmeenSearch] = useState("");
  const [fromIbriSearch, setFromIbriSearch] = useState("");

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const defaultExcludedKeys = useMemo(() => ["lastMemorizedPageStr", "parentPhone"], []);

  const allHeaders: { key: keyof CombinedDataItem; label: string }[] = useMemo(
    () => [
      { key: "serialNumber", label: "م" },
      { key: "studentName", label: "اسم الطالب" },
      { key: "halaqaName", label: "اسم الحلقة" },
      { key: "teacherName", label: "اسم المعلم" },
      { key: "schoolStage", label: "المرحلة الدراسية" },
      { key: "parentPhone", label: "هاتف ولي الأمر" },
      { key: "oldMemorizedPagesStr", label: "الحفظ القديم" },
      { key: "newMemorizedPagesStr", label: "الحفظ الجديد" },
      { key: "combinedMemorizedPagesStr", label: "أرقام صفحات الحفظ" },
      { key: "totalMemorizedPagesCount", label: "عدد الصفحات" },
      { key: "autoCompletedJuzsStr", label: "أرقام الأجزاء" },
      { key: "autoCompletedJuzsCount", label: "عدد الأجزاء" },
      { key: "lastMemorizedPageStr", label: "آخر صفحة تم حفظها" },
      { key: "studentLevel", label: "المستوى" },
      { key: "isAlAmeenStr", label: "من الأمين؟" },
      { key: "isFromIbriStr", label: "من جامع عبري؟" },
    ],
    [],
  );

  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>(() => {
    const savedColumns = localStorage.getItem("overviewTableColumns");
    const baseOrder = allHeaders.map((h) => h.key as string);
    const defaultKeys = baseOrder.filter((k) => !defaultExcludedKeys.includes(k));
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.selected)) {
          return parsed.selected;
        }
      } catch (e) {
        console.error("Error parsing columns", e);
      }
    }
    return defaultKeys;
  });
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [isDefaultSaved, setIsDefaultSaved] = useState(false);
  const columnPickerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const savedColumns = localStorage.getItem("overviewTableColumns");
    const baseOrder = allHeaders.map((h) => h.key as string);
    const defaultKeys = baseOrder.filter((k) => !defaultExcludedKeys.includes(k));
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedColumnKeys(parsed);
          const customMiddle = parsed.filter(k => k !== 'serialNumber');
          const remaining = baseOrder.filter(k => !customMiddle.includes(k) && k !== 'serialNumber');
          setColumnOrder(['serialNumber', ...customMiddle, ...remaining]);
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.selected)) setSelectedColumnKeys(parsed.selected);
          if (Array.isArray(parsed.order)) {
            const middle = parsed.order.filter((k: string) => k !== 'serialNumber');
            const missing = baseOrder.filter(k => !middle.includes(k) && k !== 'serialNumber');
            setColumnOrder(['serialNumber', ...middle, ...missing]);
          } else {
            setColumnOrder(baseOrder);
          }
        } else {
          setSelectedColumnKeys(defaultKeys);
          setColumnOrder(baseOrder);
        }
      } catch (e) {
        console.error("Error parsing columns", e);
        setSelectedColumnKeys(defaultKeys);
        setColumnOrder(baseOrder);
      }
    } else {
      setSelectedColumnKeys(defaultKeys);
      setColumnOrder(baseOrder);
    }
  }, [allHeaders, defaultExcludedKeys]);

  const moveColumn = (key: string, direction: 'up' | 'down') => {
    if (key === 'serialNumber') return;
    setColumnOrder(prev => {
      const baseOrder = allHeaders.map(h => h.key as string);
      const currentFull = prev.length > 0 ? prev : baseOrder;
      const middle = currentFull.filter(k => k !== 'serialNumber');
      const idx = middle.indexOf(key);
      if (idx === -1) return currentFull;

      if (direction === 'up' && idx > 0) {
        const updated = [...middle];
        [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
        return ['serialNumber', ...updated];
      }
      if (direction === 'down' && idx < middle.length - 1) {
        const updated = [...middle];
        [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
        return ['serialNumber', ...updated];
      }
      return currentFull;
    });
  };

  const handleSaveAsDefault = () => {
    localStorage.setItem(
      "overviewTableColumns",
      JSON.stringify({
        selected: selectedColumnKeys,
        order: columnOrder.length > 0 ? columnOrder : allHeaders.map((h) => h.key),
      }),
    );
    setIsDefaultSaved(true);
    setTimeout(() => setIsDefaultSaved(false), 2500);
  };

  const handleResetToDefault = () => {
    localStorage.removeItem("overviewTableColumns");
    const baseOrder = allHeaders.map((h) => h.key as string);
    const defaultKeys = baseOrder.filter((k) => !defaultExcludedKeys.includes(k));
    setSelectedColumnKeys(defaultKeys);
    setColumnOrder(baseOrder);
  };

  const handleApplyComprehensiveTemplateOrder = () => {
    // الأعمدة الموجودة في "تنزيل القالب الشامل (مع المراحل وهاتف ولي الأمر والحفظ القديم ومستوى الطالب)" بالإعدادات وبنفس الترتيب
    const templateKeys: string[] = [
      "studentName",
      "halaqaName",
      "teacherName",
      "schoolStage",
      "parentPhone",
      "oldMemorizedPagesStr",
      "studentLevel",
      "isAlAmeenStr",
    ];

    setSelectedColumnKeys(templateKeys);

    const baseOrder = allHeaders.map((h) => h.key as string);
    const remaining = baseOrder.filter(
      (k) => !templateKeys.includes(k) && k !== "serialNumber"
    );

    setColumnOrder(["serialNumber", ...templateKeys, ...remaining]);
    showToast("✅ تم ترتيب وعرض الأعمدة وفق القالب الشامل");
  };

  const getAutoStudentData = (studentId: number) => {
    const studentEvaluations = evaluations.filter(
      (e) => e.studentId === studentId && e.surahs && e.surahs.length > 0,
    );
    const uniqueSurahs = new Set<string>();
    const uniqueJuzs = new Set<number>();

    studentEvaluations.forEach((e) => {
      e.surahs?.forEach((s) => {
        uniqueSurahs.add(s);
        const juzs = SURAH_JUZ_MAPPING[s] || [];
        juzs.forEach((j) => uniqueJuzs.add(j));
      });
    });

    const targetStudent = students.find((s) => s.id === studentId);
    let completedJuzs: number[] = [];
    if (targetStudent) {
        completedJuzs = getCompletedJuzs(getMemorizedPagesData(targetStudent, evaluations).totalSet);
    }

    return {
      surahs: Array.from(uniqueSurahs),
      juzs: Array.from(uniqueJuzs)
        .sort((a, b) => a - b)
        .map(String),
      completedJuzs: completedJuzs
    };
  };

  // تحديث قيم المدخلات عند اختيار طالب للتعديل لضمان عدم ظهورها فارغة
  useEffect(() => {
    if (editingStudent) {
      setEditName(editingStudent.name);
      const studentHalaqaExists = halaqas.some((h) => h.id === editingStudent.halaqaId);
      setEditHalaqaId(studentHalaqaExists ? editingStudent.halaqaId : 0);
      setEditSchoolStage(editingStudent.schoolStage || "");
      setEditParentPhone(editingStudent.parentPhone || "");
      setEditIsAlAmeen(!!editingStudent.isAlAmeen);
      setEditIsFromIbri(editingStudent.isFromIbri !== false);

      setEditOldMemorizedPages(editingStudent.oldMemorizedPages || "");
      const currentManual = normalizeStudentLevel(editingStudent.manualStudentLevel || editingStudent.manualLevel);
      setEditStudentLevel(currentManual);
    } else {
      setEditName("");
      setEditHalaqaId(0);
      setEditSchoolStage("");
      setEditParentPhone("");
      setEditIsAlAmeen(false);
      setEditIsFromIbri(true);
    }
  }, [editingStudent, halaqas]);

  const combinedData = useMemo(() => {
    return students.map((student) => {
      const halaqa = halaqas.find((h) => h.id === student.halaqaId);
      const teacher = halaqa
        ? users.find(
            (u) => u.id === halaqa.teacherId && u.role === UserRole.TEACHER,
          )
        : null;

      const isAlAmeenStr = student.isAlAmeen ? "نعم" : "لا";
      const isFromIbriStr = (student.isFromIbri !== false) ? "نعم" : "لا";
      const pagesData = getMemorizedPagesData(student, evaluations);
      const autoCompletedJuzsArr = getCompletedJuzs(pagesData.totalSet);
      const autoCompletedJuzsStr = formatAndCountJuzs(autoCompletedJuzsArr.map(String)).formatted;
      const autoCompletedJuzsCount = autoCompletedJuzsArr.length;
      const lastMemorizedPageStr = getLastMemorizedPage(student, evaluations);

      const studentLevel = normalizeStudentLevel(student.manualStudentLevel || student.manualLevel) || calculateStudentLevel(pagesData.totalCount);

      return {
        oldMemorizedPagesStr: pagesData.oldStr,
        studentLevel,
        newMemorizedPagesStr: pagesData.newStr,
        combinedMemorizedPagesStr: pagesData.combinedStr,
        totalMemorizedPagesCount: pagesData.totalCount,
        autoCompletedJuzsStr,
        autoCompletedJuzsCount,
        lastMemorizedPageStr,
        studentId: student.id,
        studentName: student.name,
        halaqaId: halaqa?.id || 0,
        halaqaName: halaqa?.name || "غير محدد",
        teacherId: teacher?.id || 0,
        teacherName: teacher?.name || "غير معين",
        schoolStage: student.schoolStage || "",
        parentPhone: student.parentPhone || "",

        isAlAmeenStr,
        isFromIbriStr,
      };
    });
  }, [students, halaqas, users, evaluations]);



  const studentOptions = useMemo(() => {
    return students.map((s) => ({ id: String(s.id), name: s.name }));
  }, [students]);

  const halaqaOptions = useMemo(() => {
    return [...halaqas]
      .sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }))
      .map((h) => ({ id: String(h.id), name: h.name }));
  }, [halaqas]);

  const teacherOptions = useMemo(() => {
    return users
      .filter((u) => u.role === UserRole.TEACHER)
      .map((t) => ({ id: String(t.id), name: t.name }));
  }, [users]);

  const studentLevelOptions = useMemo(() => {
    const levels = new Set<string>();
    combinedData.forEach((d) => {
      const norm = normalizeStudentLevel(d.studentLevel);
      if (norm) levels.add(norm);
    });
    return Array.from(levels)
      .sort((a, b) => getLevelNumericRank(a) - getLevelNumericRank(b))
      .map((l) => ({ id: l, name: l }));
  }, [combinedData]);

  const alAmeenOptions = [
    { id: "نعم", name: "نعم" },
    { id: "لا", name: "لا" },
  ];

  const ibriOptions = [
    { id: "نعم", name: "نعم" },
    { id: "لا", name: "لا" },
  ];

  const filteredAndSortedData = useMemo(() => {
    let sortableItems = [...combinedData];
    if (searchTerm.trim()) {
      sortableItems = sortableItems.filter(
        (item) =>
          isSmartMatch(item.studentName, searchTerm) ||
          isSmartMatch(item.halaqaName, searchTerm) ||
          isSmartMatch(item.teacherName, searchTerm) ||
          isSmartMatch(item.schoolStage, searchTerm) ||
          isSmartMatch(item.parentPhone, searchTerm) ||
          isSmartMatch(item.studentLevel, searchTerm) ||
          isSmartMatch(item.oldMemorizedPagesStr, searchTerm) ||
          isSmartMatch(item.lastMemorizedPageStr, searchTerm) ||
          isSmartMatch(item.isAlAmeenStr, searchTerm) ||
          isSmartMatch(item.isFromIbriStr, searchTerm),
      );
    }

    if (selectedStudentIds.length > 0 && !selectedStudentIds.includes("ALL") && !selectedStudentIds.includes("all")) {
      sortableItems = sortableItems.filter((item) =>
        selectedStudentIds.includes(String(item.studentId)),
      );
    }
    if (selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes("ALL") && !selectedHalaqaIds.includes("all")) {
      sortableItems = sortableItems.filter((item) =>
        selectedHalaqaIds.includes(String(item.halaqaId)),
      );
    }
    if (selectedTeacherIds.length > 0 && !selectedTeacherIds.includes("ALL") && !selectedTeacherIds.includes("all")) {
      sortableItems = sortableItems.filter((item) =>
        selectedTeacherIds.includes(String(item.teacherId)),
      );
    }
    if (selectedStudentLevels.length > 0 && !selectedStudentLevels.includes("ALL") && !selectedStudentLevels.includes("all")) {
      sortableItems = sortableItems.filter((item) =>
        selectedStudentLevels.includes(item.studentLevel),
      );
    }
    if (selectedAlAmeen.length > 0 && !selectedAlAmeen.includes("ALL") && !selectedAlAmeen.includes("all")) {
      sortableItems = sortableItems.filter((item) =>
        selectedAlAmeen.includes(item.isAlAmeenStr),
      );
    }
    if (selectedFromIbri.length > 0 && !selectedFromIbri.includes("ALL") && !selectedFromIbri.includes("all")) {
      sortableItems = sortableItems.filter((item) =>
        selectedFromIbri.includes(item.isFromIbriStr),
      );
    }

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'halaqaName' || sortConfig.key === 'studentName') {
          const isHalaqaVisible = selectedColumnKeys.includes('halaqaName');
          if (isHalaqaVisible) {
            const hA = a.halaqaName || '';
            const hB = b.halaqaName || '';
            const halaqaComp = hA.localeCompare(hB, 'ar', { numeric: true });
            if (halaqaComp !== 0) {
              const direction = sortConfig.key === 'halaqaName' ? sortConfig.direction : 'ascending';
              return direction === 'ascending' ? halaqaComp : -halaqaComp;
            }
          }
          const sA = a.studentName || '';
          const sB = b.studentName || '';
          const studentComp = sA.localeCompare(sB, 'ar', { numeric: true });
          const direction = sortConfig.key === 'studentName' ? sortConfig.direction : 'ascending';
          return direction === 'ascending' ? studentComp : -studentComp;
        }

        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (typeof valA === "string" && typeof valB === "string") {
          const comparison = valA.localeCompare(valB, "ar", { numeric: true });
          return sortConfig.direction === "ascending"
            ? comparison
            : -comparison;
        }
        if (valA < valB) return sortConfig.direction === "ascending" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems.map((item, index) => ({
      ...item,
      serialNumber: index + 1,
    }));
  }, [
    combinedData,
    searchTerm,
    sortConfig,
    selectedStudentIds,
    selectedHalaqaIds,
    selectedTeacherIds,
    selectedStudentLevels,
    selectedAlAmeen,
    selectedFromIbri,
    selectedColumnKeys,
  ]);

  const requestSort = (key: keyof CombinedDataItem) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    )
      direction = "descending";
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof CombinedDataItem) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  const getDynamicHeaders = (data: any[]) => {
    const headersMap = new Map(allHeaders.map((h) => [h.key as string, h]));
    const currentOrder = columnOrder.length > 0 ? columnOrder : allHeaders.map((h) => h.key as string);
    const orderedSelected = currentOrder.filter(k => selectedColumnKeys.includes(k) && headersMap.has(k));
    const hasSeq = orderedSelected.includes('serialNumber');
    const middle = orderedSelected.filter(k => k !== 'serialNumber');

    const finalKeys: string[] = [];
    if (hasSeq) finalKeys.push('serialNumber');
    finalKeys.push(...middle);

    const orderedHeaders = finalKeys.map(k => headersMap.get(k)!).filter(Boolean);

    if (data.length === 0) return orderedHeaders;
    const keysWithMeaningfulData = new Set<string>();
    for (const item of data) {
      for (const header of allHeaders) {
        const value = item[header.key as keyof typeof item];
        if (
          !isValueEffectivelyEmpty(value) &&
          value !== "غير معروف" &&
          value !== "غير معين"
        )
          keysWithMeaningfulData.add(header.key as string);
      }
    }
    // ضمان بقاء أعمدة القالب الشامل ظاهرة دائماً عند اختيارها
    const templateKeys = [
      "studentName",
      "halaqaName",
      "teacherName",
      "schoolStage",
      "parentPhone",
      "oldMemorizedPagesStr",
      "studentLevel",
      "isAlAmeenStr",
      "isFromIbriStr",
    ];
    templateKeys.forEach((k) => {
      if (selectedColumnKeys.includes(k)) {
        keysWithMeaningfulData.add(k);
      }
    });
    return orderedHeaders.filter((header) => keysWithMeaningfulData.has(header.key as string));
  };

  const handleUpdateStudent = () => {
    if (editingStudent && editName.trim()) {
      const calculatedStudentLevel = calculateStudentLevel(
        getMemorizedPagesData({ ...editingStudent, oldMemorizedPages: editOldMemorizedPages }, evaluations).totalCount
      );
      const normalizedManual = normalizeStudentLevel(editStudentLevel);
      const finalStudentLevel = (!normalizedManual || normalizedManual === calculatedStudentLevel) ? "" : normalizedManual;

      updateStudent({
        ...editingStudent,
        name: editName.trim(),
        halaqaId: editHalaqaId,
        schoolStage: editSchoolStage.trim(),
        parentPhone: editParentPhone.trim(),
        manualStudentLevel: finalStudentLevel,
        manualLevel: finalStudentLevel,
        isAlAmeen: editIsAlAmeen,
        isFromIbri: editIsFromIbri,
        oldMemorizedPages: editOldMemorizedPages.trim(),
      });
      setEditingStudent(null);
      showToast("✅ تم تحديث بيانات الطالب بنجاح");
    }
  };

  const handleDeleteConfirm = () => {
    if (studentToDelete) {
      deleteStudent(studentToDelete);
      setStudentToDelete(null);
      showToast("✅ تم حذف الطالب بنجاح");
    }
  };

  return (
    <>
      {studentToDelete && (
        <Modal
          title="تأكيد حذف الطالب"
          onClose={() => setStudentToDelete(null)}
          hideDefaultCloseButton={true}
        >
          <div className="text-center">
            <p className="py-4 text-xl dark:text-gray-200 font-bold">
              هل أنت متأكد من حذف الطالب؟
            </p>
            <p className="text-gray-500 dark:text-gray-400 mb-6 font-bold">
              سيتم حذف الطالب وجميع تقييماته المسجلة نهائياً.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-4 border-t dark:border-gray-700">
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all"
              >
                نعم، حذف
              </button>
              <button
                onClick={() => setStudentToDelete(null)}
                className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-2xl hover:bg-gray-300 font-bold dark:bg-gray-700 dark:text-gray-200 text-xl"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingStudent && (
        <Modal
          title="تعديل بيانات الطالب"
          onClose={() => setEditingStudent(null)}
          hideDefaultCloseButton={true}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                  اسم الطالب:
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-style text-lg font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-normal"
                  placeholder="مثال: عبد الله بن محمد"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                  الحلقة:
                </label>
                <select
                  value={editHalaqaId}
                  onChange={(e) => setEditHalaqaId(Number(e.target.value))}
                  className="input-style font-bold"
                >
                  <option value={0}>غير محدد</option>
                  {[...halaqas]
                    .sort((a, b) =>
                      a.name.localeCompare(b.name, "ar", { numeric: true }),
                    )
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                  المرحلة الدراسية:
                </label>
                <input
                  type="text"
                  value={editSchoolStage}
                  onChange={(e) => setEditSchoolStage(e.target.value)}
                  className="input-style font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-normal"
                  placeholder="مثال: ابتدائي، متوسط، ثانوي..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                  هاتف ولي الأمر:
                </label>
                <input
                  type="tel"
                  value={editParentPhone}
                  onChange={(e) => setEditParentPhone(e.target.value)}
                  className="input-style font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-normal text-left"
                  placeholder="مثال: 0501234567"
                  dir="ltr"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                الحفظ القديم (أرقام صفحات بالعربية أو الإنجليزية مثل: 1-21، 582-604 أو ١-٢١، ٥٨٢-٦٠٤):
              </label>
              <input
                type="text"
                value={editOldMemorizedPages}
                onChange={(e) => setEditOldMemorizedPages(e.target.value)}
                className="input-style text-lg font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-normal text-right"
                placeholder="مثال: 1-21، 582-604 أو ١-٢١، ٥٨٢-٦٠٤"
                dir="rtl"
              />
            </div>

                        <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                  مستوى الطالب:
                </label>
                {editingStudent && editStudentLevel && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditStudentLevel("");
                      showToast("🔄 تم العودة للمستوى التلقائي (بحسب الحفظ)");
                    }}
                    className="text-[10px] font-bold px-2 py-1 bg-white dark:bg-gray-700 border border-indigo-200 dark:border-indigo-600 text-indigo-600 dark:text-indigo-300 rounded-md hover:bg-indigo-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    العودة للتلقائي
                  </button>
                )}
              </div>
              <select
                value={editStudentLevel}
                onChange={(e) => setEditStudentLevel(e.target.value)}
                className="input-style text-sm font-medium"
              >
                <option value="">
                  {`تلقائي (بحسب الحفظ: ${calculateStudentLevel(
                    getMemorizedPagesData({ ...editingStudent, oldMemorizedPages: editOldMemorizedPages }, evaluations).totalCount
                  )})`}
                </option>
                {ALL_LEVEL_NAMES.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
              {editingStudent && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  المستوى التلقائي المحسوب:{" "}
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {calculateStudentLevel(
                      getMemorizedPagesData({ ...editingStudent, oldMemorizedPages: editOldMemorizedPages }, evaluations).totalCount
                    )}
                  </span>
                  {editStudentLevel ? (
                    <span className="text-amber-600 dark:text-amber-400 mr-2 font-bold">
                      (تعديل يدوي محدد: {editStudentLevel})
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 mr-2 font-bold">
                      (معتمد تلقائياً)
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsAlAmeen}
                  onChange={(e) => setEditIsAlAmeen(e.target.checked)}
                  className="w-5 h-5 text-green-600 rounded focus:ring-green-500 bg-white"
                />
                <span className="text-sm font-bold text-orange-900 dark:text-orange-200">
                  هذا الطالب مسجل في مركز الأمين
                </span>
              </label>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsFromIbri}
                  onChange={(e) => setEditIsFromIbri(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 bg-white"
                />
                <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                  هذا الطالب من جامع عبري
                </span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t dark:border-gray-700">
              <button
                onClick={handleUpdateStudent}
                className="flex-1 py-4 bg-green-700 text-white rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all"
              >
                حفظ التغييرات
              </button>
              <button
                onClick={() => setEditingStudent(null)}
                className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-2xl hover:bg-gray-300 font-bold dark:bg-gray-700 dark:text-gray-200 text-xl"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg dark:bg-gray-800 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b dark:border-gray-700 pb-4">
          <h3 className="text-2xl font-bold text-green-900 dark:text-green-300">
            نظرة عامة على بيانات الطلاب
          </h3>
          <div className="px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg font-black shadow-sm text-sm border border-green-100 dark:border-green-800">
            عدد السجلات: {filteredAndSortedData.length}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 mb-4 no-print">
          <FilterItem
            id="student"
            title="الطالب"
            selectedValues={selectedStudentIds}
            options={studentOptions}
            onSelect={setSelectedStudentIds}
            search={studentSearch}
            setSearch={setStudentSearch}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
          <FilterItem
            id="halaqa"
            title="حلقة الطالب"
            selectedValues={selectedHalaqaIds}
            options={halaqaOptions}
            onSelect={setSelectedHalaqaIds}
            search={halaqaSearch}
            setSearch={setHalaqaSearch}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
          <FilterItem
            id="teacher"
            title="المعلم"
            selectedValues={selectedTeacherIds}
            options={teacherOptions}
            onSelect={setSelectedTeacherIds}
            search={teacherSearch}
            setSearch={setTeacherSearch}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
          <FilterItem
            id="studentLevel"
            title="مستوى الطالب"
            selectedValues={selectedStudentLevels}
            options={studentLevelOptions}
            onSelect={setSelectedStudentLevels}
            search={studentLevelSearch}
            setSearch={setStudentLevelSearch}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
          <FilterItem
            id="alAmeen"
            title="من الأمين؟"
            selectedValues={selectedAlAmeen}
            options={alAmeenOptions}
            onSelect={setSelectedAlAmeen}
            search={alAmeenSearch}
            setSearch={setAlAmeenSearch}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
          <FilterItem
            id="fromIbri"
            title="من جامع عبري؟"
            selectedValues={selectedFromIbri}
            options={ibriOptions}
            onSelect={setSelectedFromIbri}
            search={fromIbriSearch}
            setSearch={setFromIbriSearch}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-end gap-3 mb-4 no-print mt-4 border-t dark:border-gray-700 pt-5">
          <div className="flex-grow w-full sm:w-auto relative">
            <label
              htmlFor="search-overview"
              className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200"
            >
              بحث شامل (اسم الطالب، الحلقة، المعلم)
            </label>
            <div className="relative">
              <input
                id="search-overview"
                type="text"
                placeholder="ابحث عن طالب، حلقة، أو معلم..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-style w-full pl-10"
              />
              <svg
                className="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse self-end">
            <button
              onClick={() => setIsExcelModalOpen(true)}
              className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 rounded-lg shadow-sm"
            >
              Excel
            </button>
            <button
              onClick={() => setIsWordModalOpen(true)}
              className="px-3 py-2 text-[10px] font-bold text-white bg-blue-600 rounded-lg shadow-sm"
            >
              Word
            </button>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  exportToPdf(
                    getDynamicHeaders(filteredAndSortedData),
                    filteredAndSortedData,
                    "نظرة_عامة_البيانات",
                    "نظرة عامة على بيانات الطلاب",
                  )
                }
                className="px-3 py-2 text-[10px] font-bold text-white bg-red-600 rounded-lg shadow-sm active:scale-95 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                طباعة
              </button>

              <button
                onClick={() =>
                  sharePdfDirectly(
                    getDynamicHeaders(filteredAndSortedData),
                    filteredAndSortedData,
                    "نظرة_عامة_البيانات",
                    "نظرة عامة على بيانات الطلاب",
                    undefined,
                    hijriAdjustments,
                    undefined,
                    undefined,
                    "landscape"
                  )
                }
                className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm active:scale-95 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                مشاركة PDF
              </button>
            </div>
            <div ref={columnPickerRef} className="relative inline-block text-right">
              <button
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                className="px-3 py-2 text-[10px] font-bold text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-lg shadow-sm flex items-center gap-2"
              >
                الأعمدة
              </button>
              {showColumnPicker && (
                <>
                  <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[65] sm:hidden" 
                    onClick={() => setShowColumnPicker(false)} 
                  />
                  <div className="fixed sm:absolute z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 sm:top-full sm:left-0 sm:right-auto sm:mt-2 w-[92vw] max-w-sm sm:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-fade-in ring-1 ring-black/10 text-right">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b dark:border-gray-700">
                      <span className="text-xs font-black text-green-800 dark:text-green-400">
                        تخصيص وترتيب الأعمدة
                      </span>
                      <button
                        onClick={() => setShowColumnPicker(false)}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2 pb-2 border-b dark:border-gray-700">
                      <button
                        onClick={() =>
                          setSelectedColumnKeys(allHeaders.map((h) => h.key as string))
                        }
                        className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex-1 text-center bg-blue-50 dark:bg-blue-900/30 py-1.5 rounded-lg"
                      >
                        إظهار الكل
                      </button>
                      <button
                        onClick={() => setSelectedColumnKeys([])}
                        className="text-[11px] text-red-600 dark:text-red-400 font-bold hover:underline flex-1 text-center bg-red-50 dark:bg-red-900/30 py-1.5 rounded-lg"
                      >
                        إخفاء الكل
                      </button>
                    </div>
                    <div className="max-h-[50vh] sm:max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1 divide-y divide-gray-100 dark:divide-gray-700/40">
                      {(columnOrder.length > 0 ? columnOrder : allHeaders.map((h) => h.key as string)).map((key) => {
                        const h = allHeaders.find((item) => item.key === key);
                        if (!h) return null;
                        const isChecked = selectedColumnKeys.includes(h.key as string);
                        const currentOrder = columnOrder.length > 0 ? columnOrder : allHeaders.map((item) => item.key as string);
                        const middleKeys = currentOrder.filter(k => k !== 'serialNumber');
                        const middleIdx = middleKeys.indexOf(h.key as string);
                        const isFirstMiddle = middleIdx === 0;
                        const isLastMiddle = middleIdx === middleKeys.length - 1;

                        return (
                          <div key={h.key} className="flex items-center justify-between gap-3 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl group transition-colors">
                            <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  setSelectedColumnKeys((prev) =>
                                    isChecked
                                      ? prev.filter((k) => k !== (h.key as string))
                                      : [...prev, h.key as string],
                                  )
                                }
                                className="w-4 h-4 rounded text-green-600 border-gray-300 focus:ring-green-500 cursor-pointer flex-shrink-0"
                              />
                              <span
                                className={`text-xs font-bold truncate ${isChecked ? "text-green-950 dark:text-green-200" : "text-gray-400 dark:text-gray-500"}`}
                              >
                                {h.label}
                              </span>
                            </label>

                            {h.key === 'serialNumber' ? (
                              <span className="text-[10px] sm:text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800 whitespace-nowrap flex-shrink-0">
                                الأول دائماً
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  type="button"
                                  disabled={isFirstMiddle}
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveColumn(h.key as string, 'up'); }}
                                  className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                                  title="تقديم للأعلى"
                                  aria-label="تقديم للأعلى"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  disabled={isLastMiddle}
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveColumn(h.key as string, 'down'); }}
                                  className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                                  title="تأخير للأسفل"
                                  aria-label="تأخير للأسفل"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2.5 mt-2.5 border-t dark:border-gray-700 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={handleSaveAsDefault}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                          isDefaultSaved
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-500/30 active:scale-95"
                        }`}
                      >
                        {isDefaultSaved ? (
                          <span>✓ تم حفظ الترتيب والتنسيق الافتراضي</span>
                        ) : (
                          <>
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                              />
                            </svg>
                            <span>حفظ الترتيب كعرض افتراضي</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="w-full py-1 text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold text-center transition-colors cursor-pointer"
                      >
                        استعادة الترتيب الافتراضي
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyComprehensiveTemplateOrder}
                        className="w-full py-1.5 px-2.5 mt-0.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-700 transition-all shadow-xs active:scale-95 cursor-pointer text-center"
                        title="إظهار وترتيب الأعمدة تلقائياً بنفس ترتيب القالب الشامل (مع المراحل والحفظ القديم ومستوى الطالب) في الإعدادات"
                      >
                        <svg
                          className="w-3.5 h-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>ترتيب وعرض حسب القالب الشامل</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-2 no-print sm:hidden">
            <span className="text-xs text-gray-500 font-bold">مرر يميناً ويساراً لعرض الأعمدة</span>
            <div className="flex gap-2">
                <button
                    onClick={() => scrollTable('right')}
                    className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title="تمرير يمين"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
                <button
                    onClick={() => scrollTable('left')}
                    className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title="تمرير يسار"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
            </div>
        </div>

        <div className="relative group">
          <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
               <button
                    onClick={() => scrollTable('right')}
                    className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                    title="تمرير يمين"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                </button>
          </div>
          
          <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
               <button
                    onClick={() => scrollTable('left')}
                    className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                    title="تمرير يسار"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                </button>
          </div>

          <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-gray-100 dark:border-gray-700 custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/90 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                <tr>
                {getDynamicHeaders(filteredAndSortedData).map((header) => (
                  <th
                    key={header.key}
                    onClick={() =>
                      requestSort(header.key as keyof CombinedDataItem)
                    }
                    scope="col"
                    className={`px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer dark:text-gray-200 hover:text-green-800 transition-colors whitespace-nowrap ${(header.key as string) === 'serialNumber' || (header.key as string) === 'sequence' ? 'w-px !px-2 text-center' : 'text-right'}`}
                  >
                    {header.label}
                    {getSortIndicator(header.key as keyof CombinedDataItem)}
                  </th>
                ))}
                <th className="px-4 py-4 text-center text-xs font-bold text-gray-500 no-print">
                  العمليات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
              {filteredAndSortedData.map((item, index) => (
                <tr
                  key={item.studentId}
                  className={
                    item.isAlAmeenStr === "نعم"
                      ? "bg-red-50/50 dark:bg-red-900/10"
                      : index % 2 === 0
                        ? ""
                        : "bg-gray-50/20 dark:bg-gray-900/5"
                  }
                >
                  {getDynamicHeaders(filteredAndSortedData).map((header) => (
                    <td
                      key={header.key}
                      className={`px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200 font-bold ${(header.key as string) === 'serialNumber' || (header.key as string) === 'sequence' ? 'w-px !px-2 text-center font-bold text-gray-500' : ''}`}
                    >
                      {header.key === 'parentPhone' ? (
                        item.parentPhone ? (
                          <div className="flex items-center gap-1.5 justify-start" dir="ltr">
                            <a
                              href={`tel:${item.parentPhone}`}
                              className="font-mono text-sm text-indigo-600 dark:text-indigo-400 hover:underline select-all inline-block"
                              title="اتصال بالرقم"
                            >
                              {item.parentPhone}
                            </a>

                            {/* زر اتصال هاتفي */}
                            <a
                              href={`tel:${item.parentPhone}`}
                              className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors no-print"
                              title="اتصال هاتفي"
                            >
                              <span className="text-xs">📞</span>
                            </a>

                            {/* زر نسخ الرقم */}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(item.parentPhone);
                                showToast("📋 تم نسخ رقم الهاتف بنجاح");
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors no-print text-[11px]"
                              title="نسخ الرقم"
                            >
                              📋
                            </button>

                            {/* زر واتساب الرسمي مصغر */}
                            <a
                              href={`https://wa.me/${formatWhatsAppNumber(item.parentPhone)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md shadow-xs transition-transform hover:scale-105 no-print"
                              title="محادثة واتساب"
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                              </svg>
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )
                      ) : header.key === 'studentName' ? (
                        <div className="flex flex-col">
                          <span>{item.studentName}</span>
                          {item.isAlAmeenStr === "نعم" && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal leading-tight mt-0.5">
                              (من طلاب الأمين)
                            </span>
                          )}
                        </div>
                      ) : (
                        renderCell((item as any)[header.key])
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-4 whitespace-nowrap text-center no-print">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() =>
                          setEditingStudent(
                            students.find((s) => s.id === item.studentId) ||
                              null,
                          )
                        }
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border"
                        title="تعديل"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setStudentToDelete(item.studentId)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border"
                        title="حذف"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <WordExportModal 
        isOpen={isWordModalOpen} 
        onClose={() => setIsWordModalOpen(false)} 
        onExport={(orientation, action) => {
          if (action === 'share-pdf') {
            sharePdfDirectly(
              getDynamicHeaders(filteredAndSortedData),
              filteredAndSortedData,
              "نظرة_عامة_البيانات",
              "نظرة عامة على بيانات الطلاب",
              undefined,
              undefined,
              undefined,
              undefined,
              orientation
            );
          } else {
            exportToWord(
              getDynamicHeaders(filteredAndSortedData),
              filteredAndSortedData,
              "نظرة_عامة_البيانات",
              undefined,
              undefined,
              undefined,
              undefined,
              orientation,
              action
            );
          }
        }}
      />
      <ExcelExportModal 
        isOpen={isExcelModalOpen} 
        onClose={() => setIsExcelModalOpen(false)} 
        onExport={(orientation, action) => 
          exportToExcel(
            getDynamicHeaders(filteredAndSortedData),
            filteredAndSortedData,
            "نظرة_عامة_البيانات",
            undefined,
            undefined,
            undefined,
            undefined,
            orientation,
            action
          )
        }
      />

    </>
  );
};
