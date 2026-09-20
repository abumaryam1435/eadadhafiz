const fs = require('fs');

const code = `import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { AppContext } from '../App';
import { FilterItem } from './FilterItem';
import { UserRole } from '../types';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface CardConfig {
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
    width: number;
    height: number;
    unit: 'mm' | 'in' | 'cm';
}

const DEFAULT_CONFIG: CardConfig = {
    templateImage: null,
    nameX: 27.5,
    nameY: 45,
    nameFontSize: 16,
    nameFontFamily: "'Amiri', serif",
    nameColor: '#000000',
    nameBold: false,
    nameItalic: false,
    nameUnderline: false,
    nameAlign: 'center',
    width: 55,
    height: 90,
    unit: 'mm'
};

export const CardsManager: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { students, users, showToast, cardConfig, setCardConfig } = context;

    const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'excel'>('students');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedStage, setSelectedStage] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [excelData, setExcelData] = useState<{id: string, name: string}[]>([]);
    
    const [stageColors, setStageColors] = useState<Record<string, string>>({});
    const [appLogo, setAppLogo] = useState<HTMLImageElement | null>(null);
    const [dynamicPreviewUrl, setDynamicPreviewUrl] = useState<string>('');

    useEffect(() => {
        const saved = localStorage.getItem('stageColors');
        if (saved) {
            try { setStageColors(JSON.parse(saved)); } catch(e) {}
        }
        const i = new Image();
        i.src = '/logo.png';
        i.onload = () => setAppLogo(i);
    }, []);

    const handleStageColorChange = (stage: string, color: string | null) => {
        setStageColors(prev => {
            const newColors = { ...prev };
            if (color) newColors[stage] = color;
            else delete newColors[stage];
            localStorage.setItem('stageColors', JSON.stringify(newColors));
            return newColors;
        });
    };

    const [config, setConfig] = useState<CardConfig>(() => {
        if (cardConfig) return { ...DEFAULT_CONFIG, ...cardConfig };
        const saved = localStorage.getItem('simpleCardConfig');
        if (saved) {
            try { return { ...DEFAULT_CONFIG, ...JSON.parse(saved) }; } catch (e) { return DEFAULT_CONFIG; }
        }
        return DEFAULT_CONFIG;
    });

    const [exportMode, setExportMode] = useState<'single' | 'a4' | 'a3'>('a4');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (setCardConfig) setCardConfig(config);
    }, [config, setCardConfig]);

    const imageRef = useRef<HTMLImageElement>(null);

    const stages = useMemo(() => {
        const s = new Set<string>();
        students.forEach(st => {
            if (st.schoolStage) s.add(st.schoolStage.trim());
        });
        return Array.from(s).filter(Boolean).sort();
    }, [students]);

    const options = useMemo(() => {
        if (activeTab === 'students') {
            let result = students;
            if (selectedStage && selectedStage.length > 0) {
                result = result.filter(s => s.schoolStage && selectedStage.includes(s.schoolStage.trim()));
            }
            return result.map(s => ({ id: s.id, name: s.name, stage: s.schoolStage?.trim() }));
        } else if (activeTab === 'teachers') {
            return users.filter(u => u.role === UserRole.TEACHER).map(t => ({ id: t.id, name: t.name, stage: null }));
        } else {
            return excelData.map(e => ({...e, stage: null}));
        }
    }, [activeTab, students, users, excelData, selectedStage]);

    useEffect(() => {
        setSelectedIds([]);
        setSearch('');
        setPreviewIndex(0);
    }, [activeTab, selectedStage]);

    useEffect(() => {
        setPreviewIndex(0);
    }, [selectedIds]);

    useEffect(() => {
        if (config.templateImage) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = 1000;
        canvas.height = (config.height / config.width) * 1000;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const currentTarget = options[previewIndex];
        const stage = currentTarget?.stage;
        const baseColor = (stage && stageColors[stage]) || '#064e3b';
        
        let r = parseInt(baseColor.slice(1,3), 16) || 6;
        let g = parseInt(baseColor.slice(3,5), 16) || 78;
        let b = parseInt(baseColor.slice(5,7), 16) || 59;
        const darkerColor = "#" + Math.floor(r * 0.5).toString(16).padStart(2,'0') + Math.floor(g * 0.5).toString(16).padStart(2,'0') + Math.floor(b * 0.5).toString(16).padStart(2,'0');
        
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(1, darkerColor);
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const borderWidth = canvas.width * 0.03;
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(borderWidth, borderWidth, canvas.width - borderWidth * 2, canvas.height - borderWidth * 2);
        
        ctx.lineWidth = borderWidth * 0.2;
        ctx.strokeRect(borderWidth * 1.5, borderWidth * 1.5, canvas.width - borderWidth * 3, canvas.height - borderWidth * 3);
        
        if (appLogo) {
            const logoW = canvas.width * 0.4;
            const logoH = (appLogo.height / appLogo.width) * logoW;
            ctx.drawImage(appLogo, (canvas.width - logoW) / 2, canvas.height * 0.1, logoW, logoH);
            
            ctx.font = \`bold \${canvas.height * 0.06}px Amiri, Cairo, sans-serif\`;
            ctx.fillStyle = '#D4AF37';
            ctx.textAlign = 'center';
            ctx.fillText('مشروع إعداد حافظ', canvas.width / 2, canvas.height * 0.1 + logoH + canvas.height * 0.08);
        }
        
        setDynamicPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
    }, [config.templateImage, config.width, config.height, options, previewIndex, stageColors, appLogo]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setConfig(p => ({...p, templateImage: event.target?.result as string}));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
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
                                names.push({ id: \`excel_\${i}\`, name });
                            }
                        }
                    }
                    
                    if (names.length > 0) {
                        setExcelData(names);
                        showToast(\`✅ تم استيراد \${names.length} اسم بنجاح\`);
                    } else {
                        showToast('⚠️ لم يتم العثور على أسماء في العمود الأول');
                    }
                } catch (error) {
                    console.error('Error parsing Excel:', error);
                    showToast('❌ حدث خطأ أثناء قراءة ملف الإكسل');
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const saveAsDefault = () => {
        localStorage.setItem('simpleCardConfig', JSON.stringify(config));
        showToast('✅ تم حفظ الإعدادات كافتراضية');
    };

    const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!imageRef.current) return;
        const rect = imageRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const percentX = x / rect.width;
        const percentY = y / rect.height;
        
        setConfig(p => ({
            ...p,
            nameX: percentX * p.width,
            nameY: percentY * p.height
        }));
    };

    const printContainerRef = useRef<HTMLDivElement>(null);

    const generatePDF = async () => {
        let targets: any[] = [];
        if (selectedIds.includes('ALL') || selectedIds.length === 0) {
            targets = options;
        } else {
            targets = options.filter(o => selectedIds.includes(String(o.id)));
        }

        if (targets.length === 0) {
            showToast('⚠️ لا يوجد أشخاص محددين لإصدار البطاقات لهم');
            return;
        }

        setIsGenerating(true);
        showToast('⏳ جاري إنشاء البطاقات، يرجى الانتظار...');

        setTimeout(async () => {
            try {
                await document.fonts.ready;
                
                const img = new Image();
                img.crossOrigin = "anonymous";
                if (config.templateImage) {
                    img.src = config.templateImage;
                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve; 
                    });
                }

                let cardWidthMM = config.width;
                let cardHeightMM = config.height;
                if (config.unit === 'cm') {
                    cardWidthMM = config.width * 10;
                    cardHeightMM = config.height * 10;
                } else if (config.unit === 'in') {
                    cardWidthMM = config.width * 25.4;
                    cardHeightMM = config.height * 25.4;
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = cardWidthMM * 10;
                canvas.height = cardHeightMM * 10;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not create canvas context');

                let docFormat = 'a4';
                let docWidth = 210;
                let docHeight = 297;
                if (exportMode === 'a3') {
                    docFormat = 'a3';
                    docWidth = 297;
                    docHeight = 420;
                } else if (exportMode === 'single') {
                    docFormat = [cardWidthMM, cardHeightMM] as any;
                    docWidth = cardWidthMM;
                    docHeight = cardHeightMM;
                }

                const pdf = new jsPDF({
                    orientation: docWidth > docHeight ? 'landscape' : 'portrait',
                    unit: 'mm',
                    format: docFormat
                });

                let currentX = 0;
                let currentY = 0;
                const marginX = 10; 
                const marginY = 10;
                let firstPage = true;

                if (exportMode === 'a4' || exportMode === 'a3') {
                    currentX = marginX;
                    currentY = marginY;
                }

                for (let i = 0; i < targets.length; i++) {
                    const target = targets[i];
                    
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    if (config.templateImage) {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    } else {
                        const stage = target.stage;
                        const baseColor = (stage && stageColors[stage]) || '#064e3b';
                        
                        let r = parseInt(baseColor.slice(1,3), 16) || 6;
                        let g = parseInt(baseColor.slice(3,5), 16) || 78;
                        let b = parseInt(baseColor.slice(5,7), 16) || 59;
                        const darkerColor = "#" + Math.floor(r * 0.5).toString(16).padStart(2,'0') + Math.floor(g * 0.5).toString(16).padStart(2,'0') + Math.floor(b * 0.5).toString(16).padStart(2,'0');
                        
                        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                        grad.addColorStop(0, baseColor);
                        grad.addColorStop(1, darkerColor);
                        
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        
                        const borderWidth = canvas.width * 0.03;
                        ctx.strokeStyle = '#D4AF37';
                        ctx.lineWidth = borderWidth;
                        ctx.strokeRect(borderWidth, borderWidth, canvas.width - borderWidth * 2, canvas.height - borderWidth * 2);
                        
                        ctx.lineWidth = borderWidth * 0.2;
                        ctx.strokeRect(borderWidth * 1.5, borderWidth * 1.5, canvas.width - borderWidth * 3, canvas.height - borderWidth * 3);
                        
                        if (appLogo) {
                            const logoW = canvas.width * 0.4;
                            const logoH = (appLogo.height / appLogo.width) * logoW;
                            ctx.drawImage(appLogo, (canvas.width - logoW) / 2, canvas.height * 0.1, logoW, logoH);
                            
                            ctx.font = \`bold \${canvas.height * 0.06}px Amiri, Cairo, sans-serif\`;
                            ctx.fillStyle = '#D4AF37';
                            ctx.textAlign = 'center';
                            ctx.fillText('مشروع إعداد حافظ', canvas.width / 2, canvas.height * 0.1 + logoH + canvas.height * 0.08);
                        }
                    }

                    const fontSizePx = config.nameFontSize * 3.5277;
                    
                    ctx.font = \`\${config.nameItalic ? 'italic ' : ''}\${config.nameBold ? 'bold ' : ''}\${fontSizePx}px \${config.nameFontFamily}\`;
                    ctx.fillStyle = config.nameColor;
                    ctx.textAlign = config.nameAlign;
                    ctx.textBaseline = 'middle';
                    ctx.direction = 'rtl';

                    const x = (config.nameX / config.width) * canvas.width;
                    const y = (config.nameY / config.height) * canvas.height;
                    
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
                            lineStartX = x - (textWidth / 2);
                        } else if (config.nameAlign === 'left') {
                            lineStartX = x;
                        } else if (config.nameAlign === 'right') {
                            lineStartX = x - textWidth;
                        }
                        
                        ctx.moveTo(lineStartX, lineY);
                        ctx.lineTo(lineStartX + textWidth, lineY);
                        ctx.stroke();
                    }

                    const imgData = canvas.toDataURL('image/jpeg', 0.95);

                    if (exportMode === 'single') {
                        if (!firstPage) pdf.addPage();
                        pdf.addImage(imgData, 'JPEG', 0, 0, cardWidthMM, cardHeightMM);
                        firstPage = false;
                    } else {
                        if (currentX + cardWidthMM > docWidth - marginX && currentX !== marginX) {
                            currentX = marginX;
                            currentY += cardHeightMM + 5;
                        }
                        if (currentY + cardHeightMM > docHeight - marginY && currentY !== marginY) {
                            pdf.addPage();
                            currentX = marginX;
                            currentY = marginY;
                        }
                        
                        pdf.addImage(imgData, 'JPEG', currentX, currentY, cardWidthMM, cardHeightMM);
                        
                        // faint border for cutting
                        pdf.setDrawColor(200, 200, 200);
                        pdf.setLineWidth(0.1);
                        pdf.rect(currentX, currentY, cardWidthMM, cardHeightMM);

                        currentX += cardWidthMM + 5;
                    }
                }

                pdf.save(\`cards_\${new Date().getTime()}.pdf\`);
                showToast('✅ تم إنشاء البطاقات بنجاح');
            } catch (error) {
                console.error('Error generating PDF:', error);
                showToast('❌ حدث خطأ أثناء إنشاء البطاقات');
            } finally {
                setIsGenerating(false);
            }
        }, 100);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-2xl font-bold text-green-900 dark:text-green-300">إصدار البطاقات</h3>
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('students')}
                        className={\`px-6 py-2 rounded-md font-bold transition-colors \${activeTab === 'students' ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}\`}
                    >
                        الطلاب
                    </button>
                    <button 
                        onClick={() => setActiveTab('teachers')}
                        className={\`px-6 py-2 rounded-md font-bold transition-colors \${activeTab === 'teachers' ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}\`}
                    >
                        المعلمين
                    </button>
                    <button 
                        onClick={() => setActiveTab('excel')}
                        className={\`px-6 py-2 rounded-md font-bold transition-colors \${activeTab === 'excel' ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}\`}
                    >
                        من ملف إكسل
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div>
                        {activeTab === 'students' && stages.length > 0 && (
                            <div className="mb-4">
                                <FilterItem 
                                    id="stages" 
                                    title="تصفية وتمييز بالألوان حسب المرحلة الدراسية"
                                    options={stages.map(s => ({ id: s, name: s }))}
                                    selectedValues={selectedStage}
                                    onSelect={setSelectedStage}
                                    search={search}
                                    setSearch={setSearch}
                                    openDropdown={openDropdown}
                                    setOpenDropdown={setOpenDropdown}
                                    showColorPicker={true}
                                    colorMap={stageColors}
                                    onColorChange={handleStageColorChange}
                                />
                            </div>
                        )}
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
                        {activeTab === 'excel' && (
                            <div className="mt-4">
                                <label className="cursor-pointer block w-full text-center bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-bold transition-colors text-sm">
                                    رفع ملف إكسل (الأسماء في العمود الأول)
                                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
                                </label>
                            </div>
                        )}
                    </div>
                    
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
                        <div className="flex gap-2">
                            <button 
                                onClick={saveAsDefault}
                                className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                            >
                                حفظ التنسيق
                            </button>
                            <label className="flex-1 text-center cursor-pointer bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-blue-100 dark:border-blue-800">
                                رفع قالب (اختياري)
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                            {config.templateImage && (
                                <button
                                    onClick={() => setConfig(p => ({...p, templateImage: null}))}
                                    className="bg-red-50 text-red-600 hover:bg-red-100 px-3 rounded-lg font-bold transition-colors"
                                    title="إزالة القالب والعودة للافتراضي"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">إعدادات الطباعة</h4>
                            <div className="flex gap-2">
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="exportMode" className="peer hidden" checked={exportMode === 'a4'} onChange={() => setExportMode('a4')} />
                                    <div className="text-center p-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 peer-checked:border-green-500 peer-checked:bg-green-50 dark:peer-checked:bg-green-900/20 peer-checked:text-green-700 dark:peer-checked:text-green-300 font-bold text-xs transition-all">
                                        تجميع في A4
                                    </div>
                                </label>
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="exportMode" className="peer hidden" checked={exportMode === 'a3'} onChange={() => setExportMode('a3')} />
                                    <div className="text-center p-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 peer-checked:border-green-500 peer-checked:bg-green-50 dark:peer-checked:bg-green-900/20 peer-checked:text-green-700 dark:peer-checked:text-green-300 font-bold text-xs transition-all">
                                        تجميع في A3
                                    </div>
                                </label>
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="exportMode" className="peer hidden" checked={exportMode === 'single'} onChange={() => setExportMode('single')} />
                                    <div className="text-center p-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 peer-checked:border-green-500 peer-checked:bg-green-50 dark:peer-checked:bg-green-900/20 peer-checked:text-green-700 dark:peer-checked:text-green-300 font-bold text-xs transition-all">
                                        كل بطاقة في صفحة
                                    </div>
                                </label>
                            </div>
                        </div>

                        <button 
                            onClick={generatePDF}
                            disabled={isGenerating}
                            className="w-full bg-green-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-green-700 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isGenerating ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    جاري الإصدار...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    إصدار البطاقات
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300">أبعاد البطاقة (في الطباعة)</h4>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">العرض:</label>
                                    <input type="number" value={config.width} onChange={e => setConfig(p => ({...p, width: Number(e.target.value)}))} onFocus={e => e.target.select()} className="w-16 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">الطول:</label>
                                    <input type="number" value={config.height} onChange={e => setConfig(p => ({...p, height: Number(e.target.value)}))} onFocus={e => e.target.select()} className="w-16 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">الوحدة:</label>
                                    <select value={config.unit} onChange={e => setConfig(p => ({...p, unit: e.target.value as any}))} className="p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                        <option value="cm">سم</option>
                                        <option value="mm">مم</option>
                                        <option value="in">بوصة</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4 flex flex-wrap gap-4 items-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                            <span className="text-sm font-bold text-gray-600 dark:text-gray-400 ml-2">تنسيق الاسم:</span>
                            
                            <div className="flex items-center gap-2 border-r pr-4 dark:border-gray-600">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">الخط:</label>
                                <select value={config.nameFontFamily} onChange={e => setConfig(p => ({...p, nameFontFamily: e.target.value}))} className="p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="'Amiri', serif">أميري</option>
                                    <option value="'Cairo', sans-serif">كايرو</option>
                                    <option value="'Tajawal', sans-serif">تجوال</option>
                                    <option value="Arial, sans-serif">Arial</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 border-r pr-4 dark:border-gray-600">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">الحجم:</label>
                                <input type="number" value={config.nameFontSize} onChange={e => setConfig(p => ({...p, nameFontSize: Number(e.target.value)}))} onFocus={e => e.target.select()} className="w-14 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>

                            <div className="flex items-center gap-2 border-r pr-4 dark:border-gray-600">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">اللون:</label>
                                <input type="color" value={config.nameColor} onChange={e => setConfig(p => ({...p, nameColor: e.target.value}))} className="w-6 h-6 p-0 border-0 rounded cursor-pointer" />
                            </div>

                            <div className="flex items-center gap-1 border-r pr-4 dark:border-gray-600">
                                <button onClick={() => setConfig(p => ({...p, nameBold: !p.nameBold}))} className={\`p-1.5 rounded \${config.nameBold ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}\`} title="عريض"><span className="font-bold text-gray-700 dark:text-gray-300">B</span></button>
                                <button onClick={() => setConfig(p => ({...p, nameItalic: !p.nameItalic}))} className={\`p-1.5 rounded \${config.nameItalic ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}\`} title="مائل"><span className="italic text-gray-700 dark:text-gray-300">I</span></button>
                                <button onClick={() => setConfig(p => ({...p, nameUnderline: !p.nameUnderline}))} className={\`p-1.5 rounded \${config.nameUnderline ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}\`} title="تسطير"><span className="underline text-gray-700 dark:text-gray-300">U</span></button>
                            </div>
                            
                            <div className="flex items-center gap-1 border-r pr-4 dark:border-gray-600">
                                <button onClick={() => setConfig(p => ({...p, nameAlign: 'right'}))} className={\`p-1.5 rounded \${config.nameAlign === 'right' ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}\`}><svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                                <button onClick={() => setConfig(p => ({...p, nameAlign: 'center'}))} className={\`p-1.5 rounded \${config.nameAlign === 'center' ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}\`}><svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg></button>
                                <button onClick={() => setConfig(p => ({...p, nameAlign: 'left'}))} className={\`p-1.5 rounded \${config.nameAlign === 'left' ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}\`}><svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M12 12h8m-8 6h16" /></svg></button>
                            </div>
                        </div>

                        <div className="relative w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair" style={{ aspectRatio: \`\${config.width}/\${config.height}\`, containerType: 'inline-size' }} onClick={handleImageClick}>
                            <img ref={imageRef} src={config.templateImage || dynamicPreviewUrl} alt="Template" className="w-full h-full object-fill pointer-events-none" />
                            
                            <div 
                                className="absolute pointer-events-none z-10 ring-1 ring-red-500/50"
                                style={{
                                    top: \`\${(config.nameY / config.height) * 100}%\`,
                                    ...(config.nameAlign === 'right' ? { right: \`\${((config.width - config.nameX) / config.width) * 100}%\`, transform: 'translateY(-50%)' } : 
                                         config.nameAlign === 'left' ? { left: \`\${(config.nameX / config.width) * 100}%\`, transform: 'translateY(-50%)' } : 
                                         { left: \`\${(config.nameX / config.width) * 100}%\`, transform: 'translate(-50%, -50%)' }),
                                    color: config.nameColor,
                                    fontSize: \`\${(config.nameFontSize * 0.35277 / (config.unit === 'cm' ? config.width * 10 : config.unit === 'in' ? config.width * 25.4 : config.width)) * 100}cqw\`,
                                    lineHeight: 1,
                                    whiteSpace: 'nowrap',
                                    fontFamily: config.nameFontFamily,
                                    fontWeight: config.nameBold ? 'bold' : 'normal',
                                    fontStyle: config.nameItalic ? 'italic' : 'normal',
                                    direction: 'rtl'
                                }}
                            >
                                {options.length > 0 ? options[previewIndex]?.name : 'الاسم للتجربة'}
                                
                                {config.nameUnderline && (
                                    <div 
                                        className="absolute bottom-[-20%] h-[10%] bg-current" 
                                        style={{ 
                                            width: '100%',
                                            ...(config.nameAlign === 'right' ? { right: 0 } : 
                                                 config.nameAlign === 'left' ? { left: 0 } : 
                                                 { left: '50%', transform: 'translateX(-50%)' })
                                        }} 
                                    />
                                )}
                            </div>
                            <div className="absolute w-2 h-2 bg-red-500 rounded-full" style={{
                                    top: \`\${(config.nameY / config.height) * 100}%\`,
                                    ...(config.nameAlign === 'right' ? { right: \`\${((config.width - config.nameX) / config.width) * 100}%\`, transform: 'translate(50%, -50%)' } : 
                                         config.nameAlign === 'left' ? { left: \`\${(config.nameX / config.width) * 100}%\`, transform: 'translate(-50%, -50%)' } : 
                                         { left: \`\${(config.nameX / config.width) * 100}%\`, transform: 'translate(-50%, -50%)' })
                            }}></div>
                        </div>
                        
                        <div className="mt-4 flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded-lg border border-gray-100 dark:border-gray-600">
                            <button 
                                onClick={() => setPreviewIndex(p => Math.max(0, p - 1))}
                                disabled={previewIndex === 0}
                                className="p-2 text-gray-500 hover:text-green-600 disabled:opacity-50"
                            >
                                السابق
                            </button>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                معاينة: {previewIndex + 1} / {Math.max(1, options.length)}
                            </span>
                            <button 
                                onClick={() => setPreviewIndex(p => Math.min(options.length - 1, p + 1))}
                                disabled={previewIndex >= options.length - 1}
                                className="p-2 text-gray-500 hover:text-green-600 disabled:opacity-50"
                            >
                                التالي
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
`;

fs.writeFileSync('components/CardsManager.tsx', code);
