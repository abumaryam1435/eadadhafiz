import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { AppContext } from '../App';
import { FilterItem } from './FilterItem';
import { UserRole } from '../types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { HexColorPicker } from "react-colorful";
import { parseSafeNumber, safeNumberVal } from '../utils/juzUtils';

interface CertificateConfig {
    templateImage: string | null;
    nameX: number;
    nameY: number;
    nameFontSize: number;
    nameFontFamily: string;
    nameColor: string;
    nameBold: boolean;
    nameItalic: boolean;
    nameUnderline: boolean;
    nameAlign: 'right' | 'center' | 'left';
}

const DEFAULT_CONFIG: CertificateConfig = {
    templateImage: null,
    nameX: 148.5,
    nameY: 100,
    nameFontSize: 25,
    nameFontFamily: "'Amiri', serif",
    nameColor: '#000000',
    nameBold: false,
    nameItalic: false,
    nameUnderline: false,
    nameAlign: 'right',
};

export const CertificatesManager: React.FC = () => {
    const context = useContext(AppContext);

    const students = context?.students || [];
    const users = context?.users || [];
    const showToast = context?.showToast || (() => {});
    const evaluations = context?.evaluations || [];
    const halaqas = context?.halaqas || [];
    const certificateConfig = context?.certificateConfig;
    const setCertificateConfig = context?.setCertificateConfig;
    const testsSummaryFilteredData = context?.testsSummaryFilteredData || [];

    const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'excel'>('students');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [excelData, setExcelData] = useState<{id: string, name: string}[]>([]);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCloudSynced, setIsCloudSynced] = useState(false);

    const imageRef = useRef<HTMLImageElement>(null);
    const printContainerRef = useRef<HTMLDivElement>(null);

    const [config, setConfig] = useState<CertificateConfig>(() => {
        if (certificateConfig) {
            return { ...DEFAULT_CONFIG, ...certificateConfig };
        }
        const saved = localStorage.getItem('simpleCertificateConfig');
        if (saved) {
            try {
                return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
            } catch (e) {
                return DEFAULT_CONFIG;
            }
        }
        return DEFAULT_CONFIG;
    });

    useEffect(() => {
        if (setCertificateConfig) {
            setCertificateConfig(config);
        }
    }, [config, setCertificateConfig]);

    const options = useMemo(() => {
        if (activeTab === 'students') {
            if (testsSummaryFilteredData && testsSummaryFilteredData.length > 0) {
                return testsSummaryFilteredData
                    .filter(r => r.rank !== -1)
                    .map(r => ({ id: r.id, name: r.studentName || r.name }));
            }
            return students.map(s => ({ id: s.id, name: s.name }));
        } else if (activeTab === 'teachers') {
            return users.filter(u => u.role === UserRole.TEACHER).map(t => ({ id: t.id, name: t.name }));
        } else {
            return excelData;
        }
    }, [activeTab, students, users, excelData, testsSummaryFilteredData]);

    useEffect(() => {
        setSelectedIds([]);
        setSearch('');
        setPreviewIndex(0);
    }, [activeTab]);

    useEffect(() => {
        setPreviewIndex(0);
    }, [selectedIds]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 2970;
                    canvas.height = 2100;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                        setConfig(prev => ({ ...prev, templateImage: dataUrl }));
                    }
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
                
                const names: {id: string, name: string}[] = [];
                for (let i = 0; i < json.length; i++) {
                    const row = json[i];
                    if (row && row.length > 0 && typeof row[0] === 'string') {
                        const name = row[0].trim();
                        if (name && name !== 'الاسم' && name !== 'Name') {
                            names.push({ id: `excel_${i}`, name });
                        }
                    }
                }
                
                if (names.length > 0) {
                    setExcelData(names);
                    showToast(`✅ تم استيراد ${names.length} اسم بنجاح`);
                } else {
                    showToast('⚠️ لم يتم العثور على أسماء في العمود الأول');
                }
            } catch (error) {
                console.error('Error parsing Excel:', error);
                showToast('❌ حدث خطأ أثناء قراءة ملف الإكسل');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const saveAsDefault = () => {
        localStorage.setItem('simpleCertificateConfig', JSON.stringify(config));
        showToast('✅ تم حفظ الإعدادات كافتراضية');
    };

    const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const relY = (e.clientY - rect.top) / rect.height;
        
        const a4Width = 297;
        const a4Height = 210;
        
        setConfig(prev => ({
            ...prev,
            nameX: relX * a4Width,
            nameY: relY * a4Height
        }));
    };

    const generatePDF = async () => {
        if (!config.templateImage) {
            showToast('⚠️ يرجى رفع قالب الشهادة أولاً');
            return;
        }

        let targets: any[] = [];
        if (selectedIds.includes('ALL') || selectedIds.length === 0) {
            targets = options;
        } else {
            targets = options.filter(o => selectedIds.includes(String(o.id)));
        }

        if (targets.length === 0) {
            showToast('⚠️ لا يوجد أشخاص محددين لإصدار الشهادات لهم');
            return;
        }

        setIsGenerating(true);
        showToast('⏳ جاري إنشاء الشهادات، يرجى الانتظار...');

        setTimeout(async () => {
            try {
                const doc = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4',
                    compress: true
                });

                await document.fonts.ready;

                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = config.templateImage;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                const canvas = document.createElement('canvas');
                canvas.width = 2970;
                canvas.height = 2100;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not create canvas context');

                for (let i = 0; i < targets.length; i++) {
                    const target = targets[i];
                    
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    const fontSizePx = config.nameFontSize * 3.5277;
                    ctx.font = `${config.nameItalic ? 'italic ' : ''}${config.nameBold ? 'bold ' : ''}${fontSizePx}px ${config.nameFontFamily}`;
                    ctx.fillStyle = config.nameColor;
                    ctx.textAlign = config.nameAlign;
                    ctx.textBaseline = 'middle';
                    ctx.direction = 'rtl';

                    const x = config.nameX * 10;
                    const y = config.nameY * 10;

                    ctx.fillText(target.name, x, y);

                    if (config.nameUnderline) {
                        const metrics = ctx.measureText(target.name);
                        const textWidth = metrics.width;
                        const lineY = y + (fontSizePx * 0.4);
                        
                        ctx.beginPath();
                        ctx.strokeStyle = config.nameColor;
                        ctx.lineWidth = fontSizePx * 0.05;
                        
                        let lineStartX = x;
                        if (config.nameAlign === 'center') {
                            lineStartX = x + (textWidth / 2);
                        } else if (config.nameAlign === 'left') {
                            lineStartX = x + textWidth;
                        }
                        
                        ctx.moveTo(lineStartX, lineY);
                        ctx.lineTo(lineStartX - textWidth, lineY);
                        ctx.stroke();
                    }

                    const imgData = canvas.toDataURL('image/jpeg', 0.95);

                    if (i > 0) {
                        doc.addPage('a4', 'landscape');
                    }

                    doc.addImage(imgData, 'JPEG', 0, 0, 297, 210);
                }

                doc.save(`شهادات_${activeTab === 'students' ? 'الطلاب' : activeTab === 'teachers' ? 'المعلمين' : 'مخصصة'}.pdf`);
                showToast('✅ تم تصدير الشهادات بنجاح');
            } catch (error) {
                console.error('Error generating PDF:', error);
                showToast('❌ حدث خطأ أثناء إنشاء الشهادات');
            } finally {
                setIsGenerating(false);
            }
        }, 100);
    };

    const handleSync = () => {
        if (isCloudSynced) {
            context?.resetCloudSettings();
            setIsCloudSynced(false);
        } else {
            context?.syncSettingsToCloud();
            setIsCloudSynced(true);
        }
    };

    const movePosition = (dx: number, dy: number) => {
        setConfig(prev => ({
            ...prev,
            nameX: Math.max(0, Math.min(297, prev.nameX + dx)),
            nameY: Math.max(0, Math.min(210, prev.nameY + dy))
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-2xl font-bold text-green-900 dark:text-green-300">إصدار شهادات التقدير</h3>
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('students')}
                        className={`px-6 py-2 rounded-md font-bold transition-colors ${activeTab === 'students' ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                        الطلاب
                    </button>
                    <button 
                        onClick={() => setActiveTab('teachers')}
                        className={`px-6 py-2 rounded-md font-bold transition-colors ${activeTab === 'teachers' ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                        المعلمين
                    </button>
                    <button 
                        onClick={() => setActiveTab('excel')}
                        className={`px-6 py-2 rounded-md font-bold transition-colors ${activeTab === 'excel' ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                        من ملف إكسل
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div>
                        <FilterItem 
                            id="targets" 
                            title={activeTab === 'students' ? 'اختر الطلاب' : activeTab === 'teachers' ? 'اختر المعلمين' : 'اختر الأسماء من الإكسل'}
                            options={options}
                            selectedValues={selectedIds}
                            onSelect={setSelectedIds}
                            search={search}
                            setSearch={setSearch}
                            openDropdown={openDropdown}
                            setOpenDropdown={setOpenDropdown}
                        />
                        <p className="text-xs text-gray-500 mt-1">إذا لم يتم اختيار أحد، سيتم إصدار الشهادات للكل.</p>
                        
                        {activeTab === 'excel' && (
                            <div className="mt-4">
                                <label className="cursor-pointer block w-full text-center bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-100 transition-colors text-sm border border-blue-200">
                                    رفع ملف إكسل
                                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleExcelUpload} />
                                </label>
                                {excelData.length > 0 && (
                                    <p className="text-xs text-green-600 mt-2 text-center">تم تحميل {excelData.length} اسم</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button onClick={generatePDF} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-md hover:bg-green-700 active:scale-95 transition-all">
                            تصدير PDF للطباعة
                        </button>
                        <button onClick={saveAsDefault} className="w-full mt-2 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm shadow-sm">
                            حفظ الإعدادات محلياً
                        </button>
                        <button 
                            onClick={handleSync} 
                            className={`w-full mt-2 py-2 rounded-xl font-bold border transition-all text-sm flex items-center justify-center gap-2 shadow-sm ${isCloudSynced ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600'}`}
                        >
                            {isCloudSynced ? (
                                <>
                                    <span>إلغاء حفظ التنسيق</span>
                                    <span className="bg-white text-orange-600 rounded p-0.5 leading-none text-[10px] font-bold">🔄</span>
                                </>
                            ) : (
                                <>
                                    <span>حفظ التنسيق</span>
                                    <div className="w-4 h-4 border border-white/30 rounded flex items-center justify-center">
                                        <svg className="w-2.5 h-2.5 opacity-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h4 className="font-bold text-gray-700 dark:text-gray-300">قالب الشهادة</h4>
                            <p className="text-xs text-gray-500">ارفع صورة القالب الجاهز (A4 Landscape)</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="cursor-pointer bg-blue-50 text-blue-700 px-4 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition-colors text-sm border border-blue-200 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                رفع قالب
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    {config.templateImage ? (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="mb-4 flex flex-wrap gap-4 items-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                <span className="text-sm font-bold text-gray-600 dark:text-gray-400 ml-2">تنسيق الاسم:</span>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">حجم الخط:</label>
                                    <input 
                                        type="number" 
                                        value={safeNumberVal(config.nameFontSize, 24)} 
                                        onChange={e => setConfig(p => ({...p, nameFontSize: parseSafeNumber(e.target.value, 24)}))}
                                        onFocus={e => e.target.select()}
                                        className="w-16 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div className="flex items-center gap-2 relative">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">اللون:</label>
                                    <button 
                                        onClick={() => setShowColorPicker(!showColorPicker)}
                                        className="w-8 h-8 rounded border border-gray-300 shadow-sm"
                                        style={{ backgroundColor: config.nameColor }}
                                    />
                                    {showColorPicker && (
                                        <div className="absolute z-50 top-full mt-2 right-0">
                                            <div className="fixed inset-0" onClick={() => setShowColorPicker(false)} />
                                            <div className="relative z-10 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                                                <HexColorPicker color={config.nameColor} onChange={(c) => setConfig(p => ({...p, nameColor: c}))} />
                                                <div className="mt-2 w-full flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">HEX:</span>
                                                    <input 
                                                        type="text" 
                                                        value={config.nameColor} 
                                                        onChange={(e) => setConfig(p => ({...p, nameColor: e.target.value}))}
                                                        onFocus={e => e.target.select()}
                                                        className="w-full bg-transparent text-xs font-mono text-center text-gray-800 dark:text-gray-200 focus:outline-none uppercase"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">نوع الخط:</label>
                                    <select 
                                        value={config.nameFontFamily} 
                                        onChange={e => setConfig(p => ({...p, nameFontFamily: e.target.value}))}
                                        className="p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value="'Amiri', serif">أميري</option>
                                        <option value="'Cairo', sans-serif">كايرو</option>
                                        <option value="'Tajawal', sans-serif">تجوال</option>
                                        <option value="'Almarai', sans-serif">المراعي</option>
                                        <option value="'Changa', sans-serif">شانجا</option>
                                        <option value="'Reem Kufi', sans-serif">ريم كوفي</option>
                                        <option value="Arial, sans-serif">Arial</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-3">
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameBold: !p.nameBold}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameBold ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="عريض"
                                    >
                                        <span className="font-bold">B</span>
                                    </button>
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameItalic: !p.nameItalic}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameItalic ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="مائل"
                                    >
                                        <span className="italic font-serif">I</span>
                                    </button>
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameUnderline: !p.nameUnderline}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameUnderline ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="تسطير"
                                    >
                                        <span className="underline">U</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-3">
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameAlign: 'right'}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameAlign === 'right' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="محاذاة لليمين"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameAlign: 'center'}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameAlign === 'center' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="توسيط"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameAlign: 'left'}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameAlign === 'left' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="محاذاة لليسار"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M10 18h10" /></svg>
                                    </button>
                                </div>
                                <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-3">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 ml-1">الموضع:</label>
                                    <div className="grid grid-cols-3 gap-0.5">
                                        <div />
                                        <button onClick={() => movePosition(0, -0.5)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200" title="أعلى">↑</button>
                                        <div />
                                        <button onClick={() => movePosition(0.5, 0)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200" title="يمين">→</button>
                                        <button onClick={() => movePosition(0, 0.5)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200" title="أسفل">↓</button>
                                        <button onClick={() => movePosition(-0.5, 0)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200" title="يسار">←</button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mb-4 flex flex-wrap gap-2">
                                <span className="text-sm font-bold text-gray-600 dark:text-gray-400 ml-2">انقر على الصورة لتحديد مكان طباعة الاسم</span>
                            </div>

                            <div className="relative w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair" style={{ aspectRatio: '297/210', containerType: 'inline-size' }} onClick={handleImageClick}>
                                <img ref={imageRef} src={config.templateImage || undefined} alt="Template" className="w-full h-full object-fill pointer-events-none" />
                                
                                <div 
                                    className="absolute pointer-events-none z-10 ring-1 ring-red-500/50"
                                    style={{
                                        top: `${(config.nameY / 210) * 100}%`,
                                        ...(config.nameAlign === 'right' ? { right: `${((297 - config.nameX) / 297) * 100}%`, transform: 'translateY(-50%)' } : 
                                            config.nameAlign === 'left' ? { left: `${(config.nameX / 297) * 100}%`, transform: 'translateY(-50%)' } : 
                                            { left: `${(config.nameX / 297) * 100}%`, transform: 'translate(-50%, -50%)' }),
                                        color: config.nameColor,
                                        fontSize: `${(config.nameFontSize * 0.35277 / 297) * 100}cqw`,
                                        lineHeight: 1,
                                        whiteSpace: 'nowrap',
                                        fontFamily: config.nameFontFamily,
                                        fontWeight: config.nameBold ? 'bold' : 'normal',
                                        fontStyle: config.nameItalic ? 'italic' : 'normal',
                                        textDecoration: config.nameUnderline ? 'underline' : 'none',
                                        direction: 'rtl'
                                    }}
                                >
                                    <div className="absolute w-2 h-2 bg-red-500 rounded-full" style={{
                                        top: '50%',
                                        ...(config.nameAlign === 'right' ? { right: 0, transform: 'translate(50%, -50%)' } : 
                                            config.nameAlign === 'left' ? { left: 0, transform: 'translate(-50%, -50%)' } : 
                                            { left: '50%', transform: 'translate(-50%, -50%)' })
                                    }}></div>
                                    <span>
                                        {(() => {
                                            let targets = [];
                                            if (selectedIds.includes('ALL') || selectedIds.length === 0) {
                                                targets = options;
                                            } else {
                                                targets = options.filter(o => selectedIds.includes(String(o.id)));
                                            }
                                            return targets.length > 0 ? targets[Math.min(previewIndex, targets.length - 1)].name : 'اسم الطالب / المعلم';
                                        })()}
                                    </span>
                                </div>
                            </div>
                            
                            {(() => {
                                let targets = [];
                                if (selectedIds.includes('ALL') || selectedIds.length === 0) {
                                    targets = options;
                                } else {
                                    targets = options.filter(o => selectedIds.includes(String(o.id)));
                                }
                                
                                if (targets.length > 1) {
                                    return (
                                        <div className="mt-4 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                            <button 
                                                onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                                                disabled={previewIndex === 0}
                                                className="px-3 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded shadow-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                                            >
                                                السابق
                                            </button>
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                                معاينة: {Math.min(previewIndex + 1, targets.length)} من {targets.length}
                                            </span>
                                            <button 
                                                onClick={() => setPreviewIndex(prev => Math.min(targets.length - 1, prev + 1))}
                                                disabled={previewIndex >= targets.length - 1}
                                                className="px-3 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded shadow-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                                            >
                                                التالي
                                            </button>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    ) : (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-12 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center h-96">
                            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <p className="text-gray-500 dark:text-gray-400 font-bold">لم يتم رفع قالب بعد</p>
                            <p className="text-sm text-gray-400 mt-2">يرجى رفع صورة قالب الشهادة الجاهز للبدء</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
