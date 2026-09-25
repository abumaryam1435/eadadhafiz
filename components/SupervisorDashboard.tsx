
import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { ReportsTable } from './ReportsTable';
import { TestsReportTable } from './TestsReportTable';
import { SardReportsTable } from './SardReportsTable';
import DashboardStats from './DashboardStats';
import StudentManagement from './StudentManagement';
import { Settings } from './Settings'; 
import { OverviewTable } from './OverviewTable';
import { CertificatesManager } from './CertificatesManager';
import { CardsManager } from './CardsManager';
import { SupervisorSuggestionsView } from './SupervisorSuggestionsView';
import { DocumentsManager } from './DocumentsManager';
import { 
  FileText, 
  GraduationCap, 
  Users, 
  Lightbulb, 
  Award, 
  CreditCard, 
  Settings as SettingsIcon, 
  Database,
  BookOpen,
  ScrollText,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  Check,
  Compass,
  FolderOpen
} from 'lucide-react';

type View = 'reports' | 'testReports' | 'management' | 'documents' | 'suggestions' | 'certificates' | 'cards' | 'settings' | 'overview';

interface NavItemConfig {
  id: View;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  activeIconColor: string;
  iconBgLight: string;
  activeIconBgLight: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { 
    id: 'reports', 
    label: 'التقارير الرئيسة', 
    shortLabel: 'التقارير', 
    icon: FileText,
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    activeIconColor: 'text-white',
    iconBgLight: 'bg-emerald-100/90 dark:bg-emerald-950/60',
    activeIconBgLight: 'bg-white/20'
  },
  { 
    id: 'testReports', 
    label: 'تقارير الاختبارات', 
    shortLabel: 'الاختبارات', 
    icon: GraduationCap,
    iconColor: 'text-violet-700 dark:text-violet-400',
    activeIconColor: 'text-white',
    iconBgLight: 'bg-violet-100/90 dark:bg-violet-950/60',
    activeIconBgLight: 'bg-white/20'
  },
  { 
    id: 'management', 
    label: 'إدارة الطلاب والحلقات', 
    shortLabel: 'الإدارة', 
    icon: Users,
    iconColor: 'text-blue-700 dark:text-blue-400',
    activeIconColor: 'text-white',
    iconBgLight: 'bg-blue-100/90 dark:bg-blue-950/60',
    activeIconBgLight: 'bg-white/20'
  },
  { 
    id: 'documents', 
    label: 'أرشيف المستندات', 
    shortLabel: 'المستندات', 
    icon: FolderOpen,
    iconColor: 'text-emerald-800 dark:text-emerald-400',
    activeIconColor: 'text-white',
    iconBgLight: 'bg-emerald-100/90 dark:bg-emerald-950/60',
    activeIconBgLight: 'bg-white/20'
  },
  { 
    id: 'suggestions', 
    label: 'الاقتراحات', 
    shortLabel: 'الاقتراحات', 
    icon: Lightbulb,
    iconColor: 'text-amber-600 dark:text-amber-400',
    activeIconColor: 'text-white',
    iconBgLight: 'bg-amber-100/90 dark:bg-amber-950/60',
    activeIconBgLight: 'bg-white/20'
  },
  { 
    id: 'certificates', 
    label: 'الشهادات', 
    shortLabel: 'الشهادات', 
    icon: Award,
    iconColor: 'text-orange-600 dark:text-orange-400',
    activeIconColor: 'text-white',
    iconBgLight: 'bg-orange-100/90 dark:bg-orange-950/60',
    activeIconBgLight: 'bg-white/20'
  },
  { 
    id: 'cards', 
    label: 'البطاقات', 
    shortLabel: 'البطاقات', 
    icon: CreditCard,
    iconColor: 'text-teal-700 dark:text-teal-400',
    activeIconColor: 'text-white',
    iconBgLight: 'bg-teal-100/90 dark:bg-teal-950/60',
    activeIconBgLight: 'bg-white/20'
  },
  { 
    id: 'settings', 
    label: 'الإعدادات', 
    shortLabel: 'الإعدادات', 
    icon: SettingsIcon,
    iconColor: 'text-slate-700 dark:text-slate-300',
    activeIconColor: 'text-white',
    iconBgLight: 'bg-slate-200/80 dark:bg-slate-800/80',
    activeIconBgLight: 'bg-white/20'
  },
  { 
    id: 'overview', 
    label: 'نظرة عامة على البيانات', 
    shortLabel: 'البيانات', 
    icon: Database,
    iconColor: 'text-indigo-700 dark:text-indigo-400',
    activeIconColor: 'text-white',
    iconBgLight: 'bg-indigo-100/90 dark:bg-indigo-950/60',
    activeIconBgLight: 'bg-white/20'
  },
];

