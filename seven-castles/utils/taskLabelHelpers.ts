// Shared task title parsing & label cleaning helpers used across Daily Tasks UI and PDF exports.
// Strictly strips ONLY recognized task-action prefixes so Surah names and verse ranges are NEVER truncated.

const ACTION_COLON_PREFIX_REGEX =
  /^(?:استماع(?:\s+تثبيت|\s+التثبيت|\s+للجديد|\s+للقرآن|\s+المقدار(?:\s+الجديد)?)?|حفظ(?:\s+جديد|\s+الجديد|\s+المقدار(?:\s+الجديد)?)?|تثبيت(?:\s+المقدار\s+الجديد|\s+الجديد|\s+التثبيت|\s+المقدار|\s+ومراجعة[^:]*)?|تسميع(?:\s+تثبيت|\s+التثبيت|\s+تراكمي(?:\s+لـ)?|\s+للجديد|\s+المقدار(?:\s+الجديد)?)?|مراجعة(?:\s+مكررة|\s+تراكمية(?:\s+لـ)?|\s+التراكمي(?:\s+غيباً)?|\s+القلعة\s+\S+|\s+القريب[^:]*|\s+البعيد[^:]*|\s+حزب[^:]*|\s+الأجزاء|\s+الجزء[^:]*|\s+محفوظ[^:]*)?|سرد\s+وتسميع[^:]*)\s*:\s*/;

const ACTION_SPACE_PREFIX_REGEX =
  /^(?:تسميع\s+تثبيت|تسميع\s+التثبيت|استماع\s+تثبيت|استماع\s+التثبيت|تسميع\s+تراكمي\s+لـ|تسميع\s+تراكمي|مراجعة\s+تراكمية\s+لـ|مراجعة\s+تراكمية|مراجعة\s+مكررة|تثبيت\s+المقدار\s+الجديد|تثبيت\s+الجديد|تثبيت\s+المقدار|حفظ\s+الجديد|حفظ\s+جديد|حفظ\s+المقدار\s+الجديد|حفظ\s+المقدار|تسميع\s+للجديد|تسميع|تثبيت|حفظ|استماع|مراجعة)\s+/;

/**
 * Removes only the task action prefix (e.g. "حفظ جديد:", "تثبيت", "استماع:", "مراجعة")
 * and trailing repetition/mode notes ("غيباً", "(3 مرات)", "(40 تكراراً)") so related
 * daily tasks over the exact same verse portion group cleanly without ever stripping a Surah name.
 */
export function cleanTaskGroupLabel(title: string): string {
  if (!title) return "";
  let clean = title.trim();

  // 1. Strip ONLY a recognized action header followed by a colon (never split on colons inside Surah/verse text)
  if (ACTION_COLON_PREFIX_REGEX.test(clean)) {
    clean = clean.replace(ACTION_COLON_PREFIX_REGEX, "").trim();
  }

  // 2. Strip space-separated action prefixes (e.g. "تثبيت ص 50 (...)", "تسميع من سورة ...")
  clean = clean.replace(ACTION_SPACE_PREFIX_REGEX, "").trim();

  // 3. Remove trailing " غيباً"
  clean = clean.replace(/\s+غيباً$/g, "").trim();

  // 4. Remove trailing repetition counts like " (3 مرات)" or " (40 تكراراً)"
  clean = clean.replace(/\s*\(\d+\s*(?:مرات|مرة|تكراراً|تكرار)\)\s*$/g, "").trim();

  return clean;
}

/**
 * Splits a task title into an action badge ("🔲 حفظ", "🔲 استماع", etc.) and its full intact
 * portion description for PDF cards (Castle Tower & Booklet styles).
 * Never truncates on colons belonging to Surah/verse descriptions.
 */
