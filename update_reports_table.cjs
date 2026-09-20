const fs = require('fs');
let code = fs.readFileSync('components/ReportsTable.tsx', 'utf-8');

// Add prop interface
code = code.replace(
  'export const ReportsTable: React.FC = () => {',
  `export interface ReportsTableProps {
  subjectFilter?: 'quran' | 'mutoon';
}

export const ReportsTable: React.FC<ReportsTableProps> = ({ subjectFilter = 'quran' }) => {`
);

// Filter evaluations
code = code.replaceAll(
  'evaluations.filter(e => !e.isTest)',
  'evaluations.filter(e => !e.isTest && (subjectFilter === \'mutoon\' ? e.subject === \'mutoon\' : e.subject !== \'mutoon\'))'
);

// Also need to fix column headers and display for Mutoon
// "عدد الصفحات" -> "عدد الأبيات"
// "المقدار (الآيات)" -> "الأبيات"
// "السور" -> "المتون"

// Wait, the column definitions are dynamically mapped or statically? Let's check.
const targetHeaders = `  const allHeaders = useMemo(() => [
    { key: 'studentName', label: 'اسم الطالب' },
    { key: 'halaqaName', label: 'اسم الحلقة' },
    { key: 'teacherName', label: 'المعلم (حلقة)' },
    { key: 'weekNumber', label: 'الأسبوع' },
    { key: 'attendance', label: 'الحضور' },
    { key: 'absenceReason', label: 'سبب الغياب' },
    { key: 'evaluationType', label: 'نوع الإنجاز' },
    { key: 'pages', label: 'عدد الصفحات' },
    { key: 'ayahs', label: 'المقدار (الآيات)' },
    { key: 'surahs', label: 'السور' },
    { key: 'performance', label: 'الأداء' },
    { key: 'periodicReview', label: 'المراجعة الدورية' },
    { key: 'notes', label: 'ملاحظات' },
    { key: 'evaluatorName', label: 'المقيم (من أدخل التقييم)' },
    { key: 'evaluationDate', label: 'تاريخ الإدخال' },
    { key: 'studentOriginalHalaqaName', label: 'حلقة الطالب الأصلية' }
  ], []);`;

const newHeaders = `  const allHeaders = useMemo(() => [
    { key: 'studentName', label: 'اسم الطالب' },
    { key: 'halaqaName', label: 'اسم الحلقة' },
    { key: 'teacherName', label: 'المعلم (حلقة)' },
    { key: 'weekNumber', label: 'الأسبوع' },
    { key: 'attendance', label: 'الحضور' },
    { key: 'absenceReason', label: 'سبب الغياب' },
    { key: 'evaluationType', label: 'نوع الإنجاز' },
    { key: 'pages', label: subjectFilter === 'mutoon' ? 'عدد الأبيات' : 'عدد الصفحات' },
    { key: 'ayahs', label: subjectFilter === 'mutoon' ? 'الأبيات' : 'المقدار (الآيات)' },
    { key: 'surahs', label: subjectFilter === 'mutoon' ? 'المتون' : 'السور' },
    { key: 'performance', label: 'الأداء' },
    { key: 'periodicReview', label: 'المراجعة الدورية' },
    { key: 'notes', label: 'ملاحظات' },
    { key: 'evaluatorName', label: 'المقيم (من أدخل التقييم)' },
    { key: 'evaluationDate', label: 'تاريخ الإدخال' },
    { key: 'studentOriginalHalaqaName', label: 'حلقة الطالب الأصلية' }
  ], [subjectFilter]);`;

if (code.includes('const allHeaders = useMemo(() => [')) {
    // Regex replace to handle whitespace differences just in case
    code = code.replace(
      /const allHeaders = useMemo\(\(\) => \[\s*\{ key: 'studentName'[\s\S]*?\], \[\]\);/m,
      newHeaders
    );
}

fs.writeFileSync('components/ReportsTable.tsx', code, 'utf-8');
console.log('Updated ReportsTable component');
