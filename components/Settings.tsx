import React, { useState, useContext, useEffect, useRef } from "react";
import { AppContext } from "../App";
import { exportSheetTemplate } from "../utils/exportSheetTemplate";
import { exportMainHalaqasTemplate, exportSardHalaqasTemplate } from "../utils/halaqaExcelUtils";
import { exportFullBackup, importFullBackup, exportFullBackupJson, importFullBackupJson } from "../utils/fullBackup";
import { parseJuzsToNumbers, parseSafeNumber, safeNumberVal } from "../utils/juzUtils";
import { FullBackupData, UserRole, ReviewFeatureConfig, TeacherReviewPermission } from "../types";
import Modal from "./Modal";
import {
  generateAndDownloadDistributableHtml,
  generateAndDownloadDistributableZip,
} from "../utils/distributableApp";
import Logo from "./Logo";
import { MutoonManager } from "./MutoonManager";
import { gregorianToHijriFormatted, HIJRI_MONTHS } from "../utils/exportPdf";
import { HalaqaExcelImportModal } from "./HalaqaExcelImportModal";
import { findSimilarHalaqa } from "../utils/searchUtils";
import { generateParentLink, generateParentDirectPathLink, generateParentWhatsAppMessage, normalizeParentPhone, getParentRandomCode } from "../utils/parentReportUtils";

declare const XLSX: any;

