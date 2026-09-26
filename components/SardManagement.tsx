import React, { useState, useContext, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { AppContext } from '../App';
import { Student, UserRole, SardHalaqa, User } from '../types';
import Modal from './Modal';
import { isSmartMatch, findSimilarHalaqa, normalizeHalaqaName } from '../utils/searchUtils';
import { exportSardHalaqasTemplate } from '../utils/halaqaExcelUtils';
import { HalaqaExcelImportModal } from './HalaqaExcelImportModal';
import { getMemorizedPagesData, calculateStudentLevel, getLevelNumericRank, LEVEL_WORDS_ORDER, normalizeStudentLevel } from '../utils/pageUtils';
import { exportToWord } from '../utils/exportWord';
import { exportToExcel } from '../utils/exportExcel';
import { exportToPdf, sharePdfDirectly } from '../utils/exportPdf';
import { WordExportModal } from './WordExportModal';
import { ExcelExportModal } from './ExcelExportModal';

export const SardManagement: React.FC = () => {
    const context = useContext(AppContext);

    const students = context?.students || [];
    const sardHalaqas = context?.sardHalaqas || [];
    const halaqas = context?.halaqas || [];
    const users = context?.users || [];
    const evaluations = context?.evaluations || [];

    const getStudentLevel = (s: Student) => {
        const manual = normalizeStudentLevel(s.manualStudentLevel || s.manualLevel);
        if (manual) return manual;
        const pagesData = getMemorizedPagesData(s, evaluations);
        return calculateStudentLevel(pagesData.totalCount) || "المستوى الأول";
    };
    const addStudent = context?.addStudent || (async () => {});
    const updateStudent = context?.updateStudent || (async () => {});
    const deleteStudent = context?.deleteStudent || (async () => {});
    const addTeacher = context?.addTeacher || ((n: string) => 0);
    const addSardHalaqa = context?.addSardHalaqa || ((h: any) => 0);
    const updateSardHalaqa = context?.updateSardHalaqa || (async () => {});
    const deleteSardHalaqa = context?.deleteSardHalaqa || (async () => {});
    const assignTeacherToSardHalaqa = context?.assignTeacherToSardHalaqa || (async () => {});
    const assignStudentToSardHalaqa = context?.assignStudentToSardHalaqa || (async () => {});
    const showToast = context?.showToast || (() => {});

    const [openHalaqaId, setOpenHalaqaId] = useState<number | null>(null);
    const [newHalaqaName, setNewHalaqaName] = useState('');
    const [editingHalaqaId, setEditingHalaqaId] = useState<number | null>(null);
    const [editingHalaqaName, setEditingHalaqaName] = useState<string>('');
    const [halaqaSearchTerm, setHalaqaSearchTerm] = useState('');
    const [studentSearchTerm, setStudentSearchTerm] = useState('');

    // Modal for Excel Import
    const [showImportModal, setShowImportModal] = useState(false);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [isWordModalOpen, setIsWordModalOpen] = useState(false);

    // Transfer student between Sard halaqas
    const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
    const [transferSearchQuery, setTransferSearchQuery] = useState('');

    // Add existing student modal
    const [assignExistingModalOpen, setAssignExistingModalOpen] = useState<number | null>(null);
    const [existingStudentSearch, setExistingStudentSearch] = useState('');
    const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');
    const [selectedStudentIdsToAssign, setSelectedStudentIdsToAssign] = useState<number[]>([]);
    const [showMemorizedPagesRange, setShowMemorizedPagesRange] = useState<boolean>(false);

    // New student text input
    const [newStudentName, setNewStudentName] = useState('');

    const [confirmationModal, setConfirmationModal] = useState<{ 
        isOpen: boolean; 
        title: string; 
        message: string; 
        onConfirm: () => void; 
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const teachers = useMemo(() => users.filter(u => u.role === UserRole.TEACHER).sort((a,b) => a.name.localeCompare(b.name, 'ar', { numeric: true })), [users]);
    const sortedSardHalaqas = useMemo(() => [...(sardHalaqas || [])].sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true })), [sardHalaqas]);

    // Available teachers for a given Sard Halaqa (hides teachers already assigned to OTHER Sard halaqas)
    const getAvailableTeachersForSardHalaqa = (currentHalaqaId: number) => {
        return teachers.filter(t => {
            const isAssignedToOther = sardHalaqas.some(h => h.id !== currentHalaqaId && h.teacherId === t.id);
            return !isAssignedToOther;
        });
    };

    // Students not assigned to ANY Sard Halaqa yet
    const unassignedStudents = useMemo(() => {
        return students.filter(s => !s.sardHalaqaId);
    }, [students]);

    // Unique levels among unassigned students (Sorted strictly ascending from smallest to largest)
    const availableLevels = useMemo(() => {
        const levelsSet = new Set<string>();
        unassignedStudents.forEach(s => {
            const lvl = normalizeStudentLevel(getStudentLevel(s));
            if (lvl) levelsSet.add(lvl);
        });
        return Array.from(levelsSet).sort((a, b) => {
            const rankA = getLevelNumericRank(a);
            const rankB = getLevelNumericRank(b);
            if (rankA !== rankB) return rankA - rankB;
            return a.localeCompare(b, 'ar');
        });
    }, [unassignedStudents, evaluations]);

    // Filtered and sorted students for assignment modal (Sorted by level smallest to largest, then by name)
    const filteredAndSortedStudentsToAssign = useMemo(() => {
        return unassignedStudents
            .filter(s => {
                const matchesSearch = !existingStudentSearch.trim() || isSmartMatch(s.name, existingStudentSearch);
                const matchesLevel = selectedLevelFilter === 'all' || getStudentLevel(s) === selectedLevelFilter;
                return matchesSearch && matchesLevel;
            })
            .sort((a, b) => {
                const rankA = getLevelNumericRank(getStudentLevel(a));
                const rankB = getLevelNumericRank(getStudentLevel(b));
                if (rankA !== rankB) return rankA - rankB;
                return a.name.localeCompare(b.name, 'ar', { numeric: true });
            });
    }, [unassignedStudents, existingStudentSearch, selectedLevelFilter, evaluations]);

    const handleSelectAllFiltered = () => {
        const visibleIds = filteredAndSortedStudentsToAssign.map(s => s.id);
        setSelectedStudentIdsToAssign(prev => Array.from(new Set([...prev, ...visibleIds])));
    };

    const handleDeselectAllFiltered = () => {
        const visibleIdsSet = new Set(filteredAndSortedStudentsToAssign.map(s => s.id));
        setSelectedStudentIdsToAssign(prev => prev.filter(id => !visibleIdsSet.has(id)));
    };

    const filteredHalaqasForList = useMemo(() => {
        if (!halaqaSearchTerm.trim()) return sortedSardHalaqas;
        return sortedSardHalaqas.filter(h => isSmartMatch(h.name, halaqaSearchTerm));
    }, [sortedSardHalaqas, halaqaSearchTerm]);

    const handleHalaqaDelete = (halaqa: SardHalaqa) => {
        setConfirmationModal({
            isOpen: true,
            title: 'تأكيد حذف حلقة السرد',
            message: `هل أنت متأكد من حذف حلقة السرد "${halaqa.name}"؟ سيتم فك ارتباط طلابها من هذه الحلقة دون حذف بياناتهم الأساسية.`,
            onConfirm: () => {
                deleteSardHalaqa(halaqa.id);
                setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                showToast('✅ تم حذف حلقة السرد بنجاح');
            }
        });
    };

    const handleRemoveStudentFromSard = (student: Student) => {
        setConfirmationModal({
            isOpen: true,
            title: 'إلغاء تعيين الطالب من حلقة السرد',
            message: `هل ترغب في إزالة الطالب "${student.name}" من حلقة السرد الحالية؟ (لن يتم حذف الطالب من البرنامج الرئيسي)`,
            onConfirm: () => {
                assignStudentToSardHalaqa(student.id, undefined);
                setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                showToast(`✅ تم إزالة الطالب "${student.name}" من حلقة السرد`);
            }
        });
    };

    const handleAddHalaqa = (e: React.FormEvent) => {
        e.preventDefault();
        const rawLines = newHalaqaName.split('\n').map(name => name.trim()).filter(name => name !== '');
        if (rawLines.length === 0) return;

        const validToAdd: string[] = [];
        const rejectedDuplicates: { name: string; conflictWith: string }[] = [];
        const seenInBatch = new Set<string>();

        for (const name of rawLines) {
            const norm = normalizeHalaqaName(name);
            if (seenInBatch.has(norm)) {
                rejectedDuplicates.push({ name, conflictWith: 'مكرر في نفس القائمة المدخلة' });
                continue;
            }
            const conflict = findSimilarHalaqa(name, sardHalaqas);
            if (conflict) {
                rejectedDuplicates.push({ name, conflictWith: conflict.name });
                continue;
            }
            seenInBatch.add(norm);
            validToAdd.push(name);
        }

        if (validToAdd.length === 0) {
            // جميع الأسماء المدخلة مكررة أو مشابهة لحلقات سرد سابقة
            if (rejectedDuplicates.length === 1) {
                showToast(`⚠️ لا يمكن قبول اسم حلقة السرد "${rejectedDuplicates[0].name}": مشابه أو مطابق لحلقة سرد سابقة ("${rejectedDuplicates[0].conflictWith}"). يجب أن يكون اسم حلقة السرد وحيداً!`);
            } else {
                const listStr = rejectedDuplicates.map(r => `"${r.name}"`).join('، ');
                showToast(`⚠️ تعذر الإضافة: حلقات السرد التالية مكررة أو مشابهة لحلقات سابقة: (${listStr}). يجب أن يكون اسم كل حلقة وحيداً!`);
            }
            return;
        }

        // إضافة حلقات السرد الفريدة فقط
        validToAdd.forEach(name => addSardHalaqa({ name, teacherId: 0 }));

        if (rejectedDuplicates.length > 0) {
            // إبقاء الأسماء المرفوضة في المربع للمراجعة والتعديل
            setNewHalaqaName(rejectedDuplicates.map(r => r.name).join('\n'));
            const rejectedList = rejectedDuplicates.map(r => `"${r.name}"`).join('، ');
            showToast(`✅ تم إضافة ${validToAdd.length} حلقة سرد بنجاح. ⚠️ تم استبعاد المكرر: (${rejectedList}) لأن الاسم مسجل مسبقاً.`);
        } else {
            setNewHalaqaName('');
            showToast(`✅ تم إضافة ${validToAdd.length} حلقة سرد بنجاح.`);
        }
    };

    const handleSaveEditHalaqa = () => {
        const trimmed = editingHalaqaName.trim();
        if (!trimmed) {
            showToast('⚠️ يرجى إدخال اسم حلقة السرد');
            return;
        }
        if (editingHalaqaId === null) return;

        const conflict = findSimilarHalaqa(trimmed, sardHalaqas, editingHalaqaId);
        if (conflict) {
            showToast(`⚠️ لا يمكن حفظ التعديل: اسم حلقة السرد "${trimmed}" مطابق أو مشابه لحلقة سرد سابقة ("${conflict.name}"). يجب أن يكون اسم حلقة السرد وحيداً!`);
            return;
        }

        const currentHalaqa = sardHalaqas.find(h => h.id === editingHalaqaId);
        if (currentHalaqa) {
            updateSardHalaqa({ ...currentHalaqa, name: trimmed });
            setEditingHalaqaId(null);
            showToast('✅ تم تحديث اسم حلقة السرد بنجاح');
        }
    };

    const handleAddNewStudentToSard = (sardHalaqaId: number) => {
        if (newStudentName.trim()) {
            const names = newStudentName.split('\n').filter(n => n.trim() !== '');
            names.forEach(name => {
                // Find if student already exists by name
                const existing = students.find(s => s.name.trim() === name.trim());
                if (existing) {
                    assignStudentToSardHalaqa(existing.id, sardHalaqaId);
                } else {
                    addStudent({ name: name.trim(), halaqaId: 0, sardHalaqaId });
                }
            });
            setNewStudentName('');
            showToast(`✅ تم إضافة ${names.length} طالب إلى حلقة السرد بنجاح.`);
        }
    };

    const handleOpenAssignExistingModal = (halaqaId: number) => {
        setSelectedLevelFilter('all');
        setExistingStudentSearch('');
        setSelectedStudentIdsToAssign([]);
        setAssignExistingModalOpen(halaqaId);
    };

    const handleCloseAssignExistingModal = () => {
        setAssignExistingModalOpen(null);
        setSelectedLevelFilter('all');
        setExistingStudentSearch('');
        setSelectedStudentIdsToAssign([]);
    };

    const handleBatchAssignExistingStudents = (sardHalaqaId: number) => {
        if (selectedStudentIdsToAssign.length === 0) return;
        selectedStudentIdsToAssign.forEach(id => {
            assignStudentToSardHalaqa(id, sardHalaqaId);
        });
        showToast(`✅ تم إلحاق ${selectedStudentIdsToAssign.length} طالب بحلقة السرد بنجاح.`);
        handleCloseAssignExistingModal();
    };

    const handleMoveStudent = (student: Student, targetSardHalaqaId: number) => {
        const targetHalaqa = sardHalaqas.find(h => h.id === targetSardHalaqaId);
        if (!targetHalaqa) return;

        assignStudentToSardHalaqa(student.id, targetSardHalaqaId);
        setTransferringStudent(null);
        setTransferSearchQuery('');
        showToast(`✅ تم نقل الطالب "${student.name}" إلى حلقة السرد "${targetHalaqa.name}"`);
    };

    const sardHalaqasExportHeaders = [
        { key: 'sequence', label: 'م' },
        { key: 'halaqaName', label: 'اسم حلقة السرد' },
        { key: 'teacherName', label: 'اسم المعلم' },
        { key: 'studentName', label: 'اسم الطالب' },
    ];

    const getSardHalaqasExportData = () => {
        const exportData: any[] = [];
        let seq = 1;
        sortedSardHalaqas.forEach(h => {
            const teacher = users.find(u => u.id === h.teacherId);
            const hStudents = students.filter(s => s.sardHalaqaId === h.id);
            if (hStudents.length === 0) {
                exportData.push({
                    sequence: seq,
                    halaqaName: h.name,
                    teacherName: teacher?.name || 'غير معين',
                    studentName: 'لا يوجد طلاب',
                    'م': seq,
                    'اسم حلقة السرد': h.name,
                    'اسم المعلم': teacher?.name || 'غير معين',
                    'اسم الطالب': 'لا يوجد طلاب'
                });
                seq++;
            } else {
                hStudents.forEach(s => {
                    exportData.push({
                        sequence: seq,
                        halaqaName: h.name,
                        teacherName: teacher?.name || 'غير معين',
                        studentName: s.name,
                        'م': seq,
                        'اسم حلقة السرد': h.name,
                        'اسم المعلم': teacher?.name || 'غير معين',
                        'اسم الطالب': s.name
                    });
                    seq++;
                });
            }
        });
        return exportData;
    };

    const handlePdfPrint = () => {
        const data = getSardHalaqasExportData();
        exportToPdf(sardHalaqasExportHeaders, data, 'بيانات_حلقات_السرد', 'قائمة حلقات السرد والمعلمين والطلاب');
    };

    const handlePdfShare = () => {
        const data = getSardHalaqasExportData();
        sharePdfDirectly(sardHalaqasExportHeaders, data, 'بيانات_حلقات_السرد', 'قائمة حلقات السرد والمعلمين والطلاب', undefined, {}, {}, undefined, 'landscape');
    };

    const exportSardHalaqasToExcel = () => {
        const exportData = getSardHalaqasExportData();
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        worksheet['!rightToLeft'] = true;
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'حلقات السرد');
        XLSX.writeFile(workbook, 'بيانات_حلقات_السرد_والطلاب.xlsx');
        showToast('✅ تم تصدير بيانات حلقات السرد إلى Excel بنجاح');
    };

    const handleConfirmImportSardHalaqas = ({
        items,
        resolveConflictMode,
    }: {
        items: { halaqaName: string; teacherName: string; teacherIdStr?: string; studentName: string; studentIdStr?: string; }[];
        resolveConflictMode: 'overwrite' | 'preserve';
    }) => {
        let importedSardHalaqasCount = 0;
        let importedTeachersCount = 0;
        let importedStudentsCount = 0;

        // خريطة المعلمين
        const teacherNameToId = new Map<string, number>();
        users.filter(u => u.role === UserRole.TEACHER).forEach(u => {
            teacherNameToId.set(u.name.trim().toLowerCase(), u.id);
        });

        // خريطة حلقات السرد
        const sardHalaqaNameToId = new Map<string, number>();
        sardHalaqas.forEach(h => {
            sardHalaqaNameToId.set(h.name.trim().toLowerCase(), h.id);
        });

        items.forEach(row => {
            const hName = row.halaqaName.trim();
            const tName = row.teacherName.trim();
            const sName = row.studentName.trim();

            if (!hName && !sName) return;

            // 1. معالجة المعلم
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

            // 2. معالجة حلقة السرد
            let targetSardHalaqaId = 0;
            if (hName) {
                const hKey = hName.toLowerCase();
                if (sardHalaqaNameToId.has(hKey)) {
                    targetSardHalaqaId = sardHalaqaNameToId.get(hKey)!;
                    const existingHalaqa = sardHalaqas.find(h => h.id === targetSardHalaqaId);
                    if (existingHalaqa && teacherId && resolveConflictMode === 'overwrite') {
                        if (existingHalaqa.teacherId !== teacherId) {
                            assignTeacherToSardHalaqa(targetSardHalaqaId, teacherId);
                        }
                    }
                } else {
                    const newHalaqaId = addSardHalaqa({ name: hName, teacherId: teacherId || 0 }) as number;
                    sardHalaqaNameToId.set(hKey, newHalaqaId);
                    targetSardHalaqaId = newHalaqaId;
                    importedSardHalaqasCount++;
                }
            }

            // 3. معالجة الطالب
            if (sName && sName !== 'لا يوجد طلاب') {
                const studentIdFromRow = row.studentIdStr && !isNaN(parseInt(row.studentIdStr)) ? parseInt(row.studentIdStr) : null;
                const existingStudent = students.find(s => studentIdFromRow ? s.id === studentIdFromRow : s.name.trim().toLowerCase() === sName.toLowerCase());
                if (existingStudent) {
                    if (targetSardHalaqaId && existingStudent.sardHalaqaId !== targetSardHalaqaId) {
                        assignStudentToSardHalaqa(existingStudent.id, targetSardHalaqaId);
                    }
                } else {
                    addStudent({
                        name: sName,
                        halaqaId: 0,
                        sardHalaqaId: targetSardHalaqaId || undefined,
                    });
                    importedStudentsCount++;
                }
            }
        });

        showToast(`✅ تم استيراد حلقات السرد بنجاح: ${importedStudentsCount} طالب، ${importedSardHalaqasCount} حلقة سرد.`);
    };

    const newHalaqaConflicts = useMemo(() => {
        if (!newHalaqaName.trim()) return [];
        const lines = newHalaqaName.split('\n').map(l => l.trim()).filter(Boolean);
        const conflicts: { line: string; existingName: string }[] = [];
        for (const l of lines) {
            const c = findSimilarHalaqa(l, sardHalaqas);
            if (c) conflicts.push({ line: l, existingName: c.name });
        }
        return conflicts;
    }, [newHalaqaName, sardHalaqas]);

    const editHalaqaConflict = useMemo(() => {
        if (!editingHalaqaId || !editingHalaqaName.trim()) return undefined;
        return findSimilarHalaqa(editingHalaqaName.trim(), sardHalaqas, editingHalaqaId);
    }, [editingHalaqaId, editingHalaqaName, sardHalaqas]);

    return (
        <>
            {/* Confirmation Modal */}
            {confirmationModal.isOpen && (
                <Modal title={confirmationModal.title} onClose={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))} hideDefaultCloseButton={true}>
                    <p className="py-4 text-lg dark:text-gray-200 text-center font-bold">{confirmationModal.message}</p>
                    <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-4 border-t dark:border-gray-700">
                        <button onClick={confirmationModal.onConfirm} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all text-xl">نعم، تأكيد</button>
                        <button onClick={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 bg-gray-200 rounded-2xl font-black dark:bg-gray-700 dark:text-white text-xl">إلغاء</button>
                    </div>
                </Modal>
            )}

            {/* Transfer Student Modal */}
            {transferringStudent && (
                <Modal title={`نقل الطالب في السرد: ${transferringStudent.name}`} onClose={() => setTransferringStudent(null)} hideDefaultCloseButton>
                    <div className="space-y-4">
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-300">اختر حلقة السرد الجديدة التي ترغب في نقل الطالب إليها:</p>
                        <div className="relative flex items-center">
                            <input 
                                type="text" 
                                placeholder="ابحث عن حلقة سرد..." 
                                value={transferSearchQuery}
                                onChange={(e) => setTransferSearchQuery(e.target.value)}
                                className="input-style w-full pl-10 pr-4"
                                autoFocus
                            />
                            <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {transferSearchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setTransferSearchQuery('')}
                                    className="absolute left-9 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                                    title="مسح البحث"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <div className="max-h-60 overflow-y-auto border-2 rounded-2xl p-2 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                            {sortedSardHalaqas
                                .filter(h => h.id !== transferringStudent.sardHalaqaId && isSmartMatch(h.name, transferSearchQuery))
                                .map(halaqa => (
                                    <button 
                                        key={halaqa.id}
                                        onClick={() => handleMoveStudent(transferringStudent, halaqa.id)}
                                        className="w-full text-right p-4 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-700 rounded-xl border-b dark:border-slate-700 last:border-0 font-bold transition-colors flex justify-between items-center group"
                                    >
                                        <span>{halaqa.name}</span>
                                        <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                                    </button>
                                ))
                            }
                            {sortedSardHalaqas.filter(h => h.id !== transferringStudent.sardHalaqaId && isSmartMatch(h.name, transferSearchQuery)).length === 0 && (
                                <p className="p-8 text-center text-gray-400">لا توجد حلقات سرد أخرى بهذا الاسم</p>
                            )}
                        </div>
                        <button onClick={() => setTransferringStudent(null)} className="w-full py-3 bg-gray-200 text-gray-800 rounded-xl font-bold mt-2">إلغاء</button>
                    </div>
                </Modal>
            )}

            {/* Modal: Assign Existing Students to Sard Halaqa */}
            {assignExistingModalOpen !== null && (
                <Modal 
                    title="إضافة طلاب من القائمة العامة إلى حلقة السرد" 
                    onClose={handleCloseAssignExistingModal}
                    hideDefaultCloseButton
                >
                    <div className="space-y-4">
                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                            حدد الطلاب المراد إلحاقهم بهذه الحلقة (المرتبين حسب المستوى من الأصغر للأكبر):
                        </p>

                        {/* Search + Level Filter Row */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-grow flex items-center">
                                <input 
                                    type="text" 
                                    placeholder="ابحث باسم الطالب..." 
                                    value={existingStudentSearch}
                                    onChange={(e) => setExistingStudentSearch(e.target.value)}
                                    className="input-style w-full pl-10 pr-4"
                                />
                                <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                {existingStudentSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setExistingStudentSearch('')}
                                        className="absolute left-9 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                                        title="مسح البحث"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            <div className="sm:w-52">
                                <select
                                    value={selectedLevelFilter}
                                    onChange={(e) => setSelectedLevelFilter(e.target.value)}
                                    className="input-style w-full bg-white dark:bg-slate-700 font-bold text-xs border-2 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 focus:outline-none cursor-pointer py-3"
                                    title="تصفية حسب المستوى"
                                >
                                    <option value="all">جميع المستويات ({unassignedStudents.length})</option>
                                    {availableLevels.map(lvl => {
                                        const count = unassignedStudents.filter(s => getStudentLevel(s) === lvl).length;
                                        return (
                                            <option key={lvl} value={lvl}>
                                                {lvl} ({count})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Filter Action Bar (Select All / Deselect All) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
                            <span className="font-bold text-gray-700 dark:text-gray-300">
                                غير المدرجين حالياً: <span className="text-emerald-700 dark:text-emerald-300 font-black">{filteredAndSortedStudentsToAssign.length} طالب</span>
                                {selectedLevelFilter !== 'all' && <span className="mr-1 text-emerald-600 dark:text-emerald-400">({selectedLevelFilter})</span>}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSelectAllFiltered}
                                    disabled={filteredAndSortedStudentsToAssign.length === 0}
                                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-lg text-xs shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                                >
                                    اختيار الكل {selectedLevelFilter !== 'all' ? `في ${selectedLevelFilter}` : ''}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeselectAllFiltered}
                                    disabled={selectedStudentIdsToAssign.length === 0}
                                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-lg text-xs transition-colors disabled:opacity-40 cursor-pointer"
                                >
                                    إلغاء تحديد الكل
                                </button>
                            </div>
                        </div>

                        {/* زر إظهار/إخفاء أرقام صفحات المحفوظ (القديم والجديد) */}
                        <div className="flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => setShowMemorizedPagesRange(prev => !prev)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                                    showMemorizedPagesRange
                                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                                        : 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-600'
                                }`}
                            >
                                <span>{showMemorizedPagesRange ? '📖' : '📑'}</span>
                                <span>{showMemorizedPagesRange ? 'إخفاء أرقام صفحات المحفوظ' : 'إظهار أرقام صفحات المحفوظ (القديم والجديد)'}</span>
                            </button>
                        </div>
                        
                        {/* Student Checklist */}
                        <div className="max-h-64 overflow-y-auto border-2 rounded-2xl p-2 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 divide-y dark:divide-slate-700">
                            {filteredAndSortedStudentsToAssign.map(student => {
                                const isSelected = selectedStudentIdsToAssign.includes(student.id);
                                const level = getStudentLevel(student);
                                const studentPagesData = showMemorizedPagesRange ? getMemorizedPagesData(student, evaluations) : null;
                                const pagesRangeStr = studentPagesData?.combinedStr && studentPagesData.combinedStr !== '—' ? studentPagesData.combinedStr : (studentPagesData ? 'لا يوجد محفوظ' : '');

                                return (
                                    <label 
                                        key={student.id} 
                                        className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                                            isSelected ? 'bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700' : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedStudentIdsToAssign(prev => [...prev, student.id]);
                                                    } else {
                                                        setSelectedStudentIdsToAssign(prev => prev.filter(id => id !== student.id));
                                                    }
                                                }}
                                                className="w-5 h-5 text-emerald-600 rounded cursor-pointer"
                                            />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900 dark:text-gray-100 text-base">{student.name}</span>
                                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-900 dark:bg-emerald-900/80 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-700 shadow-2xs">
                                                        {level}
                                                    </span>
                                                    {showMemorizedPagesRange && (
                                                        <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                                                            ({pagesRangeStr})
                                                        </span>
                                                    )}
                                                    {student.isAlAmeen && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                                            طالب أمين
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                            {filteredAndSortedStudentsToAssign.length === 0 && (
                                <p className="p-8 text-center text-gray-400 font-bold">
                                    {unassignedStudents.length === 0 
                                        ? 'جميع الطلاب مدرجون بالفعل في حلقات السرد' 
                                        : 'لا يوجد طلاب غير مدرجين مطابقين للبحث أو التصفية'}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3 pt-3 border-t dark:border-gray-700">
                            <button 
                                onClick={handleCloseAssignExistingModal}
                                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={() => handleBatchAssignExistingStudents(assignExistingModalOpen)}
                                disabled={selectedStudentIdsToAssign.length === 0}
                                className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition-all ${
                                    selectedStudentIdsToAssign.length > 0 ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-gray-400 cursor-not-allowed'
                                }`}
                            >
                                إلحاق المحددين ({selectedStudentIdsToAssign.length})
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Editing Halaqa Modal */}
            {editingHalaqaId && (
                <Modal title="تعديل اسم حلقة السرد" onClose={() => setEditingHalaqaId(null)} hideDefaultCloseButton>
                    <div className="space-y-4">
                        <p className="block font-black text-gray-700 dark:text-white">الاسم الجديد لحلقة السرد:</p>
                        <input 
                            type="text" 
                            value={editingHalaqaName} 
                            onChange={(e) => setEditingHalaqaName(e.target.value)} 
                            className={`input-style text-lg font-bold ${editHalaqaConflict ? 'border-red-500 focus:ring-red-500 bg-red-50/20' : ''}`}
                            placeholder="اكتب اسم حلقة السرد الجديد..."
                        />
                        {editHalaqaConflict && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded-xl flex items-center gap-2 text-red-800 dark:text-red-200 text-sm font-bold">
                                <span className="text-lg">⚠️</span>
                                <span>هذا الاسم مطابق أو مشابه لحلقة سرد موجودة مسبقاً ("{editHalaqaConflict.name}"). يجب أن يكون اسم حلقة السرد وحيداً!</span>
                            </div>
                        )}
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setEditingHalaqaId(null)} className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-all">إلغاء</button>
                            <button 
                                onClick={handleSaveEditHalaqa} 
                                disabled={!editingHalaqaName.trim() || !!editHalaqaConflict}
                                className={`flex-1 py-3 rounded-xl font-bold shadow-lg transition-all ${
                                    !editingHalaqaName.trim() || !!editHalaqaConflict
                                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                        : 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-95'
                                }`}
                            >
                                حفظ التغييرات
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Excel Import Modal for Sard Halaqas */}
            <HalaqaExcelImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                type="sard"
                users={users}
                halaqas={halaqas}
                sardHalaqas={sardHalaqas}
                students={students}
                onConfirmImport={handleConfirmImportSardHalaqas}
            />

            <div className="space-y-8 animate-fade-in pb-20">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print border-b pb-4 dark:border-gray-700">
                    <div>
                        <h3 className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-300">إدارة حلقات السرد</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">توزيع مستقل لطلاب ومعلمي السرد القرآني مع تصدير واستيراد ملفات Excel و Word و PDF</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <button 
                            type="button"
                            onClick={() => setIsExcelModalOpen(true)}
                            className="px-3 sm:px-3.5 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                            title="تصدير أكسل مع خيارات الاتجاه والمشاركة"
                        >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            <span>Excel</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => setIsWordModalOpen(true)}
                            className="px-3 sm:px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                            title="تصدير وورد مع خيارات الاتجاه والتنسيق"
                        >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            <span>Word</span>
                        </button>
                        <button 
                            type="button"
                            onClick={handlePdfPrint}
                            className="px-3 sm:px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                            title="طباعة وتصدير ملف PDF"
                        >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                            <span>طباعة</span>
                        </button>
                        <button 
                            type="button"
                            onClick={handlePdfShare}
                            className="px-3 sm:px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                            title="مشاركة الملف كـ PDF عبر الواتساب والتطبيقات"
                        >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                            <span>مشاركة PDF</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => exportSardHalaqasTemplate('قالب_استيراد_حلقات_السرد', users, students)}
                            className="px-3 sm:px-3.5 py-2 text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                            title="تنزيل قالب أكسل فارغ مع أمثلة لحلقات السرد"
                        >
                            <span>📄</span>
                            <span>تصدير قالب أكسل</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => setShowImportModal(true)}
                            className="px-3 sm:px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                            title="استيراد حلقات السرد والمعلمين والطلاب من ملف Excel مع كشف التعارضات"
                        >
                            <span>📥</span>
                            <span>استيراد ملف أكسل</span>
                        </button>
                    </div>
                </div>

                {/* إضافة حلقات سرد جديدة */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b dark:border-gray-700 bg-emerald-50/30 dark:bg-slate-800/50">
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                            إضافة حلقات سرد جديدة
                        </h4>
                        <form onSubmit={handleAddHalaqa} className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <textarea 
                                    value={newHalaqaName} 
                                    onChange={(e) => setNewHalaqaName(e.target.value)} 
                                    placeholder="اكتب أسماء حلقات السرد (اسم في كل سطر)... مثال: حلقة سرد 1" 
                                    className={`input-style flex-grow py-3 ${newHalaqaConflicts.length > 0 ? 'border-amber-400 focus:ring-amber-400 bg-amber-50/20' : ''}`} 
                                    rows={1}
                                />
                                <button 
                                    type="submit" 
                                    disabled={!newHalaqaName.trim()}
                                    className="px-6 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md active:scale-95 whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    إضافة حلقة سرد
                                </button>
                            </div>
                            {newHalaqaConflicts.length > 0 && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-1 font-bold">
                                    <div className="flex items-center gap-1.5 text-sm">
                                        <span className="text-base">⚠️</span>
                                        <span>تنبيه: تم اكتشاف أسماء مكررة أو مشابهة لحلقات سرد سابقة (يجب أن يكون اسم كل حلقة وحيداً):</span>
                                    </div>
                                    <ul className="list-disc list-inside pr-4 space-y-0.5">
                                        {newHalaqaConflicts.map((c, idx) => (
                                            <li key={idx}>الاسم "{c.line}" مطابق أو مشابه لحلقة السرد الحالية ("{c.existingName}")</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                {/* قائمة حلقات السرد وتوزيع الطلاب */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700 dark:text-gray-200">حلقات السرد المتاحة:</span>
                            <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-3 py-1 rounded-full text-xs font-black">{sortedSardHalaqas.length}</span>
                        </div>
                        <div className="relative w-full sm:w-72 flex items-center">
                            <input 
                                type="text" 
                                placeholder="بحث في حلقات السرد..." 
                                value={halaqaSearchTerm} 
                                onChange={(e) => setHalaqaSearchTerm(e.target.value)} 
                                className="input-style w-full pl-10 pr-4 py-2 text-sm"
                            />
                            <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {halaqaSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setHalaqaSearchTerm('')}
                                    className="absolute left-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                                    title="مسح البحث"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {filteredHalaqasForList.length === 0 ? (
                        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 font-bold">لا توجد حلقات سرد مضافة حتى الآن. قم بإضافة حلقة للبدء في توزيع الطلاب.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredHalaqasForList.map(halaqa => {
                                const isOpen = openHalaqaId === halaqa.id;
                                const halaqaStudents = students.filter(s => s.sardHalaqaId === halaqa.id);
                                const teacher = users.find(u => u.id === halaqa.teacherId);
                                const filteredStudentsInHalaqa = halaqaStudents.filter(s => isSmartMatch(s.name, studentSearchTerm));

                                return (
                                    <div key={halaqa.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 overflow-hidden transition-all">
                                        <div className="p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50 dark:bg-slate-800/50">
                                            <div className="flex items-center gap-4 flex-grow w-full md:w-auto">
                                                <button 
                                                    onClick={() => setOpenHalaqaId(isOpen ? null : halaqa.id)}
                                                    className="flex items-center gap-3 text-right flex-grow font-black text-lg text-gray-800 dark:text-gray-100 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                                                >
                                                    <svg className={`w-5 h-5 text-emerald-600 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                    <span>{halaqa.name}</span>
                                                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                                                        {halaqaStudents.length} طالب
                                                    </span>
                                                </button>
                                            </div>

                                            {/* تعيين معلم السرد وأزرار التحكم */}
                                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                                                <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600">
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-300 whitespace-nowrap">المعلم:</span>
                                                    <select 
                                                        value={halaqa.teacherId || 0} 
                                                        onChange={(e) => assignTeacherToSardHalaqa(halaqa.id, Number(e.target.value))}
                                                        className="bg-transparent font-bold text-sm text-emerald-800 dark:text-emerald-300 focus:outline-none cursor-pointer"
                                                    >
                                                        <option value={0}>-- غير محدد --</option>
                                                        {getAvailableTeachersForSardHalaqa(halaqa.id).map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <button 
                                                    onClick={() => { setEditingHalaqaId(halaqa.id); setEditingHalaqaName(halaqa.name); }}
                                                    className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 dark:text-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="تعديل الاسم"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                                </button>

                                                <button 
                                                    onClick={() => handleHalaqaDelete(halaqa)}
                                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 dark:text-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="حذف الحلقة"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* تفاصيل الطلاب في حلقة السرد المفتوحة */}
                                        {isOpen && (
                                            <div className="p-6 border-t dark:border-gray-700 bg-white dark:bg-gray-800 space-y-6">
                                                {/* أزرار إضافة طلاب */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                    {/* خيار 1: إلحاق طلاب من قائمة المدرسة */}
                                                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex flex-col justify-between">
                                                        <div>
                                                            <h5 className="font-bold text-emerald-900 dark:text-emerald-200 mb-1">إلحاق طلاب من القائمة العامة</h5>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">اختر طلاباً مسجلين بالفعل في حلقات المدرسة لإضافتهم لهذه الحلقة في السرد.</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleOpenAssignExistingModal(halaqa.id)}
                                                            className="w-full py-2.5 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-800 transition-all text-sm flex items-center justify-center gap-2"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                                                            اختيار طلاب من القائمة
                                                        </button>
                                                    </div>

                                                    {/* خيار 2: كتابة أسماء طلاب مباشرة */}
                                                    <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-200 dark:border-gray-600">
                                                        <h5 className="font-bold text-gray-800 dark:text-gray-200 mb-1">إضافة أسماء مباشرة</h5>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">اكتب أسماء الطلاب لإضافتهم مباشرة (اسم في كل سطر).</p>
                                                        <div className="flex gap-2">
                                                            <textarea 
                                                                value={newStudentName}
                                                                onChange={(e) => setNewStudentName(e.target.value)}
                                                                placeholder="اسم الطالب..."
                                                                className="input-style flex-grow py-2 text-sm"
                                                                rows={1}
                                                            />
                                                            <button 
                                                                onClick={() => handleAddNewStudentToSard(halaqa.id)}
                                                                className="px-4 py-2 bg-gray-800 text-white dark:bg-gray-600 rounded-xl font-bold hover:bg-gray-900 transition-all text-sm whitespace-nowrap"
                                                            >
                                                                إضافة
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* قائمة الطلاب داخل الحلقة */}
                                                <div>
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                                        <h5 className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                                                            طلاب حلقة السرد ({halaqaStudents.length})
                                                        </h5>
                                                        {halaqaStudents.length > 5 && (
                                                            <div className="relative flex items-center w-full sm:w-48">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="بحث بين طلاب الحلقة..." 
                                                                    value={studentSearchTerm}
                                                                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                                                                    className="input-style py-1 pl-7 pr-3 text-xs w-full"
                                                                />
                                                                {studentSearchTerm && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setStudentSearchTerm('')}
                                                                        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer"
                                                                        title="مسح البحث"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {halaqaStudents.length === 0 ? (
                                                        <p className="text-sm text-gray-400 py-4 text-center">لا يوجد طلاب ملحقين بهذه الحلقة حتى الآن.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {filteredStudentsInHalaqa.map(student => (
                                                                <div key={student.id} className="p-3 bg-gray-50 dark:bg-slate-700/60 rounded-xl border border-gray-200 dark:border-slate-600 flex justify-between items-center group">
                                                                    <div>
                                                                        <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{student.name}</p>
                                                                        <div className="flex items-center gap-1 flex-wrap text-[10px] leading-tight mt-0.5">
                                                                            {student.isAlAmeen && (
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                    (من طلاب الأمين)
                                                                                </span>
                                                                            )}
                                                                            <span className={student.isAlAmeen ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-gray-500 dark:text-gray-400 font-medium"}>
                                                                                {student.isAlAmeen ? ` - (${getStudentLevel(student)})` : `- (${getStudentLevel(student)})`}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <button 
                                                                            onClick={() => setTransferringStudent(student)}
                                                                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                                                            title="نقل لحلقة سرد أخرى"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleRemoveStudentFromSard(student)}
                                                                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                                                            title="إزالة من السرد"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <WordExportModal 
                isOpen={isWordModalOpen} 
                onClose={() => setIsWordModalOpen(false)} 
                onExport={(orientation, action) => {
                    const data = getSardHalaqasExportData();
                    const fileName = 'بيانات_حلقات_السرد';
                    const title = 'قائمة حلقات السرد والمعلمين والطلاب';
                    if (action === 'share-pdf') {
                        sharePdfDirectly(sardHalaqasExportHeaders, data, fileName, title, undefined, {}, {}, undefined, orientation);
                    } else if (action === 'pdf') {
                        exportToPdf(sardHalaqasExportHeaders, data, fileName, title, undefined, {}, {});
                    } else {
                        exportToWord(sardHalaqasExportHeaders, data, fileName, title, {}, {}, undefined, orientation, action);
                    }
                }} 
            />

            <ExcelExportModal 
                isOpen={isExcelModalOpen} 
                onClose={() => setIsExcelModalOpen(false)} 
                onExport={(orientation, action) => {
                    const data = getSardHalaqasExportData();
                    const fileName = 'بيانات_حلقات_السرد';
                    const title = 'قائمة حلقات السرد والمعلمين والطلاب';
                    exportToExcel(sardHalaqasExportHeaders, data, fileName, title, {}, {}, undefined, orientation, action);
                }} 
            />
        </>
    );
};
