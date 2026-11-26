import { DailyAmount, PageRange, SevenCastlesPlan } from './types';
import { expandOldMemorizationRanges } from './sevenCastlesGenerator';

interface CompactPlanPayload {
  v: 1;
  sn: string; // studentName
  sid?: string | number; // studentId
  da: DailyAmount; // dailyAmount
  sp: number; // startPage
  ep: number; // endPage
  jn?: number; // juzNumber
  sd: string; // startDate (YYYY-MM-DD)
  fd: number; // firstDayOfWeek (0..6)
  ds: 0 | 1; // isSevenCastlesDescending
  sm: 'j' | 'p'; // sevenCastlesStartMode
  df: number; // dailyFixationRepetitions
  wr: number; // weeklyReviewRepetitions
  or?: [number, number][]; // oldMemorizationRanges as compact tuples
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Encodes a SevenCastlesPlan into a compact URL-safe token so a student can open
 * their Daily Tasks page immediately from a WhatsApp link even without logging in.
 */
export function encodeSevenCastlesPlanToken(plan: SevenCastlesPlan): string {
  const ranges: [number, number][] | undefined =
    plan.oldMemorizationRanges && plan.oldMemorizationRanges.length > 0
      ? plan.oldMemorizationRanges.map((r) => [r.start, r.end])
      : undefined;

  const payload: CompactPlanPayload = {
    v: 1,
    sn: plan.studentName,
    sid: plan.studentId,
    da: plan.dailyAmount,
    sp: plan.startPage,
    ep: plan.endPage,
    jn: plan.juzNumber,
    sd: plan.startDate,
    fd: plan.firstDayOfWeek,
    ds: plan.isSevenCastlesDescending ? 1 : 0,
    sm: plan.sevenCastlesStartMode === 'page' ? 'p' : 'j',
    df: plan.dailyFixationRepetitions || 5,
    wr: plan.weeklyReviewRepetitions || 3,
    ...(ranges ? { or: ranges } : {}),
  };

  return toBase64Url(JSON.stringify(payload));
}

/**
 * Decodes a URL-safe token back into a full SevenCastlesPlan object ready for StudentSevenCastlesTasksPage.
 */
export function decodeSevenCastlesPlanToken(token: string): SevenCastlesPlan | null {
  try {
    if (!token) return null;
    const json = fromBase64Url(token.trim());
    const p = JSON.parse(json) as CompactPlanPayload;
    if (!p || !p.sn || !p.da || !p.sd) return null;

    const oldRanges: PageRange[] = Array.isArray(p.or)
      ? p.or
          .filter((pair) => Array.isArray(pair) && pair.length === 2)
          .map(([start, end]) => ({ start: Number(start), end: Number(end) }))
      : [];

    const oldPages = expandOldMemorizationRanges(oldRanges);

    return {
      id: p.sid ? `student-${p.sid}-${p.sd}` : `shared-${p.sd}`,
      studentId: p.sid,
      studentName: p.sn,
      name: `خطة القلاع السبع — ${p.sn}`,
      planType: 'memorization',
      isSevenCastles: true,
      juzNumber: p.jn,
      startPage: Number(p.sp) || 1,
      endPage: Number(p.ep) || 604,
      dailyAmount: p.da,
      startDate: p.sd,
      firstDayOfWeek: Number(p.fd) || 0,
      isSevenCastlesDescending: p.ds === 1,
      sevenCastlesStartMode: p.sm === 'p' ? 'page' : 'juz',
      dailyFixationRepetitions: Number(p.df) || 5,
      weeklyReviewRepetitions: Number(p.wr) || 3,
      hasOldMemorization: oldPages.length > 0,
      oldMemorizationRanges: oldRanges,
      oldMemorizedPages: oldPages,
      status: 'active',
    };
  } catch (err) {
    console.error('Failed to decode Seven Castles plan token:', err);
    return null;
  }
}

/**
 * Builds the direct shareable URL for a student's Daily Tasks page.
 * If a saved database planId is passed, uses `/student-tasks/:planId`;
 * otherwise embeds the compact self-contained plan token in `?plan=...`.
 */
export function buildStudentTasksShareUrl(
  plan: SevenCastlesPlan,
  options?: {
    origin?: string;
    routePath?: string; // default: '/student-tasks'
    savedPlanId?: string | number;
  }
): string {
  const origin =
    options?.origin ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const routePath = (options?.routePath || '/student-tasks').replace(/\/+$/, '');

  if (options?.savedPlanId !== undefined && options.savedPlanId !== '') {
    return `${origin}${routePath}/${encodeURIComponent(String(options.savedPlanId))}`;
  }

  const token = encodeSevenCastlesPlanToken(plan);
  return `${origin}${routePath}?plan=${encodeURIComponent(token)}`;
}
