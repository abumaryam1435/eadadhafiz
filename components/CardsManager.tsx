import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { AppContext } from '../App';
import { FilterItem } from './FilterItem';
import { UserRole } from '../types';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { HexColorPicker } from 'react-colorful';
import { RotateCcw, CreditCard, Users, Sparkles, Palette, Check, Printer, Download, Plus, Trash2, Layers } from 'lucide-react';

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    if (cleanHex.length !== 6) return null;
    const num = parseInt(cleanHex, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
};

/**
 * Derives a deep, rich, dark tone of the exact same color family (hue) as the base card background.
 * Always guarantees high contrast (dark text) even if the background color is bright, pastel, or light.
 */
const getDarkToneFromBaseColor = (color: string): string => {
    if (!color) return '#003b29';
    let r = 5, g = 150, b = 105;
    if (color.startsWith('#')) {
        const rgb = hexToRgb(color);
        if (rgb) {
            r = rgb.r;
            g = rgb.g;
            b = rgb.b;
        }
    } else if (color.startsWith('rgb')) {
        const match = color.match(/\d+/g);
        if (match && match.length >= 3) {
            r = parseInt(match[0], 10);
            g = parseInt(match[1], 10);
            b = parseInt(match[2], 10);
        }
    }

    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
            case gNorm: h = (bNorm - rNorm) / d + 2; break;
            case bNorm: h = (rNorm - gNorm) / d + 4; break;
        }
        h /= 6;
    }

    // Force lightness into a strictly dark range (0.11 - 0.18) so it is always bold & readable against white/cream badges
    const targetL = Math.min(0.18, Math.max(0.11, l * 0.32));
    // Maintain or boost saturation so the hue remains vibrant and clearly reflects the card background color
    const targetS = s < 0.15 ? s : Math.max(s, 0.72);

    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    let dr: number, dg: number, db: number;
    if (targetS === 0) {
        dr = dg = db = targetL;
    } else {
        const q = targetL < 0.5 ? targetL * (1 + targetS) : targetL + targetS - targetL * targetS;
        const p = 2 * targetL - q;
        dr = hue2rgb(p, q, h + 1 / 3);
        dg = hue2rgb(p, q, h);
        db = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${toHex(dr)}${toHex(dg)}${toHex(db)}`;
};

export interface UnifiedHalaqaCardItem {
    id: string;
    originalId: number | string;
    name: string;
    type: 'memorization' | 'sard' | string;
    typeName: string;
    numberStr: string;
    teacherName?: string;
    color: string;
}

export interface CustomHalaqaType {
    id: string;
    name: string;
    count: number;
    color: string;
}

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
    pdfGaps?: boolean;
    pdfGapsExplicit?: boolean;
    showAwqafLogo?: boolean;
    awqafLogoCorner?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    awqafLogoBadge?: 'white' | 'cream' | 'transparent';
    awqafLogoSize?: number;
}

const DEFAULT_CONFIG: CardConfig = {
    templateImage: null,
    nameX: 42.5,
    nameY: 39,
    nameFontSize: 16,
    nameFontFamily: "'Tajawal', 'Cairo', sans-serif",
    nameColor: '#FDF7E3',
    nameBold: true,
    nameItalic: false,
    nameUnderline: false,
    nameAlign: 'center',
    width: 85,
    height: 54,
    unit: 'mm',
    pdfGaps: false,
    showAwqafLogo: true,
    awqafLogoCorner: 'top-right',
    awqafLogoBadge: 'transparent',
    awqafLogoSize: 22
};

export const drawAwqafLogoOnCanvas = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    logoImg: HTMLImageElement,
    corner: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right',
    _badge: 'white' | 'cream' | 'transparent' = 'transparent',
    sizePercent: number = 22
) => {
    const naturalW = logoImg.naturalWidth || 800;
    const naturalH = logoImg.naturalHeight || 427;
    const aspect = naturalW / naturalH;

    const clampedSize = Math.max(14, Math.min(36, sizePercent || 22));
    const targetW = canvasWidth * (clampedSize / 100);
    const targetH = targetW / aspect;

    const marginX = canvasWidth * 0.035;
    const marginY = canvasHeight * 0.05;

    let posX = 0;
    let posY = 0;

    if (corner === 'top-right') {
        posX = canvasWidth - targetW - marginX;
        posY = marginY;
    } else if (corner === 'top-left') {
        posX = marginX;
        posY = marginY;
    } else if (corner === 'bottom-right') {
        posX = canvasWidth - targetW - marginX;
        posY = canvasHeight - targetH - marginY;
    } else { // bottom-left
        posX = marginX;
        posY = canvasHeight - targetH - marginY;
    }

    // Direct draw with pure transparency: no background, no border/frame
    ctx.drawImage(logoImg, posX, posY, targetW, targetH);
};

export interface OtherPaperPreset {
    id: string;
    name: string;
    category: 'press' | 'standard' | 'custom';
    widthMM: number;
    heightMM: number;
    notes?: string;
}

export const OTHER_PAPER_PRESETS: OtherPaperPreset[] = [
    // مقاسات المطابع الكبيرة والفرخ التجاري
    { id: 'b1_press', name: 'B1 / فرخ مطابع كامل (70 × 100 سم)', category: 'press', widthMM: 700, heightMM: 1000, notes: 'المقاس التجاري القياسي الأشهر في المطابع التجارية' },
    { id: 'sheet_66_88', name: 'فرخ كوشيه تجاري (66 × 88 سم)', category: 'press', widthMM: 660, heightMM: 880, notes: 'مقاس مطابع شائع لأوراق الكوشيه والبانرات' },
    { id: 'b2_press', name: 'B2 / نصف فرخ مطابع (50 × 70 سم)', category: 'press', widthMM: 500, heightMM: 700, notes: 'نصف فرخ تجاري' },
    { id: 'a0_press', name: 'A0 / بوستر ومطابع كبير جداً (84.1 × 118.9 سم)', category: 'press', widthMM: 841, heightMM: 1189, notes: 'مقاس البوسترات والمخططات الهندسية والمطابع' },
    { id: 'a1_press', name: 'A1 / بوستر ومطابع كبير (59.4 × 84.1 سم)', category: 'press', widthMM: 594, heightMM: 841, notes: 'مقاس لوحات وبوسترات المطابع' },
    { id: 'a2_press', name: 'A2 / ربع فرخ مطابع (42 × 59.4 سم)', category: 'press', widthMM: 420, heightMM: 594, notes: 'مقاس مطابع متوسط' },
    { id: 'b0_press', name: 'B0 / فرخ عملاق للمطابع (100 × 141.4 سم)', category: 'press', widthMM: 1000, heightMM: 1414, notes: 'أكبر مقاس قياسي للمطابع واللافتات' },
    { id: 'plotter_90_120', name: 'رول بلوتر / بنر مطابع (90 × 120 سم)', category: 'press', widthMM: 900, heightMM: 1200, notes: 'مقاس رول المطابع الرقمية' },

    // مقاسات معيارية إضافية
    { id: 'a5', name: 'A5 (14.8 × 21 سم)', category: 'standard', widthMM: 148, heightMM: 210, notes: 'نصف صفحة A4' },
    { id: 'b3', name: 'B3 (35.3 × 50 سم)', category: 'standard', widthMM: 353, heightMM: 500, notes: 'ربع فرخ' },
    { id: 'b4', name: 'B4 (25 × 35.3 سم)', category: 'standard', widthMM: 250, heightMM: 353, notes: 'حجم مكتبي كبير' },
    { id: 'b5', name: 'B5 (17.6 × 25 سم)', category: 'standard', widthMM: 176, heightMM: 250, notes: 'حجم كتب ودفاتر' },
    { id: 'letter', name: 'Letter (21.6 × 27.9 سم)', category: 'standard', widthMM: 215.9, heightMM: 279.4, notes: 'المقاس الأمريكي القياسي' },
    { id: 'legal', name: 'Legal (21.6 × 35.6 سم)', category: 'standard', widthMM: 215.9, heightMM: 355.6, notes: 'مقاس المستندات الطويلة' },
    { id: 'tabloid', name: 'Tabloid / Ledger (27.9 × 43.2 سم)', category: 'standard', widthMM: 279.4, heightMM: 431.8, notes: 'مقاس 11 × 17 إنش' },

    // نهاية القائمة المنسدلة: خيار تحديد الحجم يدوياً
    { id: 'custom', name: 'أخرى: حجم الورق يدوياً (الطول والعرض)', category: 'custom', widthMM: 0, heightMM: 0, notes: 'تحديد الطول والعرض والوحدة يدوياً' }
];

export const DEFAULT_STAGE_COLORS = [
    '#059669', // 1. الأخضر (المرحلة ذات أكبر عدد من الطلاب)
    '#2563eb', // 2. الأزرق (المرحلة التالية - عدد أقل من الأولى)
    '#be185d', // 3. الأرجواني / الوردي الغامق
    '#78350f', // 4. البني
    '#7c3aed', // 5. البنفسجي
    '#0891b2', // 6. السماوي
    '#db2777', // 7. الوردي
    '#4f46e5', // 8. النيلي
    '#0d9488', // 9. الفيروزي
    '#1e3a8a', // 10. الكحلي
    '#475569', // 11. الرمادي الداكن
    '#dc2626', // 12. الأحمر (الخيار الأخير)
];

const STAGE_ORDER_WEIGHTS: Record<string, number> = {
    'تمهيدي': 1,
    'التمهيدي': 1,
    'روضة': 1,
    'الروضة': 1,
    'ابتدائي': 2,
    'ابتدائية': 2,
    'الابتدائي': 2,
    'الابتدائية': 2,
    'المرحلة الابتدائية': 2,
    'متوسط': 3,
    'متوسطة': 3,
    'المتوسط': 3,
    'المتوسطة': 3,
    'المرحلة المتوسطة': 3,
    'ثانوي': 4,
    'ثانوية': 4,
    'الثانوي': 4,
    'الثانوية': 4,
    'المرحلة الثانوية': 4,
    'جامعي': 5,
    'جامعية': 5,
    'الجامعي': 5,
    'الجامعية': 5,
    'المرحلة الجامعية': 5,
    'كبار': 6,
    'الكبار': 6,
    'موظفين': 7,
};

const getStageWeight = (stageName: string): number => {
    const trimmed = stageName.trim();
    if (STAGE_ORDER_WEIGHTS[trimmed]) return STAGE_ORDER_WEIGHTS[trimmed];
    if (trimmed.includes('تمهيد') || trimmed.includes('روض')) return 1;
    if (trimmed.includes('ابتدائ')) return 2;
    if (trimmed.includes('متوسط')) return 3;
    if (trimmed.includes('ثانو')) return 4;
    if (trimmed.includes('جامع')) return 5;
    if (trimmed.includes('كبار')) return 6;
    return 99;
};

const getDefaultColorForStage = (index: number): string => {
    return DEFAULT_STAGE_COLORS[index % DEFAULT_STAGE_COLORS.length];
};

export const CardsManager: React.FC = () => {
    const context = useContext(AppContext);

    const students = context?.students || [];
    const users = context?.users || [];
    const halaqas = context?.halaqas || [];
    const sardHalaqas = context?.sardHalaqas || [];
    const showToast = context?.showToast || (() => {});
    const cardConfig = context?.cardConfig;
    const setCardConfig = context?.setCardConfig;
    const syncSettingsToCloud = context?.syncSettingsToCloud;

    // Main top-level tab: 'id_cards' (البطاقات التعريفية) or 'halaqa_cards' (بطاقات الحلقات)
    const [mainTab, setMainTab] = useState<'id_cards' | 'halaqa_cards'>('id_cards');

    // State for Halaqa Cards
    const [halaqaFilter, setHalaqaFilter] = useState<string>('all');
    const [selectedHalaqaIds, setSelectedHalaqaIds] = useState<string[]>([]);
    const [halaqaSearch, setHalaqaSearch] = useState('');

    const [memorizationColor, setMemorizationColor] = useState<string>(() => {
        return localStorage.getItem('halaqa_card_mem_color') || '#059669';
    });
    const [sardColor, setSardColor] = useState<string>(() => {
        return localStorage.getItem('halaqa_card_sard_color') || '#2563eb';
    });
    const [showMemColorPicker, setShowMemColorPicker] = useState(false);
    const [showSardColorPicker, setShowSardColorPicker] = useState(false);
    const [activeCustomColorPickerId, setActiveCustomColorPickerId] = useState<string | null>(null);

    const [customHalaqaTypes, setCustomHalaqaTypes] = useState<CustomHalaqaType[]>(() => {
        const saved = localStorage.getItem('custom_halaqa_card_types');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // إذا كانت القيمة القديمة هي النموذج الافتراضي "حلقات تعليم"، نجعلها فارغة وفق طلب المستخدم
                    const isOldDefault = parsed.length === 1 && parsed[0].name === 'حلقات تعليم';
                    if (!isOldDefault) return parsed;
                }
            } catch (e) {}
        }
        return [
            { id: 'custom_1', name: '', count: 1, color: '#8B4513' }
        ];
    });

    const saveCustomHalaqaTypes = (types: CustomHalaqaType[]) => {
        setCustomHalaqaTypes(types);
        try {
            localStorage.setItem('custom_halaqa_card_types', JSON.stringify(types));
        } catch (e) {}
    };

    const handleAddCustomType = () => {
        const newId = `custom_${Date.now()}`;
        const updated = [
            ...customHalaqaTypes,
            { id: newId, name: '', count: 1, color: '#8B4513' }
        ];
        saveCustomHalaqaTypes(updated);
    };

    const handleUpdateCustomType = (id: string, updates: Partial<CustomHalaqaType>) => {
        const updated = customHalaqaTypes.map(t => t.id === id ? { ...t, ...updates } : t);
        saveCustomHalaqaTypes(updated);
    };

    const handleRemoveCustomType = (id: string) => {
        const remaining = customHalaqaTypes.filter(t => t.id !== id);
        if (remaining.length === 0) {
            saveCustomHalaqaTypes([{ id: `custom_${Date.now()}`, name: '', count: 1, color: '#8B4513' }]);
        } else {
            saveCustomHalaqaTypes(remaining);
        }
    };

    const [halaqaConfig, setHalaqaConfig] = useState<{
        width: number;
        height: number;
        unit: 'mm' | 'cm' | 'in';
    }>({
        width: 148,
        height: 210,
        unit: 'mm'
    });
    const [halaqaPreviewIndex, setHalaqaPreviewIndex] = useState(0);
    const [halaqaPreviewUrl, setHalaqaPreviewUrl] = useState<string>('');

    const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'excel'>('students');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedStage, setSelectedStage] = useState<string[]>([]);
    const [targetSearch, setTargetSearch] = useState('');
    const [stageSearch, setStageSearch] = useState('');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [excelData, setExcelData] = useState<{id: string, name: string}[]>([]);
    
    const [stageColors, setStageColors] = useState<Record<string, string>>({});
    const [hasSavedColors, setHasSavedColors] = useState(false);
    const [appLogo, setAppLogo] = useState<HTMLImageElement | null>(null);
    const [awqafLogo, setAwqafLogo] = useState<HTMLImageElement | null>(null);
    const [dynamicPreviewUrl, setDynamicPreviewUrl] = useState<string>('');

    // List of Halaqa items for Halaqa Cards
    const allHalaqaItems = useMemo<UnifiedHalaqaCardItem[]>(() => {
        const items: UnifiedHalaqaCardItem[] = [];

        const getTeacherName = (tId?: number) => {
            if (!tId) return '';
            const u = users.find(user => Number(user.id) === Number(tId));
            return u ? u.name : '';
        };

        const extractNumber = (name: string, fallbackId: number) => {
            const match = name.match(/\d+/);
            if (match) return match[0];
            return String(fallbackId);
        };

        halaqas.forEach(h => {
            const numStr = extractNumber(h.name, h.id);
            items.push({
                id: `mem_${h.id}`,
                originalId: h.id,
                name: h.name,
                type: 'memorization',
                typeName: 'حلقة حفظ',
                numberStr: numStr,
                teacherName: getTeacherName(h.teacherId),
                color: memorizationColor
            });
        });

        sardHalaqas.forEach(sh => {
            const numStr = extractNumber(sh.name, sh.id);
            items.push({
                id: `sard_${sh.id}`,
                originalId: sh.id,
                name: sh.name,
                type: 'sard',
                typeName: 'حلقة سرد',
                numberStr: numStr,
                teacherName: getTeacherName(sh.teacherId),
                color: sardColor
            });
        });

        // Add custom additional halaqa types (generated from 1 to count)
        customHalaqaTypes.forEach(ct => {
            const title = ct.name.trim();
            if (!title) return;
            const count = Math.max(1, Number(ct.count) || 1);
            const color = ct.color || '#8B4513';
            for (let n = 1; n <= count; n++) {
                items.push({
                    id: `custom_${ct.id}_${n}`,
                    originalId: n,
                    name: `${title} - رقم ${n}`,
                    type: `custom_${ct.id}`,
                    typeName: title,
                    numberStr: String(n),
                    teacherName: '',
                    color: color
                });
            }
        });

        return items;
    }, [halaqas, sardHalaqas, users, memorizationColor, sardColor, customHalaqaTypes]);

    const filteredHalaqaItems = useMemo(() => {
        let result = allHalaqaItems;
        if (halaqaFilter === 'memorization') {
            result = result.filter(item => item.type === 'memorization');
        } else if (halaqaFilter === 'sard') {
            result = result.filter(item => item.type === 'sard');
        } else if (halaqaFilter !== 'all') {
            result = result.filter(item => item.type === halaqaFilter);
        }
        return result;
    }, [allHalaqaItems, halaqaFilter]);

    const activeHalaqaTargets = useMemo(() => {
        const hasSpecificSelection = selectedHalaqaIds && selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('ALL') && !selectedHalaqaIds.includes('all');
        if (hasSpecificSelection) {
            return filteredHalaqaItems.filter(item => selectedHalaqaIds.includes(item.id));
        }
        return filteredHalaqaItems;
    }, [filteredHalaqaItems, selectedHalaqaIds]);

    const safeHalaqaPreviewIndex = useMemo(() => {
        if (activeHalaqaTargets.length === 0) return 0;
        return Math.min(halaqaPreviewIndex, activeHalaqaTargets.length - 1);
    }, [halaqaPreviewIndex, activeHalaqaTargets.length]);

    const [hasSavedCardConfig, setHasSavedCardConfig] = useState(() => !!localStorage.getItem('simpleCardConfig'));
    const [showNameColorPicker, setShowNameColorPicker] = useState(false);
    const [config, setConfig] = useState<CardConfig>(() => {
        let initialConfig = DEFAULT_CONFIG;
        if (cardConfig) {
            initialConfig = { ...DEFAULT_CONFIG, ...cardConfig };
        } else {
            const saved = localStorage.getItem('simpleCardConfig');
            if (saved) {
                try { initialConfig = { ...DEFAULT_CONFIG, ...JSON.parse(saved) }; } catch (e) { }
            }
        }
        // Auto-migrate old default Y position for landscape cards
        if (initialConfig.width === 85 && initialConfig.height === 54 && initialConfig.nameY === 35) {
            initialConfig.nameY = 39;
        }
        if (initialConfig.nameFontFamily === "'Amiri', serif" || initialConfig.nameFontFamily === "'Cairo', sans-serif" || !initialConfig.nameFontFamily) {
            initialConfig.nameFontFamily = "'Tajawal', 'Cairo', sans-serif";
        }
        initialConfig.awqafLogoCorner = 'top-right';
        return initialConfig;
    });

    const [exportMode, setExportMode] = useState<'single' | 'a4' | 'a3' | 'other'>('a4');
    const [selectedOtherPaper, setSelectedOtherPaper] = useState<string>('b1_press');
    const [isOtherPaperDropdownOpen, setIsOtherPaperDropdownOpen] = useState(false);
    const [customPaperWidth, setCustomPaperWidth] = useState<number>(70);
    const [customPaperHeight, setCustomPaperHeight] = useState<number>(100);
    const [customPaperUnit, setCustomPaperUnit] = useState<'cm' | 'mm' | 'in'>('cm');
    const [customPaperOrientation, setCustomPaperOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const otherPaperDropdownRef = useRef<HTMLDivElement>(null);

    const [pdfGaps, setPdfGaps] = useState<boolean>(() => {
        const isUserModified = localStorage.getItem('cards_pdf_gaps_user_set');
        if (isUserModified === 'true') {
            const saved = localStorage.getItem('cards_pdf_gaps');
            if (saved !== null) {
                try { return JSON.parse(saved); } catch (e) { }
            }
        }
        if (cardConfig && typeof cardConfig.pdfGaps === 'boolean' && cardConfig.pdfGapsExplicit) {
            return cardConfig.pdfGaps;
        }
        const savedConfig = localStorage.getItem('simpleCardConfig');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                if (typeof parsed.pdfGaps === 'boolean' && parsed.pdfGapsExplicit) return parsed.pdfGaps;
            } catch (e) { }
        }
        return false; // الافتراضي: عدم ترك مسافة بين البطاقات
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingList, setIsGeneratingList] = useState(false);

    const exportPdfList = async () => {
        setIsGeneratingList(true);
        try {
            const { sharePdfDirectly } = await import('../utils/exportPdf');
            const headers = [
                { key: 'sequence', label: 'م', type: 'text' },
                { key: 'name', label: 'الاسم', type: 'text' },
                { key: 'stageName', label: 'المرحلة', type: 'text' },
            ];
            
            const dataToExport = [];
            let currentStage = '';
            
            for (const target of activeTargets) {
                if (target.stage !== currentStage) {
                    currentStage = target.stage || '';
                    const stageColor = effectiveStageColors[currentStage] || '#059669';
                    
                    dataToExport.push({
                        sequence: `<div style="page-break-before: always; height: 0;"></div>`,
                        name: `<div style="color: ${stageColor}; font-weight: bold; font-size: 14px;">مستوى ${currentStage}</div>`,
                        stageName: '',
                    });
                }
                
                const stageColor = effectiveStageColors[target.stage || ''] || '#000000';
                dataToExport.push({
                    sequence: target.stageIndex,
                    name: target.name,
                    stageName: `<span style="color: ${stageColor}; font-weight: bold;">${target.stage}</span>`
                });
            }
            
            if (dataToExport.length > 0 && typeof dataToExport[0].sequence === 'string' && dataToExport[0].sequence.includes('page-break-before')) {
                 dataToExport[0].sequence = ''; // Prevent blank first page
            }

            await sharePdfDirectly(
                headers as any,
                dataToExport,
                "قائمة_البطاقات",
                "قائمة الأسماء لإصدار البطاقات",
                undefined,
                {},
                {},
                undefined,
                "portrait"
            );
        } catch (error) {
            console.error("Error generating list PDF:", error);
            showToast('❌ حدث خطأ أثناء تصدير القائمة');
        } finally {
            setIsGeneratingList(false);
        }
    };

    const imageRef = useRef<HTMLImageElement>(null);
    const printContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (otherPaperDropdownRef.current && !otherPaperDropdownRef.current.contains(e.target as Node)) {
                setIsOtherPaperDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const getOtherPaperDimensionsMM = () => {
        let wMM = 700;
        let hMM = 1000;
        if (selectedOtherPaper === 'custom') {
            const wVal = Number(customPaperWidth) || 10;
            const hVal = Number(customPaperHeight) || 10;
            if (customPaperUnit === 'cm') {
                wMM = wVal * 10;
                hMM = hVal * 10;
            } else if (customPaperUnit === 'in') {
                wMM = wVal * 25.4;
                hMM = hVal * 25.4;
            } else {
                wMM = wVal;
                hMM = hVal;
            }
        } else {
            const preset = OTHER_PAPER_PRESETS.find(p => p.id === selectedOtherPaper);
            if (preset) {
                wMM = preset.widthMM;
                hMM = preset.heightMM;
            }
        }

        if (customPaperOrientation === 'landscape') {
            return {
                width: Math.max(wMM, hMM),
                height: Math.min(wMM, hMM)
            };
        } else {
            return {
                width: Math.min(wMM, hMM),
                height: Math.max(wMM, hMM)
            };
        }
    };

    const currentOtherPaper = OTHER_PAPER_PRESETS.find(p => p.id === selectedOtherPaper) || OTHER_PAPER_PRESETS[0];

    const estimatedCardsPerPage = useMemo(() => {
        let docW = 210;
        let docH = 297;
        if (exportMode === 'a4') {
            docW = 210; docH = 297;
        } else if (exportMode === 'a3') {
            docW = 297; docH = 420;
        } else if (exportMode === 'single') {
            return 1;
        } else if (exportMode === 'other') {
            const dims = getOtherPaperDimensionsMM();
            docW = dims.width;
            docH = dims.height;
        }

        let cardW = config.width;
        let cardH = config.height;
        if (config.unit === 'cm') { cardW *= 10; cardH *= 10; }
        else if (config.unit === 'in') { cardW *= 25.4; cardH *= 25.4; }

        const gap = pdfGaps ? 5 : 0;
        const availW = Math.max(0, docW - 20);
        const availH = Math.max(0, docH - 20);
        const cols = Math.max(1, Math.floor((availW + gap) / (cardW + gap)));
        const rows = Math.max(1, Math.floor((availH + gap) / (cardH + gap)));
        return cols * rows;
    }, [exportMode, selectedOtherPaper, customPaperWidth, customPaperHeight, customPaperUnit, customPaperOrientation, config.width, config.height, config.unit, pdfGaps]);

    useEffect(() => {
        const saved = localStorage.getItem('stageColors');
        if (saved) {
            try { 
                const parsed = JSON.parse(saved);
                setStageColors(parsed); 
                if (Object.keys(parsed).length > 0) setHasSavedColors(true);
            } catch(e) {}
        }
        const i = new Image();
        i.src = '/logo.png';
        i.onload = () => setAppLogo(i);

        const awqaf = new Image();
        awqaf.src = '/awqaf_logo.png';
        awqaf.onload = () => setAwqafLogo(awqaf);
    }, []);

    const drawHalaqaCardOnCanvas = async (
        target: UnifiedHalaqaCardItem,
        canvas: HTMLCanvasElement,
        logoImg: HTMLImageElement | null,
        cardWMM: number = 148,
        cardHMM: number = 210
    ) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = 1000;
        const height = Math.round((cardHMM / cardWMM) * width);
        canvas.width = width;
        canvas.height = height;

        const baseColor = target.color || (target.type === 'memorization' ? memorizationColor : (target.type === 'sard' ? sardColor : '#8B4513'));

        // 1. Background Gradient
        const rgb = hexToRgb(baseColor) || { r: 5, g: 150, b: 105 };
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        
        const darkR = Math.max(0, Math.round(rgb.r * 0.4));
        const darkG = Math.max(0, Math.round(rgb.g * 0.4));
        const darkB = Math.max(0, Math.round(rgb.b * 0.4));

        gradient.addColorStop(0, `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
        gradient.addColorStop(0.55, `rgb(${Math.round(rgb.r * 0.75)}, ${Math.round(rgb.g * 0.75)}, ${Math.round(rgb.b * 0.75)})`);
        gradient.addColorStop(1, `rgb(${darkR}, ${darkG}, ${darkB})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // 2. Pattern Overlay
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = '#FFFFFF';
        const patternSize = 50;
        for (let x = 0; x < width; x += patternSize) {
            for (let y = 0; y < height; y += patternSize) {
                ctx.beginPath();
                ctx.arc(x + patternSize / 2, y + patternSize / 2, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();

        // 3. Radial Top Light
        ctx.save();
        const radialGlow = ctx.createRadialGradient(width / 2, height * 0.15, 10, width / 2, height * 0.15, width * 0.55);
        radialGlow.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
        radialGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = radialGlow;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        // 4. Golden Frame Border
        ctx.save();
        const margin = Math.round(width * 0.04);
        const frameW = width - margin * 2;
        const frameH = height - margin * 2;

        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = Math.round(width * 0.012);
        ctx.strokeRect(margin, margin, frameW, frameH);

        const innerMargin = margin + Math.round(width * 0.015);
        ctx.strokeStyle = '#F3E5AB';
        ctx.lineWidth = Math.round(width * 0.003);
        ctx.strokeRect(innerMargin, innerMargin, width - innerMargin * 2, height - innerMargin * 2);

        ctx.fillStyle = '#D4AF37';
        const corners = [
            [margin, margin],
            [margin + frameW, margin],
            [margin, margin + frameH],
            [margin + frameW, margin + frameH]
        ];
        corners.forEach(([cx, cy]) => {
            ctx.beginPath();
            ctx.arc(cx, cy, Math.round(width * 0.01), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        // 5. Program Logo ("مشروع إعداد حافظ") in Top Center Frame
        const logoRadius = Math.round(width * 0.13);
        const logoCenterX = width / 2;
        const logoCenterY = margin + Math.round(height * 0.12);

        if (logoImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(logoCenterX, logoCenterY, logoRadius + 6, 0, Math.PI * 2);
            ctx.fillStyle = '#D4AF37';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(logoCenterX, logoCenterY, logoRadius + 3, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(logoCenterX, logoCenterY, logoRadius, 0, Math.PI * 2);
            ctx.clip();

            const imgAspect = logoImg.width / logoImg.height;
            let drawW = logoRadius * 2;
            let drawH = drawW / imgAspect;
            if (drawH < logoRadius * 2) {
                drawH = logoRadius * 2;
                drawW = drawH * imgAspect;
            }
            ctx.drawImage(logoImg, logoCenterX - drawW / 2, logoCenterY - drawH / 2, drawW, drawH);
            ctx.restore();
        }

        // Program Title Under Logo
        ctx.save();
        ctx.font = 'bold 22px Cairo, Tajawal, sans-serif';
        ctx.fillStyle = '#FDF7E3';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 6;
        ctx.fillText('✦ مشروع إعداد حافظ ✦', logoCenterX, logoCenterY + logoRadius + 14);
        ctx.restore();

        // 6. Center Section - Halaqa Type Name and Number
        // Positioned comfortably below "✦ مشروع إعداد حافظ ✦" to eliminate any overlap
        const typeY = Math.round(height * 0.29);

        ctx.save();
        let typeFontSize = 50;
        ctx.font = `bold ${typeFontSize}px Tajawal, Cairo, sans-serif`;
        let textMetrics = ctx.measureText(target.typeName);
        while (textMetrics.width > width * 0.82 && typeFontSize > 22) {
            typeFontSize -= 2;
            ctx.font = `bold ${typeFontSize}px Tajawal, Cairo, sans-serif`;
            textMetrics = ctx.measureText(target.typeName);
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(target.typeName, width / 2, typeY);
        ctx.restore();

        // Divider Line (neatly spaced under type name)
        const lineY = typeY + 44;
        ctx.save();
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 160, lineY);
        ctx.lineTo(width / 2 + 160, lineY);
        ctx.stroke();

        ctx.fillStyle = '#D4AF37';
        ctx.beginPath();
        ctx.arc(width / 2, lineY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Bottom Ornamentation Y coordinate
        const bottomOrnamentY = height - margin - 20;

        // Number Badge - Extra Large Central Circle (Centered vertically and horizontally with maximum diameter)
        ctx.save();
        const availableVertical = bottomOrnamentY - lineY;
        const numY = Math.round(lineY + availableVertical / 2);
        // Circle radius 405px (810px diameter) maximizes the space between divider line and bottom ornament
        const circleRadius = 405;

        // Shadow for depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 10;

        // Circle Background
        ctx.beginPath();
        ctx.arc(width / 2, numY, circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.fill();

        // Remove shadow for clean crisp borders & text
        ctx.shadowColor = 'transparent';

        // Outer Golden Border
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#D4AF37';
        ctx.stroke();

        // Inner Subtle Golden Ring
        ctx.beginPath();
        ctx.arc(width / 2, numY, circleRadius - 15, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.8)';
        ctx.stroke();

        // Number Text Inside Circle - Maximized to the largest possible size taking up the full circle interior
        const numStr = target.numberStr.trim();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        let fontSize = 720;
        if (numStr.length === 1) {
            fontSize = 780;
        } else if (numStr.length === 2) {
            fontSize = 640;
        } else if (numStr.length === 3) {
            fontSize = 440;
        } else {
            fontSize = 320;
        }

        // Inner safe radius from the gold ring
        const safeInnerRadius = circleRadius - 15 - 10; // ~380px radius
        while (fontSize > 100) {
            ctx.font = `900 ${fontSize}px Tajawal, Cairo, Arial, sans-serif`;
            const metrics = ctx.measureText(numStr);
            const textWidth = metrics.width;
            
            // In center alignment, text extends halfWidth to the left and right
            const halfW = textWidth / 2;
            let halfH = fontSize * 0.36;
            if (metrics.actualBoundingBoxAscent !== undefined && metrics.actualBoundingBoxDescent !== undefined) {
                halfH = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) / 2;
            }

            // Since digits inside circles have curved/slanted silhouettes, check horizontal, vertical, and corner bounds
            const cornerDist = Math.sqrt((halfW * 0.70) ** 2 + (halfH * 0.70) ** 2);
            if (halfW <= safeInnerRadius * 0.95 && halfH <= safeInnerRadius * 0.95 && cornerDist <= safeInnerRadius) {
                break;
            }
            fontSize -= 4;
        }

        ctx.font = `900 ${fontSize}px Tajawal, Cairo, Arial, sans-serif`;
        ctx.fillStyle = getDarkToneFromBaseColor(baseColor);
        ctx.textAlign = 'center';

        // Optical centering: place the number in the EXACT center of the circle vertically and horizontally
        const finalMetrics = ctx.measureText(numStr);
        if (finalMetrics.actualBoundingBoxAscent !== undefined && finalMetrics.actualBoundingBoxDescent !== undefined) {
            ctx.textBaseline = 'alphabetic';
            const opticalY = numY + (finalMetrics.actualBoundingBoxAscent - finalMetrics.actualBoundingBoxDescent) / 2;
            ctx.fillText(numStr, width / 2, opticalY);
        } else {
            ctx.textBaseline = 'middle';
            ctx.fillText(numStr, width / 2, numY);
        }
        ctx.restore();

        // 8. Bottom Ornamentation
        ctx.save();
        ctx.fillStyle = 'rgba(212, 175, 55, 0.85)';
        ctx.font = '18px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❖  ❖  ❖', width / 2, bottomOrnamentY);
        ctx.restore();
    };

    useEffect(() => {
        if (mainTab !== 'halaqa_cards') return;
        if (activeHalaqaTargets.length === 0) {
            setHalaqaPreviewUrl('');
            return;
        }
        const currentItem = activeHalaqaTargets[safeHalaqaPreviewIndex];
        if (!currentItem) return;

        const canvas = document.createElement('canvas');
        drawHalaqaCardOnCanvas(currentItem, canvas, appLogo, halaqaConfig.width, halaqaConfig.height)
            .then(() => {
                setHalaqaPreviewUrl(canvas.toDataURL('image/png'));
            })
            .catch(err => {
                console.error('Error drawing halaqa card preview:', err);
            });
    }, [mainTab, activeHalaqaTargets, safeHalaqaPreviewIndex, appLogo, halaqaConfig, memorizationColor, sardColor, customHalaqaTypes]);

    const generateHalaqaPDF = async () => {
        if (activeHalaqaTargets.length === 0) {
            showToast('⚠️ لا توجد حلقات محددة لإصدار البطاقات');
            return;
        }

        setIsGenerating(true);
        try {
            const { jsPDF } = await import('jspdf');

            let docW = 210;
            let docH = 297;
            let pdfOrientation: 'portrait' | 'landscape' = 'portrait';

            if (exportMode === 'a4') {
                docW = 210; docH = 297; pdfOrientation = 'portrait';
            } else if (exportMode === 'a3') {
                docW = 297; docH = 420; pdfOrientation = 'portrait';
            } else if (exportMode === 'single') {
                docW = halaqaConfig.width;
                docH = halaqaConfig.height;
                if (halaqaConfig.unit === 'cm') { docW *= 10; docH *= 10; }
                else if (halaqaConfig.unit === 'in') { docW *= 25.4; docH *= 25.4; }
                pdfOrientation = docW > docH ? 'landscape' : 'portrait';
            } else if (exportMode === 'other') {
                const dims = getOtherPaperDimensionsMM();
                docW = dims.width;
                docH = dims.height;
                pdfOrientation = customPaperOrientation;
            }

            const pdf = new jsPDF({
                orientation: pdfOrientation,
                unit: 'mm',
                format: exportMode === 'single' ? [docW, docH] : (exportMode === 'other' ? [docW, docH] : exportMode as any)
            });

            let cardWMM = halaqaConfig.width;
            let cardHMM = halaqaConfig.height;
            if (halaqaConfig.unit === 'cm') { cardWMM *= 10; cardHMM *= 10; }
            else if (halaqaConfig.unit === 'in') { cardWMM *= 25.4; cardHMM *= 25.4; }

            if (exportMode === 'single') {
                const canvas = document.createElement('canvas');
                for (let i = 0; i < activeHalaqaTargets.length; i++) {
                    if (i > 0) pdf.addPage([cardWMM, cardHMM], cardWMM > cardHMM ? 'landscape' : 'portrait');
                    await drawHalaqaCardOnCanvas(activeHalaqaTargets[i], canvas, appLogo, halaqaConfig.width, halaqaConfig.height);
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    pdf.addImage(imgData, 'JPEG', 0, 0, cardWMM, cardHMM);
                }
            } else {
                const gap = pdfGaps ? 5 : 0;
                const marginX = 10;
                const marginY = 10;
                const cols = Math.max(1, Math.floor((docW - marginX * 2 + gap) / (cardWMM + gap)));
                const rows = Math.max(1, Math.floor((docH - marginY * 2 + gap) / (cardHMM + gap)));
                const cardsPerPage = cols * rows;

                const startX = (docW - (cols * cardWMM + (cols - 1) * gap)) / 2;
                const startY = (docH - (rows * cardHMM + (rows - 1) * gap)) / 2;

                const canvas = document.createElement('canvas');

                for (let i = 0; i < activeHalaqaTargets.length; i++) {
                    if (i > 0 && i % cardsPerPage === 0) {
                        pdf.addPage(exportMode === 'other' ? [docW, docH] : exportMode as any, pdfOrientation);
                    }

                    const pageIndex = i % cardsPerPage;
                    const col = pageIndex % cols;
                    const row = Math.floor(pageIndex / cols);

                    const x = startX + col * (cardWMM + gap);
                    const y = startY + row * (cardHMM + gap);

                    await drawHalaqaCardOnCanvas(activeHalaqaTargets[i], canvas, appLogo, halaqaConfig.width, halaqaConfig.height);
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    pdf.addImage(imgData, 'JPEG', x, y, cardWMM, cardHMM);
                }
            }

            pdf.save('بطاقات_الحلقات.pdf');
            showToast('✅ تم إنشاء وتنزيل ملف PDF لبطاقات الحلقات بنجاح');
        } catch (err) {
            console.error('Error generating Halaqa PDF:', err);
            showToast('❌ حدث خطأ أثناء إصدار ملف PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStageColorChange = (stage: string, color: string | null) => {
        setStageColors(prev => {
            const newColors = { ...prev };
            if (color) newColors[stage] = color;
            else delete newColors[stage];
            return newColors;
        });
    };

    const getStudentDisplayStage = (st: any): string => {
        if (st.isAlAmeen) return 'طلاب الأمين';
        return st.schoolStage ? st.schoolStage.trim() : '';
    };

    const stages = useMemo(() => {
        const s = new Set<string>();
        students.forEach(st => {
            const stage = getStudentDisplayStage(st);
            if (stage) s.add(stage);
        });
        return Array.from(s).filter(Boolean).sort((a, b) => {
            if (a === 'طلاب الأمين') return -1;
            if (b === 'طلاب الأمين') return 1;
            const weightA = getStageWeight(a);
            const weightB = getStageWeight(b);
            if (weightA !== weightB) return weightA - weightB;
            return a.localeCompare(b, 'ar', { numeric: true });
        });
    }, [students]);

    // 1. حساب عدد الطلاب في كل مرحلة دراسية
    const stageStudentCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        students.forEach(st => {
            const stage = getStudentDisplayStage(st);
            if (stage) {
                counts[stage] = (counts[stage] || 0) + 1;
            }
        });
        return counts;
    }, [students]);

    // 2. ترتيب المراحل تنازلياً حسب عدد الطلاب (المرحلة الأكثر طلاباً أولاً)
    const stagesRankedByCount = useMemo(() => {
        return [...stages].sort((a, b) => {
            if (a === 'طلاب الأمين') return -1;
            if (b === 'طلاب الأمين') return 1;
            const countA = stageStudentCounts[a] || 0;
            const countB = stageStudentCounts[b] || 0;
            if (countB !== countA) {
                return countB - countA; // المرحلة الأكثر طلاباً أولاً
            }
            // في حال التساوي، الترتيب المعتمد للمراحل
            const weightA = getStageWeight(a);
            const weightB = getStageWeight(b);
            if (weightA !== weightB) return weightA - weightB;
            return a.localeCompare(b, 'ar', { numeric: true });
        });
    }, [stages, stageStudentCounts]);

    // 3. خريطة الألوان الافتراضية للمراحل حسب الترتيب المطلوب:
    // الأخضر (الأكبر عدداً) -> الأزرق -> البرتقالي -> البني -> البنفسجي -> ... -> الأحمر (الأخير)
    const defaultStageColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        stagesRankedByCount.forEach((st, rank) => {
            map[st] = DEFAULT_STAGE_COLORS[rank % DEFAULT_STAGE_COLORS.length];
        });
        return map;
    }, [stagesRankedByCount]);

    const effectiveStageColors = useMemo(() => {
        const map: Record<string, string> = {};
        stages.forEach((st, idx) => {
            if (stageColors[st]) {
                map[st] = stageColors[st];
            } else {
                map[st] = defaultStageColorMap[st] || getDefaultColorForStage(idx);
            }
        });
        // Preserve any custom stage color definitions that might not be in the current stages list
        Object.keys(stageColors).forEach(k => {
            if (!map[k]) map[k] = stageColors[k];
        });
        return map;
    }, [stages, stageColors, defaultStageColorMap]);

    const handleSaveColors = () => {
        localStorage.setItem('stageColors', JSON.stringify(effectiveStageColors));
        setStageColors(effectiveStageColors);
        setHasSavedColors(true);
        showToast('✅ تم حفظ تنسيق الألوان بنجاح');
    };

    const handleResetColors = () => {
        localStorage.removeItem('stageColors');
        setStageColors({});
        setHasSavedColors(false);
        showToast('✅ تم استعادة الألوان الافتراضية');
    };

    useEffect(() => {
        if (setCardConfig) setCardConfig(config);
    }, [config, setCardConfig]);

    const options = useMemo(() => {
        if (activeTab === 'students') {
            let result = [...students];
            const isAllStages = !selectedStage || selectedStage.length === 0 || selectedStage.includes('all') || selectedStage.includes('ALL') || (stages.length > 0 && selectedStage.length === stages.length);
            if (!isAllStages) {
                result = result.filter(s => {
                    const stage = getStudentDisplayStage(s);
                    return stage && selectedStage.includes(stage);
                });
            }

            // ترتيب الطلاب أولاً حسب المرحلة الدراسية، ثم حسب الترتيب الهجائي للاسم
            result.sort((a, b) => {
                const stageA = getStudentDisplayStage(a);
                const stageB = getStudentDisplayStage(b);

                if (stageA && stageB) {
                    const weightA = getStageWeight(stageA);
                    const weightB = getStageWeight(stageB);
                    if (weightA !== weightB) return weightA - weightB;
                    const stageCmp = stageA.localeCompare(stageB, 'ar', { numeric: true });
                    if (stageCmp !== 0) return stageCmp;
                } else if (stageA && !stageB) {
                    return -1;
                } else if (!stageA && stageB) {
                    return 1;
                }

                return (a.name || '').trim().localeCompare((b.name || '').trim(), 'ar', { numeric: true });
            });

            let currentStage = '';
            let currentStageIndex = 1;
            
            return result.map(s => {
                const stage = getStudentDisplayStage(s);
                if (stage !== currentStage) {
                    currentStage = stage;
                    currentStageIndex = 1;
                }
                const res = { id: s.id, name: s.name, stage, stageIndex: currentStageIndex };
                currentStageIndex++;
                return res;
            });
        } else if (activeTab === 'teachers') {
            return users
                .filter(u => u.role === UserRole.TEACHER)
                .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim(), 'ar', { numeric: true }))
                .map((t, idx) => ({ id: t.id, name: t.name, stage: null, stageIndex: idx + 1 }));
        } else {
            return excelData.map((e, idx) => ({...e, stage: null, stageIndex: idx + 1}));
        }
    }, [activeTab, students, users, excelData, selectedStage, stages.length]);

    const activeTargets = useMemo(() => {
        const hasSpecificSelection = selectedIds && selectedIds.length > 0 && !selectedIds.includes('ALL') && !selectedIds.includes('all');
        if (hasSpecificSelection) {
            return options.filter(o => selectedIds.includes(String(o.id)));
        }
        return options;
    }, [options, selectedIds]);

    const totalCardsCount = useMemo(() => {
        return activeTargets.length;
    }, [activeTargets]);

    const safePreviewIndex = useMemo(() => {
        if (activeTargets.length === 0) return 0;
        return Math.min(previewIndex, activeTargets.length - 1);
    }, [previewIndex, activeTargets.length]);

    const estimatedTotalSheets = useMemo(() => {
        if (totalCardsCount === 0) return 0;
        if (exportMode === 'single') return totalCardsCount;
        return Math.ceil(totalCardsCount / Math.max(1, estimatedCardsPerPage));
    }, [totalCardsCount, exportMode, estimatedCardsPerPage]);

    const formatSheetsCount = (sheets: number, cards: number) => {
        if (cards === 0) return '0 ورقة';
        let sheetsLabel = '';
        if (sheets === 1) sheetsLabel = 'ورقة واحدة';
        else if (sheets === 2) sheetsLabel = 'ورقتان';
        else if (sheets >= 3 && sheets <= 10) sheetsLabel = `${sheets} أوراق`;
        else sheetsLabel = `${sheets} ورقة`;

        let cardsLabel = '';
        if (cards === 1) cardsLabel = 'بطاقة واحدة';
        else if (cards === 2) cardsLabel = 'بطاقتان';
        else if (cards >= 3 && cards <= 10) cardsLabel = `${cards} بطاقات`;
        else cardsLabel = `${cards} بطاقة`;

        return `${sheetsLabel} (${cardsLabel})`;
    };

    useEffect(() => {
        setSelectedIds([]);
        setTargetSearch('');
        setStageSearch('');
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
        
        const currentTarget = activeTargets[safePreviewIndex];
        const stage = currentTarget?.stage;
        const baseColor = (stage && effectiveStageColors[stage]) || '#059669';
        
        let r = parseInt(baseColor.slice(1,3), 16) || 5;
        let g = parseInt(baseColor.slice(3,5), 16) || 150;
        let b = parseInt(baseColor.slice(5,7), 16) || 105;
        const darkerColor = "#" + Math.floor(r * 0.5).toString(16).padStart(2,'0') + Math.floor(g * 0.5).toString(16).padStart(2,'0') + Math.floor(b * 0.5).toString(16).padStart(2,'0');
        
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(1, darkerColor);
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 1. Subtle Islamic geometric background (Rub el Hizb overlay)
        ctx.save();
        ctx.lineWidth = canvas.width * 0.003;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        const starSize = canvas.width * 0.15;
        const drawStar = (x, y, size) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.beginPath();
            ctx.rect(-size/2, -size/2, size, size);
            ctx.stroke();
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.rect(-size/2, -size/2, size, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        };

        for(let i = -starSize; i < canvas.width + starSize; i += starSize * 1.4) {
            for(let j = -starSize; j < canvas.height + starSize; j += starSize * 1.4) {
                drawStar(i, j, starSize);
                drawStar(i + starSize*0.7, j + starSize*0.7, starSize * 0.5);
            }
        }
        ctx.restore();

        // 2. Elegant Arabesque Waves / Arches (Diagonal)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(canvas.width, 0);
        ctx.lineTo(canvas.width, canvas.height * 0.4);
        ctx.bezierCurveTo(canvas.width * 0.7, canvas.height * 0.6, 
                          canvas.width * 0.4, canvas.height * 0.4, 
                          0, canvas.height * 0.8);
        ctx.lineTo(0, canvas.height);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(canvas.width, canvas.height * 0.2);
        ctx.bezierCurveTo(canvas.width * 0.8, canvas.height * 0.2, 
                          canvas.width * 0.5, canvas.height * 0.6, 
                          0, canvas.height * 0.4);
        ctx.lineTo(0, canvas.height);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.8, 0);
        ctx.bezierCurveTo(canvas.width * 0.6, canvas.height * 0.3, 
                          canvas.width * 0.2, canvas.height * 0.1, 
                          0, canvas.height * 0.5);
        ctx.lineTo(0, 0);
        ctx.lineTo(canvas.width, 0);
        ctx.fillStyle = 'rgba(212, 175, 55, 0.06)';
        ctx.fill();
        ctx.restore();

        // 3. إضاءة إشعاعية قوية وناعمة في الزاوية العلوية اليمنى تتلاشى تدريجياً نحو وسط البطاقة
        ctx.save();
        const glowRadius1 = Math.hypot(canvas.width * 0.5, canvas.height * 0.5) * 1.25;
        const radialGlow1 = ctx.createRadialGradient(canvas.width, 0, 0, canvas.width, 0, glowRadius1);
        radialGlow1.addColorStop(0, 'rgba(255, 255, 255, 0.78)');     // إضاءة إشعاعية ساطعة في الزاوية العلوية اليمنى
        radialGlow1.addColorStop(0.12, 'rgba(255, 255, 255, 0.60)');
        radialGlow1.addColorStop(0.25, 'rgba(255, 255, 255, 0.42)');
        radialGlow1.addColorStop(0.42, 'rgba(255, 255, 255, 0.25)');
        radialGlow1.addColorStop(0.60, 'rgba(255, 255, 255, 0.13)');
        radialGlow1.addColorStop(0.78, 'rgba(255, 255, 255, 0.04)');  // حدود ناعمة جداً أثناء التلاشي باتجاه وسط البطاقة
        radialGlow1.addColorStop(0.92, 'rgba(255, 255, 255, 0.01)');
        radialGlow1.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');    // تلاشٍ كامل بانسيابية تامة
        ctx.fillStyle = radialGlow1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // لمعان زجاجي خفيف متناسق
        const subtleShine1 = ctx.createLinearGradient(0, canvas.height, canvas.width, 0);
        subtleShine1.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
        subtleShine1.addColorStop(0.35, 'rgba(255, 255, 255, 0.0)');
        subtleShine1.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = subtleShine1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        
        const borderWidth = canvas.width * 0.015;
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(borderWidth, borderWidth, canvas.width - borderWidth * 2, canvas.height - borderWidth * 2);
        
        ctx.lineWidth = borderWidth * 0.2;
        ctx.strokeRect(borderWidth * 1.5, borderWidth * 1.5, canvas.width - borderWidth * 3, canvas.height - borderWidth * 3);
        
        if (appLogo) {
            const logoSize = Math.min(canvas.width, canvas.height) * 0.35;
            const logoX = (canvas.width - logoSize) / 2;
            const logoY = canvas.height * 0.08;
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(appLogo, logoX, logoY, logoSize, logoSize);
            ctx.restore();
            
            ctx.beginPath();
            ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#D4AF37';
            ctx.lineWidth = Math.max(2, logoSize * 0.03);
            ctx.stroke();
            
            ctx.font = `800 ${logoSize * 0.17}px Cairo, Alexandria, Tajawal, "IBM Plex Sans Arabic", sans-serif`;
            ctx.fillStyle = '#D4AF37';
            ctx.textAlign = 'center';
            ctx.fillText('✦ مشروع إعداد حافظ ✦', canvas.width / 2, logoY + logoSize + logoSize * 0.2);
        }

        if (config.showAwqafLogo !== false && awqafLogo) {
            drawAwqafLogoOnCanvas(
                ctx,
                canvas.width,
                canvas.height,
                awqafLogo,
                config.awqafLogoCorner || 'top-right',
                config.awqafLogoBadge || 'white',
                config.awqafLogoSize || 22
            );
        }

        // 6. Serial number in the top left corner
        if (currentTarget?.stageIndex !== undefined) {
            ctx.save();
            const radius = canvas.width * 0.055;
            const padding = canvas.width * 0.03;
            // Since direction is RTL, top-left is x = radius + padding. 
            // If awqafLogo is top-left, we might want to move this or it might overlap. The request explicitly said "الزاوية العلوي اليسرى".
            const x = radius + padding;
            const y = radius + padding;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fill();
            ctx.lineWidth = radius * 0.15;
            ctx.strokeStyle = '#D4AF37'; // Golden border
            ctx.stroke();

            ctx.font = `bold ${radius * 0.9}px Arial, sans-serif`;
            const idCardBaseColor = (stage && effectiveStageColors[stage]) || config.nameColor || '#059669';
            ctx.fillStyle = getDarkToneFromBaseColor(idCardBaseColor);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(currentTarget.stageIndex.toString(), x, y + radius * 0.08);
            ctx.restore();
        }
        
        setDynamicPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
    }, [config.templateImage, config.width, config.height, activeTargets, safePreviewIndex, stageColors, effectiveStageColors, appLogo, awqafLogo, config.showAwqafLogo, config.awqafLogoCorner, config.awqafLogoBadge, config.awqafLogoSize]);

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
        }
    };

    const handlePdfGapsChange = (checked: boolean) => {
        setPdfGaps(checked);
        localStorage.setItem('cards_pdf_gaps', JSON.stringify(checked));
        localStorage.setItem('cards_pdf_gaps_user_set', 'true');
        setConfig(prev => ({ ...prev, pdfGaps: checked, pdfGapsExplicit: true }));
    };

    const saveAsDefault = () => {
        const configToSave = { ...config, pdfGaps, pdfGapsExplicit: true };
        localStorage.setItem('simpleCardConfig', JSON.stringify(configToSave));
        localStorage.setItem('cards_pdf_gaps', JSON.stringify(pdfGaps));
        localStorage.setItem('cards_pdf_gaps_user_set', 'true');
        setHasSavedCardConfig(true);
        if (setCardConfig) {
            setCardConfig(configToSave);
            setTimeout(() => {
                if (syncSettingsToCloud) syncSettingsToCloud();
            }, 500);
        }
        showToast('✅ تم حفظ الإعدادات كافتراضية');
    };
    
    const resetCardConfigToDefault = () => {
        localStorage.removeItem('simpleCardConfig');
        localStorage.removeItem('cards_pdf_gaps');
        localStorage.removeItem('cards_pdf_gaps_user_set');
        setConfig(DEFAULT_CONFIG);
        setPdfGaps(false);
        setHasSavedCardConfig(false);
        if (setCardConfig) {
            setCardConfig(null);
            setTimeout(() => {
                if (syncSettingsToCloud) syncSettingsToCloud();
            }, 500);
        }
        showToast('✅ تم استعادة الإعدادات الافتراضية');
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

    const generatePDF = async () => {
        const targets = activeTargets;

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

                let activeAwqafLogo = awqafLogo;
                if (!activeAwqafLogo && config.showAwqafLogo !== false) {
                    activeAwqafLogo = await new Promise<HTMLImageElement | null>((resolve) => {
                        const temp = new Image();
                        temp.crossOrigin = 'anonymous';
                        temp.src = '/awqaf_logo.png';
                        temp.onload = () => resolve(temp);
                        temp.onerror = () => resolve(null);
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

                let docFormat: any = 'a4';
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
                } else if (exportMode === 'other') {
                    const dims = getOtherPaperDimensionsMM();
                    docWidth = dims.width;
                    docHeight = dims.height;
                    docFormat = [Math.min(dims.width, dims.height), Math.max(dims.width, dims.height)] as any;
                }

                const isLandscape = docWidth > docHeight;
                const pdf = new jsPDF({
                    orientation: isLandscape ? 'landscape' : 'portrait',
                    unit: 'mm',
                    format: docFormat
                });

                docWidth = pdf.internal.pageSize.getWidth();
                docHeight = pdf.internal.pageSize.getHeight();

                let currentX = 0;
                let currentY = 0;
                const marginX = 10; 
                const marginY = 10;
                let firstPage = true;

                if (exportMode === 'a4' || exportMode === 'a3' || exportMode === 'other') {
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
                        const baseColor = (stage && effectiveStageColors[stage]) || '#059669';
                        
                        let r = parseInt(baseColor.slice(1,3), 16) || 5;
                        let g = parseInt(baseColor.slice(3,5), 16) || 150;
                        let b = parseInt(baseColor.slice(5,7), 16) || 105;
                        const darkerColor = "#" + Math.floor(r * 0.5).toString(16).padStart(2,'0') + Math.floor(g * 0.5).toString(16).padStart(2,'0') + Math.floor(b * 0.5).toString(16).padStart(2,'0');
                        
                        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                        grad.addColorStop(0, baseColor);
                        grad.addColorStop(1, darkerColor);
                        
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

// 1. Subtle Islamic geometric background (Rub el Hizb overlay)
                                        ctx.save();
                                        ctx.lineWidth = canvas.width * 0.003;
                                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
                                        const starSize = canvas.width * 0.15;
                                        const drawStar = (x, y, size) => {
                                            ctx.save();
                                            ctx.translate(x, y);
                                            ctx.beginPath();
                                            ctx.rect(-size/2, -size/2, size, size);
                                            ctx.stroke();
                                            ctx.rotate(Math.PI / 4);
                                            ctx.beginPath();
                                            ctx.rect(-size/2, -size/2, size, size);
                                            ctx.stroke();
                                            ctx.beginPath();
                                            ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
                                            ctx.stroke();
                                            ctx.restore();
                                        };
                                
                                        for(let i = -starSize; i < canvas.width + starSize; i += starSize * 1.4) {
                                            for(let j = -starSize; j < canvas.height + starSize; j += starSize * 1.4) {
                                                drawStar(i, j, starSize);
                                                drawStar(i + starSize*0.7, j + starSize*0.7, starSize * 0.5);
                                            }
                                        }
                                        ctx.restore();
                                
                                        // 2. Elegant Arabesque Waves / Arches (Diagonal)
                                        ctx.save();
                                        ctx.beginPath();
                                        ctx.moveTo(canvas.width, 0);
                                        ctx.lineTo(canvas.width, canvas.height * 0.4);
                                        ctx.bezierCurveTo(canvas.width * 0.7, canvas.height * 0.6, 
                                                          canvas.width * 0.4, canvas.height * 0.4, 
                                                          0, canvas.height * 0.8);
                                        ctx.lineTo(0, canvas.height);
                                        ctx.lineTo(canvas.width, canvas.height);
                                        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
                                        ctx.fill();
                                
                                        ctx.beginPath();
                                        ctx.moveTo(canvas.width, canvas.height * 0.2);
                                        ctx.bezierCurveTo(canvas.width * 0.8, canvas.height * 0.2, 
                                                          canvas.width * 0.5, canvas.height * 0.6, 
                                                          0, canvas.height * 0.4);
                                        ctx.lineTo(0, canvas.height);
                                        ctx.lineTo(canvas.width, canvas.height);
                                        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
                                        ctx.fill();
                                
                                        ctx.beginPath();
                                        ctx.moveTo(canvas.width * 0.8, 0);
                                        ctx.bezierCurveTo(canvas.width * 0.6, canvas.height * 0.3, 
                                                          canvas.width * 0.2, canvas.height * 0.1, 
                                                          0, canvas.height * 0.5);
                                        ctx.lineTo(0, 0);
                                        ctx.lineTo(canvas.width, 0);
                                        ctx.fillStyle = 'rgba(212, 175, 55, 0.06)';
                                        ctx.fill();
                                        ctx.restore();
                                
                                        // 3. إضاءة إشعاعية قوية وناعمة في الزاوية العلوية اليمنى تتلاشى تدريجياً نحو وسط البطاقة
                                        ctx.save();
                                        const glowRadius2 = Math.hypot(canvas.width * 0.5, canvas.height * 0.5) * 1.25;
                                        const radialGlow2 = ctx.createRadialGradient(canvas.width, 0, 0, canvas.width, 0, glowRadius2);
                                        radialGlow2.addColorStop(0, 'rgba(255, 255, 255, 0.78)');     // إضاءة إشعاعية ساطعة في الزاوية العلوية اليمنى
                                        radialGlow2.addColorStop(0.12, 'rgba(255, 255, 255, 0.60)');
                                        radialGlow2.addColorStop(0.25, 'rgba(255, 255, 255, 0.42)');
                                        radialGlow2.addColorStop(0.42, 'rgba(255, 255, 255, 0.25)');
                                        radialGlow2.addColorStop(0.60, 'rgba(255, 255, 255, 0.13)');
                                        radialGlow2.addColorStop(0.78, 'rgba(255, 255, 255, 0.04)');  // حدود ناعمة جداً أثناء التلاشي باتجاه وسط البطاقة
                                        radialGlow2.addColorStop(0.92, 'rgba(255, 255, 255, 0.01)');
                                        radialGlow2.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');    // تلاشٍ كامل بانسيابية تامة
                                        ctx.fillStyle = radialGlow2;
                                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                                        // لمعان زجاجي خفيف متناسق
                                        const subtleShine2 = ctx.createLinearGradient(0, canvas.height, canvas.width, 0);
                                        subtleShine2.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
                                        subtleShine2.addColorStop(0.35, 'rgba(255, 255, 255, 0.0)');
                                        subtleShine2.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
                                        ctx.fillStyle = subtleShine2;
                                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                                        ctx.restore();
                        
                        
                        const borderWidth = canvas.width * 0.015;
                        ctx.strokeStyle = '#D4AF37';
                        ctx.lineWidth = borderWidth;
                        ctx.strokeRect(borderWidth, borderWidth, canvas.width - borderWidth * 2, canvas.height - borderWidth * 2);
                        
                        ctx.lineWidth = borderWidth * 0.2;
                        ctx.strokeRect(borderWidth * 1.5, borderWidth * 1.5, canvas.width - borderWidth * 3, canvas.height - borderWidth * 3);
                        
                        if (appLogo) {
                            const logoSize = Math.min(canvas.width, canvas.height) * 0.35;
                            const logoX = (canvas.width - logoSize) / 2;
                            const logoY = canvas.height * 0.08;
                            
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                            ctx.closePath();
                            ctx.clip();
                            ctx.drawImage(appLogo, logoX, logoY, logoSize, logoSize);
                            ctx.restore();
                            
                            ctx.beginPath();
                            ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                            ctx.strokeStyle = '#D4AF37';
                            ctx.lineWidth = Math.max(2, logoSize * 0.03);
                            ctx.stroke();
                            
                            ctx.font = `800 ${logoSize * 0.17}px Cairo, Alexandria, Tajawal, "IBM Plex Sans Arabic", sans-serif`;
                            ctx.fillStyle = '#D4AF37';
                            ctx.textAlign = 'center';
                            ctx.fillText('✦ مشروع إعداد حافظ ✦', canvas.width / 2, logoY + logoSize + logoSize * 0.2);
                        }
                    }

                    if (config.showAwqafLogo !== false && activeAwqafLogo) {
                        drawAwqafLogoOnCanvas(
                            ctx,
                            canvas.width,
                            canvas.height,
                            activeAwqafLogo,
                            config.awqafLogoCorner || 'top-right',
                            config.awqafLogoBadge || 'white',
                            config.awqafLogoSize || 22
                        );
                    }

                    // 6. Serial number in the top left corner (for PDF export)
                    if (target?.stageIndex !== undefined) {
                        ctx.save();
                        const radius = canvas.width * 0.055;
                        const padding = canvas.width * 0.03;
                        const x = radius + padding;
                        const y = radius + padding;

                        ctx.beginPath();
                        ctx.arc(x, y, radius, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                        ctx.fill();
                        ctx.lineWidth = radius * 0.15;
                        ctx.strokeStyle = '#D4AF37'; // Golden border
                        ctx.stroke();

                        ctx.font = `bold ${radius * 0.9}px Arial, sans-serif`;
                        const idCardBaseColor = (target.stage && effectiveStageColors[target.stage]) || config.nameColor || '#059669';
                        ctx.fillStyle = getDarkToneFromBaseColor(idCardBaseColor);
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(target.stageIndex.toString(), x, y + radius * 0.08);
                        ctx.restore();
                    }

                    let fontSizePx = config.nameFontSize * 3.5277;
                    
                    ctx.font = `${config.nameItalic ? 'italic ' : ''}${config.nameBold ? 'bold ' : ''}${fontSizePx}px ${config.nameFontFamily}`;
                    ctx.fillStyle = config.nameColor;
                    ctx.textAlign = config.nameAlign;
                    ctx.textBaseline = 'middle';
                    ctx.direction = 'rtl';

                    const x = (config.nameX / config.width) * canvas.width;
                    const y = (config.nameY / config.height) * canvas.height;
                    
                    const maxTextWidth = canvas.width * 0.85;

                    const measuredName = ctx.measureText(target.name);
                    if (measuredName.width > maxTextWidth && measuredName.width > 0) {
                        const scale = maxTextWidth / measuredName.width;
                        fontSizePx = Math.max(8, fontSizePx * scale);
                        ctx.font = `${config.nameItalic ? 'italic ' : ''}${config.nameBold ? 'bold ' : ''}${fontSizePx}px ${config.nameFontFamily}`;
                    }

                    ctx.fillText(target.name, x, y);

                    if (config.nameUnderline) {
                        const metrics = ctx.measureText(target.name);
                        const textWidth = Math.min(metrics.width, maxTextWidth);
                        const lineY = y + (fontSizePx * 0.4);
                        
                        ctx.beginPath();
                        ctx.strokeStyle = config.nameColor;
                        ctx.lineWidth = Math.max(1, fontSizePx * 0.05);
                        
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
                        if (!firstPage) pdf.addPage([cardWidthMM, cardHeightMM], cardWidthMM > cardHeightMM ? 'landscape' : 'portrait');
                        pdf.addImage(imgData, 'JPEG', 0, 0, cardWidthMM, cardHeightMM);
                        firstPage = false;
                    } else {
                        const gap = pdfGaps ? 5 : 0;
                        if (currentX + cardWidthMM > docWidth - marginX && currentX !== marginX) {
                            currentX = marginX;
                            currentY += cardHeightMM + gap;
                        }
                        if (currentY + cardHeightMM > docHeight - marginY && currentY !== marginY) {
                            pdf.addPage(docFormat, isLandscape ? 'landscape' : 'portrait');
                            currentX = marginX;
                            currentY = marginY;
                        }
                        
                        pdf.addImage(imgData, 'JPEG', currentX, currentY, cardWidthMM, cardHeightMM);
                        
                        // faint border for cutting
                        pdf.setDrawColor(200, 200, 200);
                        pdf.setLineWidth(0.1);
                        pdf.rect(currentX, currentY, cardWidthMM, cardHeightMM);

                        currentX += cardWidthMM + gap;
                    }
                }

                let exportModeLabel = 'مفردة';
                if (exportMode === 'a4') exportModeLabel = 'A4';
                else if (exportMode === 'a3') exportModeLabel = 'A3';
                else if (exportMode === 'other') {
                    exportModeLabel = selectedOtherPaper === 'custom' 
                        ? `custom_${Math.round(docWidth)}x${Math.round(docHeight)}mm` 
                        : selectedOtherPaper;
                }
                const dimLabel = `h${config.height}${config.unit}_w${config.width}${config.unit}`;
                pdf.save(`cards_${exportModeLabel}_${dimLabel}.pdf`);
                showToast('✅ تم إنشاء البطاقات بنجاح');
            } catch (error) {
                console.error('Error generating PDF:', error);
                showToast('❌ حدث خطأ أثناء إنشاء البطاقات');
            } finally {
                setIsGenerating(false);
            }
        }, 100);
    };


    const movePosition = (dx: number, dy: number) => {
        setConfig(prev => ({
            ...prev,
            nameX: Math.max(0, Math.min(prev.width, prev.nameX + dx)),
            nameY: Math.max(0, Math.min(prev.height, prev.nameY + dy))
        }));
    };

    const resetNamePosition = () => {
        setConfig(prev => ({
            ...prev,
            nameX: (DEFAULT_CONFIG.nameX / DEFAULT_CONFIG.width) * prev.width,
            nameY: (DEFAULT_CONFIG.nameY / DEFAULT_CONFIG.height) * prev.height,
            nameAlign: 'center'
        }));
        showToast('📍 تم استعادة موضع الاسم الافتراضي');
    };

    return (

        <div className="space-y-6">
            {/* Header & Main Sub-tabs (البطاقات التعريفية | بطاقات الحلقات) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-emerald-50/50 dark:bg-gray-800/80 p-4 rounded-2xl border border-emerald-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">إصدار البطاقات</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">إصدار وتصميم البطاقات التعريفية للطلاب والمعلمين وبطاقات الحلقات</p>
                    </div>
                </div>

                <div className="flex bg-white dark:bg-gray-700 p-1 rounded-xl shadow-xs border border-gray-200 dark:border-gray-600 w-full md:w-auto">
                    <button 
                        onClick={() => setMainTab('id_cards')}
                        className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${mainTab === 'id_cards' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                    >
                        <CreditCard className="w-4 h-4" />
                        <span>البطاقات التعريفية</span>
                    </button>
                    <button 
                        onClick={() => setMainTab('halaqa_cards')}
                        className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${mainTab === 'halaqa_cards' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                    >
                        <Users className="w-4 h-4" />
                        <span>بطاقات الحلقات</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: ID CARDS (البطاقات التعريفية) */}
            {mainTab === 'id_cards' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                            <button 
                                onClick={() => setActiveTab('students')}
                                className={`px-6 py-2 rounded-md font-bold text-xs transition-colors ${activeTab === 'students' ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                            >
                                الطلاب
                            </button>
                            <button 
                                onClick={() => setActiveTab('teachers')}
                                className={`px-6 py-2 rounded-md font-bold text-xs transition-colors ${activeTab === 'teachers' ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                            >
                                المعلمين
                            </button>
                            <button 
                                onClick={() => setActiveTab('excel')}
                                className={`px-6 py-2 rounded-md font-bold text-xs transition-colors ${activeTab === 'excel' ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
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
                                    options={stages.map(s => ({ id: s, name: stageStudentCounts[s] ? `${s} (${stageStudentCounts[s]} طالب)` : s }))}
                                    selectedValues={selectedStage}
                                    onSelect={setSelectedStage}
                                    search={stageSearch}
                                    setSearch={setStageSearch}
                                    openDropdown={openDropdown}
                                    setOpenDropdown={setOpenDropdown}
                                    showColorPicker={true}
                                    colorMap={effectiveStageColors}
                                    onColorChange={handleStageColorChange}
                                    onSaveColorsClick={handleSaveColors}
                                    hasSavedColors={hasSavedColors}
                                    onResetColorsClick={handleResetColors}
                                    defaultColorPickerValue="#059669"
                                />
                            </div>
                        )}
                        <FilterItem 
                            id="targets" 
                            title={activeTab === 'students' ? 'اختر الطلاب' : activeTab === 'teachers' ? 'اختر المعلمين' : 'اختر الأسماء من الإكسل'}
                            options={options}
                            selectedValues={selectedIds}
                            onSelect={setSelectedIds}
                            search={targetSearch}
                            setSearch={setTargetSearch}
                            openDropdown={openDropdown}
                            setOpenDropdown={setOpenDropdown}
                        />

                        {/* مؤشر حالة التصفية النشطة */}
                        {((selectedStage.length > 0 && selectedStage.length !== stages.length && !selectedStage.includes('all') && !selectedStage.includes('ALL')) || (selectedIds.length > 0 && !selectedIds.includes('ALL') && !selectedIds.includes('all') && selectedIds.length !== options.length)) && (
                            <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between text-xs animate-fade-in">
                                <div className="flex items-center gap-1.5 text-green-800 dark:text-green-300 font-bold truncate">
                                    <span>🎯</span>
                                    <span>تم تصفية {activeTargets.length} {activeTab === 'students' ? 'طالب' : activeTab === 'teachers' ? 'معلم' : 'سجل'}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedIds([]);
                                        setSelectedStage([]);
                                        setPreviewIndex(0);
                                    }}
                                    className="text-[11px] text-red-600 dark:text-red-400 hover:underline font-bold shrink-0"
                                >
                                    إلغاء التصفية
                                </button>
                            </div>
                        )}

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
                            {hasSavedCardConfig ? (
                                <button 
                                    onClick={resetCardConfigToDefault}
                                    className="flex-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-red-100 dark:border-red-800"
                                >
                                    إلغاء حفظ التنسيق
                                </button>
                            ) : (
                                <button 
                                    onClick={saveAsDefault}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                                >
                                    حفظ التنسيق
                                </button>
                            )}
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
                            <div className="flex items-center justify-between mb-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only" checked={pdfGaps} onChange={(e) => handlePdfGapsChange(e.target.checked)} />
                                        <div className={`block w-10 h-6 rounded-full transition-colors ${pdfGaps ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${pdfGaps ? 'transform translate-x-4' : ''}`}></div>
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">ترك مسافة بين البطاقات</span>
                                </label>
                            </div>
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

                            {/* زر وقائمة أحجام الورق الأخرى والمطابع */}
                            <div className="relative" ref={otherPaperDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (exportMode !== 'other') {
                                            setExportMode('other');
                                            setIsOtherPaperDropdownOpen(true);
                                        } else {
                                            setIsOtherPaperDropdownOpen(prev => !prev);
                                        }
                                    }}
                                    className={`w-full p-2.5 rounded-lg border-2 flex items-center justify-between text-xs font-bold transition-all shadow-sm ${
                                        exportMode === 'other'
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 truncate text-right">
                                        <span className="p-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shrink-0">
                                            🖨️
                                        </span>
                                        <div className="truncate">
                                            <div className="truncate">
                                                {exportMode === 'other' ? (
                                                    <span>حجم مخصص: <strong className="text-green-800 dark:text-green-200">{currentOtherPaper.name}</strong></span>
                                                ) : (
                                                    'أحجام ورق أخرى ومقاسات المطابع...'
                                                )}
                                            </div>
                                            {exportMode === 'other' && currentOtherPaper.id !== 'custom' && (
                                                <div className="text-[10px] font-normal text-gray-500 dark:text-gray-400 truncate">
                                                    {currentOtherPaper.widthMM / 10} × {currentOtherPaper.heightMM / 10} سم • {currentOtherPaper.notes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {exportMode === 'other' && (
                                            <span className="text-[10px] bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded font-bold">
                                                مفعّل
                                            </span>
                                        )}
                                        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOtherPaperDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </button>

                                {/* القائمة المنسدلة للأحجام */}
                                {isOtherPaperDropdownOpen && (
                                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 text-xs">
                                        {/* مقاسات المطابع الكبيرة */}
                                        <div className="p-2">
                                            <div className="px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                                <span>🏭</span>
                                                <span>مقاسات المطابع الكبيرة والفرخ التجاري</span>
                                            </div>
                                            <div className="space-y-1 mt-1">
                                                {OTHER_PAPER_PRESETS.filter(p => p.category === 'press').map(preset => (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedOtherPaper(preset.id);
                                                            setExportMode('other');
                                                            setIsOtherPaperDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-right p-2 rounded-lg transition-colors flex items-center justify-between ${
                                                            exportMode === 'other' && selectedOtherPaper === preset.id
                                                                ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 font-bold border border-green-300 dark:border-green-700'
                                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="font-bold">{preset.name}</div>
                                                            <div className="text-[10px] text-gray-500 dark:text-gray-400">{preset.notes}</div>
                                                        </div>
                                                        {exportMode === 'other' && selectedOtherPaper === preset.id && (
                                                            <span className="text-green-600 dark:text-green-400 font-bold text-sm">✓</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* مقاسات معيارية إضافية */}
                                        <div className="p-2">
                                            <div className="px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                                                <span>📄</span>
                                                <span>مقاسات معيارية إضافية</span>
                                            </div>
                                            <div className="space-y-1 mt-1">
                                                {OTHER_PAPER_PRESETS.filter(p => p.category === 'standard').map(preset => (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedOtherPaper(preset.id);
                                                            setExportMode('other');
                                                            setIsOtherPaperDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-right p-2 rounded-lg transition-colors flex items-center justify-between ${
                                                            exportMode === 'other' && selectedOtherPaper === preset.id
                                                                ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 font-bold border border-green-300 dark:border-green-700'
                                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="font-bold">{preset.name}</div>
                                                            <div className="text-[10px] text-gray-500 dark:text-gray-400">{preset.notes}</div>
                                                        </div>
                                                        {exportMode === 'other' && selectedOtherPaper === preset.id && (
                                                            <span className="text-green-600 dark:text-green-400 font-bold text-sm">✓</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* نهاية القائمة المنسدلة: خيار مخصص يدوي */}
                                        <div className="p-2 bg-gray-50/70 dark:bg-gray-700/30">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedOtherPaper('custom');
                                                    setExportMode('other');
                                                    setIsOtherPaperDropdownOpen(false);
                                                }}
                                                className={`w-full text-right p-2.5 rounded-lg transition-colors flex items-center justify-between ${
                                                    exportMode === 'other' && selectedOtherPaper === 'custom'
                                                        ? 'bg-green-100 dark:bg-green-900/50 text-green-900 dark:text-green-100 font-bold border border-green-400 dark:border-green-600'
                                                        : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 border border-dashed border-gray-300 dark:border-gray-500'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">✍️</span>
                                                    <div>
                                                        <div className="font-bold text-green-800 dark:text-green-300">أخرى: حجم الورق يدوياً (الطول والعرض)</div>
                                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">إدخال مقاس الورقة المخصص وتحديد الوحدة</div>
                                                    </div>
                                                </div>
                                                {exportMode === 'other' && selectedOtherPaper === 'custom' && (
                                                    <span className="text-green-600 dark:text-green-400 font-bold text-sm">✓</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* لوحة إدخال الحجم يدوياً عند اختيار أخرى */}
                            {exportMode === 'other' && selectedOtherPaper === 'custom' && (
                                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-300 dark:border-green-700 space-y-2.5 shadow-sm">
                                    <div className="flex items-center justify-between text-xs font-bold text-green-800 dark:text-green-300 border-b border-gray-100 dark:border-gray-700 pb-1.5">
                                        <span className="flex items-center gap-1.5">
                                            <span>📐</span>
                                            <span>تحديد حجم الورقة يدوياً</span>
                                        </span>
                                        <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded font-bold">
                                            مخصص
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                                                العرض:
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                step="0.1"
                                                value={customPaperWidth}
                                                onChange={e => setCustomPaperWidth(Math.max(1, Number(e.target.value)))}
                                                onFocus={e => e.target.select()}
                                                className="w-full p-1.5 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                                                الطول (الارتفاع):
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                step="0.1"
                                                value={customPaperHeight}
                                                onChange={e => setCustomPaperHeight(Math.max(1, Number(e.target.value)))}
                                                onFocus={e => e.target.select()}
                                                className="w-full p-1.5 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                                                الوحدة:
                                            </label>
                                            <select
                                                value={customPaperUnit}
                                                onChange={e => setCustomPaperUnit(e.target.value as 'cm' | 'mm' | 'in')}
                                                className="w-full p-1.5 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold cursor-pointer"
                                            >
                                                <option value="cm">سم (cm)</option>
                                                <option value="mm">مم (mm)</option>
                                                <option value="in">بوصة (in)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-1 text-[11px]">
                                        <span className="font-bold text-gray-600 dark:text-gray-400">اتجاه الورقة:</span>
                                        <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-md">
                                            <button
                                                type="button"
                                                onClick={() => setCustomPaperOrientation('portrait')}
                                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                                                    customPaperOrientation === 'portrait'
                                                        ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                                }`}
                                            >
                                                طولي (عمودي)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCustomPaperOrientation('landscape')}
                                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                                                    customPaperOrientation === 'landscape'
                                                        ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                                }`}
                                            >
                                                عرضي (أفقي)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* اتجاه الورقة لأحجام المطابع الجاهزة */}
                            {exportMode === 'other' && selectedOtherPaper !== 'custom' && (
                                <div className="p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 flex items-center justify-between text-[11px] shadow-sm">
                                    <div className="text-gray-600 dark:text-gray-300">
                                        <span className="font-bold text-green-800 dark:text-green-300 ml-1">الاتجاه:</span>
                                        {customPaperOrientation === 'portrait' ? 'طولي (عمودي)' : 'عرضي (أفقي)'}
                                    </div>
                                    <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-md">
                                        <button
                                            type="button"
                                            onClick={() => setCustomPaperOrientation('portrait')}
                                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                                                customPaperOrientation === 'portrait'
                                                    ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm'
                                                    : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                        >
                                            عمودي
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCustomPaperOrientation('landscape')}
                                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                                                customPaperOrientation === 'landscape'
                                                    ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-300 shadow-sm'
                                                    : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                        >
                                            أفقي
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* سعة الورقة التقديرية */}
                            <div className="text-[11px] text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <span>السعة التقديرية للورقة:</span>
                                <span className="font-bold text-green-700 dark:text-green-300">
                                    {exportMode === 'single' ? 'بطاقة واحدة لكل صفحة' : `~ ${estimatedCardsPerPage} بطاقة / ورقة`}
                                </span>
                            </div>

                            {/* عدد الأوراق */}
                            <div className="text-[11px] text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <span>عدد الأوراق:</span>
                                <span className="font-bold text-blue-700 dark:text-blue-300">
                                    {formatSheetsCount(estimatedTotalSheets, totalCardsCount)}
                                </span>
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
                        
                        <button 
                            onClick={exportPdfList}
                            disabled={isGeneratingList || activeTargets.length === 0}
                            className="w-full bg-white dark:bg-gray-700 text-green-700 dark:text-green-300 border border-green-600 dark:border-green-500 px-4 py-3 rounded-xl font-bold hover:bg-green-50 dark:hover:bg-gray-600 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 mt-3"
                        >
                            {isGeneratingList ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-green-700 dark:text-green-300" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    جاري التصدير...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    تصدير قائمة الأسماء (PDF)
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-4">
                            <h4 className="font-bold text-sm sm:text-base text-gray-700 dark:text-gray-300">أبعاد الطباعة</h4>
                            <div className="flex items-center gap-1.5 sm:gap-4">
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <label className="text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-400">العرض:</label>
                                    <input type="number" value={config.width} onChange={e => setConfig(p => ({...p, width: Number(e.target.value)}))} onFocus={e => e.target.select()} className="w-12 sm:w-16 p-1 text-[10px] sm:text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <label className="text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-400">الطول:</label>
                                    <input type="number" value={config.height} onChange={e => setConfig(p => ({...p, height: Number(e.target.value)}))} onFocus={e => e.target.select()} className="w-12 sm:w-16 p-1 text-[10px] sm:text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <label className="text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-400">الوحدة:</label>
                                    <select value={config.unit} onChange={e => setConfig(p => ({...p, unit: e.target.value as any}))} className="p-1 text-[10px] sm:text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
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
                                <select value={config.nameFontFamily} onChange={e => setConfig(p => ({...p, nameFontFamily: e.target.value}))} className="p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold">
                                    <option value="'Cairo', sans-serif">كايرو (حديث)</option>
                                    <option value="'Alexandria', sans-serif">الإسكندرية (هندسي)</option>
                                    <option value="'Tajawal', sans-serif">تجوال (أنيق)</option>
                                    <option value="'IBM Plex Sans Arabic', sans-serif">IBM Plex العربي</option>
                                    <option value="'Amiri', serif">أميري (تقليدي)</option>
                                    <option value="Arial, sans-serif">Arial</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 border-r pr-4 dark:border-gray-600">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">الحجم:</label>
                                <input type="number" value={config.nameFontSize} onChange={e => setConfig(p => ({...p, nameFontSize: Number(e.target.value)}))} onFocus={e => e.target.select()} className="w-14 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>

                            <div className="flex items-center gap-2 border-r pr-4 dark:border-gray-600">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">اللون:</label>
                                <button onClick={() => setShowNameColorPicker(true)} className="w-6 h-6 rounded-full border border-gray-300 shadow-sm cursor-pointer focus:outline-none" style={{ backgroundColor: config.nameColor }} title="تغيير لون الخط" />
                            </div>

                            <div className="flex items-center gap-1 border-r pr-4 dark:border-gray-600">
                                <button onClick={() => setConfig(p => ({...p, nameBold: !p.nameBold}))} className={`p-1.5 rounded ${config.nameBold ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="عريض"><span className="font-bold text-gray-700 dark:text-gray-300">B</span></button>
                                <button onClick={() => setConfig(p => ({...p, nameItalic: !p.nameItalic}))} className={`p-1.5 rounded ${config.nameItalic ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="مائل"><span className="italic text-gray-700 dark:text-gray-300">I</span></button>
                                <button onClick={() => setConfig(p => ({...p, nameUnderline: !p.nameUnderline}))} className={`p-1.5 rounded ${config.nameUnderline ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="تسطير"><span className="underline text-gray-700 dark:text-gray-300">U</span></button>
                            </div>
                            
                            <div className="flex items-center gap-1 border-r pr-4 dark:border-gray-600">
                                <button onClick={() => setConfig(p => ({...p, nameAlign: 'right'}))} className={`p-1.5 rounded ${config.nameAlign === 'right' ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}><svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                                <button onClick={() => setConfig(p => ({...p, nameAlign: 'center'}))} className={`p-1.5 rounded ${config.nameAlign === 'center' ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}><svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg></button>
                                <button onClick={() => setConfig(p => ({...p, nameAlign: 'left'}))} className={`p-1.5 rounded ${config.nameAlign === 'left' ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}><svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M12 12h8m-8 6h16" /></svg></button>
                            </div>
                            <div className="flex items-center gap-2 border-r pr-4 dark:border-gray-600">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">الموضع:</label>
                                <div className="grid grid-cols-3 gap-0.5">
                                    <div />
                                    <button onClick={() => movePosition(0, -0.5)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors" title="أعلى">↑</button>
                                    <div />
                                    <button onClick={() => movePosition(0.5, 0)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors" title="يمين">→</button>
                                    <button onClick={() => movePosition(0, 0.5)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors" title="أسفل">↓</button>
                                    <button onClick={() => movePosition(-0.5, 0)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors" title="يسار">←</button>
                                </div>
                                <button
                                    type="button"
                                    onClick={resetNamePosition}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-gray-700 hover:bg-amber-100 dark:hover:bg-gray-600 text-amber-900 dark:text-amber-300 rounded border border-amber-200 dark:border-gray-600 text-[11px] font-bold transition-all shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
                                    title="استعادة موضع الاسم الافتراضي في المنتصف"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>استعادة الافتراضي</span>
                                </button>
                            </div>
                        </div>

                        {/* قسم شعار إدارة الأوقاف */}
                        <div className="mb-4 bg-gradient-to-l from-amber-50/70 to-emerald-50/60 dark:from-gray-700/60 dark:to-gray-700/40 p-3 rounded-lg border border-amber-200/80 dark:border-gray-600">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 p-1 border border-amber-300 dark:border-gray-500 flex items-center justify-center shadow-xs shrink-0">
                                        <img src="/awqaf_logo.png" alt="شعار الأوقاف" className="w-full h-auto object-contain" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">شعار إدارة الأوقاف على زاوية البطاقة</span>
                                        <span className="block text-[10px] text-gray-500 dark:text-gray-400">الشعار الرسمي معتمد في زاوية البطاقة التعريفية</span>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={config.showAwqafLogo !== false} 
                                        onChange={(e) => setConfig(p => ({ ...p, showAwqafLogo: e.target.checked }))} 
                                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                                    />
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">إظهار الشعار</span>
                                </label>
                            </div>

                            {config.showAwqafLogo !== false && (
                                <div className="mt-2.5 pt-2 border-t border-amber-200/60 dark:border-gray-600/70 flex items-center gap-3">
                                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 shrink-0">حجم الشعار:</label>
                                    <div className="flex items-center gap-1.5 flex-1">
                                        <button 
                                            type="button" 
                                            onClick={() => setConfig(p => ({ ...p, awqafLogoSize: 18 }))}
                                            className={`flex-1 py-1 px-1 rounded text-[11px] font-bold transition-colors ${(config.awqafLogoSize || 22) === 18 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50'}`}
                                        >
                                            صغير
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setConfig(p => ({ ...p, awqafLogoSize: 22 }))}
                                            className={`flex-1 py-1 px-1 rounded text-[11px] font-bold transition-colors ${(config.awqafLogoSize || 22) === 22 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50'}`}
                                        >
                                            متوسط
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setConfig(p => ({ ...p, awqafLogoSize: 28 }))}
                                            className={`flex-1 py-1 px-1 rounded text-[11px] font-bold transition-colors ${(config.awqafLogoSize || 22) === 28 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50'}`}
                                        >
                                            كبير
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair" style={{ aspectRatio: `${config.width}/${config.height}`, containerType: 'inline-size' }} onClick={handleImageClick}>
                            <img ref={imageRef} src={config.templateImage || dynamicPreviewUrl || undefined} alt="Template" className="w-full h-full object-fill pointer-events-none" />
                            
                            {/* شعار إدارة الأوقاف على زاوية المعاينة عند وجود قالب مخصص (بدون إطار وبخلفية شفافة تماماً) */}
                            {config.templateImage && config.showAwqafLogo !== false && (
                                <div 
                                    className="absolute pointer-events-none z-10 flex items-center justify-center"
                                    style={{
                                        width: `${config.awqafLogoSize || 22}%`,
                                        ...(config.awqafLogoCorner === 'top-left' ? { top: '5%', left: '3.5%' } :
                                            config.awqafLogoCorner === 'bottom-right' ? { bottom: '5%', right: '3.5%' } :
                                            config.awqafLogoCorner === 'bottom-left' ? { bottom: '5%', left: '3.5%' } :
                                            { top: '5%', right: '3.5%' })
                                    }}
                                >
                                    <img src="/awqaf_logo.png" alt="شعار إدارة الأوقاف" className="w-full h-auto object-contain pointer-events-none" />
                                </div>
                            )}
                            
                            <div 
                                className="absolute pointer-events-none z-10 ring-1 ring-red-500/50"
                                style={{
                                    top: `${(config.nameY / config.height) * 100}%`,
                                    ...(config.nameAlign === 'right' ? { right: `${((config.width - config.nameX) / config.width) * 100}%`, transform: 'translateY(-50%)' } : 
                                         config.nameAlign === 'left' ? { left: `${(config.nameX / config.width) * 100}%`, transform: 'translateY(-50%)' } : 
                                         { left: `${(config.nameX / config.width) * 100}%`, transform: 'translate(-50%, -50%)' }),
                                    color: config.nameColor,
                                    fontSize: (() => {
                                        const nameText = activeTargets.length > 0 ? activeTargets[safePreviewIndex]?.name || '' : 'الاسم للتجربة';
                                        const scale = nameText.length > 22 ? Math.max(0.65, 22 / nameText.length) : 1;
                                        const baseSize = config.nameFontSize * scale * 0.35277;
                                        const totalWidthMm = config.unit === 'cm' ? config.width * 10 : config.unit === 'in' ? config.width * 25.4 : config.width;
                                        return `${(baseSize / totalWidthMm) * 100}cqw`;
                                    })(),
                                    lineHeight: 1,
                                    whiteSpace: 'nowrap',
                                    maxWidth: '85%',
                                    fontFamily: config.nameFontFamily,
                                    fontWeight: config.nameBold ? 'bold' : 'normal',
                                    fontStyle: config.nameItalic ? 'italic' : 'normal',
                                    direction: 'rtl'
                                }}
                            >
                                {activeTargets.length > 0 ? activeTargets[safePreviewIndex]?.name : 'الاسم للتجربة'}
                                
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
                                    top: `${(config.nameY / config.height) * 100}%`,
                                    ...(config.nameAlign === 'right' ? { right: `${((config.width - config.nameX) / config.width) * 100}%`, transform: 'translate(50%, -50%)' } : 
                                         config.nameAlign === 'left' ? { left: `${(config.nameX / config.width) * 100}%`, transform: 'translate(-50%, -50%)' } : 
                                         { left: `${(config.nameX / config.width) * 100}%`, transform: 'translate(-50%, -50%)' })
                            }}></div>
                        </div>
                        
                        <div className="mt-4 flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded-lg border border-gray-100 dark:border-gray-600">
                            <button 
                                onClick={() => setPreviewIndex(p => Math.max(0, p - 1))}
                                disabled={safePreviewIndex === 0 || activeTargets.length === 0}
                                className="p-2 text-gray-500 hover:text-green-600 disabled:opacity-50"
                            >
                                السابق
                            </button>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                معاينة: {activeTargets.length > 0 ? safePreviewIndex + 1 : 0} / {activeTargets.length}
                            </span>
                            <button 
                                onClick={() => setPreviewIndex(p => Math.min(activeTargets.length - 1, p + 1))}
                                disabled={safePreviewIndex >= activeTargets.length - 1 || activeTargets.length === 0}
                                className="p-2 text-gray-500 hover:text-green-600 disabled:opacity-50"
                            >
                                التالي
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        )}

            {/* TAB 2: HALAQA CARDS (بطاقات الحلقات) */}
            {mainTab === 'halaqa_cards' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Filters & Export Controls */}
                        <div className="lg:col-span-1 space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            {/* 1. Filter by Halaqa Type */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                                    <Palette className="w-4 h-4 text-emerald-600" />
                                    تصفية وتحديد الحلقات:
                                </h4>
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => { setHalaqaFilter('all'); setSelectedHalaqaIds([]); setHalaqaPreviewIndex(0); }}
                                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border text-center ${halaqaFilter === 'all' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100'}`}
                                    >
                                        الكل ({allHalaqaItems.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setHalaqaFilter('memorization'); setSelectedHalaqaIds([]); setHalaqaPreviewIndex(0); }}
                                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border text-center ${halaqaFilter === 'memorization' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100'}`}
                                    >
                                        الحفظ ({allHalaqaItems.filter(i => i.type === 'memorization').length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setHalaqaFilter('sard'); setSelectedHalaqaIds([]); setHalaqaPreviewIndex(0); }}
                                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border text-center ${halaqaFilter === 'sard' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100'}`}
                                    >
                                        السرد ({allHalaqaItems.filter(i => i.type === 'sard').length})
                                    </button>
                                    {customHalaqaTypes.filter(ct => ct.name.trim()).map(ct => {
                                        const count = allHalaqaItems.filter(i => i.type === `custom_${ct.id}`).length;
                                        const isSelected = halaqaFilter === `custom_${ct.id}`;
                                        return (
                                            <button
                                                key={ct.id}
                                                type="button"
                                                onClick={() => { setHalaqaFilter(`custom_${ct.id}`); setSelectedHalaqaIds([]); setHalaqaPreviewIndex(0); }}
                                                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border text-center flex items-center gap-1.5 ${isSelected ? 'bg-amber-700 text-white border-amber-700 shadow-sm' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100'}`}
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full inline-block border border-white/40 shadow-xs" style={{ backgroundColor: ct.color || '#8B4513' }} />
                                                <span>{ct.name}</span>
                                                <span>({count})</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Color Settings per Type */}
                                <div className="p-3 bg-emerald-50/60 dark:bg-gray-700/50 rounded-xl border border-emerald-100 dark:border-gray-600 space-y-2.5 mb-3">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">الألوان الافتراضية للبطاقات:</span>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">لون حلقات الحفظ:</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowMemColorPicker(true)}
                                                className="w-7 h-7 rounded-lg border border-gray-300 shadow-xs cursor-pointer focus:outline-none transition-transform hover:scale-105"
                                                style={{ backgroundColor: memorizationColor }}
                                                title="تغيير لون حلقات الحفظ"
                                            />
                                            <span className="text-[11px] font-mono text-gray-500 uppercase">{memorizationColor}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">لون حلقات السرد:</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowSardColorPicker(true)}
                                                className="w-7 h-7 rounded-lg border border-gray-300 shadow-xs cursor-pointer focus:outline-none transition-transform hover:scale-105"
                                                style={{ backgroundColor: sardColor }}
                                                title="تغيير لون حلقات السرد"
                                            />
                                            <span className="text-[11px] font-mono text-gray-500 uppercase">{sardColor}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Additional Halaqa Types */}
                                <div className="p-3 bg-amber-50/60 dark:bg-gray-700/50 rounded-xl border border-amber-200/80 dark:border-gray-600 space-y-3 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Layers className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                أنواع حلقات إضافية (مخصصة):
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                            تتولد بطاقاتها متسلسلة من 1 إلى العدد
                                        </span>
                                    </div>

                                    {/* List of custom halaqa types */}
                                    <div className="space-y-2">
                                        {customHalaqaTypes.map((customType) => (
                                            <div key={customType.id} className="p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-amber-100 dark:border-gray-600 shadow-xs space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 min-w-[110px]">
                                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block mb-0.5">نوع الحلقة:</label>
                                                        <input
                                                            type="text"
                                                            value={customType.name}
                                                            onChange={(e) => handleUpdateCustomType(customType.id, { name: e.target.value })}
                                                            placeholder="مثال: حلقات تعليم"
                                                            className="w-full px-2 py-1.5 text-xs font-bold border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-1 focus:ring-amber-500"
                                                        />
                                                    </div>
                                                    <div className="w-20">
                                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block mb-0.5">عدد الحلقات:</label>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={300}
                                                            value={customType.count === 0 ? '' : customType.count}
                                                            onChange={(e) => {
                                                                const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                                                handleUpdateCustomType(customType.id, { count: isNaN(val) ? 1 : val });
                                                            }}
                                                            onBlur={() => {
                                                                if (!customType.count || customType.count < 1) {
                                                                    handleUpdateCustomType(customType.id, { count: 1 });
                                                                }
                                                            }}
                                                            placeholder="1"
                                                            className="w-full px-2 py-1.5 text-xs font-bold text-center border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-1 focus:ring-amber-500"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block mb-0.5">اللون:</label>
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveCustomColorPickerId(customType.id)}
                                                            className="w-7 h-7 rounded-lg border border-gray-300 shadow-xs cursor-pointer focus:outline-none transition-transform hover:scale-105"
                                                            style={{ backgroundColor: customType.color || '#8B4513' }}
                                                            title="تغيير لون البطاقة (افتراضي بني)"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col justify-end pt-3.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCustomType(customType.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                                                            title="حذف هذا النوع"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Button to add another custom type - only appears when each current type has a name written */}
                                    {customHalaqaTypes.length > 0 && customHalaqaTypes.every(ct => ct.name.trim() !== '') && (
                                        <button
                                            type="button"
                                            onClick={handleAddCustomType}
                                            className="w-full py-2 px-3 border-2 border-dashed border-amber-300 dark:border-gray-500 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-gray-700/40 hover:bg-amber-100/60 transition-all flex items-center justify-center gap-1.5 active:scale-[0.99] animate-fade-in"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            إضافة نوع حلقة أخرى
                                        </button>
                                    )}
                                </div>

                                {/* FilterItem / Select Specific Halaqa */}
                                <div className="mb-4">
                                    <FilterItem
                                        id="halaqas_list"
                                        title="تحديد حلقات معينة (اختياري)"
                                        options={filteredHalaqaItems.map(item => ({
                                            id: item.id,
                                            name: `${item.typeName} - رقم ${item.numberStr} ${item.teacherName ? `(${item.teacherName})` : ''}`
                                        }))}
                                        selectedValues={selectedHalaqaIds}
                                        onSelect={setSelectedHalaqaIds}
                                        search={halaqaSearch}
                                        setSearch={setHalaqaSearch}
                                        openDropdown={openDropdown}
                                        setOpenDropdown={setOpenDropdown}
                                    />
                                </div>
                            </div>

                            {/* Print & Layout Options */}
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                    <Printer className="w-4 h-4 text-emerald-600" />
                                    إعدادات الطباعة والتصدير:
                                </h4>

                                <div>
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">تخطيط الورق:</label>
                                    <select
                                        value={exportMode}
                                        onChange={(e) => setExportMode(e.target.value as any)}
                                        className="w-full p-2 text-xs border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold"
                                    >
                                        <option value="a4">صفحة A4 (بطاقات متعددة)</option>
                                        <option value="a3">صفحة A3 (بطاقات متعددة)</option>
                                        <option value="single">بطاقة واحدة لكل صفحة (قياس بطاقة الحجم المخصص)</option>
                                        <option value="other">ورق قياس مخصص...</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">ترك مسافة بين البطاقات (5 مم):</label>
                                    <input
                                        type="checkbox"
                                        checked={pdfGaps}
                                        onChange={(e) => setPdfGaps(e.target.checked)}
                                        className="w-4 h-4 text-emerald-600 rounded accent-emerald-600 cursor-pointer"
                                    />
                                </div>

                                {/* PDF Generation Button */}
                                <button
                                    type="button"
                                    onClick={generateHalaqaPDF}
                                    disabled={isGenerating || activeHalaqaTargets.length === 0}
                                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Printer className="w-5 h-5" />
                                    <span>{isGenerating ? 'جاري الإصدار...' : `إصدار PDF (${activeHalaqaTargets.length} بطاقة)`}</span>
                                </button>
                            </div>
                        </div>

                        {/* Right Column: Card Preview Panel */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-amber-500" />
                                            معاينة بطاقات الحلقات
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            التصميم الافتراضي المعتمد لبطاقة الحلقة (148 × 210 مم) ببرنامج إعداد حافظ
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">القياس الافتراضي:</span>
                                        <span className="px-2.5 py-1 bg-amber-50 dark:bg-gray-700 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-gray-600 text-xs font-bold rounded-md">
                                            148 × 210 مم (A5)
                                        </span>
                                    </div>
                                </div>

                                {/* Size Customizer */}
                                <div className="mb-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 flex flex-wrap gap-4 items-center justify-between">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">أبعاد بطاقة الحلقة:</span>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5">
                                            <label className="text-xs text-gray-600 dark:text-gray-400 font-bold">العرض:</label>
                                            <input
                                                type="number"
                                                value={halaqaConfig.width}
                                                onChange={e => setHalaqaConfig(p => ({ ...p, width: Number(e.target.value) }))}
                                                onFocus={e => e.target.select()}
                                                className="w-16 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center font-bold"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <label className="text-xs text-gray-600 dark:text-gray-400 font-bold">الارتفاع:</label>
                                            <input
                                                type="number"
                                                value={halaqaConfig.height}
                                                onChange={e => setHalaqaConfig(p => ({ ...p, height: Number(e.target.value) }))}
                                                onFocus={e => e.target.select()}
                                                className="w-16 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center font-bold"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <label className="text-xs text-gray-600 dark:text-gray-400 font-bold">الوحدة:</label>
                                            <select
                                                value={halaqaConfig.unit}
                                                onChange={e => setHalaqaConfig(p => ({ ...p, unit: e.target.value as any }))}
                                                className="p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold"
                                            >
                                                <option value="mm">مم</option>
                                                <option value="cm">سم</option>
                                                <option value="in">بوصة</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Rendered Preview Canvas Area */}
                                <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-6 min-h-[420px] flex flex-col items-center justify-center relative shadow-inner overflow-hidden border border-gray-200 dark:border-gray-700">
                                    {halaqaPreviewUrl ? (
                                        <div className="relative group max-w-sm w-full flex items-center justify-center">
                                            <img
                                                src={halaqaPreviewUrl}
                                                alt="معاينة بطاقة الحلقة"
                                                className="max-h-[500px] w-auto object-contain rounded-lg shadow-2xl transition-transform duration-300"
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                                            <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-40" />
                                            <p className="text-sm font-bold">لا توجد حلقة محددة للمعاينة</p>
                                        </div>
                                    )}

                                    {/* Navigation controls for Preview */}
                                    {activeHalaqaTargets.length > 0 && (
                                        <div className="mt-6 flex items-center gap-4 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
                                            <button
                                                type="button"
                                                onClick={() => setHalaqaPreviewIndex(p => Math.max(0, p - 1))}
                                                disabled={safeHalaqaPreviewIndex <= 0}
                                                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg disabled:opacity-40 transition-colors"
                                            >
                                                السابق
                                            </button>
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 dir-rtl">
                                                معاينة: {safeHalaqaPreviewIndex + 1} / {activeHalaqaTargets.length}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setHalaqaPreviewIndex(p => Math.min(activeHalaqaTargets.length - 1, p + 1))}
                                                disabled={safeHalaqaPreviewIndex >= activeHalaqaTargets.length - 1}
                                                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg disabled:opacity-40 transition-colors"
                                            >
                                                التالي
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Download Image Action */}
                                {halaqaPreviewUrl && (
                                    <div className="mt-4 flex justify-end">
                                        <a
                                            href={halaqaPreviewUrl}
                                            download={`بطاقة_${activeHalaqaTargets[safeHalaqaPreviewIndex]?.typeName || 'حلقة'}_${activeHalaqaTargets[safeHalaqaPreviewIndex]?.numberStr || 'preview'}.png`}
                                            className="px-4 py-2 bg-emerald-50 dark:bg-gray-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-gray-600 rounded-lg text-xs font-bold border border-emerald-200 dark:border-gray-600 flex items-center gap-2 transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                            تنزيل صورة المعاينة (PNG)
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showNameColorPicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowNameColorPicker(false)}>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">اختر لون النص</h3>
                        <HexColorPicker color={config.nameColor} onChange={(color) => setConfig(p => ({...p, nameColor: color}))} />
                        <div className="w-full flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">HEX:</span>
                            <input 
                                type="text" 
                                value={config.nameColor} 
                                onChange={(e) => setConfig(p => ({...p, nameColor: e.target.value}))}
                                onFocus={e => e.target.select()}
                                className="w-full bg-transparent text-sm font-mono text-center text-gray-800 dark:text-gray-200 focus:outline-none uppercase"
                            />
                        </div>
                        <div className="flex gap-2 w-full">
                            <button onClick={() => setShowNameColorPicker(false)} className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold text-xs shadow-lg">تم</button>
                        </div>
                    </div>
                </div>
            )}

            {showMemColorPicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowMemColorPicker(false)}>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">اختر لون بطاقة حلقات الحفظ</h3>
                        <HexColorPicker color={memorizationColor} onChange={(color) => {
                            setMemorizationColor(color);
                            localStorage.setItem('halaqa_card_mem_color', color);
                        }} />
                        <div className="w-full flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">HEX:</span>
                            <input 
                                type="text" 
                                value={memorizationColor} 
                                onChange={(e) => {
                                    setMemorizationColor(e.target.value);
                                    localStorage.setItem('halaqa_card_mem_color', e.target.value);
                                }}
                                onFocus={e => e.target.select()}
                                className="w-full bg-transparent text-sm font-mono text-center text-gray-800 dark:text-gray-200 focus:outline-none uppercase"
                            />
                        </div>
                        <div className="flex gap-2 w-full">
                            <button onClick={() => setShowMemColorPicker(false)} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg">تم</button>
                        </div>
                    </div>
                </div>
            )}

            {showSardColorPicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSardColorPicker(false)}>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">اختر لون بطاقة حلقات السرد</h3>
                        <HexColorPicker color={sardColor} onChange={(color) => {
                            setSardColor(color);
                            localStorage.setItem('halaqa_card_sard_color', color);
                        }} />
                        <div className="w-full flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">HEX:</span>
                            <input 
                                type="text" 
                                value={sardColor} 
                                onChange={(e) => {
                                    setSardColor(e.target.value);
                                    localStorage.setItem('halaqa_card_sard_color', e.target.value);
                                }}
                                onFocus={e => e.target.select()}
                                className="w-full bg-transparent text-sm font-mono text-center text-gray-800 dark:text-gray-200 focus:outline-none uppercase"
                            />
                        </div>
                        <div className="flex gap-2 w-full">
                            <button onClick={() => setShowSardColorPicker(false)} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg">تم</button>
                        </div>
                    </div>
                </div>
            )}

            {activeCustomColorPickerId && (() => {
                const currentCustomType = customHalaqaTypes.find(t => t.id === activeCustomColorPickerId);
                if (!currentCustomType) return null;
                const currentColor = currentCustomType.color || '#8B4513';
                const brownPresets = ['#8B4513', '#78350F', '#92400E', '#5D4037', '#6D4C41', '#A0522D', '#D97706', '#059669', '#2563EB', '#7C3AED'];

                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActiveCustomColorPickerId(null)}>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-fade-in max-w-xs w-full mx-4" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                اختر لون بطاقة {currentCustomType.name ? `"${currentCustomType.name}"` : 'الحلقات المخصصة'}
                            </h3>
                            <HexColorPicker 
                                color={currentColor} 
                                onChange={(color) => {
                                    handleUpdateCustomType(activeCustomColorPickerId, { color });
                                }} 
                            />
                            
                            {/* Preset color swatches */}
                            <div className="w-full">
                                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block mb-1.5 text-right">ألوان مقترحة:</span>
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {brownPresets.map(preset => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => handleUpdateCustomType(activeCustomColorPickerId, { color: preset })}
                                            className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 ${currentColor.toLowerCase() === preset.toLowerCase() ? 'ring-2 ring-amber-600 ring-offset-1 border-white' : 'border-gray-300'}`}
                                            style={{ backgroundColor: preset }}
                                            title={preset}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="w-full flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">HEX:</span>
                                <input 
                                    type="text" 
                                    value={currentColor} 
                                    onChange={(e) => {
                                        handleUpdateCustomType(activeCustomColorPickerId, { color: e.target.value });
                                    }}
                                    onFocus={e => e.target.select()}
                                    className="w-full bg-transparent text-sm font-mono text-center text-gray-800 dark:text-gray-200 focus:outline-none uppercase"
                                />
                            </div>
                            <div className="flex gap-2 w-full">
                                <button onClick={() => setActiveCustomColorPickerId(null)} className="flex-1 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold text-xs shadow-lg transition-colors">تم</button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