export const Settings: React.FC = () => {
  const context = useContext(AppContext);

  const customLogo = context?.customLogo;
  const setCustomLogo = context?.setCustomLogo || (() => {});
  const deleteAllEvaluations = context?.deleteAllEvaluations || (() => {});
  const deleteAllSardEvaluations = context?.deleteAllSardEvaluations || (() => {});
  const deleteEvaluation = context?.deleteEvaluation || (() => {});
  const deleteAllData = context?.deleteAllData || (() => {});
  const handleImportFullBackupFile = context?.importFullBackup || (async () => false);
  const appName = context?.appName || '';
  const setAppName = context?.setAppName || (() => {});
  const firebaseConfig = context?.firebaseConfig;
  const users = context?.users || [];
  const halaqas = context?.halaqas || [];
  const sardHalaqas = context?.sardHalaqas || [];
  const students = context?.students || [];
  const evaluations = context?.evaluations || [];
  const maghribAttendances = context?.maghribAttendances || [];
  const supervisorPassword = context?.supervisorPassword || '';
  const maghribPassword = context?.maghribPassword || '';
  const teacherIbriPassword = context?.teacherIbriPassword || 'Ibri123';
  const teacherOutsidePassword = context?.teacherOutsidePassword || 'Ameen123';
  const setSupervisorPassword = context?.setSupervisorPassword || (() => {});
  const setMaghribPassword = context?.setMaghribPassword || (() => {});
  const setTeacherIbriPassword = context?.setTeacherIbriPassword || (() => {});
  const setTeacherOutsidePassword = context?.setTeacherOutsidePassword || (() => {});
  const addTeacher = context?.addTeacher || ((n: string) => 0);
  const addHalaqa = context?.addHalaqa || ((h: any) => 0);
  const addSardHalaqa = context?.addSardHalaqa || ((h: any) => 0);
  const addStudent = context?.addStudent || ((s: any) => 0);
  const updateStudent = context?.updateStudent || (async () => {});
  const deleteHalaqa = context?.deleteHalaqa || (async () => {});
  const deleteStudent = context?.deleteStudent || (async () => {});
  const assignTeacherToHalaqa = context?.assignTeacherToHalaqa || (async () => {});
  const assignTeacherToSardHalaqa = context?.assignTeacherToSardHalaqa || (async () => {});
  const assignStudentToSardHalaqa = context?.assignStudentToSardHalaqa || (async () => {});
  const showToast = context?.showToast || (() => {});
  const hijriAdjustments = context?.hijriAdjustments || {};
  const setHijriAdjustment = context?.setHijriAdjustment || (() => {});
  const isTestActive = context?.isTestActive || false;
  const setIsTestActive = context?.setIsTestActive || (() => {});
  const testScore = context?.testScore || 0;
  const setTestScore = context?.setTestScore || (() => {});
  const testName = context?.testName || '';
  const setTestName = context?.setTestName || (() => {});
  const testDeductions = context?.testDeductions;
  const setTestDeductions = context?.setTestDeductions || (() => {});
  const isNewStudentTestActive = context?.isNewStudentTestActive || false;
  const setIsNewStudentTestActive = context?.setIsNewStudentTestActive || (() => {});
  const allowTeacherEditOldMemorized = context?.allowTeacherEditOldMemorized || false;
  const setAllowTeacherEditOldMemorized = context?.setAllowTeacherEditOldMemorized || (() => {});
  const newStudentTestScore = context?.newStudentTestScore ?? 100;
  const setNewStudentTestScore = context?.setNewStudentTestScore || (() => {});
  const newStudentPassingRate = context?.newStudentPassingRate ?? 70;
  const setNewStudentPassingRate = context?.setNewStudentPassingRate || (() => {});
  const newStudentTestDeductions = context?.newStudentTestDeductions || { fath: 1, tashkeel: 1, tajweed: 0.5 };
  const setNewStudentTestDeductions = context?.setNewStudentTestDeductions || (() => {});
  const reviewFeatureConfig: ReviewFeatureConfig = context?.reviewFeatureConfig || { enabled: false, teachers: {} };
  const setReviewFeatureConfig = context?.setReviewFeatureConfig || (() => {});
  const [reviewTeacherSearch, setReviewTeacherSearch] = useState<string>("");
  const [expandedReviewTeacherId, setExpandedReviewTeacherId] = useState<number | null>(null);
  const parentReportsEnabled = context?.parentReportsEnabled ?? true;
  const setParentReportsEnabled = context?.setParentReportsEnabled || (() => {});
  const [parentSearchTerm, setParentSearchTerm] = useState('');
  const [parentPortalBaseUrl, setParentPortalBaseUrl] = useState(() => {
    return localStorage.getItem('parentPortalBaseUrl') || '';
  });
  const [customWhatsAppTemplate, setCustomWhatsAppTemplate] = useState(() => {
    return localStorage.getItem('parentWhatsAppTemplate') || '';
  });
  const [bulkSentPhones, setBulkSentPhones] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('parent_bulk_sent_phones');
      return s ? JSON.parse(s) : [];
    } catch (_) {
      return [];
    }
  });
  const [parentFilterTab, setParentFilterTab] = useState<'all' | 'unsent' | 'sent'>('all');

  const [activeSettingsView, setActiveSettingsView] = useState<"main" | "tests" | "customization" | "mutoon" | "review" | "passwords" | "parentReports">("main");
  
  // حالات تحرير كلمات المرور الجديدة (تكون الخانات فارغة للكتابة المباشرة)
  const [editingSupervisorPass, setEditingSupervisorPass] = useState('');
  const [editingTeacherIbriPass, setEditingTeacherIbriPass] = useState('');
  const [editingTeacherOutsidePass, setEditingTeacherOutsidePass] = useState('');
  const [editingMaghribPass, setEditingMaghribPass] = useState('');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // ضمان أن تظل خانات كتابة كلمات المرور الجديدة فارغة دائماً عند فتح صفحة كلمات المرور
  useEffect(() => {
    if (activeSettingsView === 'passwords') {
      setEditingSupervisorPass('');
      setEditingTeacherIbriPass('');
      setEditingTeacherOutsidePass('');
      setEditingMaghribPass('');
    }
  }, [activeSettingsView]);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
    confirmButtonColor?: string;
    confirmButtonText?: string;
  }>({ isOpen: false, title: "", message: "", onConfirm: async () => {} });

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importDataInputRef = useRef<HTMLInputElement>(null);

  const [selectedHijriMonth, setSelectedHijriMonth] = useState<number>(1);
  const [selectedHijriYear, setSelectedHijriYear] = useState<number>(1446);
  const [currentMonthOffset, setCurrentMonthOffset] = useState<number>(0);

  const [importModalType, setImportModalType] = useState<'main' | 'sard' | null>(null);

  const [appNameInput, setAppNameInput] = useState<string>(appName);
  const [testScoreInput, setTestScoreInput] = useState<number>(testScore || 0);
  const [testNameInput, setTestNameInput] = useState<string>(testName || "");
  const [testDeductionsInput, setTestDeductionsInput] = useState<{ fath: number; tashkeel: number; tajweed: number; passageChange?: number }>(testDeductions ? { fath: 1, tashkeel: 1, tajweed: 0.5, passageChange: 2, ...testDeductions } : { fath: 1, tashkeel: 1, tajweed: 0.5, passageChange: 2 });
  const [newStudentScoreInput, setNewStudentScoreInput] = useState<number>(newStudentTestScore);
  const [newStudentPassingRateInput, setNewStudentPassingRateInput] = useState<number>(newStudentPassingRate);
  const [newStudentDeductionsInput, setNewStudentDeductionsInput] = useState<{ fath: number; tashkeel: number; tajweed: number }>(newStudentTestDeductions);
  const [selectedTestToDelete, setSelectedTestToDelete] = useState<string>("");

  const uniqueTestNames = Array.from(new Set(evaluations.filter(e => e.isTest && e.testName).map(e => e.testName as string)));

  useEffect(() => {
    setAppNameInput(appName);
  }, [appName]);
  useEffect(() => {
    setTestScoreInput(testScore || 0);
  }, [testScore]);
  useEffect(() => {
    setTestNameInput(testName || "");
  }, [testName]);
  useEffect(() => {
    setTestDeductionsInput(testDeductions ? { fath: 1, tashkeel: 1, tajweed: 0.5, passageChange: 2, ...testDeductions } : { fath: 1, tashkeel: 1, tajweed: 0.5, passageChange: 2 });
  }, [testDeductions]);
  useEffect(() => {
    setNewStudentScoreInput(newStudentTestScore);
  }, [newStudentTestScore]);
  useEffect(() => {
    setNewStudentPassingRateInput(newStudentPassingRate);
  }, [newStudentPassingRate]);
  useEffect(() => {
    setNewStudentDeductionsInput(newStudentTestDeductions);
  }, [newStudentTestDeductions]);

  useEffect(() => {
    try {
      const today = new Date();
      const fmt = new Intl.DateTimeFormat(
        "en-US-u-ca-islamic-umalqura-nu-latn",
        {
          month: "numeric",
          year: "numeric",
        },
      );
      const parts = fmt.formatToParts(today);
      const m = parseInt(parts.find((p) => p.type === "month")?.value || "1");
      const y = parseInt(parts.find((p) => p.type === "year")?.value || "1446");
      setSelectedHijriMonth(m);
      setSelectedHijriYear(y);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const key = `${selectedHijriMonth}-${selectedHijriYear}`;
    setCurrentMonthOffset(hijriAdjustments[key] || 0);
  }, [selectedHijriMonth, selectedHijriYear, hijriAdjustments]);

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => Promise<void>,
    confirmButtonColor?: string,
    confirmButtonText?: string,
  ) => {
    setConfirmationModal({ isOpen: true, title, message, onConfirm, confirmButtonColor, confirmButtonText });
  };

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await confirmationModal.onConfirm();
    } catch (e) {
      console.error(e);
      showToast('❌ حدث خطأ، لم يكتمل الإجراء', 'error');
    } finally {
      setIsProcessing(false);
      setConfirmationModal({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: async () => {},
        confirmButtonColor: undefined,
        confirmButtonText: undefined,
      });
    }
  };

  const handleCancel = () => {
    if (!isProcessing)
      setConfirmationModal({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: async () => {},
        confirmButtonColor: undefined,
        confirmButtonText: undefined,
      });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/png", 0.9);

        setCustomLogo(dataUrl);
        setMessage({ type: "success", text: "✅ تم تحديث الشعار بنجاح." });
        setTimeout(() => setMessage(null), 3000);
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    confirmAction(
      "استعادة الشعار الافتراضي",
      "هل أنت متأكد من رغبتك في حذف الشعار المخصص والعودة لشعار البرنامج الأصلي؟",
      async () => {
        setCustomLogo(null);
        setMessage({ type: "success", text: "✅ تم العودة للشعار الافتراضي." });
      },
    );
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const raw_data = XLSX.utils.sheet_to_json(ws) as any[];
        if (raw_data.length === 0) {
          showToast("⚠️ الملف المختار فارغ.", "error");
          return;
        }
        confirmAction(
          "استيراد بيانات الطلاب والحلقات",
          "سيتم حذف الحلقات والطلاب الحاليين واستبدالهم بالبيانات من الملف. هل أنت متأكد؟",
          async () => {
            // حذف جميع الحلقات السابقة (والتي بدورها ستحذف الطلاب المرتبطين بها)
            for (const h of halaqas) {
              deleteHalaqa(h.id);
            }
            // حذف أي طلاب متبقين
            for (const s of students) {
              deleteStudent(s.id);
            }

            let addedCount = 0;
            const localUsers = [...users];
            const localHalaqas = []; // نبدأ بقائمة حلقات فارغة لأننا حذفنا السابق
            for (const row of raw_data) {
              const studentName = String(row["اسم الطالب"] || "").trim();
              const halaqaName = String(row["اسم الحلقة"] || "").trim();
              const teacherName = String(row["اسم المعلم"] || "").trim();
              const schoolStage = String(row["المرحلة الدراسية"] || "").trim();
              const parentPhone = String(
                row["هاتف ولي الأمر"] ||
                  row["رقم ولي الأمر"] ||
                  row["جوال ولي الأمر"] ||
                  row["هاتف"] ||
                  row["الجوال"] ||
                  "",
              ).trim();
              const levelValue = String(row["المستوى"] || "").trim();
              const studentLevelValue = String(row["مستوى الطالب"] || "").trim();
              const savedPartsStr = String(
                row["الأجزاء المحفوظة"] || "",
              ).trim();
              const oldMemorizedPagesStr = String(
                row["الحفظ القديم"] || "",
              ).trim();
              const isAlAmeenStr = String(
                row["من الأمين؟"] || row["طالب الأمين؟ (نعم/لا)"] || "",
              ).trim();
              const isFromIbriStr = String(
                row["من جامع عبري؟"] || row["من جامع عبري"] || row["طالب جامع عبري؟ (نعم/لا)"] || row["جامع عبري"] || "",
              ).trim();
              if (!halaqaName || !studentName) continue;
              let teacher = localUsers.find(
                (u) => u.name === teacherName && u.role === UserRole.TEACHER,
              );
              let teacherId = teacher?.id || 0;
              if (!teacher && teacherName) {
                teacherId = addTeacher(teacherName) as number;
                localUsers.push({ id: teacherId, name: teacherName, role: UserRole.TEACHER } as any);
              }
              let halaqa = findSimilarHalaqa(halaqaName, localHalaqas);
              let targetHalaqaId: number;
              if (!halaqa) {
                targetHalaqaId = addHalaqa({ name: halaqaName, teacherId }) as number;
                localHalaqas.push({ id: targetHalaqaId, name: halaqaName, teacherId } as any);
              } else {
                targetHalaqaId = halaqa.id;
              }

              const isAlAmeen =
                isAlAmeenStr === "نعم" ||
                isAlAmeenStr === "صح" ||
                isAlAmeenStr === "true" ||
                isAlAmeenStr === "1";

              const isFromIbri = isFromIbriStr
                ? (isFromIbriStr === "نعم" || isFromIbriStr === "صح" || isFromIbriStr === "true" || isFromIbriStr === "1")
                : true;

              const studentData: any = {
                name: studentName,
                halaqaId: targetHalaqaId,
                isAlAmeen,
                isFromIbri,
              };

              if (schoolStage) {
                studentData.schoolStage = schoolStage;
              }
              if (parentPhone) {
                studentData.parentPhone = parentPhone;
              }
              if (oldMemorizedPagesStr) {
                studentData.oldMemorizedPages = oldMemorizedPagesStr;
              }
              // مستوى الطالب يكون تلقائياً بحسب الحفظ، ويمكن تعديله لاحقاً من استمارة التعديل في نظرة عامة
              // لا نقفل المستوى يدوياً عند الاستيراد لضمان حسابه تلقائياً
              if (studentLevelValue && studentLevelValue.includes("يدوي")) {
                studentData.manualStudentLevel = studentLevelValue;
              }


              addStudent(studentData);
              addedCount++;
            }
            showToast(`✅ تم استيراد ${addedCount} سجل بنجاح.`);
          },
        );
      } catch (err) {
        showToast(
          "❌ فشل في معالجة ملف Excel. تأكد من مطابقة القالب.",
          "error",
        );
      }
    };
    reader.readAsBinaryString(file);
    if (importDataInputRef.current) importDataInputRef.current.value = "";
  };

  const handleConfirmImportSettings = ({
    items,
    resolveConflictMode,
  }: {
    items: { halaqaName: string; teacherName: string; teacherIdStr?: string; studentName: string; studentIdStr?: string; }[];
    resolveConflictMode: 'overwrite' | 'preserve';
  }) => {
    const isSard = importModalType === 'sard';
    let importedHalaqasCount = 0;
    let importedTeachersCount = 0;
    let importedStudentsCount = 0;

    const teacherNameToId = new Map<string, number>();
    users.filter(u => u.role === UserRole.TEACHER).forEach(u => {
      teacherNameToId.set(u.name.trim().toLowerCase(), u.id);
    });

    const halaqaNameToId = new Map<string, number>();
    if (isSard) {
      sardHalaqas.forEach(h => {
        halaqaNameToId.set(h.name.trim().toLowerCase(), h.id);
      });
    } else {
      halaqas.forEach(h => {
        halaqaNameToId.set(h.name.trim().toLowerCase(), h.id);
      });
    }

    items.forEach(row => {
      const hName = row.halaqaName.trim();
      const tName = row.teacherName.trim();
      const sName = row.studentName.trim();

      if (!hName && !sName) return;

      // 1. المعلم
      let teacherId = 0;
      if (tName) {
        const tKey = tName.toLowerCase();
        if (row.teacherIdStr && !isNaN(parseInt(row.teacherIdStr))) {
           teacherId = parseInt(row.teacherIdStr);
        } else if (teacherNameToId.has(tKey)) {
          teacherId = teacherNameToId.get(tKey)!;
        } else {
          const newTeacherId = addTeacher(tName) as number;
          teacherNameToId.set(tKey, newTeacherId);
          teacherId = newTeacherId;
          importedTeachersCount++;
        }
      }

      // 2. الحلقة
      let targetHalaqaId = 0;
      if (hName) {
        const hKey = hName.toLowerCase();
        if (halaqaNameToId.has(hKey)) {
          targetHalaqaId = halaqaNameToId.get(hKey)!;
          if (isSard) {
            const existingH = sardHalaqas.find(h => h.id === targetHalaqaId);
            if (existingH && teacherId && resolveConflictMode === 'overwrite' && existingH.teacherId !== teacherId) {
              assignTeacherToSardHalaqa(targetHalaqaId, teacherId);
            }
          } else {
            const existingH = halaqas.find(h => h.id === targetHalaqaId);
            if (existingH && teacherId && resolveConflictMode === 'overwrite' && existingH.teacherId !== teacherId) {
              assignTeacherToHalaqa(targetHalaqaId, teacherId);
            }
          }
        } else {
          const newHalaqaId = (isSard ? addSardHalaqa({ name: hName, teacherId: teacherId || 0 }) : addHalaqa({ name: hName, teacherId: teacherId || 0 })) as number;
          halaqaNameToId.set(hKey, newHalaqaId);
          targetHalaqaId = newHalaqaId;
          importedHalaqasCount++;
        }
      }

      // 3. الطالب
      if (sName && sName !== 'لا يوجد طلاب') {
        const studentIdFromRow = row.studentIdStr && !isNaN(parseInt(row.studentIdStr)) ? parseInt(row.studentIdStr) : null;
        const existingStudent = students.find(s => studentIdFromRow ? s.id === studentIdFromRow : s.name.trim().toLowerCase() === sName.toLowerCase());
        if (existingStudent) {
          if (isSard) {
            if (targetHalaqaId && existingStudent.sardHalaqaId !== targetHalaqaId) {
              assignStudentToSardHalaqa(existingStudent.id, targetHalaqaId);
            }
          } else {
            if (targetHalaqaId && existingStudent.halaqaId !== targetHalaqaId) {
              updateStudent({ ...existingStudent, halaqaId: targetHalaqaId });
            }
          }
        } else {
          if (isSard) {
            addStudent({ name: sName, halaqaId: 0, sardHalaqaId: targetHalaqaId || undefined });
          } else {
            addStudent({ name: sName, halaqaId: targetHalaqaId || 0 });
          }
          importedStudentsCount++;
        }
      }
    });

    showToast(`✅ تم استيراد بيانات ${isSard ? 'حلقات السرد' : 'حلقات الحفظ'} بنجاح: ${importedStudentsCount} طالب، ${importedHalaqasCount} حلقة.`);
  };

  const performAutoBackup = (reason: string) => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
    const backupData: FullBackupData = {
      users: context?.users || [],
      halaqas: context?.halaqas || [],
      sardHalaqas: context?.sardHalaqas || [],
      students: context?.students || [],
      evaluations: context?.evaluations || [],
      sardEvaluations: context?.sardEvaluations || [],
      maghribAttendances: context?.maghribAttendances || [],
      suggestions: context?.suggestions || [],
      studentBehaviors: context?.studentBehaviors || [],
      matns: context?.matns || [],
      newStudentTests: context?.newStudentTests || [],
      customLogo: context?.customLogo || null,
      supervisorPassword: context?.supervisorPassword || '',
      maghribPassword: context?.maghribPassword || '',
      teacherIbriPassword: context?.teacherIbriPassword || 'Ibri123',
      teacherOutsidePassword: context?.teacherOutsidePassword || 'Ameen123',
      appName: context?.appName || '',
      firebaseConfig: context?.firebaseConfig,
      hijriAdjustments: context?.hijriAdjustments || {},
      isTestActive: context?.isTestActive || false,
      testScore: context?.testScore || 0,
      testName: context?.testName || '',
      testDeductions: context?.testDeductions,
      isNewStudentTestActive: context?.isNewStudentTestActive || false,
      newStudentTestScore: context?.newStudentTestScore,
      newStudentPassingRate: context?.newStudentPassingRate,
      newStudentTestDeductions: context?.newStudentTestDeductions,
      colorMap: context?.colorMap,
      saveColors: context?.saveColors,
      rankColors: context?.rankColors,
      manualRanks: context?.manualRanks,
      certificateConfig: context?.certificateConfig,
      cardConfig: context?.cardConfig,
      showAmeerToTeachers: context?.showAmeerToTeachers ?? false,
    };
    exportFullBackup(backupData, `نسخة_احتياطية_شاملة_${reason}_${dateStr}`);
  };

  const handleSaveAdjustment = () => {
    setHijriAdjustment(
      selectedHijriMonth,
      selectedHijriYear,
      currentMonthOffset,
    );
    showToast("✅ تم حفظ تعديل التاريخ الهجري لهذا الشهر.", "success");
  };

  const handleDownloadSingleHtml = async () => {
    const currentData: FullBackupData = {
      users,
      halaqas,
      students,
      evaluations,
      maghribAttendances,
      customLogo,
      supervisorPassword,
      maghribPassword,
      teacherIbriPassword,
      teacherOutsidePassword,
      appName,
      firebaseConfig,
      hijriAdjustments,
      isDistributable: true,
      isPublishedConnected: true,
      isTestActive,
      testScore,
      testName,
      testDeductions,
      showAmeerToTeachers: context?.showAmeerToTeachers ?? false,
    };
    try {
      await generateAndDownloadDistributableHtml(currentData, "snapshot");
      showToast(
        '✅ تم تنزيل "index.html". ارفعه مباشرة إلى Netlify Drop.',
        "success",
      );
    } catch (error) {
      showToast('❌ حدث خطأ أثناء تنزيل الملف.', 'error');
    }
  };

  const allTeachers = (context?.users || [])
    .filter(u => u.role === UserRole.TEACHER)
    .sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }));

  const getTeacherHalaqas = (teacherId: number) => {
    return (context?.halaqas || []).filter(h => h.teacherId === teacherId);
  };

  const getTeacherStudents = (teacherId: number) => {
    const halaqaIds = getTeacherHalaqas(teacherId).map(h => h.id);
    return (context?.students || [])
      .filter(s => halaqaIds.includes(s.halaqaId))
      .sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }));
  };

  const isReviewMasterEnabled = !!reviewFeatureConfig.enabled;

  const handleToggleReviewMaster = (checked: boolean) => {
    const updated: ReviewFeatureConfig = {
      ...reviewFeatureConfig,
      enabled: checked,
    };
    setReviewFeatureConfig(updated);
    showToast(
      checked
        ? "✅ تم تفعيل إمكانية خيار المراجعة في استمارة التقييم (يمكنك الآن تخصيص المعلمين والطلاب)"
        : "تم تعطيل خيار المراجعة في استمارة التقييم لجميع المعلمين والطلاب (الافتراضي)",
      "info"
    );
  };

  const handleSelectAllTeachersForReview = () => {
    const newTeachersMap: Record<string | number, TeacherReviewPermission> = {};
    allTeachers.forEach(t => {
      newTeachersMap[t.id] = {
        enabled: true,
        allStudents: true,
        studentIds: [],
      };
    });
    setReviewFeatureConfig({
      ...reviewFeatureConfig,
      enabled: true,
      teachers: newTeachersMap,
    });
    showToast("✅ تم تفعيل خيار المراجعة لجميع المعلمين ولكافة طلابهم", "success");
  };

  const handleDeselectAllTeachersForReview = () => {
    setReviewFeatureConfig({
      ...reviewFeatureConfig,
      teachers: {},
    });
    showToast("تم إلغاء تفعيل خيار المراجعة لجميع المعلمين", "info");
  };

  const handleToggleTeacherReview = (teacherId: number, enabled: boolean) => {
    const teachersMap = { ...(reviewFeatureConfig.teachers || {}) };
    if (enabled) {
      teachersMap[teacherId] = {
        enabled: true,
        allStudents: teachersMap[teacherId]?.allStudents ?? true,
        studentIds: teachersMap[teacherId]?.studentIds ?? [],
      };
    } else {
      teachersMap[teacherId] = {
        ...(teachersMap[teacherId] || { allStudents: true, studentIds: [] }),
        enabled: false,
      };
    }
    setReviewFeatureConfig({
      ...reviewFeatureConfig,
      teachers: teachersMap,
    });
  };

  const handleChangeTeacherReviewMode = (teacherId: number, allStudents: boolean) => {
    const teachersMap = { ...(reviewFeatureConfig.teachers || {}) };
    const tStudents = getTeacherStudents(teacherId);
    teachersMap[teacherId] = {
      enabled: true,
      allStudents,
      studentIds: allStudents
        ? []
        : (teachersMap[teacherId]?.studentIds && teachersMap[teacherId].studentIds!.length > 0
            ? teachersMap[teacherId].studentIds
            : tStudents.map(s => s.id)),
    };
    setReviewFeatureConfig({
      ...reviewFeatureConfig,
      teachers: teachersMap,
    });
  };

  const handleToggleStudentForTeacherReview = (teacherId: number, studentId: number) => {
    const teachersMap = { ...(reviewFeatureConfig.teachers || {}) };
    const current = teachersMap[teacherId] || { enabled: true, allStudents: false, studentIds: [] };
    const currentIds = current.studentIds || [];
    const exists = currentIds.includes(studentId);
    const updatedIds = exists
      ? currentIds.filter(id => id !== studentId)
      : [...currentIds, studentId];

    teachersMap[teacherId] = {
      ...current,
      enabled: true,
      allStudents: false,
      studentIds: updatedIds,
    };
    setReviewFeatureConfig({
      ...reviewFeatureConfig,
      teachers: teachersMap,
    });
  };

  const handleSelectAllStudentsForTeacherReview = (teacherId: number) => {
    const teachersMap = { ...(reviewFeatureConfig.teachers || {}) };
    const tStudents = getTeacherStudents(teacherId);
    teachersMap[teacherId] = {
      enabled: true,
      allStudents: false,
      studentIds: tStudents.map(s => s.id),
    };
    setReviewFeatureConfig({
      ...reviewFeatureConfig,
      teachers: teachersMap,
    });
  };

  const handleDeselectAllStudentsForTeacherReview = (teacherId: number) => {
    const teachersMap = { ...(reviewFeatureConfig.teachers || {}) };
    teachersMap[teacherId] = {
      enabled: true,
      allStudents: false,
      studentIds: [],
    };
    setReviewFeatureConfig({
      ...reviewFeatureConfig,
      teachers: teachersMap,
    });
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg dark:bg-gray-800">
      {importModalType && (
        <HalaqaExcelImportModal
          isOpen={!!importModalType}
          onClose={() => setImportModalType(null)}
          type={importModalType}
          users={users}
          halaqas={halaqas}
          sardHalaqas={sardHalaqas}
          students={students}
          onConfirmImport={handleConfirmImportSettings}
        />
      )}

      {confirmationModal.isOpen && (
        <Modal
          title={confirmationModal.title}
          onClose={handleCancel}
          hideDefaultCloseButton={isProcessing}
        >
          <p className="dark:text-gray-200 text-lg font-bold text-center py-4">
            {confirmationModal.message}
          </p>
          <div className="flex justify-end gap-4 mt-6">
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg dark:bg-gray-700 dark:text-gray-200 font-bold"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className={`px-6 py-2 text-white rounded-lg font-bold shadow-lg ${confirmationModal.confirmButtonColor || 'bg-red-600'}`}
            >
              {isProcessing ? "جاري التنفيذ..." : (confirmationModal.confirmButtonText || "تأكيد")}
            </button>
          </div>
        </Modal>
      )}

      <h3 className="text-2xl font-black text-green-900 mb-6 dark:text-green-300">
        الإعدادات المتقدمة
      </h3>

      <div className="flex flex-wrap border-b-2 border-gray-100 mb-8 dark:border-gray-700">
        <button
          className={`px-6 py-3 font-bold transition-all border-b-4 ${activeSettingsView === "main" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}
          onClick={() => setActiveSettingsView("main")}
        >
          الإعدادات العامة
        </button>
        <button
          className={`px-6 py-3 font-bold transition-all border-b-4 ${activeSettingsView === "tests" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}
          onClick={() => setActiveSettingsView("tests")}
        >
          إدارة الإختبارات
        </button>
        <button
          className={`px-6 py-3 font-bold transition-all border-b-4 ${activeSettingsView === "customization" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}
          onClick={() => setActiveSettingsView("customization")}
        >
          تخصيص المظهر
        </button>
        <button
          className={`px-6 py-3 font-bold transition-all border-b-4 ${activeSettingsView === "mutoon" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}
          onClick={() => setActiveSettingsView("mutoon")}
        >
          إدارة المتون
        </button>
        <button
          className={`px-6 py-3 font-bold transition-all border-b-4 ${activeSettingsView === "review" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}
          onClick={() => setActiveSettingsView("review")}
        >
          تفعيل "مراجعة"
        </button>
        <button
          className={`px-6 py-3 font-bold transition-all border-b-4 flex items-center gap-2 ${activeSettingsView === "passwords" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}
          onClick={() => {
            setEditingSupervisorPass('');
            setEditingTeacherIbriPass('');
            setEditingTeacherOutsidePass('');
            setEditingMaghribPass('');
            setActiveSettingsView("passwords");
          }}
        >
          <span>🔐</span>
          <span>إدارة كلمات المرور</span>
        </button>
        <button
          className={`px-6 py-3 font-bold transition-all border-b-4 flex items-center gap-2 ${activeSettingsView === "parentReports" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}
          onClick={() => setActiveSettingsView("parentReports")}
        >
          <span>🔗</span>
          <span>روابط أولياء الأمور</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 mb-6 rounded-2xl font-bold animate-fade-in ${message.type === "success" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-800"}`}
        >
          {message.text}
        </div>
      )}

      {activeSettingsView === "main" && (
        <div className="space-y-10 animate-fade-in">
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
            <h4 className="text-lg font-black text-gray-800 mb-4 dark:text-gray-200 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-green-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              ضبط التقويم الهجري (تعديل شهري)
            </h4>
            <div className="bg-white dark:bg-slate-700 p-5 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm flex flex-col gap-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    الشهر الهجري
                  </label>
                  <select
                    value={selectedHijriMonth}
                    onChange={(e) =>
                      setSelectedHijriMonth(Number(e.target.value))
                    }
                    className="input-style py-2 text-sm font-bold"
                  >
                    {HIJRI_MONTHS.map((m, idx) => (
                      <option key={idx} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    السنة الهجرية
                  </label>
                  <input
                    type="number"
                    value={selectedHijriYear}
                    onChange={(e) =>
                      setSelectedHijriYear(Number(e.target.value))
                    }
                    className="input-style py-2 text-sm font-bold text-center"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
                <div className="flex items-center gap-4 bg-gray-50 dark:bg-slate-800 p-2 rounded-xl">
                  <button
                    onClick={() =>
                      setCurrentMonthOffset(currentMonthOffset - 1)
                    }
                    className="w-10 h-10 rounded-lg bg-red-100 text-red-700 font-black text-xl hover:bg-red-200 active:scale-95 transition-all shadow-sm"
                  >
                    -
                  </button>
                  <div className="text-center min-w-[80px]">
                    <span className="block text-2xl font-black" dir="ltr">
                      {currentMonthOffset > 0
                        ? `+${currentMonthOffset}`
                        : currentMonthOffset}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setCurrentMonthOffset(currentMonthOffset + 1)
                    }
                    className="w-10 h-10 rounded-lg bg-green-100 text-green-700 font-black text-xl hover:bg-green-200 active:scale-95 transition-all shadow-sm"
                  >
                    +
                  </button>
                </div>
                <div className="flex-1 w-full sm:w-auto">
                  <p className="text-sm font-black text-green-800 dark:text-green-300">
                    {gregorianToHijriFormatted(new Date(), hijriAdjustments)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSaveAdjustment}
                className="w-full py-3 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 shadow-md active:scale-95 transition-all mt-2"
              >
                حفظ التعديل لهذا الشهر
              </button>
            </div>
          </div>

          {/* تفعيل تعديل المحفوظ القديم للمعلم */}
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
            <h4 className="text-lg font-black text-gray-800 mb-4 dark:text-gray-200 flex items-center gap-2">
              <span className="text-xl">📖</span>
              تعديل المحفوظ القديم للطلاب (صلاحية المعلم)
            </h4>
            <div className="bg-white dark:bg-slate-700 p-5 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                <label className="inline-flex items-center cursor-pointer">
                  <div className="relative" dir="ltr">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={allowTeacherEditOldMemorized}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAllowTeacherEditOldMemorized(checked);
                        showToast(checked ? '✅ تم تفعيل خانات تعديل المحفوظ القديم للمعلمين' : 'تم تعطيل خانات تعديل المحفوظ القديم للمعلمين', 'info');
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                  </div>
                  <span className="mr-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                    إظهار خانات كتابة وتعديل المحفوظ القديم (على هيئة نطاقات) في شاشة تقييم الطالب
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 mr-14">
                  عند التفعيل، سيتمكن المعلم في شاشة التقييم من كتابة نطاقات المحفوظ السابق (بداية ونهاية النطاق) وتعديلها مباشرة مع تأكيد الحفظ.
                </p>
              </div>
              <span className={`text-xs font-bold px-3.5 py-1.5 rounded-xl whitespace-nowrap ${allowTeacherEditOldMemorized ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-gray-100 text-gray-500 dark:bg-gray-600'}`}>
                {allowTeacherEditOldMemorized ? 'مفعل حالياً' : 'معطل'}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
            <h4 className="text-lg font-black text-gray-800 mb-6 dark:text-gray-200">
              إدارة البيانات والنسخ الاحتياطي
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h5 className="font-bold text-gray-700 dark:text-gray-300 border-b-2 border-gray-100 pb-2 mb-4">
                  الاستيراد والتصدير
                </h5>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-row gap-3">
                    <button
                      onClick={() =>
                        exportFullBackup(context as any, "نسخة_احتياطية_كاملة")
                      }
                      className="flex-1 text-center px-4 py-3 bg-white border border-green-200 text-green-800 rounded-xl hover:bg-green-50 dark:bg-slate-700 dark:text-green-300 font-bold shadow-sm"
                    >
                      💾 تصدير نسخة احتياطية (.xlsx)
                    </button>
                    <button
                      onClick={() =>
                        exportFullBackupJson(context as any, "نسخة_احتياطية_كاملة")
                      }
                      className="flex-1 text-center px-4 py-3 bg-white border border-blue-200 text-blue-800 rounded-xl hover:bg-blue-50 dark:bg-slate-700 dark:text-blue-300 font-bold shadow-sm"
                    >
                      💾 تصدير نسخة احتياطية (.json)
                    </button>
                  </div>
                  <div className="flex flex-row gap-3">
                    <label className="flex-1 cursor-pointer text-center px-4 py-3 bg-white border border-amber-200 text-amber-800 rounded-xl hover:bg-amber-50 dark:bg-slate-700 dark:text-amber-300 font-bold shadow-sm">
                      📂 استعادة من ملف (.xlsx)
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            confirmAction(
                              "استعادة البيانات",
                              "تحذير: سيتم استبدال كافة البيانات الحالية بمحتويات الملف المختار. هل أنت متأكد؟",
                              async () => {
                                const data = await importFullBackup(file);
                                handleImportFullBackupFile(data);
                                setMessage({
                                  type: "success",
                                  text: "✅ تم استعادة البيانات بنجاح.",
                                });
                              },
                            );
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    <label className="flex-1 cursor-pointer text-center px-4 py-3 bg-white border border-purple-200 text-purple-800 rounded-xl hover:bg-purple-50 dark:bg-slate-700 dark:text-purple-300 font-bold shadow-sm">
                      📂 استعادة من ملف (.json)
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            confirmAction(
                              "استعادة البيانات",
                              "تحذير: سيتم استبدال كافة البيانات الحالية بمحتويات الملف المختار. هل أنت متأكد؟",
                              async () => {
                                const data = await importFullBackupJson(file);
                                handleImportFullBackupFile(data);
                                setMessage({
                                  type: "success",
                                  text: "✅ تم استعادة البيانات بنجاح.",
                                });
                              },
                            );
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h5 className="font-bold text-gray-700 dark:text-gray-300 border-b-2 border-gray-100 pb-2 mb-4">
                  قوالب Excel وتصدير / استيراد بيانات الحلقات
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* حلقات الحفظ */}
                  <div className="p-4 bg-emerald-50/50 dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-2 font-black text-xs text-emerald-900 dark:text-emerald-300">
                      <span>🕌</span>
                      <span>حلقات الحفظ (اسم الحلقة، المعلم، الطالب)</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => exportMainHalaqasTemplate("قالب_استيراد_حلقات_الحفظ", users, students)}
                        className="flex-1 text-center py-2.5 bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl hover:bg-emerald-50 text-xs font-bold shadow-sm transition-all"
                      >
                        📄 تنزيل القالب
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportModalType('main')}
                        className="flex-1 text-center py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                      >
                        📥 استيراد ملف
                      </button>
                    </div>
                  </div>

                  {/* حلقات السرد */}
                  <div className="p-4 bg-emerald-50/50 dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-2 font-black text-xs text-emerald-900 dark:text-emerald-300">
                      <span>📖</span>
                      <span>حلقات السرد (اسم حلقة السرد، المعلم، الطالب)</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => exportSardHalaqasTemplate("قالب_استيراد_حلقات_السرد", users, students)}
                        className="flex-1 text-center py-2.5 bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl hover:bg-emerald-50 text-xs font-bold shadow-sm transition-all"
                      >
                        📄 تنزيل القالب
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportModalType('sard')}
                        className="flex-1 text-center py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                      >
                        📥 استيراد ملف
                      </button>
                    </div>
                  </div>
                </div>

                {/* قالب الاستيراد الشامل القديم للطلاب مع بيانات الحفظ والمراحل */}
                <div className="pt-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => exportSheetTemplate("قالب_استيراد_الطلاب_الشامل")}
                      className="flex-1 text-right px-4 py-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-200 text-xs font-bold"
                    >
                      📄 تنزيل القالب الشامل (مع المراحل وهاتف ولي الأمر والحفظ ومستوى الطالب)
                    </button>
                    <label className="cursor-pointer text-center px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl hover:bg-blue-100 dark:bg-slate-700 dark:text-blue-300 text-xs font-bold shadow-sm transition-all">
                      📥 استيراد من القالب الشامل
                      <input
                        ref={importDataInputRef}
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleImportData}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t-2 border-gray-100 dark:border-slate-700">
              <h5 className="font-black text-red-600 mb-4 dark:text-red-400">
                إجراءات الحذف
              </h5>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() =>
                    confirmAction(
                      "مسح التقييمات وبدء فصل جديد",
                      "⚠️ تنبيه مهم: هذا الإجراء سيمسح جميع سجلات تقييم الطلاب (بما في ذلك تقييمات الحلقات، تقييمات السرد، تقييمات الاختبارات) وغياب برنامج المغرب.\n\nسيتم تلقائياً تصدير نسخة احتياطية إجبارية شاملة لجميع بيانات التطبيق وحفظها في جهازك قبل مسح التقييمات.\n\nهل ترغب بالمتابعة وتأكيد الحذف؟",
                      async () => {
                        performAutoBackup("إجبارية_قبل_مسح_التقييمات_والسرد");
                        await deleteAllEvaluations();
                        await deleteAllSardEvaluations();
                        showToast("📥 تم تصدير نسخة احتياطية إجبارية لجميع البيانات وحذف التقييمات", "success");
                        setMessage({
                          type: "success",
                          text: "✅ تم تصدير نسخة احتياطية إجبارية لجميع البيانات، ومسح جميع التقييمات وتقييمات السرد وغياب المغرب بنجاح.",
                        });
                      },
                      "bg-red-600 hover:bg-red-700",
                      "تأكيد وتصدير النسخة الاحتياطية"
                    )
                  }
                  className="flex-1 px-4 py-4 bg-red-50 text-red-700 border-2 border-red-100 rounded-2xl hover:bg-red-100 font-black transition-all dark:bg-red-900/20"
                >
                  🗑️ مسح التقييمات (بدء فصل جديد)
                </button>
                <button
                  onClick={() =>
                    confirmAction(
                      "إعادة ضبط المصنع",
                      'تحذير نهائي: هذا الإجراء سيمسح "كل شيء" ويعيد البرنامج لحالته الأولى. لا يمكن التراجع عن هذا الفعل!',
                      async () => {
                        performAutoBackup("قبل_تصفير_البرنامج");
                        await deleteAllData();
                        setMessage({
                          type: "success",
                          text: "✅ تم إعادة ضبط البرنامج بنجاح.",
                        });
                      },
                    )
                  }
                  className="flex-1 px-4 py-4 bg-red-600 text-white rounded-2xl hover:bg-red-700 font-black shadow-xl transition-all active:scale-95"
                >
                  ⚠️ إعادة ضبط المصنع (مسح شامل)
                </button>
              </div>

              <h5 className="font-bold text-gray-700 dark:text-gray-300 border-b-2 border-gray-100 pb-2 mt-8 mb-4">
                حذف بيانات اختبار محدد
              </h5>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    اختر الاختبار للحذف
                  </label>
                  <select
                    value={selectedTestToDelete}
                    onChange={(e) => setSelectedTestToDelete(e.target.value)}
                    className="input-style py-2 text-sm font-bold w-full"
                  >
                    <option value="">-- يرجى اختيار اختبار --</option>
                    {uniqueTestNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (!selectedTestToDelete) {
                      showToast("يرجى اختيار اختبار أولاً", "error");
                      return;
                    }
                    confirmAction(
                      "حذف بيانات الاختبار",
                      `هل أنت متأكد من حذف جميع بيانات ودرجات اختبار "${selectedTestToDelete}"؟ لا يمكن التراجع عن هذا الإجراء.`,
                      async () => {
                        const testEvals = evaluations.filter(e => e.isTest && e.testName === selectedTestToDelete);
                        for (const ev of testEvals) {
                          deleteEvaluation(ev.id);
                        }
                        setSelectedTestToDelete("");
                        setMessage({
                          type: "success",
                          text: `✅ تم حذف بيانات اختبار "${selectedTestToDelete}" بنجاح.`
                        });
                      }
                    );
                  }}
                  disabled={!selectedTestToDelete}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 hover:bg-red-700 disabled:opacity-50 h-[42px] min-w-[150px]"
                >
                  حذف الاختبار
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* تبويب إدارة الإختبارات */}
      {activeSettingsView === "tests" && (
        <div className="space-y-8 animate-fade-in">
          {/* إعدادات اختبار الحلقات وتفعيله للمعلمين */}
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
            <h4 className="text-lg font-black text-gray-800 mb-4 dark:text-gray-200 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-indigo-700 dark:text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              إعدادات اختبار الحلقات (تفعيل للمعلمين)
            </h4>
            <div className="bg-white dark:bg-slate-700 p-5 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center cursor-pointer">
                  <div className="relative" dir="ltr">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isTestActive}
                      onChange={(e) => setIsTestActive(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                  </div>
                  <span className="mr-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                    تفعيل الاختبار للمعلمين
                  </span>
                </label>
                <span className={`text-xs font-bold px-3 py-1 rounded-xl ${isTestActive ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-600'}`}>
                  {isTestActive ? 'مفعل حالياً' : 'معطل'}
                </span>
              </div>
              {isTestActive && (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        اسم الاختبار
                      </label>
                      <input
                        type="text"
                        value={testNameInput}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setTestNameInput(e.target.value)}
                        placeholder="مثلاً: اختبار الفتره الأولى"
                        className="input-style py-2 text-sm font-bold"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        الدرجة الكلية للاختبار
                      </label>
                      <input
                        type="number"
                        value={safeNumberVal(testScoreInput, 0)}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          setTestScoreInput(parseSafeNumber(e.target.value, 0))
                        }
                        className="input-style py-2 text-sm font-bold"
                        min="0"
                        step="1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end mt-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">خصم الفتح</label>
                      <input type="number" step="0.25" min="0" value={safeNumberVal(testDeductionsInput.fath, 0)} onFocus={(e) => e.target.select()} onChange={(e) => setTestDeductionsInput({ ...testDeductionsInput, fath: parseSafeNumber(e.target.value, 0) })} className="input-style py-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">خصم التشكيل</label>
                      <input type="number" step="0.25" min="0" value={safeNumberVal(testDeductionsInput.tashkeel, 0)} onFocus={(e) => e.target.select()} onChange={(e) => setTestDeductionsInput({ ...testDeductionsInput, tashkeel: parseSafeNumber(e.target.value, 0) })} className="input-style py-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">خصم التجويد</label>
                      <input type="number" step="0.25" min="0" value={safeNumberVal(testDeductionsInput.tajweed, 0)} onFocus={(e) => e.target.select()} onChange={(e) => setTestDeductionsInput({ ...testDeductionsInput, tajweed: parseSafeNumber(e.target.value, 0) })} className="input-style py-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">خصم تغيير المقطع</label>
                      <input type="number" step="0.25" min="0" value={safeNumberVal(testDeductionsInput.passageChange, 2)} onFocus={(e) => e.target.select()} onChange={(e) => setTestDeductionsInput({ ...testDeductionsInput, passageChange: parseSafeNumber(e.target.value, 0) })} className="input-style py-2 text-sm font-bold border-amber-300 focus:border-amber-500" />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => {
                        const trimmedName = testNameInput.trim();
                        const saveTestSettings = () => {
                          setTestName(trimmedName);
                          setTestScore(testScoreInput);
                          setTestDeductions(testDeductionsInput);
                          showToast("✅ تم حفظ إعدادات الاختبار بنجاح.", "success");
                        };

                        if (trimmedName && trimmedName !== testName) {
                          const nameExists = evaluations.some(
                            (e) => e.isTest && e.testName === trimmedName,
                          );
                          if (nameExists) {
                            setConfirmationModal({
                              isOpen: true,
                              title: "تنبيه: اسم الاختبار موجود مسبقاً",
                              message: "هذا الاسم مسجل في اختبارات سابقة. المواصلة تعني استكمال نفس الاختبار وسيظهر الطلاب الذين تم تقييمهم به كـ 'مقيّمين'. هل تريد المواصلة بنفس الاختبار؟",
                              confirmButtonColor: "bg-indigo-600 hover:bg-indigo-700",
                              confirmButtonText: "مواصلة الاختبار",
                              onConfirm: async () => {
                                saveTestSettings();
                              },
                            });
                            return;
                          }
                        }
                        saveTestSettings();
                      }}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-95"
                    >
                      حفظ الإعدادات
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* إعدادات اختبار قبول الطلاب الجدد وتفعيله للمعلمين */}
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
            <h4 className="text-lg font-black text-gray-800 mb-4 dark:text-gray-200 flex items-center gap-2">
              <span className="text-xl">🎓</span>
              إعدادات اختبار قبول الطلاب الجدد (تفعيل للمعلمين)
            </h4>
            <div className="bg-white dark:bg-slate-700 p-5 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center cursor-pointer">
                  <div className="relative" dir="ltr">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isNewStudentTestActive}
                      onChange={(e) => setIsNewStudentTestActive(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                  </div>
                  <span className="mr-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                    تفعيل اختبار قبول الطلاب الجدد للمعلمين
                  </span>
                </label>
                <span className={`text-xs font-bold px-3 py-1 rounded-xl ${isNewStudentTestActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-600'}`}>
                  {isNewStudentTestActive ? 'مفعل حالياً' : 'معطل'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    درجة الاختبار الكلية
                  </label>
                  <input
                    type="number"
                    value={safeNumberVal(newStudentScoreInput, 100)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentScoreInput(parseSafeNumber(e.target.value, 0))}
                    className="input-style py-2 text-sm font-bold"
                    min="10"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    نسبة القبول المحددة (%)
                  </label>
                  <input
                    type="number"
                    value={safeNumberVal(newStudentPassingRateInput, 70)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentPassingRateInput(parseSafeNumber(e.target.value, 0))}
                    className="input-style py-2 text-sm font-bold"
                    min="1"
                    max="100"
                    step="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-red-600 dark:text-red-400 mb-1">خصم الفتح</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={safeNumberVal(newStudentDeductionsInput.fath, 0)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentDeductionsInput({ ...newStudentDeductionsInput, fath: parseSafeNumber(e.target.value, 0) })}
                    className="input-style py-2 text-sm font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">خصم التشكيل</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={safeNumberVal(newStudentDeductionsInput.tashkeel, 0)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentDeductionsInput({ ...newStudentDeductionsInput, tashkeel: parseSafeNumber(e.target.value, 0) })}
                    className="input-style py-2 text-sm font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-yellow-600 dark:text-yellow-400 mb-1">خصم التجويد</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={safeNumberVal(newStudentDeductionsInput.tajweed, 0)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentDeductionsInput({ ...newStudentDeductionsInput, tajweed: parseSafeNumber(e.target.value, 0) })}
                    className="input-style py-2 text-sm font-bold text-center"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    setNewStudentTestScore(newStudentScoreInput);
                    setNewStudentPassingRate(newStudentPassingRateInput);
                    setNewStudentTestDeductions(newStudentDeductionsInput);
                    showToast("✅ تم حفظ إعدادات اختبار قبول الطلاب الجدد بنجاح.", "success");
                  }}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md transition-all active:scale-95"
                >
                  حفظ إعدادات القبول
                </button>
              </div>
            </div>
          </div>

          {/* خيار حذف بيانات اختبار محدد */}
          {uniqueTestNames.length > 0 && (
            <div className="bg-red-50/50 p-6 rounded-3xl border border-red-100 dark:bg-red-950/10 dark:border-red-900/30">
              <h4 className="text-lg font-black text-red-800 mb-2 dark:text-red-300 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                حذف بيانات اختبار محدد
              </h4>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-4 font-semibold">
                يمكنك حذف درجات وسجلات اختبار محدد مسجل مسبقاً دون المساس بباقي الاختبارات.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-end bg-white dark:bg-slate-700 p-4 rounded-2xl border border-red-100 dark:border-slate-600">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    اختر الاختبار المراد حذفه
                  </label>
                  <select
                    value={selectedTestToDelete}
                    onChange={(e) => setSelectedTestToDelete(e.target.value)}
                    className="input-style py-2 text-sm font-bold w-full"
                  >
                    <option value="">-- يرجى اختيار اختبار --</option>
                    {uniqueTestNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (!selectedTestToDelete) {
                      showToast("يرجى اختيار اختبار أولاً", "error");
                      return;
                    }
                    confirmAction(
                      "حذف بيانات الاختبار",
                      `هل أنت متأكد من حذف جميع بيانات ودرجات اختبار "${selectedTestToDelete}"؟ لا يمكن التراجع عن هذا الإجراء.`,
                      async () => {
                        const testEvals = evaluations.filter(e => e.isTest && e.testName === selectedTestToDelete);
                        for (const ev of testEvals) {
                          deleteEvaluation(ev.id);
                        }
                        setSelectedTestToDelete("");
                        setMessage({
                          type: "success",
                          text: `✅ تم حذف بيانات اختبار "${selectedTestToDelete}" بنجاح.`
                        });
                      }
                    );
                  }}
                  disabled={!selectedTestToDelete}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 hover:bg-red-700 disabled:opacity-50 h-[42px] min-w-[150px]"
                >
                  حذف الاختبار
                </button>
              </div>
            </div>
          )}
        </div>
      )}

            {activeSettingsView === "mutoon" && (
        <MutoonManager />
      )}

      {activeSettingsView === "review" && (
        <div className="animate-fade-in space-y-8">
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h4 className="text-xl font-black text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <span className="text-2xl">🔄</span>
                  تفعيل وتخصيص بند «المراجعة»
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  إتاحة خيار المراجعة في خانة نوع الإنجاز في استمارة التقييم وتعديل التقييم، مع إمكانية إدارتها لمعلمين وطلاب محددين.
                </p>
              </div>
              <span className={`self-start sm:self-center text-xs font-bold px-3.5 py-1.5 rounded-xl whitespace-nowrap ${isReviewMasterEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-gray-100 text-gray-500 dark:bg-gray-600'}`}>
                {isReviewMasterEnabled ? 'مفعل حالياً' : 'معطل (الافتراضي)'}
              </span>
            </div>

            {/* المفتاح الرئيسي */}
            <div className="bg-white dark:bg-slate-700 p-5 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                <label className="inline-flex items-center cursor-pointer">
                  <div className="relative" dir="ltr">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isReviewMasterEnabled}
                      onChange={(e) => handleToggleReviewMaster(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                  </div>
                  <span className="mr-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                    تفعيل بند «مراجعة» في شاشة تقييم وتعديل الطلاب
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 mr-14">
                  الأصل والافتراضي هو عدم ظهور بند المراجعة (حفظ جديد وغير مستعد فقط). عند تفعيل هذا الخيار، يمكنك تحديد المعلمين والطلاب المتاح لهم التقييم ببند المراجعة.
                </p>
              </div>
            </div>

            {/* لوحة تخصيص المعلمين والطلاب عند التفعيل */}
            {isReviewMasterEnabled && (
              <div className="mt-5 space-y-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/70 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                  <div className="space-y-0.5">
                    <h5 className="text-sm font-black text-blue-950 dark:text-blue-200 flex items-center gap-2">
                      <span>👥</span>
                      تحديد المعلمين والطلاب المسموح لهم بالمراجعة
                    </h5>
                    <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                      اختر المعلمين، ثم حدد ما إذا كان بند المراجعة متاحاً لجميع طلاب المعلم أو لطلاب محددين فقط.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSelectAllTeachersForReview}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      تحديد جميع المعلمين
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllTeachersForReview}
                      className="px-3 py-1.5 text-xs font-bold bg-white text-gray-700 border border-gray-200 dark:bg-slate-700 dark:text-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      إلغاء تحديد الجميع
                    </button>
                  </div>
                </div>

                {/* خانة بحث عن المعلمين */}
                {allTeachers.length > 3 && (
                  <div className="relative">
                    <input
                      type="text"
                      value={reviewTeacherSearch}
                      onChange={(e) => setReviewTeacherSearch(e.target.value)}
                      placeholder="ابحث باسم المعلم أو الحلقة..."
                      className="w-full text-xs font-bold py-2.5 px-9 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400"
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-gray-400">🔍</span>
                    {reviewTeacherSearch && (
                      <button
                        type="button"
                        onClick={() => setReviewTeacherSearch("")}
                        className="absolute left-3 top-2.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* قائمة المعلمين */}
                <div className="space-y-3">
                  {allTeachers
                    .filter((teacher) => {
                      if (!reviewTeacherSearch.trim()) return true;
                      const q = reviewTeacherSearch.toLowerCase().trim();
                      const halaqas = getTeacherHalaqas(teacher.id);
                      return (
                        teacher.name.toLowerCase().includes(q) ||
                        halaqas.some((h) => h.name.toLowerCase().includes(q))
                      );
                    })
                    .map((teacher) => {
                      const teacherPerm = reviewFeatureConfig.teachers?.[teacher.id];
                      const isTeacherActive = teacherPerm?.enabled !== false && teacherPerm !== undefined;
                      const isAllStudents = teacherPerm?.allStudents ?? true;
                      const tHalaqas = getTeacherHalaqas(teacher.id);
                      const tStudents = getTeacherStudents(teacher.id);
                      const selectedStudentIds = teacherPerm?.studentIds || [];
                      const selectedStudentsCount = isAllStudents
                        ? tStudents.length
                        : selectedStudentIds.filter((id) => tStudents.some((s) => s.id === id)).length;

                      const isExpanded = expandedReviewTeacherId === teacher.id;

                      return (
                        <div
                          key={teacher.id}
                          className={`rounded-2xl border transition-all ${
                            isTeacherActive
                              ? 'bg-white dark:bg-slate-700/80 border-emerald-200 dark:border-emerald-800/80 shadow-xs'
                              : 'bg-white/60 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700 opacity-80'
                          }`}
                        >
                          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`teacher_review_${teacher.id}`}
                                checked={isTeacherActive}
                                onChange={(e) => handleToggleTeacherReview(teacher.id, e.target.checked)}
                                className="w-5 h-5 rounded-md text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-600 cursor-pointer"
                              />
                              <div>
                                <label
                                  htmlFor={`teacher_review_${teacher.id}`}
                                  className="text-sm font-black text-gray-800 dark:text-gray-100 cursor-pointer flex items-center gap-2"
                                >
                                  <span>{teacher.name}</span>
                                  {isTeacherActive && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                      متاح
                                    </span>
                                  )}
                                </label>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  <span>
                                    {tHalaqas.length > 0
                                      ? tHalaqas.map((h) => h.name).join('، ')
                                      : 'لا توجد حلقات مسندة'}
                                  </span>
                                  <span>•</span>
                                  <span>{tStudents.length} طلاب</span>
                                </div>
                              </div>
                            </div>

                            {/* خيارات الطلاب للمعلم المفعل */}
                            {isTeacherActive && (
                              <div className="flex items-center gap-2 flex-wrap mr-8 sm:mr-0">
                                <div className="inline-flex rounded-xl p-1 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-xs font-bold">
                                  <button
                                    type="button"
                                    onClick={() => handleChangeTeacherReviewMode(teacher.id, true)}
                                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                      isAllStudents
                                        ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs font-black'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                                    }`}
                                  >
                                    جميع الطلاب ({tStudents.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleChangeTeacherReviewMode(teacher.id, false);
                                      setExpandedReviewTeacherId(teacher.id);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                      !isAllStudents
                                        ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-black'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                                    }`}
                                  >
                                    طلاب محددون ({selectedStudentsCount})
                                  </button>
                                </div>

                                {!isAllStudents && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedReviewTeacherId(isExpanded ? null : teacher.id)}
                                    className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>{isExpanded ? 'إخفاء الطلاب' : 'تحديد الطلاب'}</span>
                                    <span>{isExpanded ? '▲' : '▼'}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* قائمة تحديد الطلاب المخصصين */}
                          {isTeacherActive && !isAllStudents && (isExpanded || tStudents.length <= 6) && (
                            <div className="p-4 border-t border-gray-100 dark:border-slate-600/70 bg-gray-50/70 dark:bg-slate-800/40 rounded-b-2xl animate-in fade-in duration-200">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                  حدد الطلاب الذين سيظهر لديهم بند المراجعة لهذا المعلم:
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllStudentsForTeacherReview(teacher.id)}
                                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                                  >
                                    تحديد الكل
                                  </button>
                                  <span className="text-gray-300">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeselectAllStudentsForTeacherReview(teacher.id)}
                                    className="text-xs text-gray-500 dark:text-gray-400 font-bold hover:underline cursor-pointer"
                                  >
                                    إلغاء التحديد
                                  </button>
                                </div>
                              </div>

                              {tStudents.length === 0 ? (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                  لا يوجد طلاب مسجلون في حلقات هذا المعلم حالياً.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {tStudents.map((student) => {
                                    const isSelected = selectedStudentIds.includes(student.id);
                                    const studentHalaqa = tHalaqas.find((h) => h.id === student.halaqaId);
                                    return (
                                      <label
                                        key={student.id}
                                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                          isSelected
                                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700/80 text-blue-950 dark:text-blue-100 font-black'
                                            : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 font-normal'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleToggleStudentForTeacherReview(teacher.id, student.id)}
                                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-500 cursor-pointer"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs truncate">{student.name}</div>
                                          {studentHalaqa && (
                                            <div className="text-[10px] text-gray-400 truncate">
                                              {studentHalaqa.name}
                                            </div>
                                          )}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSettingsView === "customization" && (
        <div className="animate-fade-in space-y-8">
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
            <h4 className="text-xl font-black text-gray-800 mb-6 dark:text-gray-200">
              هوية البرنامج
            </h4>
            <div>
              <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">
                اسم البرنامج المعروض:
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={appNameInput}
                  onChange={(e) => setAppNameInput(e.target.value)}
                  className="input-style flex-grow text-xl font-bold"
                  placeholder="مثلاً: مجمع حلقات النور"
                />
                <button
                  onClick={() => {
                    setAppName(appNameInput);
                    setMessage({
                      type: "success",
                      text: "✅ تم حفظ الاسم بنجاح.",
                    });
                  }}
                  className="px-8 py-3 bg-green-700 text-white rounded-2xl font-black hover:bg-green-800 shadow-lg active:scale-95 transition-all"
                >
                  حفظ الاسم
                </button>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
            <h4 className="text-xl font-black text-gray-800 mb-6 dark:text-gray-200">
              شعار البرنامج
            </h4>
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
              <Logo className="h-40 w-40 shadow-xl" />
              <div className="flex-grow space-y-4 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-dashed border-green-400 text-green-700 rounded-2xl hover:bg-green-50 transition-all font-black"
                  >
                    رفع شعار جديد
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={handleResetLogo}
                    disabled={!customLogo}
                    className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black transition-all ${customLogo ? "bg-red-50 text-red-700 border-2 border-red-100 hover:bg-red-100" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                  >
                    الرجوع للافتراضي
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSettingsView === "passwords" && (
        <div className="space-y-8 animate-fade-in">
          <div className="p-5 sm:p-6 bg-amber-50 dark:bg-amber-950/30 rounded-3xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🔐</span>
              <div>
                <h4 className="text-xl font-black text-amber-950 dark:text-amber-200">
                  إدارة كلمات المرور والصلاحيات
                </h4>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mt-1">
                  تحدد هذه الصفحة كلمات المرور لجميع بوابات الدخول. المعلمون ومسؤولو الحضور لا يملكون صلاحية تعديل كلمات المرور، ويتم التحكم بها مركزياً وحصرياً من قبل المشرف.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. كلمة مرور المشرف */}
            <div className="bg-gray-50 dark:bg-slate-800/60 p-6 rounded-3xl border border-gray-200 dark:border-slate-700 flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">👨‍💼</span>
                    <div>
                      <h5 className="font-black text-lg text-gray-800 dark:text-gray-100">كلمة مرور المشرف</h5>
                      <span className="text-xs text-gray-500 font-bold">بوابة دخول المشرف العام</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs font-black rounded-lg">الافتراضي: 123</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                    كلمة المرور الحالية:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl dark:border-slate-700 text-green-700 dark:text-green-400 min-w-[90px] text-center">
                      {showPasswordMap['supervisor'] ? supervisorPassword : '••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPasswordMap(p => ({ ...p, supervisor: !p['supervisor'] }))}
                      className="px-2.5 py-1.5 text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {showPasswordMap['supervisor'] ? 'إخفاء 👁️' : 'إظهار 👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    كلمة المرور الجديدة:
                  </label>
                  <input
                    type="text"
                    value={editingSupervisorPass}
                    onChange={(e) => setEditingSupervisorPass(e.target.value)}
                    placeholder="أدخل كلمة مرور جديدة..."
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck="false"
                    className="input-style text-center font-bold tracking-wider py-2.5 w-full bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-5 mt-4 border-t dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    const pass = editingSupervisorPass.trim();
                    if (!pass) return showToast('⚠️ يرجى كتابة كلمة مرور جديدة أولاً', 'error');
                    setSupervisorPassword(pass);
                    setEditingSupervisorPass('');
                    showToast('✅ تم حفظ كلمة مرور المشرف بنجاح', 'success');
                  }}
                  className="flex-1 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold text-sm shadow-xs transition-all active:scale-95"
                >
                  حفظ كلمة مرور المشرف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSupervisorPassword('123');
                    setEditingSupervisorPass('');
                    showToast('🔄 تمت استعادة كلمة المرور الافتراضية (123)', 'info');
                  }}
                  className="px-3 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition-all"
                  title="استعادة الافتراضي"
                >
                  افتراضي
                </button>
              </div>
            </div>

            {/* 2. كلمة مرور معلمي جامع عبري */}
            <div className="bg-emerald-50/50 dark:bg-slate-800/60 p-6 rounded-3xl border border-emerald-200 dark:border-slate-700 flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🕌</span>
                    <div>
                      <h5 className="font-black text-lg text-emerald-950 dark:text-emerald-200">معلمو جامع عبري</h5>
                      <span className="text-xs text-gray-500 font-bold">بوابة دخول معلمي جامع عبري</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-black rounded-lg">الافتراضي: Ibri123</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                    كلمة المرور الحالية:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl dark:border-slate-700 text-emerald-700 dark:text-emerald-400 min-w-[90px] text-center">
                      {showPasswordMap['t_ibri'] ? teacherIbriPassword : '••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPasswordMap(p => ({ ...p, t_ibri: !p['t_ibri'] }))}
                      className="px-2.5 py-1.5 text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {showPasswordMap['t_ibri'] ? 'إخفاء 👁️' : 'إظهار 👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    كلمة المرور الجديدة:
                  </label>
                  <input
                    type="text"
                    value={editingTeacherIbriPass}
                    onChange={(e) => setEditingTeacherIbriPass(e.target.value)}
                    placeholder="أدخل كلمة مرور جديدة لمعلمي جامع عبري..."
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck="false"
                    className="input-style text-center font-bold tracking-wider py-2.5 w-full bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-5 mt-4 border-t dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    const pass = editingTeacherIbriPass.trim();
                    if (!pass) return showToast('⚠️ يرجى كتابة كلمة مرور جديدة أولاً', 'error');
                    setTeacherIbriPassword(pass);
                    setEditingTeacherIbriPass('');
                    showToast('✅ تم حفظ كلمة مرور معلمي جامع عبري بنجاح', 'success');
                  }}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-xs transition-all active:scale-95"
                >
                  حفظ كلمة مرور جامع عبري
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherIbriPassword('Ibri123');
                    setEditingTeacherIbriPass('');
                    showToast('🔄 تمت استعادة كلمة المرور الافتراضية (Ibri123)', 'info');
                  }}
                  className="px-3 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition-all"
                  title="استعادة الافتراضي"
                >
                  افتراضي
                </button>
              </div>
            </div>

            {/* 3. كلمة مرور المعلمين خارج جامع عبري */}
            <div className="bg-blue-50/50 dark:bg-slate-800/60 p-6 rounded-3xl border border-blue-200 dark:border-slate-700 flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🌐</span>
                    <div>
                      <h5 className="font-black text-lg text-blue-950 dark:text-blue-200">خارج جامع عبري</h5>
                      <span className="text-xs text-gray-500 font-bold">بوابة دخول المعلمين خارج جامع عبري</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 text-xs font-black rounded-lg">الافتراضي: Ameen123</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                    كلمة المرور الحالية:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl dark:border-slate-700 text-blue-700 dark:text-blue-400 min-w-[90px] text-center">
                      {showPasswordMap['t_outside'] ? teacherOutsidePassword : '••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPasswordMap(p => ({ ...p, t_outside: !p['t_outside'] }))}
                      className="px-2.5 py-1.5 text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {showPasswordMap['t_outside'] ? 'إخفاء 👁️' : 'إظهار 👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    كلمة المرور الجديدة:
                  </label>
                  <input
                    type="text"
                    value={editingTeacherOutsidePass}
                    onChange={(e) => setEditingTeacherOutsidePass(e.target.value)}
                    placeholder="أدخل كلمة مرور جديدة لخارج جامع عبري..."
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck="false"
                    className="input-style text-center font-bold tracking-wider py-2.5 w-full bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-5 mt-4 border-t dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    const pass = editingTeacherOutsidePass.trim();
                    if (!pass) return showToast('⚠️ يرجى كتابة كلمة مرور جديدة أولاً', 'error');
                    setTeacherOutsidePassword(pass);
                    setEditingTeacherOutsidePass('');
                    showToast('✅ تم حفظ كلمة مرور خارج جامع عبري بنجاح', 'success');
                  }}
                  className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-xs transition-all active:scale-95"
                >
                  حفظ كلمة مرور خارج عبري
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherOutsidePassword('Ameen123');
                    setEditingTeacherOutsidePass('');
                    showToast('🔄 تمت استعادة كلمة المرور الافتراضية (Ameen123)', 'info');
                  }}
                  className="px-3 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition-all"
                  title="استعادة الافتراضي"
                >
                  افتراضي
                </button>
              </div>
            </div>

            {/* 4. كلمة مرور إدارة الحضور (المغرب / العصر) */}
            <div className="bg-amber-50/50 dark:bg-slate-800/60 p-6 rounded-3xl border border-amber-200 dark:border-slate-700 flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🌅</span>
                    <div>
                      <h5 className="font-black text-lg text-amber-950 dark:text-amber-200">إدارة الحضور</h5>
                      <span className="text-xs text-gray-500 font-bold">بوابة حضور المغرب والعصر</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-black rounded-lg">الافتراضي: 123</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                    كلمة المرور الحالية:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl dark:border-slate-700 text-amber-800 dark:text-amber-400 min-w-[90px] text-center">
                      {showPasswordMap['maghrib'] ? maghribPassword : '••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPasswordMap(p => ({ ...p, maghrib: !p['maghrib'] }))}
                      className="px-2.5 py-1.5 text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {showPasswordMap['maghrib'] ? 'إخفاء 👁️' : 'إظهار 👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    كلمة المرور الجديدة:
                  </label>
                  <input
                    type="text"
                    value={editingMaghribPass}
                    onChange={(e) => setEditingMaghribPass(e.target.value)}
                    placeholder="أدخل كلمة مرور جديدة لإدارة الحضور..."
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck="false"
                    className="input-style text-center font-bold tracking-wider py-2.5 w-full bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-5 mt-4 border-t dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    const pass = editingMaghribPass.trim();
                    if (!pass) return showToast('⚠️ يرجى كتابة كلمة مرور جديدة أولاً', 'error');
                    setMaghribPassword(pass);
                    setEditingMaghribPass('');
                    showToast('✅ تم حفظ كلمة مرور إدارة الحضور بنجاح', 'success');
                  }}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-xs transition-all active:scale-95"
                >
                  حفظ كلمة مرور الحضور
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMaghribPassword('123');
                    setEditingMaghribPass('');
                    showToast('🔄 تمت استعادة كلمة المرور الافتراضية (123)', 'info');
                  }}
                  className="px-3 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition-all"
                  title="استعادة الافتراضي"
                >
                  افتراضي
                </button>
              </div>
            </div>
          </div>

          {/* زر الحفظ الجماعي الشامل */}
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={() => {
                let updatedCount = 0;
                if (editingSupervisorPass.trim()) {
                  setSupervisorPassword(editingSupervisorPass.trim());
                  updatedCount++;
                }
                if (editingTeacherIbriPass.trim()) {
                  setTeacherIbriPassword(editingTeacherIbriPass.trim());
                  updatedCount++;
                }
                if (editingTeacherOutsidePass.trim()) {
                  setTeacherOutsidePassword(editingTeacherOutsidePass.trim());
                  updatedCount++;
                }
                if (editingMaghribPass.trim()) {
                  setMaghribPassword(editingMaghribPass.trim());
                  updatedCount++;
                }
                if (updatedCount === 0) {
                  return showToast('ℹ️ لم يتم كتابة أي كلمة مرور جديدة لتحديثها', 'info');
                }
                setEditingSupervisorPass('');
                setEditingTeacherIbriPass('');
                setEditingTeacherOutsidePass('');
                setEditingMaghribPass('');
                showToast(`✅ تم حفظ وتحديث ${updatedCount} من كلمات المرور بنجاح`, 'success');
              }}
              className="px-8 py-4 bg-green-700 hover:bg-green-800 text-white font-black text-lg rounded-2xl shadow-xl hover:shadow-2xl active:scale-95 transition-all flex items-center gap-3 cursor-pointer"
            >
              <span>💾</span>
              <span>حفظ جميع كلمات المرور وتحديث السحابة</span>
            </button>
          </div>
        </div>
      )}

      {/* تبويب روابط أولياء الأمور */}
      {activeSettingsView === "parentReports" && (() => {
        // تجميع أولياء الأمور الفريدين حسب أرقام الهواتف لتفادي التكرار
        const parentGroups = (() => {
          const map = new Map<string, { phone: string; norm: string; studentNames: string[]; students: any[] }>();
          students.forEach(st => {
            if (st.parentPhone && st.parentPhone.trim()) {
              const norm = normalizeParentPhone(st.parentPhone);
              if (norm) {
                if (!map.has(norm)) {
                  map.set(norm, { phone: st.parentPhone.trim(), norm, studentNames: [], students: [] });
                }
                const entry = map.get(norm)!;
                entry.studentNames.push(st.name);
                entry.students.push(st);
              }
            }
          });
          return Array.from(map.values());
        })();

        const totalParents = parentGroups.length;
        const sentCount = parentGroups.filter(p => bulkSentPhones.includes(p.norm)).length;
        const progressPercent = totalParents > 0 ? Math.round((sentCount / totalParents) * 100) : 0;
        const nextTargetParent = parentGroups.find(p => !bulkSentPhones.includes(p.norm));
        const nextIndex = nextTargetParent ? parentGroups.findIndex(p => p.norm === nextTargetParent.norm) : -1;

        const handleSendNextBulk = () => {
          if (!nextTargetParent) {
            showToast('🎉 تم إرسال الروابط لجميع أولياء الأمور المسجلين!', 'info');
            return;
          }
          const norm = nextTargetParent.norm;
          const link = generateParentLink(nextTargetParent.phone);
          const msg = generateParentWhatsAppMessage(nextTargetParent.studentNames, link, appName, customWhatsAppTemplate);
          const waUrl = `https://wa.me/968${norm}?text=${encodeURIComponent(msg)}`;
          
          window.open(waUrl, '_blank');

          const updated = Array.from(new Set([...bulkSentPhones, norm]));
          setBulkSentPhones(updated);
          localStorage.setItem('parent_bulk_sent_phones', JSON.stringify(updated));

          showToast(`💬 تم فتح واتساب لولي أمر ${nextTargetParent.studentNames.join(' و ')} (${updated.length} / ${totalParents}). عند العودة اضغط للإرسال التالي.`, 'success');
        };

        const handleResetBulk = () => {
          setBulkSentPhones([]);
          localStorage.removeItem('parent_bulk_sent_phones');
          showToast('🔄 تم إعادة تعيين مؤشر الإرسال للبدء من أول رقم', 'info');
        };

        return (
          <div className="space-y-6 animate-fade-in" dir="rtl">
            {/* قسم تفعيل الخدمة ورابط الموقع المعتمد */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* تفعيل / تعطيل الخدمة */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🔗</span>
                    <h4 className="text-base font-black text-gray-900 dark:text-white">
                      حالة خدمة تقارير أولياء الأمور
                    </h4>
                  </div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black ${
                    parentReportsEnabled 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                  }`}>
                    {parentReportsEnabled ? 'مفعلة وتعمل ✅' : 'معطلة مؤقتاً ⛔'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const newState = !parentReportsEnabled;
                    setParentReportsEnabled(newState);
                    showToast(newState ? '✅ تم تفعيل خدمة التقارير' : '⛔ تم تعطيل خدمة التقارير مؤقتاً', newState ? 'success' : 'info');
                  }}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-95 ${
                    parentReportsEnabled
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {parentReportsEnabled ? 'تعطيل الخدمة' : 'تفعيل الخدمة'}
                </button>
              </div>

              {/* رابط الموقع المعتمد (Netlify / Domain) */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <span>🌐</span>
                    <span>رابط الموقع المعتمد (Netlify أو النطاق الخاص):</span>
                  </label>
                  {parentPortalBaseUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setParentPortalBaseUrl('');
                        localStorage.removeItem('parentPortalBaseUrl');
                        showToast('🔄 تم اعتماد الرابط التلقائي للصفحة', 'info');
                      }}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-bold underline"
                    >
                      استعادة التلقائي
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={parentPortalBaseUrl}
                    onChange={e => {
                      const val = e.target.value;
                      setParentPortalBaseUrl(val);
                      localStorage.setItem('parentPortalBaseUrl', val.trim());
                    }}
                    placeholder="تلقائي: يعتمد على رابط الصفحة الحالي"
                    className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono text-xs text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('parentPortalBaseUrl', parentPortalBaseUrl.trim());
                      showToast('✅ تم حفظ رابط الموقع المعتمد', 'success');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer"
                  >
                    حفظ
                  </button>
                </div>
              </div>
            </div>

            {/* الأداة الرئيسية: زر الإرسال الذكي لأولياء الأمور المتبقين */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⚡</span>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">
                      زر الإرسال الذكي (للمتبقين فقط)
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    يرسل تلقائياً فقط لأولياء الأمور الذين لم يتم الإرسال لهم بعد — يمكنك إرسال دفعة اليوم ثم المتابعة غداً بكل سهولة
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {sentCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetBulk}
                      className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs transition-colors cursor-pointer"
                    >
                      🔄 تصفير السجل للبدء من جديد
                    </button>
                  )}
                </div>
              </div>

              {/* شريط مؤشر التقدم والإحصائيات */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 py-2">
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl p-3 text-center">
                    <span className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300">تم إرسالها ✅</span>
                    <strong className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">{sentCount}</strong>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-3 text-center">
                    <span className="block text-[11px] font-bold text-amber-800 dark:text-amber-300">المتبقي للإرسال ⏳</span>
                    <strong className="text-lg font-black font-mono text-amber-700 dark:text-amber-400">{totalParents - sentCount}</strong>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl p-3 text-center">
                    <span className="block text-[11px] font-bold text-blue-800 dark:text-blue-300">الإجمالي المسجل 👥</span>
                    <strong className="text-lg font-black font-mono text-blue-700 dark:text-blue-400">{totalParents}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-bold pt-1">
                  <span className="text-gray-700 dark:text-gray-300">
                    نسبة الإنجاز:
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* الزر الرئيسي للإرسال الذكي */}
              <div className="pt-2">
                {nextTargetParent ? (
                  <button
                    type="button"
                    onClick={handleSendNextBulk}
                    className="w-full py-3.5 px-4 sm:px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black shadow-lg shadow-emerald-600/20 active:scale-98 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
                  >
                    {/* السطر الأول: الإجراء ورقم الهاتف */}
                    <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold flex-wrap">
                      <span className="text-base sm:text-lg animate-bounce">⚡</span>
                      <span>إرسال الرابط لولي الأمر التالي:</span>
                      <span className="font-mono text-[11px] sm:text-xs bg-black/25 px-2 py-0.5 rounded-lg" dir="ltr">
                        {nextTargetParent.phone}
                      </span>
                    </div>

                    {/* السطر الثاني: اسم الطالب بوضوح في سطر مستقل */}
                    <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
                      <span className="text-xs sm:text-sm text-emerald-100 font-medium">الطالب:</span>
                      <strong className="text-amber-300 text-sm sm:text-lg font-black underline underline-offset-4">
                        {nextTargetParent.studentNames.join(' و ')}
                      </strong>
                    </div>
                  </button>
                ) : (
                  <div className="w-full py-4 px-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-black text-center text-sm flex items-center justify-center gap-2">
                    <span className="text-xl">🎉</span>
                    <span>اكتمل الإرسال! تم إرسال الروابط لجميع أولياء الأمور المسجلين ({totalParents} ولي أمر) بنجاح.</span>
                  </div>
                )}
              </div>
            </div>

            {/* تخصيص نص رسالة الواتساب */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span>✍️</span>
                  <span>نص رسالة الواتساب المرسلة لولي الأمر:</span>
                </h4>
                {customWhatsAppTemplate && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomWhatsAppTemplate('');
                      localStorage.removeItem('parentWhatsAppTemplate');
                      showToast('🔄 تم استعادة النص الافتراضي', 'info');
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold underline"
                  >
                    استعادة النص الافتراضي
                  </button>
                )}
              </div>

              <textarea
                rows={3}
                value={customWhatsAppTemplate}
                onChange={e => setCustomWhatsAppTemplate(e.target.value)}
                placeholder={`السلام عليكم ورحمة الله وبركاته 🌿\n\nأهلاً بكم في *{appName}*.\n\nيسرنا مشاركتكم رابط تقرير متابعة الحفظ والمراجعة الأسبوعية الخاص بـ {student_names}:\n\n🔗 {link}\n\nنسأل الله تعالى لهم التوفيق والبركة في حفظ القرآن الكريم.`}
                className="w-full p-3 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-sans"
                dir="rtl"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <span>المتغيرات:</span>
                  <code className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md font-mono text-emerald-600 dark:text-emerald-400 font-bold">{'{student_names}'}</code>
                  <code className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md font-mono text-teal-600 dark:text-teal-400 font-bold">{'{link}'}</code>
                  <code className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md font-mono text-blue-600 dark:text-blue-400 font-bold">{'{appName}'}</code>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('parentWhatsAppTemplate', customWhatsAppTemplate);
                    showToast('✅ تم حفظ نص الرسالة', 'success');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  حفظ نص الرسالة
                </button>
              </div>
            </div>
            {/* دليل روابط الطلاب مع مؤشر حالة الإرسال والكود العشوائي */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-sm border border-gray-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-black text-gray-900 dark:text-white">
                    قائمة أولياء الأمور والطلاب المسجلين ({students.filter(s => s.parentPhone && s.parentPhone.trim()).length} طالب)
                  </h4>
                  <p className="text-xs text-gray-500">
                    يمكنك إرسال أو نسخ الرابط لأي طالب مباشرة مع رمز الكود الخاص به
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={parentSearchTerm}
                    onChange={e => setParentSearchTerm(e.target.value)}
                    placeholder="بحث باسم الطالب أو الهاتف..."
                    className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
              </div>

              {/* أزرار الفرز الذكي: الكل / غير المرسل لهم / تم الإرسال */}
              <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-slate-800/70 rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setParentFilterTab('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    parentFilterTab === 'all'
                      ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                  }`}
                >
                  الكل ({totalParents})
                </button>
                <button
                  type="button"
                  onClick={() => setParentFilterTab('unsent')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    parentFilterTab === 'unsent'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-950/40'
                  }`}
                >
                  <span>⏳ غير المرسل لهم</span>
                  <span className="font-mono bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">
                    {totalParents - sentCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setParentFilterTab('sent')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    parentFilterTab === 'sent'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  <span>✅ تم الإرسال لهم</span>
                  <span className="font-mono bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">
                    {sentCount}
                  </span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-[500px] divide-y divide-gray-100 dark:divide-slate-800 border border-gray-200/60 dark:border-slate-800 rounded-2xl">
                {students
                  .filter(s => {
                    const hasPhone = !!s.parentPhone && s.parentPhone.trim().length > 0;
                    if (!hasPhone) return parentFilterTab === 'all';
                    const norm = normalizeParentPhone(s.parentPhone!);
                    const isSent = bulkSentPhones.includes(norm);

                    if (parentFilterTab === 'unsent' && isSent) return false;
                    if (parentFilterTab === 'sent' && !isSent) return false;

                    if (!parentSearchTerm.trim()) return true;
                    const term = parentSearchTerm.toLowerCase();
                    return s.name.toLowerCase().includes(term) || (s.parentPhone && s.parentPhone.includes(term));
                  })
                  .map(st => {
                    const hasPhone = !!st.parentPhone && st.parentPhone.trim().length > 0;
                    const link = hasPhone ? generateParentLink(st.parentPhone!) : '';
                    const norm = hasPhone ? normalizeParentPhone(st.parentPhone!) : '';
                    const parentCode = hasPhone ? getParentRandomCode(norm) : '';
                    const isSent = hasPhone && bulkSentPhones.includes(norm);
                    const isNext = hasPhone && nextTargetParent?.norm === norm;

                    return (
                      <div key={st.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black text-sm flex items-center justify-center shrink-0">
                            {st.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900 dark:text-white">
                                {st.name}
                              </span>
                              {st.schoolStage && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
                                  {st.schoolStage}
                                </span>
                              )}
                              {hasPhone && (
                                <>
                                  {isSent ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                      ✅ تم الإرسال
                                    </span>
                                  ) : isNext ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 animate-pulse">
                                      👉 التالي للإرسال
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400">
                                      ⏳ بانتظار الإرسال
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2.5 mt-0.5 flex-wrap">
                              <span>الهاتف:</span>
                              {hasPhone ? (
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                                  {st.parentPhone}
                                </span>
                              ) : (
                                <span className="text-rose-500 font-bold">غير مسجل</span>
                              )}
                              {hasPhone && parentCode && (
                                <span className="font-mono text-[11px] text-gray-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  #{parentCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          {hasPhone ? (
                            <>
                              <a
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-xs transition-colors"
                              >
                                عرض
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(link);
                                  showToast(`📋 تم نسخ رابط تقرير ${st.name} مع الكود`, 'success');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 font-bold text-xs cursor-pointer transition-colors"
                              >
                                نسخ الرابط
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = generateParentWhatsAppMessage([st.name], link, appName, customWhatsAppTemplate);
                                  const waUrl = `https://wa.me/968${norm}?text=${encodeURIComponent(msg)}`;
                                  window.open(waUrl, '_blank');
                                  
                                  const updated = Array.from(new Set([...bulkSentPhones, norm]));
                                  setBulkSentPhones(updated);
                                  localStorage.setItem('parent_bulk_sent_phones', JSON.stringify(updated));
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
                              >
                                واتساب
                              </button>
                              {/* زر لتبديل حالة الإرسال يدوياً */}
                              <button
                                type="button"
                                title={isSent ? 'تحديد كغير مرسل' : 'تحديد كتم الإرسال'}
                                onClick={() => {
                                  let updated: string[];
                                  if (isSent) {
                                    updated = bulkSentPhones.filter(p => p !== norm);
                                  } else {
                                    updated = Array.from(new Set([...bulkSentPhones, norm]));
                                  }
                                  setBulkSentPhones(updated);
                                  localStorage.setItem('parent_bulk_sent_phones', JSON.stringify(updated));
                                  showToast(isSent ? '⏳ تم التحديد كـ غير مرسل' : '✅ تم التحديد كـ مرسل', 'info');
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs transition-colors cursor-pointer"
                              >
                                {isSent ? '↩️' : '✔️'}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">سجل الرقم لتفعيل الرابط</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
