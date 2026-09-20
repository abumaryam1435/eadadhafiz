export enum UserRole {
  SUPERVISOR = "supervisor",
  TEACHER = "teacher",
  MAGHRIB_ADMIN = "maghrib_admin",
}

export enum AttendanceStatus {
  PRESENT = "present",
  ABSENT = "absent",
  LATE = "late",
  UNPREPARED = "unprepared",
}

export enum MaghribAttendanceStatus {
  ABSENT = "maghrib_absent",
  EXCUSED = "maghrib_excused",
  LATE = "maghrib_late",
}

export enum AbsenceReason {
  WITH_EXCUSE = "with_excuse",
  WITHOUT_EXCUSE = "without_excuse",
}

export enum EvaluationType {
  MEMORIZATION = "memorization",
  REVIEW = "review",
  DID_NOT_MEMORIZE = "did_not_memorize",
}

export enum PerformanceLevel {
  EXCELLENT = "excellent",
  ONE_ERROR = "one_error",
  TWO_ERRORS = "two_errors",
  THREE_ERRORS = "3 أخطاء",
  FOUR_ERRORS = "4 أخطاء",
  FIVE_ERRORS = "5 أخطاء",
  MORE_THAN_FIVE_ERRORS = "more_than_five_errors",
}

export enum PeriodicReviewStatus {
  COMMITTED = "committed",
  NOT_COMMITTED = "not_committed",
  NOT_ASSIGNED = "not_assigned",
}

export interface User {
  id: number;
  name: string;
  role: UserRole;
  updatedAt?: number;
  canViewBehaviors?: boolean;
  behaviorsPassword?: string;
}

export interface Halaqa {
  id: number;
  name: string;
  teacherId: number;
  testTeacherId?: number;
  updatedAt?: number;
}

export interface Student {
  id: number;
  name: string;
  halaqaId: number;
  sardHalaqaId?: number; // حلقة السرد
  schoolStage?: string;
  parentPhone?: string; // هاتف ولي الأمر
  manualStudentLevel?: string;
  oldMemorizedPages?: string;
  updatedAt?: number;
  isAlAmeen?: boolean;
  isFromIbri?: boolean;
  useManualData?: boolean;
  manualSurahs?: string[];
  manualParts?: (number | string)[];
  manualSavedParts?: (number | string)[];
  manualLevel?: string;
}

export interface SardHalaqa {
  id: number;
  name: string;
  teacherId: number;
  updatedAt?: number;
}

export interface SardPageRange {
  fromPage: number;
  toPage: number;
}

export interface SardEvaluation {
  id: number;
  studentId: number;
  sardHalaqaId?: number;
  teacherId?: number;
  weekNumber?: number;
  date: string; // YYYY-MM-DD
  attendance?: AttendanceStatus;
  absenceReason?: AbsenceReason;
  juzList: number[]; // الأجزاء المختارة مثل [1, 2]
  pageRanges: SardPageRange[]; // نطاقات الصفحات
  surahs?: string[]; // السور المسردة (إن وجدت)
  pagesCount: number; // إجمالي عدد الصفحات المسردة
  hesitationErrors: number; // التشكيل (والتردد)
  fathErrors: number; // الفتح واللحن الجلي
  tajweedErrors: number; // التجويد واللحن الخفي
  totalErrors: number; // إجمالي الأخطاء
  grade: string; // التقدير (ممتاز مع الشرف | ممتاز | جيد جداً | ضعيف)
  performance?: string; // أداء إضافي إن وجد
  notes?: string;
  updatedAt: number;
}

export interface Evaluation {
  subject?: 'quran' | 'mutoon';
  linesCount?: number;
  matns?: string[];
  fromLine?: string | number;
  toLine?: string | number;
  id: number;
  studentId: number;
  halaqaId: number;
  teacherId?: number;
  weekNumber: number;
  attendance: AttendanceStatus;
  absenceReason?: AbsenceReason;
  evaluationType?: EvaluationType;
  pages?: number;
  fromAyah?: string | number;
  toAyah?: string | number;
  surahs?: string[];
  newMemorizedPages?: number[];
  evalFathErrors?: number;
  evalTashkeelErrors?: number;
  evalTajweedErrors?: number;
  performance?: PerformanceLevel;
  periodicReview?: PeriodicReviewStatus;
  notes?: string;
  evaluationDate?: string; // تاريخ التلقائي
  isTest?: boolean;
  testName?: string;
  testFathErrors?: number;
  testTashkeelErrors?: number;
  testTajweedErrors?: number;
  testPassageChanges?: number;
  testTotalScore?: number;
  testMaxScore?: number;
  evalStatus?: string;
  updatedAt: number;
}