export const SupervisorDashboard: React.FC = () => {
  const context = useContext(AppContext);
  const [activeView, setActiveView] = useState<View>('reports');
  const [reportsSubTab, setReportsSubTab] = useState<'quran' | 'mutoon' | 'sard'>('quran');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navScrollRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!context) {
    return <div className="dark:text-gray-200">جاري تحميل البيانات...</div>;
  }
  
  const { evaluations, students } = context;

  const handleTabChange = (view: View, buttonElement?: HTMLButtonElement | null) => {
    setActiveView(view);
    setIsDropdownOpen(false);

    // Focus and center the selected tab in the navigation bar
    setTimeout(() => {
      const targetBtn = buttonElement || navScrollRef.current?.querySelector<HTMLButtonElement>(`#nav-tab-${view}`);
      if (targetBtn) {
        targetBtn.focus({ preventScroll: false });
        targetBtn.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }, 50);
  };

  const scrollNav = (direction: 'right' | 'left') => {
    if (navScrollRef.current) {
      const delta = direction === 'left' ? -260 : 260;
      navScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  const currentActiveItem = NAV_ITEMS.find((item) => item.id === activeView) || NAV_ITEMS[0];
  const CurrentIcon = currentActiveItem.icon;

  return (
    <div className="container mx-auto space-y-6 sm:space-y-8 px-2 sm:px-6 lg:px-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 no-print px-2 sm:px-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-300 tracking-tight">
            لوحة تحكم المشرف
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 font-medium">
            متابعة شاملة لأداء الحلقات والطلاب وإدارة البرامج
          </p>
        </div>

        {/* Quick Dropdown Selector in Header for Easy Access */}
        <div className="relative w-full sm:w-auto" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
            className="w-full sm:w-auto flex items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 border-2 border-emerald-600/30 hover:border-emerald-600 dark:border-emerald-500/30 dark:hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all text-sm font-black text-gray-800 dark:text-gray-100 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${currentActiveItem.iconBgLight}`}>
                <CurrentIcon className={`w-4 h-4 ${currentActiveItem.iconColor}`} />
              </span>
              <div className="text-right">
                <span className="text-[11px] block text-emerald-700 dark:text-emerald-400 font-bold">الانتقال السريع</span>
                <span className="text-sm font-black">{currentActiveItem.label}</span>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-emerald-700 dark:text-emerald-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Floating Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-full sm:w-72 bg-white dark:bg-gray-850 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-750 flex items-center justify-between text-xs text-gray-400 dark:text-gray-400 font-bold">
                <span>أقسام لوحة المشرف ({NAV_ITEMS.length})</span>
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="max-h-80 overflow-y-auto py-1 px-1.5 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const ItemIcon = item.icon;
                  const isItemActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleTabChange(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-right cursor-pointer ${
                        isItemActive
                          ? 'bg-emerald-700 text-white shadow-sm dark:bg-emerald-600'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isItemActive ? item.activeIconBgLight : item.iconBgLight
                          }`}
                        >
                          <ItemIcon
                            className={`w-4 h-4 ${
                              isItemActive ? item.activeIconColor : item.iconColor
                            }`}
                          />
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {isItemActive && (
                        <Check className="w-4 h-4 text-white shrink-0 mr-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modern Responsive Navigation Bar with visible scrollbar & scroll buttons */}
      <div className="sticky top-0 z-30 -mx-2 sm:mx-0 px-2 sm:px-0 no-print">
        <div className="relative flex items-center gap-1.5 bg-white/95 dark:bg-gray-850/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-emerald-100/90 dark:border-gray-700/90 shadow-md shadow-emerald-950/5 dark:shadow-black/20 p-1.5 sm:p-2">
          {/* Scroll Right Button (In RTL, scrolls towards first item) */}
          <button
            type="button"
            onClick={() => scrollNav('right')}
            title="تمرير لليمين"
            aria-label="تمرير لليمين"
            className="hidden sm:flex shrink-0 w-8 h-8 items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-gray-800 dark:hover:bg-gray-750 dark:text-emerald-300 border border-emerald-200/60 dark:border-gray-700 transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Navigation with Styled Scrollbar */}
          <nav
            ref={navScrollRef}
            dir="rtl"
            aria-label="أقسام لوحة المشرف"
            className="flex-1 flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 px-1 scrollbar-thin [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-emerald-50/80 dark:[&::-webkit-scrollbar-track]:bg-gray-800/80 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-400 dark:[&::-webkit-scrollbar-thumb]:bg-emerald-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-500 cursor-grab active:cursor-grabbing"
            style={{
              scrollbarColor: 'var(--color-emerald-400, #34d399) var(--color-emerald-50, #f0fdf4)',
            }}
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  type="button"
                  onClick={(e) => handleTabChange(item.id, e.currentTarget)}
                  className={`group flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all duration-150 shrink-0 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-sm dark:bg-emerald-600 ring-2 ring-emerald-600/30'
                      : 'bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-gray-800/70 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-emerald-100/70 dark:border-gray-700/60'
                  }`}
                >
                  <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors duration-150 ${
                    isActive ? item.activeIconBgLight : item.iconBgLight
                  }`}>
                    <Icon
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors duration-150 ${
                        isActive
                          ? item.activeIconColor
                          : item.iconColor
                      }`}
                    />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Scroll Left Button (In RTL, scrolls towards last item) */}
          <button
            type="button"
            onClick={() => scrollNav('left')}
            title="تمرير لليسار"
            aria-label="تمرير لليسار"
            className="hidden sm:flex shrink-0 w-8 h-8 items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-gray-800 dark:hover:bg-gray-750 dark:text-emerald-300 border border-emerald-200/60 dark:border-gray-700 transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* 1. التقارير الرئيسة */}
      <div className={`space-y-6 ${activeView === 'reports' ? 'block' : 'hidden'}`}>
        <div className="no-print">
          <DashboardStats evaluations={evaluations} students={students} />
        </div>

        {/* Sub-tabs for Quran vs Mutoon vs Sard reports */}
        <div className="flex justify-center no-print my-2 px-1">
          <div className="flex w-full sm:w-auto justify-center gap-1.5 sm:gap-2 p-1.5 bg-gray-100/90 dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <button
              type="button"
              onClick={() => setReportsSubTab('quran')}
              className={`flex-1 sm:flex-initial px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-150 flex items-center justify-center gap-2 ${
                reportsSubTab === 'quran'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                reportsSubTab === 'quran' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
              }`}>
                <BookOpen className="w-3.5 h-3.5" />
              </span>
              <span>تقارير القرآن</span>
            </button>
            <button
              type="button"
              onClick={() => setReportsSubTab('mutoon')}
              className={`flex-1 sm:flex-initial px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-150 flex items-center justify-center gap-2 ${
                reportsSubTab === 'mutoon'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                reportsSubTab === 'mutoon' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
              }`}>
                <ScrollText className="w-3.5 h-3.5" />
              </span>
              <span>تقارير المتون</span>
            </button>
            <button
              type="button"
              onClick={() => setReportsSubTab('sard')}
              className={`flex-1 sm:flex-initial px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors duration-150 flex items-center justify-center gap-2 ${
                reportsSubTab === 'sard'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                reportsSubTab === 'sard' ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span>تقارير السرد</span>
            </button>
          </div>
        </div>

        <div className={reportsSubTab === 'quran' ? 'block' : 'hidden'}>
          <ReportsTable key="reports-table-quran" subjectFilter="quran" />
        </div>
        <div className={reportsSubTab === 'mutoon' ? 'block' : 'hidden'}>
          <ReportsTable key="reports-table-mutoon" subjectFilter="mutoon" />
        </div>
        <div className={reportsSubTab === 'sard' ? 'block' : 'hidden'}>
          <SardReportsTable key="reports-table-sard" />
        </div>
      </div>

      {/* 2. تقارير الاختبارات */}
      <div className={`space-y-8 ${activeView === 'testReports' ? 'block' : 'hidden'}`}>
        <TestsReportTable />
      </div>

      {/* 3. إدارة الطلاب والحلقات */}
      <div className={activeView === 'management' ? 'block' : 'hidden'}>
        <StudentManagement />
      </div>

      {/* 4. أرشيف المستندات والملفات */}
      <div className={activeView === 'documents' ? 'block' : 'hidden'}>
        <DocumentsManager />
      </div>

      {/* 5. الاقتراحات */}
      <div className={activeView === 'suggestions' ? 'block' : 'hidden'}>
        <SupervisorSuggestionsView />
      </div>

      {/* 5. الشهادات */}
      <div className={activeView === 'certificates' ? 'block' : 'hidden'}>
        <CertificatesManager />
      </div>

      {/* 6. البطاقات */}
      <div className={activeView === 'cards' ? 'block' : 'hidden'}>
        <CardsManager />
      </div>

      {/* 7. الإعدادات */}
      <div className={activeView === 'settings' ? 'block' : 'hidden'}>
        <Settings />
      </div>

      {/* 8. نظرة عامة على البيانات */}
      <div className={activeView === 'overview' ? 'block' : 'hidden'}>
        <OverviewTable />
      </div>

    </div>
  );
};

export default SupervisorDashboard;
