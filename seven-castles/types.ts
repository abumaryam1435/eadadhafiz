export enum DailyAmount {
  QUARTER_PAGE = 'quarter_page',
  HALF_PAGE = 'half_page',
  ONE_PAGE = 'one_page',
  TWO_PAGES = 'two_pages',
  QUARTER_HIZB = 'quarter_hizb',
  THREE_PAGES = 'three_pages',
  FOUR_PAGES = 'four_pages',
  FIVE_PAGES = 'five_pages',
  JUZ_PER_PLAN = 'juz_per_plan',
}

export enum TaskType {
  MEMORIZATION = 'memorization',
  FIXATION = 'fixation',
  REVIEW = 'review',
  RECITATION = 'recitation',
  LISTENING = 'listening',
  CUMULATIVE_REVIEW = 'cumulative_review',
}

export interface VerseRange {
  surah: string;
  start: number;
  end: number;
}

export interface PageRange {
  start: number;
  end: number;
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  completed: boolean;
  targetCount: number;
  currentCount: number;
  pages?: number[];
  verseRanges?: VerseRange[];
}

export interface SevenCastlesPlan {
  id?: string | number;
  studentId?: string | number;
  studentName: string;
  name?: string;
  planType: 'memorization';
  isSevenCastles: true;
  juzNumber?: number;
  startPage: number;
  endPage: number;
  dailyAmount: DailyAmount;
  startDate: string; // 'YYYY-MM-DD'
  firstDayOfWeek: number; // 0 = الأحد ... 6 = السبت
  isSevenCastlesDescending: boolean;
  sevenCastlesStartMode: 'juz' | 'page';
  dailyFixationRepetitions: number; // تكرار التثبيت للحفظ الجديد (اليوم 1، 2، 4، 5) - الافتراضي 5
  weeklyReviewRepetitions: number; // تكرار التثبيت/المراجعة في اليوم 3 و 6 - الافتراضي 3
  hasOldMemorization: boolean;
  oldMemorizationRanges?: PageRange[]; // نطاقات الحفظ القديم للطالب (مثال: [{start: 1, end: 61}, {start: 502, end: 604}])
  oldMemorizedPages?: number[]; // الصفحات المفردة المحسوبة تلقائياً من النطاقات
  oldMemorizationReviewMode?: 'auto' | 'custom_days' | 'custom_amount';
  oldMemorizationCustomDays?: number;
  oldMemorizationCustomAmountType?: 'pages' | 'quarter_hizb' | 'juz';
  oldMemorizationCustomAmountValue?: number;
  status: 'active' | 'paused' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

export interface ProgressLog {
  id?: string | number;
  planId: string | number;
  date: string; // 'YYYY-MM-DD'
  tasks: Task[];
  note?: string;
}

export interface SevenCastlesPortionInfo {
  castleIndex: number;
  castleName: string;
  castleSummary?: string;
  portions: {
    portionIndex: number;
    memDay: number;
    desc: string;
    pages: number[];
  }[];
}
