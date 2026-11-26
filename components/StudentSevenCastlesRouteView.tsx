import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppContext } from '../App';
import { getDb, HARDCODED_FIREBASE_CONFIG, initializeFirebase } from '../utils/firebase';
import { MushafReaderModal } from './MushafReaderModal';
import { ProgressLog, SevenCastlesPlan } from '../seven-castles/types';
import { expandOldMemorizationRanges } from '../seven-castles/sevenCastlesGenerator';
import { decodeSevenCastlesPlanToken } from '../seven-castles/sevenCastlesLink';
import { StudentSevenCastlesTasksPage } from '../seven-castles/StudentSevenCastlesTasksPage';

export interface StudentTasksRouteInfo {
  active: boolean;
  planId?: string;
  token?: string;
}

export function getStudentTasksRouteFromUrl(): StudentTasksRouteInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const pathname = url.pathname || '';
    const hash = url.hash || '';

    // 1. Check pathname: /student-tasks or /student-tasks/:planId
    const pathMatch = pathname.match(/^\/student-tasks(?:\/([^/?#]+))?\/?$/i);
    if (pathMatch) {
      const planId = pathMatch[1] ? decodeURIComponent(pathMatch[1]).trim() : undefined;
      const token = url.searchParams.get('plan') || undefined;
      return { active: true, planId, token };
    }

    // 2. Check hash path: #/student-tasks or #/student-tasks/:planId?plan=...
    const hashPathMatch = hash.match(/^#\/?student-tasks(?:\/([^/?#]+))?(?:\?(.*))?$/i);
    if (hashPathMatch) {
      const planId = hashPathMatch[1] ? decodeURIComponent(hashPathMatch[1]).trim() : undefined;
      let token = url.searchParams.get('plan') || undefined;
      if (!token && hashPathMatch[2]) {
        const hp = new URLSearchParams(hashPathMatch[2]);
        token = hp.get('plan') || undefined;
      }
      return { active: true, planId, token };
    }
  } catch {
    // ignore URL parse errors
  }
  return null;
}

function sanitizeForFirebase(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj === undefined ? null : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirebase);
  }
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      out[key] = sanitizeForFirebase(val);
    }
  }
  return out;
}

function normalizeLoadedPlan(raw: any, planId: string): SevenCastlesPlan | null {
  if (!raw || typeof raw !== 'object' || !raw.studentName || !raw.dailyAmount) {
    return null;
  }
  const oldRanges = Array.isArray(raw.oldMemorizationRanges) ? raw.oldMemorizationRanges : [];
  const oldPages = Array.isArray(raw.oldMemorizedPages)
    ? raw.oldMemorizedPages
    : expandOldMemorizationRanges(oldRanges);

  return {
    ...raw,
    id: raw.id || planId,
    isSevenCastles: true,
    planType: 'memorization',
    oldMemorizationRanges: oldRanges,
    oldMemorizedPages: oldPages,
    hasOldMemorization: oldPages.length > 0,
  } as SevenCastlesPlan;
}

function normalizeLoadedLogs(rawLogs: any): ProgressLog[] {
  if (!rawLogs || typeof rawLogs !== 'object') return [];
  const list = Array.isArray(rawLogs) ? rawLogs : Object.values(rawLogs);
  return list
    .filter((item: any) => item && typeof item === 'object' && item.date)
    .map((item: any) => ({
      ...item,
      tasks: Array.isArray(item.tasks) ? item.tasks : [],
    }));
}

interface StudentSevenCastlesRouteViewProps {
  route: StudentTasksRouteInfo;
}