export function parsePdfCustomTask(
  title: string,
  taskId?: string,
): { action: string; portion: string } | null {
  if (!title) return null;
  const trimmed = title.trim();

  const isOldReview =
    (taskId ? String(taskId).startsWith("old-rev-") : false) ||
    trimmed.includes("القديم") ||
    trimmed.includes("المحفوظ القديم");
  const isCastleRev =
    (taskId ? String(taskId).startsWith("sc-castle-rev-") : false) ||
    trimmed.includes("القلعة") ||
    trimmed.includes("قلعة");
  const isCumulative =
    trimmed.includes("المقرر التراكمي") ||
    trimmed.includes("المراجعة العميقة") ||
    trimmed.includes("تراكمي") ||
    trimmed.includes("تراكمية");

  let action = "";
  let portion = "";

  // Handle Seven Castles castle review explicitly so Castle Tower cards show clean header + full Surah/Ayah portion
  const castleColonMatch = /^(مراجعة\s+القلعة\s+\S+)\s*:\s*/.exec(trimmed);
  if (castleColonMatch) {
    action = `🔲 ${castleColonMatch[1]}`;
    portion = trimmed.slice(castleColonMatch[0].length).trim();
  } else if (isCastleRev || isCumulative) {
    return null; // Keep full title intact if it has a non-standard cumulative/castle format
  } else {
    // Match explicit action + colon ONLY when the prefix before ':' is purely an action header
    const colonMatch = ACTION_COLON_PREFIX_REGEX.exec(trimmed);
    if (colonMatch) {
      const prefix = colonMatch[0];
      const remainder = trimmed.slice(prefix.length).trim();

      if (isOldReview) {
        action = "🔲 مراجعة القديم";
      } else if (prefix.includes("استماع") || prefix.includes("سمع")) {
        action = "🔲 استماع";
      } else if (prefix.includes("حفظ")) {
        action = "🔲 حفظ";
      } else if (prefix.includes("تثبيت")) {
        action = "🔲 تثبيت";
      } else if (prefix.includes("تسميع") || prefix.includes("سرد")) {
        action = "🔲 تسميع";
      } else if (prefix.includes("مراجعة")) {
        action = "🔲 مراجعة";
      } else {
        return null;
      }
      portion = remainder;
    } else if (isOldReview && trimmed.startsWith("مراجعة")) {
      action = "🔲 مراجعة القديم";
      portion = trimmed
        .replace(/^مراجعة\s*(?:المحفوظ القديم|القديم)?\s*:?\s*/, "")
        .trim();
    } else if (trimmed.startsWith("استماع")) {
      action = "🔲 استماع";
      portion = trimmed
        .replace(/^استماع\s*(?:تثبيت|التثبيت|للقرآن|للجديد|المقدار الجديد|المقدار)?\s*/, "")
        .trim();
    } else if (trimmed.startsWith("حفظ")) {
      action = "🔲 حفظ";
      portion = trimmed
        .replace(/^حفظ\s*(?:الجديد|جديد|المقدار الجديد|المقدار)?\s*/, "")
        .trim();
    } else if (trimmed.startsWith("تثبيت")) {
      action = "🔲 تثبيت";
      portion = trimmed
        .replace(/^تثبيت\s*(?:المقدار الجديد|الجديد|المقدار)?\s*/, "")
        .trim();
    } else if (trimmed.startsWith("تسميع")) {
      action = "🔲 تسميع";
      portion = trimmed
        .replace(/^تسميع\s*(?:تثبيت|التثبيت|للجديد|المقدار الجديد|المقدار)?\s*/, "")
        .trim();
    } else if (trimmed.startsWith("مراجعة")) {
      action = "🔲 مراجعة";
      portion = trimmed
        .replace(
          /^مراجعة\s*(?:مكررة|محفوظ الأسبوع الحالي|محفوظ الأسبوع|المقدار الجديد|الجديد|المقدار)?\s*/,
          "",
        )
        .trim();
    } else {
      return null;
    }
  }

  // Strip trailing "غيباً" and trailing repetition counts so matching portions compare equal
  portion = portion.replace(/\s+غيباً$/g, "").trim();
  portion = portion.replace(/\s*\(\d+\s*(?:مرات|مرة|تكراراً|تكرار)\)\s*$/g, "").trim();
  portion = portion.replace(/\s+غيباً$/g, "").trim();

  // Clean common redundant page prefixes without touching Surah/verse wording
  portion = portion.replace(/^صفحة\s+/, "ص ");
  portion = portion.replace(/^من صفحة\s+/, "من ص ");

  if (!portion) return null;
  return { action, portion };
}

