
import { User, Halaqa, Student, Evaluation, UserRole, AttendanceStatus, AbsenceReason, EvaluationType, PerformanceLevel, PeriodicReviewStatus, MaghribAttendanceStatus } from './types';

export const QURAN_SURAHS: string[] = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج", "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس", "التكوير", "الإنفطار", "المطففين", "الإنشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس"
];

export const DEFAULT_APP_NAME = 'إعداد حافظ';
export const DEFAULT_MAGHRIB_PASSWORD = '123';

export const INITIAL_USERS: User[] = [
    { id: 1, name: 'مشرف عام', role: UserRole.SUPERVISOR, updatedAt: Date.now() },
];

export const MOCK_USERS: User[] = [
    { id: 1, name: 'مشرف عام', role: UserRole.SUPERVISOR, updatedAt: Date.now() },
    { id: 2, name: 'خالد محمد', role: UserRole.TEACHER, updatedAt: Date.now() },
    { id: 3, name: 'سالم علي', role: UserRole.TEACHER, updatedAt: Date.now() },
    { id: 4, name: 'عبدالله فهد', role: UserRole.TEACHER, updatedAt: Date.now() },
];

export const MOCK_HALAQAS: Halaqa[] = [
    { id: 1, name: 'حلقة 1', teacherId: 2, updatedAt: Date.now() },
    { id: 2, name: 'حلقة 2', teacherId: 3, updatedAt: Date.now() },
    { id: 3, name: 'حلقة 3', teacherId: 4, updatedAt: Date.now() },
    { id: 4, name: 'حلقة 4', teacherId: 2, updatedAt: Date.now() },
    { id: 5, name: 'حلقة 5', teacherId: 3, updatedAt: Date.now() },
];

const studentNames = [
    "محمد عبدالله", "عبدالرحمن خالد", "علي سعد", "فهد سليمان", "سلطان ناصر", "أحمد يوسف", "ياسر إبراهيم", "عمر وليد", "خالد فيصل", "سعود تركي",
    "عبدالعزيز منصور", "بدر جمال", "تركي فهد", "نواف محمد", "صالح علي", "ماجد أحمد", "راشد حمد", "سلمان عبدالعزيز", "مشاري خالد", "زياد عمر",
];

const NUM_HALAQAS_FOR_MOCK = 5;
const STUDENTS_PER_HALAQA = 4;
const TOTAL_MOCK_STUDENTS = NUM_HALAQAS_FOR_MOCK * STUDENTS_PER_HALAQA;

export const MOCK_STUDENTS: Student[] = studentNames.slice(0, TOTAL_MOCK_STUDENTS).map((name, index) => ({
    id: 100 + index,
    name: name,
    halaqaId: (index % NUM_HALAQAS_FOR_MOCK) + 1,
    updatedAt: Date.now()
}));

const generateMockEvaluations = (): Evaluation[] => {
    const evaluations: Evaluation[] = [];
    let evalId = 1000;
    for (const student of MOCK_STUDENTS) {
        const evaluation: Evaluation = {
            id: evalId++,
            studentId: student.id,
            halaqaId: student.halaqaId,
            weekNumber: 1,
            attendance: AttendanceStatus.PRESENT,
            evaluationType: EvaluationType.MEMORIZATION,
            pages: 2,
            surahs: ["الفاتحة"],
            performance: PerformanceLevel.EXCELLENT,
            updatedAt: Date.now(),
        };
        evaluations.push(evaluation);
    }
    return evaluations;
}

export const MOCK_EVALUATIONS: Evaluation[] = generateMockEvaluations();

export const DEFAULT_FAVICON_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%23006A4E' stroke='white' stroke-width='2'/%3E%3Ccircle cx='50' cy='50' r='32' fill='%23FBBF24' stroke='white' stroke-width='2'/%3E%3Ccircle cx='50' cy='50' r='16' fill='%23006A4E' stroke='white' stroke-width='2'/%3E%3E%3C/svg%3E";

export const REMEMBERED_LOGIN_PASSWORD_KEY = 'halaqaRememberedLoginPassword';
export const REMEMBER_ME_PREFERENCE_KEY = 'halaqaRememberMePreference';
export const CUSTOM_LOGO_KEY = 'halaqaCustomLogo';

export const translationMap: { [key: string]: string } = {
  [AttendanceStatus.PRESENT]: 'حاضر',
  [AttendanceStatus.ABSENT]: 'غائب',
  [AttendanceStatus.LATE]: 'متأخر',
  [AttendanceStatus.UNPREPARED]: 'غير حافظ',
  [AbsenceReason.WITH_EXCUSE]: 'بعذر',
  [AbsenceReason.WITHOUT_EXCUSE]: 'بدون عذر',
  [EvaluationType.MEMORIZATION]: 'حفظ',
  [EvaluationType.REVIEW]: 'مراجعة',
  [EvaluationType.DID_NOT_MEMORIZE]: 'غير مستعد',
  [PerformanceLevel.EXCELLENT]: 'ممتاز (بدون أخطاء)',
  [PerformanceLevel.ONE_ERROR]: 'جيد جداً (خطأ واحد)',
  [PerformanceLevel.TWO_ERRORS]: 'جيد جداً (خطأين)',
  [PerformanceLevel.THREE_ERRORS]: 'جيد (3 أخطاء)',
  [PerformanceLevel.FOUR_ERRORS]: 'جيد (4 أخطاء)',
  [PerformanceLevel.FIVE_ERRORS]: 'جيد (5 أخطاء)',
  [PerformanceLevel.MORE_THAN_FIVE_ERRORS]: 'لم يحفظ (أكثر من 5 أخطاء)',
  [PeriodicReviewStatus.COMMITTED]: 'ملتزم',
  [PeriodicReviewStatus.NOT_COMMITTED]: 'غير ملتزم',
  [PeriodicReviewStatus.NOT_ASSIGNED]: 'غير مكلف',
  [MaghribAttendanceStatus.ABSENT]: 'غائب',
  [MaghribAttendanceStatus.EXCUSED]: 'مستأذن',
  [MaghribAttendanceStatus.LATE]: 'متأخر',
  'not_recorded': 'لم يسجل',
};