export const StudentSevenCastlesRouteView: React.FC<StudentSevenCastlesRouteViewProps> = ({
  route,
}) => {
  const context = useContext(AppContext);
  const customLogo = context?.customLogo || null;
  const appName = context?.appName || 'إعداد حافظ';

  const [dbPlan, setDbPlan] = useState<SevenCastlesPlan | null>(null);
  const [initialLogs, setInitialLogs] = useState<ProgressLog[]>([]);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(!!route.planId);

  const [mushafState, setMushafState] = useState<{
    isOpen: boolean;
    pages: number[];
    title: string;
  }>({
    isOpen: false,
    pages: [],
    title: '',
  });

  // Fallback decoded plan if token was passed in hash/query
  const tokenPlan = useMemo(() => {
    if (!route.token) return null;
    return decodeSevenCastlesPlanToken(route.token);
  }, [route.token]);

  useEffect(() => {
    let cancelled = false;

    const loadFromDb = async () => {
      if (!route.planId) {
        setIsLoadingPlan(false);
        return;
      }

      setIsLoadingPlan(true);
      try {
        let db = getDb();
        if (!db) {
          const res = await initializeFirebase(HARDCODED_FIREBASE_CONFIG);
          db = res.db;
        }
        if (!db) {
          if (!cancelled) setIsLoadingPlan(false);
          return;
        }

        const safeId = route.planId.replace(/[.#$\[\]/]/g, '-');
        const [planSnap, progressSnap] = await Promise.all([
          db.ref(`data/sevenCastlesPlans/${safeId}`).once('value'),
          db.ref(`data/sevenCastlesProgress/${safeId}`).once('value'),
        ]);

        if (cancelled) return;

        const loadedPlan = normalizeLoadedPlan(planSnap.val(), safeId);
        const loadedLogs = normalizeLoadedLogs(progressSnap.val());

        setDbPlan(loadedPlan);
        setInitialLogs(loadedLogs);
      } catch (err) {
        console.error('Failed to load Seven Castles plan from Firebase:', err);
      } finally {
        if (!cancelled) {
          setIsLoadingPlan(false);
        }
      }
    };

    loadFromDb();

    return () => {
      cancelled = true;
    };
  }, [route.planId]);

  const activePlan = dbPlan || tokenPlan || null;

  const activePlanDbKey = useMemo(() => {
    const rawId = route.planId || activePlan?.id;
    if (!rawId) return null;
    return String(rawId).replace(/[.#$\[\]/]/g, '-');
  }, [route.planId, activePlan?.id]);

  const handleSaveProgress = useCallback(
    async (log: ProgressLog) => {
      if (!activePlanDbKey || !log?.date) return;
      try {
        let db = getDb();
        if (!db) {
          const res = await initializeFirebase(HARDCODED_FIREBASE_CONFIG);
          db = res.db;
        }
        if (!db) return;
        const safeDate = String(log.date).replace(/[.#$\[\]/]/g, '-');
        await db
          .ref(`data/sevenCastlesProgress/${activePlanDbKey}/${safeDate}`)
          .set(sanitizeForFirebase(log));
      } catch (err) {
        console.warn('Could not sync student task progress to Firebase:', err);
      }
    },
    [activePlanDbKey]
  );

  const handlePlanStartDateChange = useCallback(
    async (newStartDate: string, updatedPlan: SevenCastlesPlan) => {
      if (!route.planId || !activePlanDbKey) return;
      try {
        let db = getDb();
        if (!db) {
          const res = await initializeFirebase(HARDCODED_FIREBASE_CONFIG);
          db = res.db;
        }
        if (!db) return;
        await db.ref(`data/sevenCastlesPlans/${activePlanDbKey}`).update(
          sanitizeForFirebase({
            startDate: newStartDate,
            firstDayOfWeek: updatedPlan.firstDayOfWeek,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (err) {
        console.warn('Could not update plan startDate in Firebase:', err);
      }
    },
    [route.planId, activePlanDbKey]
  );

  const handleOpenMushafPages = useCallback((pages: number[], title: string) => {
    const validPages = (pages || []).filter((p) => typeof p === 'number' && p >= 1 && p <= 604);
    if (validPages.length === 0) return;
    setMushafState({
      isOpen: true,
      pages: validPages,
      title: title || 'صفحات المصحف',
    });
  }, []);

  const resolvedLogoUrl = useMemo(() => {
    if (customLogo && customLogo.trim()) return customLogo;
    return '/logo.png';
  }, [customLogo]);

  if (isLoadingPlan) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex flex-col items-center justify-center bg-[#F9F7F2] dark:bg-[#121212] p-6 text-center gap-3"
      >
        <Loader2 className="w-9 h-9 text-emerald-700 dark:text-[#D4AF37] animate-spin" />
        <p className="text-sm font-extrabold text-[#1A2E1A] dark:text-white">
          جاري تحميل خطة القلاع السبع...
        </p>
      </div>
    );
  }

  return (
    <>
      <StudentSevenCastlesTasksPage
        plan={activePlan}
        initialLogs={initialLogs}
        onSaveProgress={handleSaveProgress}
        onPlanStartDateChange={handlePlanStartDateChange}
        onOpenMushafPages={handleOpenMushafPages}
        logoUrl={resolvedLogoUrl}
        appName={appName}
      />

      <MushafReaderModal
        isOpen={mushafState.isOpen}
        onClose={() => setMushafState((prev) => ({ ...prev, isOpen: false }))}
        newPages={mushafState.pages}
        studentName={activePlan?.studentName}
      />
    </>
  );
};

export default StudentSevenCastlesRouteView;
