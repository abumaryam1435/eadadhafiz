
import React, { useState, useContext, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { AppContext } from '../App';
import { Student, UserRole, Halaqa, User } from '../types';
import Modal from './Modal';
import { isSmartMatch, findSimilarHalaqa, normalizeHalaqaName } from '../utils/searchUtils';
import { SardManagement } from './SardManagement';
import { exportMainHalaqasTemplate } from '../utils/halaqaExcelUtils';
import { HalaqaExcelImportModal } from './HalaqaExcelImportModal';

const StudentManagement: React.FC = () => {
    const context = useContext(AppContext);

    const students = context?.students || [];
    const halaqas = context?.halaqas || [];
    const sardHalaqas = context?.sardHalaqas || [];
    const users = context?.users || [];
    const addStudent = context?.addStudent || (async () => {});
    const updateStudent = context?.updateStudent || (async () => {});
    const deleteStudent = context?.deleteStudent || (async () => {});
    const addHalaqa = context?.addHalaqa || ((h: any) => 0);
    const updateHalaqa = context?.updateHalaqa || (async () => {});
    const deleteHalaqa = context?.deleteHalaqa || (async () => {});
    const addTeacher = context?.addTeacher || ((n: string) => 0);
    const updateTeacher = context?.updateTeacher || (async () => {});
    const deleteTeacher = context?.deleteTeacher || (async () => {});
    const assignTeacherToHalaqa = context?.assignTeacherToHalaqa || (async () => {});
    const showToast = context?.showToast || (() => {});
    const isTestActive = context?.isTestActive || false;

    const [managementTab, setManagementTab] = useState<'main' | 'sard'>('main');
    const [openHalaqaId, setOpenHalaqaId] = useState<number | null>(null);
    const [newStudentName, setNewStudentName] = useState('');
    const [newHalaqaName, setNewHalaqaName] = useState('');
    const [newTeacherName, setNewTeacherName] = useState('');
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
    const [editingHalaqaId, setEditingHalaqaId] = useState<number | null>(null);
    const [editingHalaqaName, setEditingHalaqaName] = useState<string>('');
    const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
    const [halaqaSearchTerm, setHalaqaSearchTerm] = useState('');
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [showTeachers, setShowTeachers] = useState(false);
    const [showHalaqas, setShowHalaqas] = useState(false);
    const [showTestTeachers, setShowTestTeachers] = useState(false);

    // Modal for Excel Import
    const [showImportModal, setShowImportModal] = useState(false);

    // New states for transferring students
    const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
    const [transferSearchQuery, setTransferSearchQuery] = useState('');

    // States for unassigned students dropdown
    const [openUnassignedDropdownHalaqaId, setOpenUnassignedDropdownHalaqaId] = useState<number | null>(null);
    const [unassignedSearchTerm, setUnassignedSearchTerm] = useState('');

    const [confirmationModal, setConfirmationModal] = useState<{ 
        isOpen: boolean; 
        title: string; 
        message: string; 
        onConfirm: () => void; 
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const teachers = useMemo(() => users.filter(u => u.role === UserRole.TEACHER).sort((a,b) => a.name.localeCompare(b.name, 'ar', { numeric: true })), [users]);
    const sortedHalaqas = useMemo(() => [...halaqas].sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true })), [halaqas]);

    // Unassigned students who have no halaqa assigned
    const unassignedStudents = useMemo(() => {
        return students.filter(s => !s.halaqaId || s.halaqaId === 0 || !halaqas.some(h => h.id === s.halaqaId))
                       .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
    }, [students, halaqas]);

    const filteredTeachers = useMemo(() => {
        if (!teacherSearchTerm.trim()) return teachers;
        return teachers.filter(t => isSmartMatch(t.name, teacherSearchTerm));
    }, [teachers, teacherSearchTerm]);

    const filteredHalaqasForList = useMemo(() => {
        if (!halaqaSearchTerm.trim()) return sortedHalaqas;
        return sortedHalaqas.filter(h => isSmartMatch(h.name, halaqaSearchTerm));
    }, [sortedHalaqas, halaqaSearchTerm]);

    const handleTeacherDelete = (teacher: User) => {
        setConfirmationModal({
            isOpen: true,
            title: 'تأكيد حذف المعلم',
            message: `هل أنت متأكد من حذف المعلم "${teacher.name}"؟ سيتم إلغاء تعيينه من كافة الحلقات.`,
            onConfirm: () => {
                deleteTeacher(teacher.id);
                setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                showToast('✅ تم حذف المعلم بنجاح');
            }
        });
    };

    const handleStudentDelete = (student: Student) => {
        setConfirmationModal({
            isOpen: true,
            title: 'تأكيد حذف الطالب',
            message: `هل أنت متأكد من حذف الطالب "${student.name}"؟ سيتم حذف جميع سجلات تقييمه نهائياً.`,
            onConfirm: () => {
                deleteStudent(student.id);
                setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                showToast('✅ تم حذف الطالب بنجاح');
            }
        });
    };

    const handleHalaqaDelete = (halaqa: Halaqa) => {
        setConfirmationModal({
            isOpen: true,
            title: 'تأكيد حذف الحلقة',
            message: `هل أنت متأكد من حذف حلقة "${halaqa.name}"؟ سيتم حذف جميع الطلاب المنتمين لهذه الحلقة تلقائياً. لا يمكن التراجع عن هذا الإجراء.`,
            onConfirm: () => {
                deleteHalaqa(halaqa.id);
                setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                showToast('✅ تم حذف الحلقة وطلابها بنجاح');
            }
        });
    };

    const handleAddTeacher = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTeacherName.trim()) {
            const names = newTeacherName.split('\n').filter(name => name.trim() !== '');
            names.forEach(name => addTeacher(name.trim()));
            setNewTeacherName('');
            showToast(`✅ تم إضافة ${names.length} معلم بنجاح.`);
            setShowTeachers(true);
        }
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
            const conflict = findSimilarHalaqa(name, halaqas);
            if (conflict) {
                rejectedDuplicates.push({ name, conflictWith: conflict.name });
                continue;
            }
            seenInBatch.add(norm);
            validToAdd.push(name);
        }

        if (validToAdd.length === 0) {
            // جميع الأسماء المدخلة مكررة أو مشابهة لحلقات سابقة
            if (rejectedDuplicates.length === 1) {
                showToast(`⚠️ لا يمكن قبول اسم الحلقة "${rejectedDuplicates[0].name}": مشابه أو مطابق لحلقة سابقة ("${rejectedDuplicates[0].conflictWith}"). يجب أن يكون اسم الحلقة وحيداً!`);
            } else {
                const listStr = rejectedDuplicates.map(r => `"${r.name}"`).join('، ');
                showToast(`⚠️ تعذر الإضافة: الحلقات التالية مكررة أو مشابهة لحلقات سابقة: (${listStr}). يجب أن يكون اسم كل حلقة وحيداً!`);
            }
            return;
        }

        // إضافة الحلقات الفريدة فقط
        validToAdd.forEach(name => addHalaqa({ name, teacherId: 0 }));
        setShowHalaqas(true);

        if (rejectedDuplicates.length > 0) {
            // إبقاء الأسماء المرفوضة في المربع ليتمكن المستخدم من تعديلها
            setNewHalaqaName(rejectedDuplicates.map(r => r.name).join('\n'));
            const rejectedList = rejectedDuplicates.map(r => `"${r.name}"`).join('، ');
            showToast(`✅ تم إضافة ${validToAdd.length} حلقة بنجاح. ⚠️ تم استبعاد المكرر: (${rejectedList}) لأن الاسم مسجل مسبقاً.`);
        } else {
            setNewHalaqaName('');
            showToast(`✅ تم إضافة ${validToAdd.length} حلقة بنجاح.`);
        }
    };

    const handleSaveEditHalaqa = () => {
        const trimmed = editingHalaqaName.trim();
        if (!trimmed) {
            showToast('⚠️ يرجى إدخال اسم الحلقة');
            return;
        }
        if (editingHalaqaId === null) return;

        const conflict = findSimilarHalaqa(trimmed, halaqas, editingHalaqaId);
        if (conflict) {
            showToast(`⚠️ لا يمكن حفظ التعديل: اسم الحلقة "${trimmed}" مطابق أو مشابه لحلقة موجودة مسبقاً ("${conflict.name}"). يجب أن يكون اسم الحلقة وحيداً!`);
            return;
        }

        const currentHalaqa = halaqas.find(h => h.id === editingHalaqaId);
        if (currentHalaqa) {
            updateHalaqa({ ...currentHalaqa, name: trimmed });
            setEditingHalaqaId(null);
            showToast('✅ تم تحديث اسم الحلقة بنجاح');
        }
    };

    const handleAddStudent = (halaqaId: number) => {
        if (newStudentName.trim()) {
            const names = newStudentName.split('\n').filter(n => n.trim() !== '');
            names.forEach(name => addStudent({ name: name.trim(), halaqaId }));
            setNewStudentName('');
            showToast(`✅ تم إضافة ${names.length} طالب بنجاح.`);
        }
    };

    const handleMoveStudent = (student: Student, targetHalaqaId: number) => {
        const targetHalaqa = halaqas.find(h => h.id === targetHalaqaId);
        if (!targetHalaqa) return;

        updateStudent({ ...student, halaqaId: targetHalaqaId });
        setTransferringStudent(null);
        setTransferSearchQuery('');
        showToast(`✅ تم نقل الطالب "${student.name}" إلى "${targetHalaqa.name}"`);
    };

    const exportHalaqasToExcel = () => {
        const exportData: any[] = [];
        sortedHalaqas.forEach(h => {
            const teacher = users.find(u => u.id === h.teacherId);
            const hStudents = students.filter(s => s.halaqaId === h.id);
            if (hStudents.length === 0) {
                exportData.push({
                    'اسم الحلقة': h.name,
                    'اسم المعلم': teacher?.name || 'غير معين',
                    'اسم الطالب': 'لا يوجد طلاب'
                });
            } else {
                hStudents.forEach(s => {
                    exportData.push({
                        'اسم الحلقة': h.name,
                        'اسم المعلم': teacher?.name || 'غير معين',
                        'اسم الطالب': s.name
                    });
                });
            }
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        worksheet['!rightToLeft'] = true;
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'الحلقات الرئيسة');
        XLSX.writeFile(workbook, 'بيانات_الحلقات_الرئيسة_والطلاب.xlsx');
        showToast('✅ تم تصدير بيانات الحلقات الرئيسة إلى Excel بنجاح');
    };

    const handleConfirmImportHalaqas = ({
        items,
        resolveConflictMode,
    }: {
        items: { halaqaName: string; teacherName: string; teacherIdStr?: string; studentName: string; studentIdStr?: string; }[];
        resolveConflictMode: 'overwrite' | 'preserve';
    }) => {
        let importedHalaqasCount = 0;
        let importedTeachersCount = 0;
        let importedStudentsCount = 0;

        // تجميع المعلمين المنشئين
        const teacherNameToId = new Map<string, number>();
        users.filter(u => u.role === UserRole.TEACHER).forEach(u => {
            teacherNameToId.set(u.name.trim().toLowerCase(), u.id);
        });

        // تجميع الحلقات المنشأة
        const halaqaNameToId = new Map<string, number>();
        halaqas.forEach(h => {
            halaqaNameToId.set(h.name.trim().toLowerCase(), h.id);
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

            // 2. معالجة الحلقة
            let targetHalaqaId = 0;
            if (hName) {
                const hKey = hName.toLowerCase();
                if (halaqaNameToId.has(hKey)) {
                    targetHalaqaId = halaqaNameToId.get(hKey)!;
                    const existingHalaqa = halaqas.find(h => h.id === targetHalaqaId);
                    if (existingHalaqa && teacherId && resolveConflictMode === 'overwrite') {
                        if (existingHalaqa.teacherId !== teacherId) {
                            assignTeacherToHalaqa(targetHalaqaId, teacherId);
                        }
                    }
                } else {
                    const newHalaqaId = addHalaqa({ name: hName, teacherId: teacherId || 0 }) as number;
                    halaqaNameToId.set(hKey, newHalaqaId);
                    targetHalaqaId = newHalaqaId;
                    importedHalaqasCount++;
                }
            }

            // 3. معالجة الطالب
            if (sName && sName !== 'لا يوجد طلاب') {
                const studentIdFromRow = row.studentIdStr && !isNaN(parseInt(row.studentIdStr)) ? parseInt(row.studentIdStr) : null;
                const existingStudent = students.find(s => studentIdFromRow ? s.id === studentIdFromRow : s.name.trim().toLowerCase() === sName.toLowerCase());
                if (existingStudent) {
                    if (targetHalaqaId && existingStudent.halaqaId !== targetHalaqaId) {
                        updateStudent({ ...existingStudent, halaqaId: targetHalaqaId });
                    }
                } else {
                    addStudent({
                        name: sName,
                        halaqaId: targetHalaqaId || 0,
                    });
                    importedStudentsCount++;
                }
            }
        });

        showToast(`✅ تم الاستيراد بنجاح: ${importedStudentsCount} طالب، ${importedHalaqasCount} حلقة جديدة.`);
    };

    const newHalaqaConflicts = useMemo(() => {
        if (!newHalaqaName.trim()) return [];
        const lines = newHalaqaName.split('\n').map(l => l.trim()).filter(Boolean);
        const conflicts: { line: string; existingName: string }[] = [];
        for (const l of lines) {
            const c = findSimilarHalaqa(l, halaqas);
            if (c) conflicts.push({ line: l, existingName: c.name });
        }
        return conflicts;
    }, [newHalaqaName, halaqas]);

    const editHalaqaConflict = useMemo(() => {
        if (!editingHalaqaId || !editingHalaqaName.trim()) return undefined;
        return findSimilarHalaqa(editingHalaqaName.trim(), halaqas, editingHalaqaId);
    }, [editingHalaqaId, editingHalaqaName, halaqas]);

    return (
        <>
            {/* Confirmation Modal */}
            {confirmationModal.isOpen && (
                <Modal title={confirmationModal.title} onClose={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))} hideDefaultCloseButton={true}>
                    <p className="py-4 text-lg dark:text-gray-200 text-center font-bold">{confirmationModal.message}</p>
                    <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-4 border-t dark:border-gray-700">
                        <button onClick={confirmationModal.onConfirm} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all text-xl">نعم، حذف</button>
                        <button onClick={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 bg-gray-200 rounded-2xl font-black dark:bg-gray-700 dark:text-white text-xl">إلغاء</button>
                    </div>
                </Modal>
            )}

            {/* Transfer Student Modal */}
            {transferringStudent && (
                <Modal title={`نقل الطالب: ${transferringStudent.name}`} onClose={() => setTransferringStudent(null)} hideDefaultCloseButton>
                    <div className="space-y-4">
                        <p className="text-sm font-bold text-gray-500">اختر الحلقة الجديدة التي ترغب في نقل الطالب إليها:</p>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="ابحث عن حلقة..." 
                                value={transferSearchQuery}
                                onChange={(e) => setTransferSearchQuery(e.target.value)}
                                className="input-style w-full pl-10"
                                autoFocus
                            />
                            <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <div className="max-h-60 overflow-y-auto border-2 rounded-2xl p-2 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                            {sortedHalaqas
                                .filter(h => h.id !== transferringStudent.halaqaId && isSmartMatch(h.name, transferSearchQuery))
                                .map(halaqa => (
                                    <button 
                                        key={halaqa.id}
                                        onClick={() => handleMoveStudent(transferringStudent, halaqa.id)}
                                        className="w-full text-right p-4 hover:bg-green-600 hover:text-white dark:hover:bg-green-700 rounded-xl border-b dark:border-slate-700 last:border-0 font-bold transition-colors flex justify-between items-center group"
                                    >
                                        <span>{halaqa.name}</span>
                                        <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                                    </button>
                                ))
                            }
                            {sortedHalaqas.filter(h => h.id !== transferringStudent.halaqaId && isSmartMatch(h.name, transferSearchQuery)).length === 0 && (
                                <p className="p-8 text-center text-gray-400">لا توجد حلقات أخرى بهذا الاسم</p>
                            )}
                        </div>
                        <button onClick={() => setTransferringStudent(null)} className="w-full py-3 bg-gray-200 text-gray-800 rounded-xl font-bold mt-2">إلغاء</button>
                    </div>
                </Modal>
            )}

            {/* Editing Halaqa Modal */}
            {editingHalaqaId && (
                <Modal title="تعديل اسم الحلقة" onClose={() => setEditingHalaqaId(null)} hideDefaultCloseButton>
                    <div className="space-y-4">
                        <p className="block font-black text-gray-700 dark:text-white">الاسم الجديد للحلقة:</p>
                        <input 
                            type="text" 
                            value={editingHalaqaName} 
                            onChange={(e) => setEditingHalaqaName(e.target.value)} 
                            className={`input-style text-lg font-bold ${editHalaqaConflict ? 'border-red-500 focus:ring-red-500 bg-red-50/20' : ''}`}
                            placeholder="اكتب اسم الحلقة الجديد..."
                        />
                        {editHalaqaConflict && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded-xl flex items-center gap-2 text-red-800 dark:text-red-200 text-sm font-bold">
                                <span className="text-lg">⚠️</span>
                                <span>هذا الاسم مطابق أو مشابه لحلقة موجودة مسبقاً ("{editHalaqaConflict.name}"). يجب أن يكون اسم الحلقة وحيداً!</span>
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
                                        : 'bg-green-700 hover:bg-green-800 text-white active:scale-95'
                                }`}
                            >
                                حفظ التغييرات
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Excel Import Modal for Main Halaqas */}
            <HalaqaExcelImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                type="main"
                users={users}
                halaqas={halaqas}
                sardHalaqas={sardHalaqas}
                students={students}
                onConfirmImport={handleConfirmImportHalaqas}
            />

            <div className="space-y-8 animate-fade-in pb-20">
                {/* تبويبات إدارة الحلقات الرئيسية وحلقات السرد */}
                <div className="flex justify-center no-print my-2">
                    <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setManagementTab('main')}
                            className={`px-8 py-3 rounded-xl font-black text-base transition-all flex items-center gap-2 ${
                                managementTab === 'main'
                                    ? 'bg-green-700 text-white shadow-md'
                                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                            }`}
                        >
                            <span>🕌</span>
                            <span>الحلقات الرئيسة</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setManagementTab('sard')}
                            className={`px-8 py-3 rounded-xl font-black text-base transition-all flex items-center gap-2 ${
                                managementTab === 'sard'
                                    ? 'bg-emerald-700 text-white shadow-md'
                                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                            }`}
                        >
                            <span>📖</span>
                            <span>حلقات السرد</span>
                        </button>
                    </div>
                </div>

                {managementTab === 'sard' ? (
                    <SardManagement />
                ) : (
                    <>
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print border-b pb-4 dark:border-gray-700">
                            <div>
                                <h3 className="text-2xl font-extrabold text-green-900 dark:text-green-300">إدارة الحلقات الرئيسة</h3>
                                <p className="text-xs text-gray-500 font-bold mt-1">إدارة المعلمين، الحلقات، والطلاب مع تصدير واستيراد ملفات Excel</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <button 
                                    onClick={exportHalaqasToExcel}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white font-black rounded-xl shadow-md active:scale-95 transition-all text-xs"
                                    title="تصدير جميع الحلقات والمعلمين والطلاب إلى ملف Excel"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                    تصدير الحلقات
                                </button>
                                <button 
                                    onClick={() => exportMainHalaqasTemplate('قالب_استيراد_الحلقات_الرئيسة', users, students)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 font-black rounded-xl shadow-sm active:scale-95 transition-all text-xs"
                                    title="تنزيل قالب أكسل فارغ مع أمثلة يحتوي على (اسم الحلقة، اسم المعلم، الطالب)"
                                >
                                    <span>📄</span>
                                    <span>تصدير قالب أكسل</span>
                                </button>
                                <button 
                                    onClick={() => setShowImportModal(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md active:scale-95 transition-all text-xs"
                                    title="استيراد الحلقات والمعلمين والطلاب من ملف Excel مع كشف التعارضات"
                                >
                                    <span>📥</span>
                                    <span>استيراد ملف أكسل</span>
                                </button>
                            </div>
                        </div>

                {/* أولاً: إدارة المعلمين */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b dark:border-gray-700 bg-blue-50/30 dark:bg-slate-800/50">
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                            إضافة معلمين
                        </h4>
                        <form onSubmit={handleAddTeacher} className="flex gap-3">
                            <textarea 
                                value={newTeacherName} 
                                onChange={(e) => setNewTeacherName(e.target.value)} 
                                placeholder="اكتب أسماء المعلمين (اسم في كل سطر)..." 
                                className="input-style flex-grow py-3" 
                                rows={1}
                            />
                            <button type="submit" className="px-6 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md active:scale-95 whitespace-nowrap">إضافة</button>
                        </form>
                    </div>

                    <button 
                        onClick={() => setShowTeachers(!showTeachers)}
                        className={`w-full p-5 flex justify-between items-center transition-all ${showTeachers ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${showTeachers ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            </div>
                            <span className="text-xl font-bold text-gray-800 dark:text-gray-200">قائمة المعلمين ({teachers.length})</span>
                        </div>
                        <svg className={`h-6 w-6 transform transition-transform ${showTeachers ? 'rotate-180 text-blue-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {showTeachers && (
                        <div className="p-6 bg-white dark:bg-gray-800 border-t dark:border-gray-700 animate-fade-in">
                            <div className="relative mb-6">
                                <input type="text" placeholder="بحث عن معلم..." value={teacherSearchTerm} onChange={(e) => setTeacherSearchTerm(e.target.value)} className="input-style w-full pl-10" />
                                <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredTeachers.map(teacher => {
                                    const isEditing = editingTeacher?.id === teacher.id;
                                    const assignedHalaqas = halaqas.filter(h => h.teacherId === teacher.id);
                                    return (
                                        <div key={teacher.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 dark:bg-gray-700 dark:border-gray-600 hover:shadow-sm transition-all">
                                            {isEditing ? (
                                                <input 
                                                type="text" autoFocus defaultValue={teacher.name} 
                                                onBlur={(e) => { updateTeacher({ ...teacher, name: e.target.value.trim() }); setEditingTeacher(null); }} 
                                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} 
                                                className="input-style mb-2 py-2" 
                                                />
                                            ) : (
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="font-bold text-gray-800 dark:text-gray-100">{teacher.name}</p>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingTeacher(teacher)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded-lg transition-colors" title="تعديل"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                                                        <button onClick={() => handleTeacherDelete(teacher)} className="text-red-600 hover:bg-red-100 p-1.5 rounded-lg transition-colors" title="حذف"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 space-y-1">
                                                <p className="flex items-center gap-1 font-bold">
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10V4a1 1 0 011-1h2a1 1 0 011 1v3M12 4v16"/></svg>
                                                    {assignedHalaqas.length > 0 ? `مسؤول عن ${assignedHalaqas.length} حلقة` : 'غير معين لحلقة'}
                                                </p>
                                                {assignedHalaqas.map(h => <span key={h.id} className="inline-block bg-white dark:bg-slate-600 px-2 py-0.5 rounded mr-1 mb-1 shadow-sm border dark:border-slate-500">{h.name}</span>)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ثانياً: إدارة الحلقات والطلاب (نسق منسدل) */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b dark:border-gray-700 bg-green-50/30 dark:bg-slate-800/50">
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                            إضافة حلقات جديدة
                        </h4>
                        <form onSubmit={handleAddHalaqa} className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <textarea 
                                    value={newHalaqaName} 
                                    onChange={(e) => setNewHalaqaName(e.target.value)} 
                                    placeholder="اكتب أسماء الحلقات (اسم في كل سطر)..." 
                                    className={`input-style flex-grow py-3 ${newHalaqaConflicts.length > 0 ? 'border-amber-400 focus:ring-amber-400 bg-amber-50/20' : ''}`} 
                                    rows={1}
                                />
                                <button 
                                    type="submit" 
                                    disabled={!newHalaqaName.trim()}
                                    className="px-6 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md active:scale-95 whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    إضافة
                                </button>
                            </div>
                            {newHalaqaConflicts.length > 0 && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-1 font-bold">
                                    <div className="flex items-center gap-1.5 text-sm">
                                        <span className="text-base">⚠️</span>
                                        <span>تنبيه: تم اكتشاف أسماء مكررة أو مشابهة لحلقات سابقة (يجب أن يكون اسم كل حلقة وحيداً):</span>
                                    </div>
                                    <ul className="list-disc list-inside pr-4 space-y-0.5">
                                        {newHalaqaConflicts.map((c, idx) => (
                                            <li key={idx}>الاسم "{c.line}" مطابق أو مشابه للحلقة الحالية ("{c.existingName}")</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </form>
                    </div>

                    <button 
                        onClick={() => setShowHalaqas(!showHalaqas)}
                        className={`w-full p-5 flex justify-between items-center transition-all ${showHalaqas ? 'bg-green-50/50 dark:bg-green-900/20' : 'hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${showHalaqas ? 'bg-green-600 text-white' : 'bg-green-100 text-green-600'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            </div>
                            <span className="text-xl font-bold text-gray-800 dark:text-gray-200">قائمة الحلقات ({halaqas.length})</span>
                        </div>
                        <svg className={`h-6 w-6 transform transition-transform ${showHalaqas ? 'rotate-180 text-green-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {showHalaqas && (
                        <div className="p-6 bg-white dark:bg-gray-800 border-t dark:border-gray-700 animate-fade-in">
                            <div className="relative mb-6">
                                <input type="text" placeholder="بحث عن حلقة..." value={halaqaSearchTerm} onChange={(e) => setHalaqaSearchTerm(e.target.value)} className="input-style w-full pl-10" />
                                <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>

                            <div className="space-y-4">
                                {filteredHalaqasForList.map(halaqa => {
                                    const isOpen = openHalaqaId === halaqa.id;
                                    const halaqaStudents = students.filter(s => s.halaqaId === halaqa.id);
                                    const currentTeacher = teachers.find(t => t.id === halaqa.teacherId);

                                    return (
                                        <div key={halaqa.id} className="border-2 rounded-2xl overflow-hidden transition-all dark:border-gray-700 shadow-sm">
                                            <div className={`p-4 flex flex-wrap items-center justify-between gap-4 ${isOpen ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-gray-800'}`}>
                                                <div className="flex items-center gap-4 flex-grow cursor-pointer" onClick={() => setOpenHalaqaId(isOpen ? null : halaqa.id)}>
                                                    <div className={`p-2 rounded-full ${isOpen ? 'bg-green-600 text-white' : 'bg-green-100 text-green-600'}`}>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xl font-black text-gray-800 dark:text-gray-100">{halaqa.name}</h5>
                                                        <p className="text-xs text-gray-500 font-bold dark:text-gray-400">عدد الطلاب: {halaqaStudents.length} | المعلم: {currentTeacher?.name || 'غير معين'}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <select 
                                                        className="text-xs p-2 rounded-lg bg-white border-gray-200 focus:ring-green-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white border-2"
                                                        value={halaqa.teacherId}
                                                        onChange={(e) => assignTeacherToHalaqa(halaqa.id, Number(e.target.value))}
                                                    >
                                                        <option value="0">--- تعيين معلم ---</option>
                                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                    </select>
                                                    <button onClick={() => { setEditingHalaqaId(halaqa.id); setEditingHalaqaName(halaqa.name); }} className="text-blue-600 hover:bg-blue-100 p-2 rounded-xl transition-colors border-2 border-blue-100 dark:border-blue-900" title="تعديل"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                                                    <button onClick={() => handleHalaqaDelete(halaqa)} className="text-red-600 hover:bg-red-100 p-2 rounded-xl transition-colors border-2 border-red-100 dark:border-red-900" title="حذف"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                                                    <button onClick={() => setOpenHalaqaId(isOpen ? null : halaqa.id)} className={`p-2 rounded-xl transition-all ${isOpen ? 'bg-green-600 text-white rotate-180 shadow-md' : 'text-gray-400 bg-gray-50'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg></button>
                                                </div>
                                            </div>

                                            {isOpen && (
                                                <div className="p-5 bg-gray-50 dark:bg-slate-900/50 border-t dark:border-gray-700 animate-fade-in">
                                                    <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-inner border dark:border-slate-700">
                                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                            <h6 className="text-xs font-black text-gray-500 mb-0 uppercase tracking-wider">إضافة طلاب لهذه الحلقة:</h6>
                                                            {unassignedStudents.length > 0 && (
                                                                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                                                                    {unassignedStudents.length} طالب بدون حلقة
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                                            <textarea 
                                                                value={newStudentName} 
                                                                onChange={(e) => setNewStudentName(e.target.value)} 
                                                                placeholder="أدخل أسماء الطلاب (اسم في كل سطر)..." 
                                                                className="input-style flex-grow py-2 text-sm" 
                                                                rows={1}
                                                            />
                                                            
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleAddStudent(halaqa.id)} 
                                                                    className="px-4 py-2.5 bg-green-700 text-white font-bold rounded-xl shadow-md hover:bg-green-800 active:scale-95 transition-all text-xs sm:text-sm whitespace-nowrap cursor-pointer"
                                                                >
                                                                    حفظ الطلاب
                                                                </button>

                                                                {/* زر القائمة المنسدلة للطلاب الذين لم تحدد لهم حلقة */}
                                                                <div className="relative">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (openUnassignedDropdownHalaqaId === halaqa.id) {
                                                                                setOpenUnassignedDropdownHalaqaId(null);
                                                                            } else {
                                                                                setOpenUnassignedDropdownHalaqaId(halaqa.id);
                                                                                setUnassignedSearchTerm('');
                                                                            }
                                                                        }}
                                                                        className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl border transition-all active:scale-95 shadow-sm whitespace-nowrap cursor-pointer ${
                                                                            openUnassignedDropdownHalaqaId === halaqa.id
                                                                                ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400'
                                                                                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                                                                        }`}
                                                                        title="عرض قائمة الطلاب الذين لم تحدد لهم حلقة"
                                                                    >
                                                                        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                                        </svg>
                                                                        <span>طلاب بدون حلقة</span>
                                                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                                                            openUnassignedDropdownHalaqaId === halaqa.id
                                                                                ? 'bg-white text-amber-900'
                                                                                : 'bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100'
                                                                        }`}>
                                                                            {unassignedStudents.length}
                                                                        </span>
                                                                        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${openUnassignedDropdownHalaqaId === halaqa.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                    </button>

                                                                    {/* القائمة المنسدلة */}
                                                                    {openUnassignedDropdownHalaqaId === halaqa.id && (
                                                                        <>
                                                                            {/* غطاء شفاف للنقر خارج القائمة لإغلاقها */}
                                                                            <div 
                                                                                className="fixed inset-0 z-40" 
                                                                                onClick={() => setOpenUnassignedDropdownHalaqaId(null)} 
                                                                            />

                                                                            <div 
                                                                                className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-amber-300 dark:border-amber-700 z-50 p-3.5 animate-fade-in text-right"
                                                                                style={{ maxWidth: 'min(90vw, 380px)' }}
                                                                            >
                                                                                <div className="flex items-center justify-between pb-2 mb-2 border-b dark:border-slate-700">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="text-amber-700 dark:text-amber-400 font-black text-xs sm:text-sm">طلاب لم تحدد لهم حلقة</span>
                                                                                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">({unassignedStudents.length})</span>
                                                                                    </div>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setOpenUnassignedDropdownHalaqaId(null)}
                                                                                        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                                                        title="إغلاق"
                                                                                    >
                                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                                                                                    </button>
                                                                                </div>

                                                                                {/* خانة البحث - بدون تركيز تلقائي (autoFocus) بحيث لا يتم التركيز عليها إلا بعد النقر عليها */}
                                                                                <div className="relative mb-2.5">
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="ابحث في أسماء الطلاب غير المحددين..."
                                                                                        value={unassignedSearchTerm}
                                                                                        onChange={(e) => setUnassignedSearchTerm(e.target.value)}
                                                                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold dark:text-white"
                                                                                    />
                                                                                    <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                                                    </svg>
                                                                                </div>

                                                                                {/* قائمة الطلاب غير المحددين */}
                                                                                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
                                                                                    {unassignedStudents
                                                                                        .filter(s => isSmartMatch(s.name, unassignedSearchTerm))
                                                                                        .map(student => (
                                                                                            <div
                                                                                                key={student.id}
                                                                                                className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-700/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-gray-100 dark:border-slate-600 transition-colors"
                                                                                            >
                                                                                                <div className="flex flex-col min-w-0 pr-1">
                                                                                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{student.name}</span>
                                                                                                    {student.isAlAmeen && (
                                                                                                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                                                                            (من طلاب الأمين)
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        updateStudent({ ...student, halaqaId: halaqa.id });
                                                                                                        showToast(`✅ تم إضافة الطالب "${student.name}" إلى ${halaqa.name}`);
                                                                                                    }}
                                                                                                    className="px-2.5 py-1 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-[11px] font-black rounded-lg shadow-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                                                                                                    title={`إضافة ${student.name} إلى هذه الحلقة`}
                                                                                                >
                                                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                                                                                                    <span>إضافة</span>
                                                                                                </button>
                                                                                            </div>
                                                                                        ))
                                                                                    }

                                                                                    {unassignedStudents.length === 0 && (
                                                                                        <div className="py-6 text-center text-xs text-gray-400 dark:text-gray-500 font-bold">
                                                                                            ✨ جميع الطلاب محددة لهم حلقات، لا يوجد طلاب بدون حلقة حالياً.
                                                                                        </div>
                                                                                    )}

                                                                                    {unassignedStudents.length > 0 && unassignedStudents.filter(s => isSmartMatch(s.name, unassignedSearchTerm)).length === 0 && (
                                                                                        <div className="py-4 text-center text-xs text-gray-400 dark:text-gray-500 font-bold">
                                                                                            لا يوجد طلاب يطابقون البحث
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* إضافة الكل للحلقة عند وجود أكثر من نتيجة مطابقة */}
                                                                                {unassignedStudents.filter(s => isSmartMatch(s.name, unassignedSearchTerm)).length > 1 && (
                                                                                    <div className="pt-2 mt-2 border-t dark:border-slate-700 flex justify-between items-center">
                                                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                                                                                            مطابق: {unassignedStudents.filter(s => isSmartMatch(s.name, unassignedSearchTerm)).length} طالب
                                                                                        </span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                const matching = unassignedStudents.filter(s => isSmartMatch(s.name, unassignedSearchTerm));
                                                                                                matching.forEach(s => updateStudent({ ...s, halaqaId: halaqa.id }));
                                                                                                showToast(`✅ تم إضافة ${matching.length} طالب إلى ${halaqa.name}`);
                                                                                            }}
                                                                                            className="text-[10px] font-black px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
                                                                                        >
                                                                                            إضافة الكل للحلقة ({unassignedStudents.filter(s => isSmartMatch(s.name, unassignedSearchTerm)).length})
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center px-1 mb-2">
                                                            <h6 className="text-sm font-bold text-gray-700 dark:text-gray-300">قائمة طلاب الحلقة ({halaqaStudents.length})</h6>
                                                            <input type="text" placeholder="بحث في طلاب الحلقة..." className="text-[10px] p-1.5 border-2 rounded-lg dark:bg-slate-700 dark:border-slate-600" value={studentSearchTerm} onChange={(e) => setStudentSearchTerm(e.target.value)} />
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {halaqaStudents.filter(s => isSmartMatch(s.name, studentSearchTerm)).map(student => {
                                                                const isStudEditing = editingStudent?.id === student.id;
                                                                const currentHalaqaName = halaqas.find(h => h.id === student.halaqaId)?.name || 'بدون حلقة';
                                                                return (
                                                                    <div key={student.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 group hover:border-green-300 transition-all">
                                                                        {isStudEditing ? (
                                                                            <input 
                                                                                type="text" autoFocus defaultValue={student.name}
                                                                                onBlur={(e) => { updateStudent({ ...student, name: e.target.value.trim() }); setEditingStudent(null); }}
                                                                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                                                                className="input-style flex-grow py-1 text-sm mr-2"
                                                                            />
                                                                        ) : (
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">{student.name}</span>
                                                                                {student.isAlAmeen && (
                                                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight">
                                                                                        (من طلاب الأمين)
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        
                                                                        <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            {/* Clickable Badge to move student */}
                                                                            <button 
                                                                                onClick={() => setTransferringStudent(student)}
                                                                                className="text-[9px] font-black px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-600 hover:text-white transition-all whitespace-nowrap"
                                                                                title="انقر لنقل الطالب لحلقة أخرى"
                                                                            >
                                                                                {currentHalaqaName}
                                                                            </button>
                                                                            
                                                                            <button onClick={() => setEditingStudent(student)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="تعديل"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                                                                            <button onClick={() => handleStudentDelete(student)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="حذف"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {halaqaStudents.length === 0 && <p className="col-span-full text-center py-4 text-xs text-gray-400 font-bold italic">لا يوجد طلاب في هذه الحلقة حالياً</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {filteredHalaqasForList.length === 0 && <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 dark:bg-slate-900/50 dark:border-gray-700"><p className="text-gray-400 font-bold">لم يتم العثور على حلقات تطابق البحث</p></div>}
                            </div>
                        </div>
                    )}
                </div>

                {/* ثالثاً: إدارة المعلمين للاختبار */}
                {isTestActive && (
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
                    <button 
                        onClick={() => setShowTestTeachers(!showTestTeachers)}
                        className={`w-full p-5 flex justify-between items-center transition-all ${showTestTeachers ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${showTestTeachers ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            </div>
                            <span className="text-xl font-bold text-gray-800 dark:text-gray-200">إدارة المعلمين في الاختبار</span>
                        </div>
                        <svg className={`h-6 w-6 transform transition-transform ${showTestTeachers ? 'rotate-180 text-indigo-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {showTestTeachers && (
                        <div className="p-6 bg-white dark:bg-gray-800 border-t dark:border-gray-700 animate-fade-in">
                            <div className="space-y-4">
                                <p className="text-sm font-bold text-gray-500 mb-4">هذه القائمة خاصة باختيار المعلم الذي سيقوم بتقييم طلاب الحلقة أثناء الاختبار.</p>
                                {sortedHalaqas.map(halaqa => {
                                    const assignedTeacherId = halaqa.testTeacherId !== undefined ? halaqa.testTeacherId : halaqa.teacherId;
                                    return (
                                        <div key={`test-${halaqa.id}`} className="border-2 rounded-2xl overflow-hidden shadow-sm dark:border-gray-700">
                                            <div className="p-4 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xl font-black text-gray-800 dark:text-gray-100">{halaqa.name}</h5>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold text-gray-500">معلم الاختبار:</span>
                                                    <select 
                                                        className="text-sm p-2.5 rounded-xl bg-white border-gray-200 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white border-2 font-bold min-w-[200px]"
                                                        value={assignedTeacherId}
                                                        onChange={(e) => {
                                                            const newTestTeacherId = e.target.value === 'none' ? undefined : Number(e.target.value);
                                                            updateHalaqa({ ...halaqa, testTeacherId: newTestTeacherId });
                                                            showToast('✅ تم تحديث معلم الاختبار للحلقة');
                                                        }}
                                                    >
                                                        <option value={halaqa.teacherId}>نفس المعلم الأساسي ({teachers.find(t => t.id === halaqa.teacherId)?.name || 'بدون'})</option>
                                                        {teachers.filter(t => t.id !== halaqa.teacherId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                )}
                </>
                )}
            </div>
        </>
    );
};

export default StudentManagement;