export interface MaghribAttendance {
  id: number;
  studentId: number;
  weekNumber: number;
  status: MaghribAttendanceStatus;
  date?: string; // تاريخ يدوي/تلقائي
  time?: string; // وقت يدوي/تلقائي
  programType?: "maghrib" | "asr";
  updatedAt: number;
}

export interface DeletedItem {
  id: number;
  type: "student" | "halaqa" | "user" | "evaluation";
  timestamp: number;
}

export interface Suggestion {
  id: number;
  teacherId: number;
  teacherName: string;
  type: 'text' | 'voice';
  content?: string;
  audioUrl?: string; // Base64 audio string
  attachments?: { name: string; type: string; data: string }[]; // Base64 attachments
  createdAt: number;
  updatedAt?: number;
  reviewed?: boolean;
  teacherReadBy?: number[];
}

export interface StudentBehavior {
  id: number;
  studentId: number;
  studentName: string;
  teacherId: number;
  teacherName: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
  reviewed?: boolean;
  teacherReadBy?: number[];
}

export interface Matn {
  id: number;
  name: string;
  linesCount: number;
  linesText?: string;
  verses?: string[];
  isActive?: boolean; // تفعيل/إلغاء تفعيل المتن في التقييم
  updatedAt?: number;
}

export interface TestDeductions {
  fath: number;
  tashkeel: number;
  tajweed: number;
  passageChange?: number;
}

export interface NewStudentTest {
  id: number;
  studentName: string; // الاسم
  grade: string; // الصف / المرحلة الدراسية
  parentPhone: string; // رقم ولي الأمر
  teacherId: number; // المعلم المختبر
  teacherName?: string;
  testDate: string; // تاريخ الاختبار
  surahs?: string[]; // السور التي اختبر فيها
  pages?: number[]; // الصفحات
  fathErrors: number; // أخطاء الفتح
  tashkeelErrors: number; // أخطاء التشكيل
  tajweedErrors: number; // أخطاء التجويد
  score: number; // الدرجة المحصلة
  maxScore: number; // الدرجة الكلية للاختبار
  percentage: number; // النسبة المئوية
  passingRate: number; // نسبة القبول المحددة
  isPassed: boolean; // هل حقق نسبة القبول
  status: 'pending' | 'accepted' | 'rejected'; // حالة القبول
  createdStudentId?: number; // معرف الطالب بعد إدراجه في الطلاب
  notes?: string; // ملاحظات وتوصيات
  updatedAt?: number;
}

export interface FullBackupData {
  users: User[];
  halaqas: Halaqa[];
  students: Student[];
  evaluations: Evaluation[];
  sardHalaqas?: SardHalaqa[];
  sardEvaluations?: SardEvaluation[];
  maghribAttendances?: MaghribAttendance[];
  deletedItems?: DeletedItem[];
  suggestions?: Suggestion[];
  studentBehaviors?: StudentBehavior[];
  matns?: Matn[];
  newStudentTests?: NewStudentTest[];
  customLogo: string | null;
  supervisorPassword?: string;
  maghribPassword?: string;
  appName?: string;
  firebaseConfig?: any;
  configUpdatedAt?: number;
  isTestActive?: boolean;
  testScore?: number;
  testName?: string;
  testDeductions?: TestDeductions;
  isNewStudentTestActive?: boolean;
  newStudentTestScore?: number;
  newStudentPassingRate?: number;
  newStudentTestDeductions?: TestDeductions;
  lastUsedWeek?: number | null;
  isDistributable?: boolean;
  isPublishedConnected?: boolean;
  hijriAdjustments?: Record<string, number>;
  colorMap?: Record<string, string>;
  saveColors?: boolean;
  reportVisibleColumns?: string[];
  testReportVisibleColumns?: string[];
  rankColors?: Record<string, string>;
  manualRanks?: Record<string, number>;
  certificateConfig?: any;
  cardConfig?: any;
}

export interface DocumentCategory {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  createdAt: number;
}

export interface SupervisorDocument {
  id: string;
  title: string;
  categoryId: string;
  categoryName?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: number;
  updatedAt?: number;
  notes?: string;
  thumbnail?: string;
  blobKey: string;
  storageUrl?: string;
}

export type ScoreFilterMode = 
  | 'all'
  | 'gte'
  | 'gt'
  | 'lte'
  | 'lt'
  | 'between'
  | 'eq'
  | 'passed'
  | 'failed'
  | 'excellent'
  | 'very_good'
  | 'good'
  | 'no_score';

export interface ScoreFilterConfig {
  mode: ScoreFilterMode;
  val1?: number | string;
  val2?: number | string;
  targetTest?: string;
}


