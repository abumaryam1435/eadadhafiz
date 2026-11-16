import React, { useContext, useState, useMemo, useRef, useEffect } from 'react';
import { Bell, TrendingUp, MessageSquare, ShieldAlert, CheckCheck, Check, FileText, Eye } from 'lucide-react';
import { AppContext } from '../App';
import { getStudentLevelUpgrades } from '../utils/levelUpgradeUtils';
import { toArabicDigits } from '../utils/juzUtils';

type NotifCategory = 'all' | 'upgrades' | 'notes' | 'behaviors';

interface UnifiedNotification {
  id: string;
  category: 'upgrades' | 'notes' | 'behaviors';
  subType: 'upgrade' | 'suggestion' | 'behavior';
  title: string;
  body: string;
  meta: string;
  timestamp: number;
  isUnread: boolean;
  onMarkRead: () => void;
  onNavigate: () => void;
}

export const SupervisorNotificationsBell: React.FC = () => {
  const context = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NotifCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'unread' | 'all'>('unread');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const students = context?.students || [];
  const evaluations = context?.evaluations || [];
  const halaqas = context?.halaqas || [];
  const users = context?.users || [];
  const suggestions = context?.suggestions || [];
  const studentBehaviors = context?.studentBehaviors || [];
  const supervisorReadNotifications = context?.supervisorReadNotifications || [];
  const markNotificationsRead = context?.markNotificationsRead;
  const updateSuggestion = context?.updateSuggestion;
  const updateStudentBehavior = context?.updateStudentBehavior;
  const navigateSupervisor = context?.navigateSupervisor;

  const readSet = useMemo(() => new Set(supervisorReadNotifications), [supervisorReadNotifications]);

  const formatTimestamp = (ts: number) => {
    if (!ts || ts <= 0) return '';
    try {
      return new Date(ts).toLocaleString('ar-SA', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return '';
    }
  };

  const notifications = useMemo<UnifiedNotification[]>(() => {
    const list: UnifiedNotification[] = [];

    // 1. Level upgrades
    const upgrades = getStudentLevelUpgrades(students, evaluations, halaqas, users);
    upgrades.forEach(u => {
      const numStr = u.studentNumber && u.studentNumber !== '—' ? ` (#${toArabicDigits(u.studentNumber)})` : '';
      list.push({
        id: u.upgradeKey,
        category: 'upgrades',
        subType: 'upgrade',
        title: `ترقية مستوى: ${u.studentName}${numStr}`,
        body: `انتقل في الأسبوع ${toArabicDigits(u.weekNumber)} من ${u.previousLevel} إلى ${u.newLevel}`,
        meta: `${u.studentOriginalHalaqaName} • ${toArabicDigits(u.totalMemorizedPagesAtUpgrade)} صفحة${u.evaluationDate && u.evaluationDate !== '—' ? ` • ${u.evaluationDate}` : ''}`,
        timestamp: u.updatedAt || u.weekNumber * 1000000 + u.evaluationId,
        isUnread: !readSet.has(u.upgradeKey),
        onMarkRead: () => markNotificationsRead?.(u.upgradeKey),
        onNavigate: () => {
          markNotificationsRead?.(u.upgradeKey);
          setIsOpen(false);
          navigateSupervisor?.({ view: 'reports', reportsSubTab: 'upgrades' });
        },
      });
    });

    // 2. Teacher suggestions
    suggestions.forEach(s => {
      const bodyText =
        s.type === 'voice'
          ? 'تسجيل صوتي جديد للمشرف'
          : (s.content || '').trim() || 'مقترح بمرفقات توضيحية';
      list.push({
        id: `suggestion_${s.id}`,
        category: 'notes',
        subType: 'suggestion',
        title: `مقترح من المعلم: ${s.teacherName}`,
        body: bodyText,
        meta: formatTimestamp(s.createdAt) || 'صندوق الاقتراحات',
        timestamp: s.createdAt || s.id,
        isUnread: !s.reviewed,
        onMarkRead: () => updateSuggestion?.({ ...s, reviewed: true }),
        onNavigate: () => {
          if (!s.reviewed) updateSuggestion?.({ ...s, reviewed: true });
          setIsOpen(false);
          navigateSupervisor?.({ view: 'suggestions', suggestionsSubTab: 'suggestions' });
        },
      });
    });

    // 3. Student behaviors
    studentBehaviors.forEach(b => {
      list.push({
        id: `behavior_${b.id}`,
        category: 'behaviors',
        subType: 'behavior',
        title: `سلوك طالب: ${b.studentName}`,
        body: b.content,
        meta: `المعلم: ${b.teacherName}${b.createdAt ? ` • ${formatTimestamp(b.createdAt)}` : ''}`,
        timestamp: b.createdAt || b.id,
        isUnread: !b.reviewed,
        onMarkRead: () => updateStudentBehavior?.({ ...b, reviewed: true }),
        onNavigate: () => {
          if (!b.reviewed) updateStudentBehavior?.({ ...b, reviewed: true });
          setIsOpen(false);
          navigateSupervisor?.({ view: 'suggestions', suggestionsSubTab: 'behaviors' });
        },
      });
    });

    // Sort: unread first, then newest timestamp descending
    list.sort((a, b) => {
      if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    return list;
  }, [
    students,
    evaluations,
    halaqas,
    users,
    suggestions,
    studentBehaviors,
    readSet,
    markNotificationsRead,
    updateSuggestion,
    updateStudentBehavior,
    navigateSupervisor,
  ]);

  const counts = useMemo(() => {
    let all = 0;
    let upgrades = 0;
    let notes = 0;
    let behaviors = 0;
    notifications.forEach(n => {
      if (!n.isUnread) return;
      all++;
      if (n.category === 'upgrades') upgrades++;
      else if (n.category === 'notes') notes++;
      else if (n.category === 'behaviors') behaviors++;
    });
    return { all, upgrades, notes, behaviors };
  }, [notifications]);

  const visibleNotifications = useMemo(() => {
    return notifications
      .filter(n => (activeCategory === 'all' ? true : n.category === activeCategory))
      .filter(n => (statusFilter === 'unread' ? n.isUnread : true))
      .slice(0, 80);
  }, [notifications, activeCategory, statusFilter]);

  const handleMarkCategoryRead = () => {
    const targetUnread = notifications.filter(
      n => n.isUnread && (activeCategory === 'all' ? true : n.category === activeCategory)
    );
    if (targetUnread.length === 0) return;

    const configKeys: string[] = [];
    targetUnread.forEach(item => {
      if (item.subType === 'upgrade') {
        configKeys.push(item.id);
      } else if (item.subType === 'suggestion') {
        const sId = Number(item.id.replace('suggestion_', ''));
        const orig = suggestions.find(s => Number(s.id) === sId);
        if (orig && !orig.reviewed) updateSuggestion?.({ ...orig, reviewed: true });
      } else if (item.subType === 'behavior') {
        const bId = Number(item.id.replace('behavior_', ''));
        const orig = studentBehaviors.find(b => Number(b.id) === bId);
        if (orig && !orig.reviewed) updateStudentBehavior?.({ ...orig, reviewed: true });
      }
    });

    if (configKeys.length > 0) {
      markNotificationsRead?.(configKeys);
    }
  };

  const unreadInActiveCategory =
    activeCategory === 'all'
      ? counts.all
      : activeCategory === 'upgrades'
        ? counts.upgrades
        : activeCategory === 'notes'
          ? counts.notes
          : counts.behaviors;

  const getItemIcon = (item: UnifiedNotification) => {
    if (item.category === 'upgrades') {
      return (
        <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4" />
        </span>
      );
    }
    if (item.category === 'behaviors') {
      return (
        <span className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </span>
      );
    }
    return (
      <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
        <MessageSquare className="w-4 h-4" />
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`relative flex items-center justify-center p-1.5 sm:p-2.5 rounded-xl border-2 transition-all shadow-md active:scale-95 cursor-pointer ${
          isOpen
            ? 'bg-amber-400 text-green-950 border-amber-500'
            : counts.all > 0
              ? 'bg-white text-green-900 border-amber-400 hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-300 dark:border-amber-500/80 dark:hover:bg-slate-700'
              : 'bg-white text-green-900 border-emerald-600/50 hover:bg-gray-100 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-600 dark:hover:bg-slate-700'
        }`}
        aria-label={`التنبيهات والإشعارات${counts.all > 0 ? ` (${counts.all} غير مقروءة)` : ''}`}
        title="التنبيهات والإشعارات"
      >
        <Bell className={`h-4 w-4 sm:h-6 sm:w-6 ${counts.all > 0 && !isOpen ? 'text-amber-600 dark:text-amber-400' : ''}`} />
        {counts.all > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] sm:min-w-[21px] sm:h-[21px] px-1 rounded-full bg-red-600 text-white text-[10px] sm:text-[11px] font-black flex items-center justify-center shadow-md ring-2 ring-green-800 dark:ring-slate-900">
            {counts.all > 99 ? '+99' : toArabicDigits(counts.all)}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[80] sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-2 top-16 sm:inset-auto sm:absolute sm:left-0 sm:mt-2 sm:w-[440px] max-w-[96vw] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 z-[90] overflow-hidden text-right animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-emerald-800 to-green-900 dark:from-slate-800 dark:to-slate-900 text-white border-b border-emerald-700/50 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-yellow-300" />
                <span className="font-black text-sm sm:text-base">التنبيهات والإشعارات</span>
                {counts.all > 0 && (
                  <span className="bg-yellow-400 text-green-950 text-[11px] font-black px-2 py-0.5 rounded-full">
                    {toArabicDigits(counts.all)} جديد
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {unreadInActiveCategory > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkCategoryRead}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-colors cursor-pointer"
                    title="تحديد التنبيهات الظاهرة كمقروءة"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>قراءة الكل</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                  aria-label="إغلاق"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="grid grid-cols-4 gap-1 p-2 bg-gray-50 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-700 text-[11px] font-black">
              {(
                [
                  { id: 'all', label: 'الكل', count: counts.all },
                  { id: 'upgrades', label: 'الترقيات', count: counts.upgrades },
                  { id: 'notes', label: 'المقترحات', count: counts.notes },
                  { id: 'behaviors', label: 'السلوك', count: counts.behaviors },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`py-1.5 px-1.5 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeCategory === tab.id
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        activeCategory === tab.id
                          ? 'bg-yellow-400 text-green-950'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}
                    >
                      {toArabicDigits(tab.count)}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    statusFilter === 'unread'
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'
                  }`}
                >
                  غير المقروءة
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'
                  }`}
                >
                  عرض الكل
                </button>
              </div>
              <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">
                {toArabicDigits(visibleNotifications.length)} تنبيه
              </span>
            </div>

            {/* Notifications List */}
            <div className="max-h-[58vh] sm:max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
              {visibleNotifications.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2">
                  <Bell className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-700" />
                  <p className="text-sm font-black text-gray-600 dark:text-gray-300">
                    {statusFilter === 'unread'
                      ? 'لا توجد تنبيهات غير مقروءة في هذا القسم'
                      : 'لا توجد تنبيهات مسجلة في هذا القسم'}
                  </p>
                  {statusFilter === 'unread' && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض جميع الإشعارات السابقة</span>
                    </button>
                  )}
                </div>
              ) : (
                visibleNotifications.map(item => (
                  <div
                    key={item.id}
                    onClick={item.onNavigate}
                    className={`p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                      item.isUnread
                        ? 'bg-amber-50/45 hover:bg-amber-50/80 dark:bg-amber-950/15 dark:hover:bg-amber-950/25'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/60 opacity-80'
                    }`}
                  >
                    {getItemIcon(item)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white truncate">
                          {item.title}
                        </h5>
                        {item.isUnread && (
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="غير مقروء" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.body}
                      </p>
                      {item.meta && (
                        <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-400 mt-1 truncate">
                          {item.meta}
                        </p>
                      )}
                    </div>
                    {item.isUnread && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          item.onMarkRead();
                        }}
                        className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors shrink-0 cursor-pointer"
                        title="تحديد كمقروء"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer quick actions */}
            <div className="px-3 py-2.5 bg-gray-50 dark:bg-slate-800/70 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2 text-xs font-black">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigateSupervisor?.({ view: 'reports', reportsSubTab: 'upgrades' });
                }}
                className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>فتح تقرير الترقيات</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigateSupervisor?.({ view: 'suggestions', suggestionsSubTab: 'behaviors' });
                }}
                className="text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                الاقتراحات والسلوكيات
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
