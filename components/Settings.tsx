import React, { useState, useContext, useEffect, useRef } from "react";
import { AppContext } from "../App";
import { exportSheetTemplate } from "../utils/exportSheetTemplate";
import { exportMainHalaqasTemplate, exportSardHalaqasTemplate } from "../utils/halaqaExcelUtils";
import { exportFullBackup, importFullBackup, exportFullBackupJson, importFullBackupJson } from "../utils/fullBackup";
import { parseJuzsToNumbers } from "../utils/juzUtils";
import { FullBackupData, UserRole } from "../types";
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

  const [activeSettingsView, setActiveSettingsView] = useState<"main" | "tests" | "customization" | "mutoon">("main");
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

    showToast(`✅ تم استيراد بيانات ${isSard ? 'حلقات السرد' : 'الحلقات الرئيسة'} بنجاح: ${importedStudentsCount} طالب، ${importedHalaqasCount} حلقة.`);
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
      appName,
      firebaseConfig,
      hijriAdjustments,
      isDistributable: true,
      isPublishedConnected: true,
      isTestActive,
      testScore,
      testName,
      testDeductions,
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
                  {/* الحلقات الرئيسة */}
                  <div className="p-4 bg-emerald-50/50 dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-2 font-black text-xs text-emerald-900 dark:text-emerald-300">
                      <span>🕌</span>
                      <span>الحلقات الرئيسة (اسم الحلقة، المعلم، الطالب)</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => exportMainHalaqasTemplate("قالب_استيراد_الحلقات_الرئيسة", users, students)}
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
                        value={testScoreInput}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          setTestScoreInput(Number(e.target.value))
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
                      <input type="number" step="0.25" min="0" value={testDeductionsInput.fath} onFocus={(e) => e.target.select()} onChange={(e) => setTestDeductionsInput({ ...testDeductionsInput, fath: Number(e.target.value) })} className="input-style py-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">خصم التشكيل</label>
                      <input type="number" step="0.25" min="0" value={testDeductionsInput.tashkeel} onFocus={(e) => e.target.select()} onChange={(e) => setTestDeductionsInput({ ...testDeductionsInput, tashkeel: Number(e.target.value) })} className="input-style py-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">خصم التجويد</label>
                      <input type="number" step="0.25" min="0" value={testDeductionsInput.tajweed} onFocus={(e) => e.target.select()} onChange={(e) => setTestDeductionsInput({ ...testDeductionsInput, tajweed: Number(e.target.value) })} className="input-style py-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">خصم تغيير المقطع</label>
                      <input type="number" step="0.25" min="0" value={testDeductionsInput.passageChange ?? 2} onFocus={(e) => e.target.select()} onChange={(e) => setTestDeductionsInput({ ...testDeductionsInput, passageChange: Number(e.target.value) })} className="input-style py-2 text-sm font-bold border-amber-300 focus:border-amber-500" />
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
                    value={newStudentScoreInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentScoreInput(Number(e.target.value))}
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
                    value={newStudentPassingRateInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentPassingRateInput(Number(e.target.value))}
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
                    value={newStudentDeductionsInput.fath}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentDeductionsInput({ ...newStudentDeductionsInput, fath: Number(e.target.value) })}
                    className="input-style py-2 text-sm font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">خصم التشكيل</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={newStudentDeductionsInput.tashkeel}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentDeductionsInput({ ...newStudentDeductionsInput, tashkeel: Number(e.target.value) })}
                    className="input-style py-2 text-sm font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-yellow-600 dark:text-yellow-400 mb-1">خصم التجويد</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={newStudentDeductionsInput.tajweed}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewStudentDeductionsInput({ ...newStudentDeductionsInput, tajweed: Number(e.target.value) })}
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
    </div>
  );
};
