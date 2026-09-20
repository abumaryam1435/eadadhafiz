import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { Matn } from '../types';
import Modal from './Modal';
import { MatnVersesModal } from './MatnVersesModal';
import { PoeticVerseRow } from './PoeticVerseRow';
import { formatPoemVerses, standardizeVerseWithSymbol } from '../utils/poetryUtils';
import { toArabicDigits } from '../utils/juzUtils';

export const MutoonManager: React.FC = () => {
    const context = useContext(AppContext);

    const matns = context?.matns || [];
    const addMatn = context?.addMatn || (async () => {});
    const updateMatn = context?.updateMatn || (async () => {});
    const deleteMatn = context?.deleteMatn || (async () => {});
    const showToast = context?.showToast || (() => {});
    const safeMatns = matns || [];

    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    
    const [nameInput, setNameInput] = useState('');
    const [linesInput, setLinesInput] = useState<number | ''>('');
    const [versesInput, setVersesInput] = useState('');
    const [isActiveInput, setIsActiveInput] = useState<boolean>(true);
    const [versesTab, setVersesTab] = useState<'editor' | 'preview'>('editor');
    const [previewTatweel, setPreviewTatweel] = useState<boolean>(true);
    const [previewLayoutMode, setPreviewLayoutMode] = useState<'columns' | 'stacked'>('columns');

    const [showDeleteModal, setShowDeleteModal] = useState<number | null>(null);
    const [viewingMatn, setViewingMatn] = useState<Matn | null>(null);

    // تفكيك الأبيات من النص المدخل: كل سطر يعتبر بيتاً واحداً مع استبعاد الأسطر الفارغة
    const parsedVerses = useMemo(() => {
        if (!versesInput.trim()) return [];
        return versesInput
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
    }, [versesInput]);

    // تنسيق أبيات المعاينة بالاعتماد الدائم على أطول شطر في المتن كله بدون كشيدة
    const formattedPreviewVerses = useMemo(() => {
        if (parsedVerses.length === 0) return [];
        return formatPoemVerses(parsedVerses, {
            enableTatweel: previewTatweel,
            startIndex: 1,
        });
    }, [parsedVerses, previewTatweel]);

    const resetForm = () => {
        setNameInput('');
        setLinesInput('');
        setVersesInput('');
        setIsActiveInput(true);
        setVersesTab('editor');
        setIsAdding(false);
        setEditingId(null);
    };

    const handleVersesChange = (text: string) => {
        setVersesInput(text);
        const count = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).length;
        if (count > 0) {
            setLinesInput(count);
        }
    };

    const handleToggleActive = (m: Matn) => {
        const currentActive = m.isActive !== false;
        const nextActive = !currentActive;
        updateMatn({
            ...m,
            isActive: nextActive,
            updatedAt: Date.now(),
        });
        if (nextActive) {
            showToast(`✅ تم تفعيل المتن «${m.name}» في التقييم.`);
        } else {
            showToast(`⏸️ تم تعطيل المتن «${m.name}» وإخفاؤه من التقييم.`);
        }
    };

    const handleSave = () => {
        if (!nameInput.trim()) {
            showToast('الرجاء إدخال اسم المتن.');
            return;
        }

        const calculatedLines = parsedVerses.length > 0 ? parsedVerses.length : (Number(linesInput) || 0);

        if (!calculatedLines || calculatedLines <= 0) {
            showToast('الرجاء إدخال عدد صحيح للأبيات أو لصق الأبيات في الخانة المخصصة.');
            return;
        }

        const standardizedVerses = parsedVerses.map(v => standardizeVerseWithSymbol(v));

        const matnPayload = {
            name: nameInput.trim(),
            linesCount: calculatedLines,
            linesText: versesInput.trim() ? standardizedVerses.join('\n') : undefined,
            verses: standardizedVerses.length > 0 ? standardizedVerses : undefined,
            isActive: isActiveInput,
        };

        if (editingId !== null) {
            updateMatn({
                id: editingId,
                ...matnPayload,
            });
            showToast('✅ تم تعديل المتن وحفظ الأبيات بنجاح!');
        } else {
            addMatn(matnPayload);
            showToast('✅ تمت إضافة المتن وحفظ الأبيات بنجاح!');
        }
        resetForm();
    };

    const handleEdit = (m: Matn) => {
        setEditingId(m.id);
        setNameInput(m.name);
        setLinesInput(m.linesCount);
        setIsActiveInput(m.isActive !== false);
        const existingText = m.linesText || (m.verses && m.verses.length > 0 ? m.verses.join('\n') : '');
        setVersesInput(existingText);
        setVersesTab('editor');
        setIsAdding(true);
    };

    const confirmDelete = () => {
        if (showDeleteModal !== null) {
            deleteMatn(showDeleteModal);
            showToast('🗑️ تم حذف المتن بنجاح.');
            setShowDeleteModal(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <div className="bg-gray-50 p-4 sm:p-6 rounded-3xl border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h4 className="text-xl font-black text-gray-800 dark:text-gray-200">إدارة المتون</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-1">
                            إضافة المتون وتدوين نصوص الأبيات المشكولة لتظهر للمعلمين أثناء التقييم
                        </p>
                    </div>
                    {!isAdding && (
                        <button 
                            onClick={() => {
                                resetForm();
                                setIsAdding(true);
                            }} 
                            className="w-full sm:w-auto px-5 py-2.5 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                            إضافة متن جديد
                        </button>
                    )}
                </div>

                {isAdding && (
                    <div className="bg-white dark:bg-slate-700 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm mb-6 animate-fade-in">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-600">
                            <h5 className="text-lg font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block"></span>
                                {editingId !== null ? 'تعديل المتن وأبياته' : 'إضافة متن جديد مع نصوص الأبيات'}
                            </h5>
                            <button
                                onClick={resetForm}
                                className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                إغلاق
                            </button>
                        </div>

                        {/* الحقول الأساسية: اسم المتن وعدد الأبيات */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                    اسم المتن <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    value={nameInput} 
                                    onChange={e => setNameInput(e.target.value)} 
                                    className="w-full px-4 py-2.5 text-sm font-bold bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 transition-all outline-none" 
                                    placeholder="مثال: غاية المراد أو تحفة الأطفال" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                                    <span>عدد الأبيات الإجمالي</span>
                                    {parsedVerses.length > 0 && (
                                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-black">
                                            (محسوب من الأسطر: {toArabicDigits(parsedVerses.length)})
                                        </span>
                                    )}
                                </label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    value={linesInput} 
                                    onChange={e => setLinesInput(e.target.value === '' ? '' : Number(e.target.value))} 
                                    className="w-full px-4 py-2.5 text-sm font-bold bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 transition-all outline-none" 
                                    placeholder="مثال: 77" 
                                />
                            </div>
                        </div>

                        {/* خيار تفعيل المتن في التقييم */}
                        <div className="mb-5 p-3.5 bg-emerald-50/60 dark:bg-slate-800/80 rounded-xl border border-emerald-200/80 dark:border-slate-600 flex items-center justify-between gap-3">
                            <div>
                                <h6 className="text-sm font-bold text-gray-800 dark:text-gray-200">حالة التفعيل في تقييم المتون</h6>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    عند إلغاء التفعيل، سيتم إخفاء هذا المتن من قائمة التقييم للمعلمين دون حذف المتن أو نصوص أبياته.
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isActiveInput}
                                onClick={() => setIsActiveInput(!isActiveInput)}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 border shadow-2xs active:scale-95 ${
                                    isActiveInput
                                        ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                                        : 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700 shadow-xs'
                                }`}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full ${isActiveInput ? 'bg-white' : 'bg-rose-200'}`}></span>
                                <span>{isActiveInput ? 'مفعل في التقييم' : 'معطل (مخفي)'}</span>
                            </button>
                        </div>

                        {/* خانة لصق أو كتابة أبيات المتن */}
                        <div className="mb-6 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                                <div>
                                    <label className="block text-sm font-black text-gray-800 dark:text-gray-200">
                                        أبيات المتن (كل سطر بيتاً واحداً مع التشكيل)
                                    </label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        الصق أبيات المتن كاملة، وسيقوم النظام تلقائياً بترقيم كل بيت تسلسلياً (1، 2، 3...)
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setVersesTab('editor')}
                                            className={`px-3 py-1 rounded-lg font-bold transition-all ${
                                                versesTab === 'editor'
                                                    ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-2xs'
                                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                                            }`}
                                        >
                                            كتابة / لصق
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setVersesTab('preview')}
                                            className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                                                versesTab === 'preview'
                                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                                            }`}
                                        >
                                            <span>معاينة الأبيات</span>
                                            {parsedVerses.length > 0 && (
                                                <span className="px-1.5 py-0.2 bg-white/20 rounded-md text-[10px]">
                                                    {toArabicDigits(parsedVerses.length)}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {versesTab === 'editor' ? (
                                <div className="relative">
                                    <textarea
                                        rows={9}
                                        dir="rtl"
                                        value={versesInput}
                                        onChange={e => handleVersesChange(e.target.value)}
                                        placeholder={`الصق أو اكتب أبيات المتن هنا...\nيدعم النظام الفاصلة "،" أو المسافات المتعددة أو "|" أو ❖ للفصل بين الصدر والعجز:\nيَقُولُ رَاجِي رَحْمَةِ الْغَفُورِ ، دَوْمًا سُلَيْمَانُ هُوَ الْجَمْزُورِي\nالْحَمْدُ لِلَّهِ مُصَلِّيًا عَلَى | مُحَمَّدٍ وَآلِهِ وَمَنْ تَلَا\nوَبَعْدُ هَذَا النَّظْمُ لِلْمُرِيدِ     فِي النُّونِ وَالتَّنْوِينِ وَالْمُدُودِ`}
                                        className="w-full p-4 text-base sm:text-lg font-serif leading-loose tracking-wide bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl focus:border-green-600 focus:bg-white dark:focus:bg-gray-800/90 text-gray-900 dark:text-gray-100 outline-none resize-y transition-all"
                                    />
                                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 px-1 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="font-bold flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            إجمالي الأبيات المكتشفة: <strong className="text-emerald-700 dark:text-emerald-400 font-black">{toArabicDigits(parsedVerses.length)}</strong> بيتاً
                                        </span>
                                        {versesInput.trim() && (
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // استبدال الفواصل (فاصلة "،" أو مسافات متعددة أو "|" وغيرها) بـ ❖ في المنتصف
                                                        const unified = parsedVerses.map(v => standardizeVerseWithSymbol(v)).join('\n');
                                                        setVersesInput(unified);
                                                        showToast('تم استبدال الفواصل بـ ❖ في منتصف جميع الأبيات بنجاح.');
                                                    }}
                                                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 transition-all hover:bg-emerald-100"
                                                    title="تحويل الفواصل أو المسافات أو | إلى ❖ في منتصف كل بيت بين الصدر والعجز"
                                                >
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-black">❖</span>
                                                    <span>وضع ❖ بين الصدر والعجز</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // تنظيف الأسطر الفارغة الزائدة
                                                        setVersesInput(parsedVerses.join('\n'));
                                                        showToast('تمت إزالة الأسطر الفارغة وتنظيم الأبيات.');
                                                    }}
                                                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                                                >
                                                    إزالة الأسطر الفارغة
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* شريط أدوات المعاينة الشعرية */}
                                    <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            <span>معاينة التنسيق المتوازي (الصدر والعجز):</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* زر تفعيل تمديد الحروف بـ "ـ" */}
                                            <button
                                                type="button"
                                                onClick={() => setPreviewTatweel(!previewTatweel)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold transition-all ${
                                                    previewTatweel
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                                        : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-100'
                                                }`}
                                                title="تمديد الحروف بالتكشيدة (ـ) دون أي مسافات إضافية بين الكلمات"
                                            >
                                                <span className="font-serif">ـتـ</span>
                                                <span>تمديد الحروف (ـ)</span>
                                                {previewTatweel && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                            </button>

                                            {/* زر التبديل بين عمودين ومكدس */}
                                            <div className="flex bg-white dark:bg-slate-700 p-0.5 rounded-lg border border-gray-200 dark:border-slate-600">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewLayoutMode('columns')}
                                                    className={`px-2 py-0.5 rounded font-bold transition-all text-[11px] ${
                                                        previewLayoutMode === 'columns'
                                                            ? 'bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100 font-black'
                                                            : 'text-gray-500 dark:text-gray-400'
                                                    }`}
                                                >
                                                    عمودين
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewLayoutMode('stacked')}
                                                    className={`px-2 py-0.5 rounded font-bold transition-all text-[11px] ${
                                                        previewLayoutMode === 'stacked'
                                                            ? 'bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100 font-black'
                                                            : 'text-gray-500 dark:text-gray-400'
                                                    }`}
                                                >
                                                    مكدس
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* قائمة الأبيات المنسقة بالتوازي */}
                                    <div className="bg-gray-50 dark:bg-gray-800/80 p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-600 max-h-96 overflow-y-auto custom-scrollbar space-y-2">
                                        {formattedPreviewVerses.length === 0 ? (
                                            <div className="text-center py-8 text-gray-400 text-sm">
                                                لم يتم لصق أو كتابة أي أبيات بعد. انتقل إلى تبويب (كتابة / لصق) لإدخال الأبيات.
                                            </div>
                                        ) : (
                                            formattedPreviewVerses.map(verse => (
                                                <PoeticVerseRow
                                                    key={verse.index}
                                                    verse={verse}
                                                    fontClass="text-sm sm:text-base leading-loose"
                                                    layoutMode={previewLayoutMode}
                                                    showBadge={true}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* أزرار الحفظ والإلغاء */}
                        <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-slate-600">
                            <button 
                                type="button"
                                onClick={resetForm} 
                                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold dark:bg-gray-600 dark:text-gray-200 active:scale-95 transition-all text-sm"
                            >
                                إلغاء
                            </button>
                            <button 
                                type="button"
                                onClick={handleSave} 
                                className="px-6 py-2.5 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 active:scale-95 transition-all text-sm shadow-md flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                                {editingId !== null ? 'حفظ التعديلات' : 'حفظ المتن'}
                            </button>
                        </div>
                    </div>
                )}

                {/* قائمة المتون الحالية */}
                {safeMatns.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 dark:text-gray-400 font-bold bg-white dark:bg-slate-700 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600">
                        لا توجد متون مضافة حالياً.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {safeMatns.map(m => {
                            const isMatnActive = m.isActive !== false;
                            const hasVerses = (m.verses && m.verses.length > 0) || (m.linesText && m.linesText.trim().length > 0);
                            const versesCount = m.verses?.length || (m.linesText ? m.linesText.split(/\r?\n/).filter(Boolean).length : 0);

                            return (
                                <div 
                                    key={m.id} 
                                    className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-2xl border transition-all ${
                                        isMatnActive
                                            ? 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:border-emerald-300 shadow-2xs'
                                            : 'bg-red-50/90 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800/80 shadow-xs'
                                    }`}
                                >
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h5 className={`font-black text-lg ${isMatnActive ? 'text-gray-800 dark:text-gray-100' : 'text-red-950 dark:text-red-100'}`}>
                                                {m.name}
                                            </h5>
                                            
                                            {/* شارة حالة التفعيل */}
                                            {isMatnActive ? (
                                                <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                                    <span>مفعل بالتقييم</span>
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 text-xs font-black rounded-lg border border-red-300 dark:border-red-700 flex items-center gap-1.5 shadow-2xs">
                                                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                                    <span>معطل (مخفي)</span>
                                                </span>
                                            )}

                                            {hasVerses ? (
                                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg border border-blue-200 dark:border-blue-800/60">
                                                    ✓ الأبيات محفوظة ({toArabicDigits(versesCount)} بيتاً)
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800/60">
                                                    لم تُدخل الأبيات
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-bold">
                                            عدد الأبيات المقررة: <span className="text-indigo-600 dark:text-indigo-400 font-black">{toArabicDigits(m.linesCount)}</span> بيتاً
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        {/* زر تفعيل/إلغاء تفعيل المتن في التقييم */}
                                        <button 
                                            type="button"
                                            onClick={() => handleToggleActive(m)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs active:scale-95 ${
                                                isMatnActive
                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                                                    : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200 dark:bg-red-950/70 dark:text-red-200 dark:border-red-800'
                                            }`}
                                            title={isMatnActive ? 'المتن مفعّل في التقييم - انقر للتعطيل والإخفاء' : 'المتن معطّل ومخفي من التقييم - انقر للتفعيل والإظهار'}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${isMatnActive ? 'bg-emerald-600' : 'bg-red-600'}`}></span>
                                            <span>{isMatnActive ? 'تعطيل من التقييم' : 'تفعيل في التقييم'}</span>
                                        </button>

                                        {hasVerses && (
                                            <button 
                                                onClick={() => setViewingMatn(m)}
                                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800"
                                                title="عرض الأبيات"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                                <span>عرض الأبيات</span>
                                            </button>
                                        )}

                                        <button 
                                            onClick={() => handleEdit(m)} 
                                            className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition-colors" 
                                            title="تعديل المتن والأبيات"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                        </button>

                                        <button 
                                            onClick={() => setShowDeleteModal(m.id)} 
                                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors" 
                                            title="حذف المتن"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* نافذة تأكيد الحذف */}
            {showDeleteModal !== null && (
                <Modal title="تأكيد الحذف" onClose={() => setShowDeleteModal(null)}>
                    <div className="space-y-6" dir="rtl">
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full text-red-600 dark:text-red-400 shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-red-800 dark:text-red-400 mb-1">هل أنت متأكد من حذف المتن؟</h4>
                                <p className="text-sm text-red-600 dark:text-red-300 leading-relaxed">
                                    هذا الإجراء سيقوم بحذف المتن وأبياته من القائمة. لا يمكن التراجع عن هذه الخطوة.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2 border-t dark:border-slate-700">
                            <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 active:scale-95 transition-all shadow-md">نعم، احذف المتن</button>
                            <button onClick={() => setShowDeleteModal(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200 rounded-xl font-bold active:scale-95 transition-all">إلغاء</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* نافذة معاينة الأبيات من قِبل المشرف */}
            {viewingMatn && (
                <MatnVersesModal
                    isOpen={Boolean(viewingMatn)}
                    onClose={() => setViewingMatn(null)}
                    matnName={viewingMatn.name}
                    fromVerse={1}
                    toVerse={viewingMatn.linesCount}
                    matns={safeMatns}
                />
            )}
        </div>
    );
};

