// 勤怠（基本チェックの出勤時・退勤時）の判定ロジック
//
// ・稼働枠（日報の区切り）は 20:00〜翌20:00（JST）
//   例: 21:00〜翌9:00 / 3:00〜12:00 / 7:00〜15:00 の勤務は、出勤と退勤が同じ稼働枠に入る
// ・出勤と退勤は「ペア」で判定する
//   - 退勤は、その人の「まだ退勤していない出勤」に対してだけ記録できる
//   - 出勤は、前回の勤務の退勤が済んでいなければ記録できない（退勤忘れは後日入力へ誘導）
//   そのため、稼働枠や日付をまたぐ残業でも重複・誤判定が起きない

export const BUSINESS_DAY_START_HOUR = 20;

// 出勤から何時間以内なら「その勤務の退勤」として通常どおり記録できるか
export const OPEN_SHIFT_MAX_HOURS = 20;

// 後日入力の退勤時刻の初期値（出勤からの時間）
const DEFAULT_SETTLE_HOURS = 8;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

const pad = (n: number) => String(n).padStart(2, '0');

// Date → JST の各要素
const jstParts = (d: Date) => {
  const j = new Date(d.getTime() + JST_OFFSET_MS);
  return {
    y: j.getUTCFullYear(),
    m: j.getUTCMonth() + 1,
    d: j.getUTCDate(),
    h: j.getUTCHours(),
    min: j.getUTCMinutes(),
    dow: j.getUTCDay(),
  };
};

// JST の年月日・時刻から Date を作る（月日の繰り上がりも正しく扱う）
const fromJst = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min) - JST_OFFSET_MS);

const toIsoJst = (d: Date) => {
  const p = jstParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}:00+09:00`;
};

// 日時入力欄（datetime-local）用の JST 文字列 YYYY-MM-DDTHH:mm
export const toJstInputValue = (d: Date) => {
  const p = jstParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
};

export interface BusinessSlot {
  slotStartIso: string;
  slotEndIso: string;
  startMs: number;
  endMs: number;
  /** 稼働枠が終わる日付（日報の日付）例: 11/14(金) */
  dateLabel: string;
}

// 指定日時が属する稼働枠
export const getBusinessSlotForDate = (date: Date | string): BusinessSlot => {
  const t = typeof date === 'string' ? new Date(date) : date;
  const p = jstParts(t);
  // 20:00 より前なら、前日 20:00 から始まる稼働枠
  const startDayOffset = p.h < BUSINESS_DAY_START_HOUR ? -1 : 0;
  const start = fromJst(p.y, p.m, p.d + startDayOffset, BUSINESS_DAY_START_HOUR);
  const end = new Date(start.getTime() + 24 * HOUR_MS);
  const e = jstParts(end);
  return {
    slotStartIso: toIsoJst(start),
    slotEndIso: toIsoJst(end),
    startMs: start.getTime(),
    endMs: end.getTime(),
    dateLabel: `${e.m}/${e.d}(${DAY_NAMES[e.dow]})`,
  };
};

// 現在の稼働枠
export const getBusinessRangeJST = () => {
  const s = getBusinessSlotForDate(new Date());
  return { startIso: s.slotStartIso, endIso: s.slotEndIso };
};

// 日報の日付（YYYY-MM-DD）→ その日の稼働枠（前日20:00〜当日20:00）
export const getBusinessPeriod = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const end = fromJst(y, m, d, BUSINESS_DAY_START_HOUR);
  const start = new Date(end.getTime() - 24 * HOUR_MS);
  const s = jstParts(start);
  const h = pad(BUSINESS_DAY_START_HOUR);
  return {
    startIso: toIsoJst(start),
    endIso: toIsoJst(end),
    label: `${s.m}/${s.d} ${h}:00 ～ ${m}/${d} ${h}:00`,
  };
};

export const isSameBusinessSlot = (a: Date | string, b: Date | string) =>
  getBusinessSlotForDate(a).startMs === getBusinessSlotForDate(b).startMs;

// ------------------------------------------------------------------
// 出勤・退勤のペア判定
// ------------------------------------------------------------------

export interface AttendanceLog {
  id?: string;
  checked_at: string;
  notes: string | null;
  staff_name?: string;
}

export type AttendanceKind = 'start' | 'finish';

export const attendanceKindOf = (notes: string | null | undefined): AttendanceKind | null => {
  if (!notes) return null;
  if (notes.includes('出勤時')) return 'start';
  if (notes.includes('退勤時')) return 'finish';
  return null;
};

export interface AttendanceState {
  /** 時刻が最も新しい出勤・退勤の記録 */
  latest: AttendanceLog | null;
  latestKind: AttendanceKind | null;
  /** まだ退勤していない出勤（最新の記録が出勤のとき） */
  openStart: AttendanceLog | null;
}

// 本人の記録（順不同）から現在の状態を求める
export const getAttendanceState = (myLogs: AttendanceLog[], now: Date = new Date()): AttendanceState => {
  const nowMs = now.getTime();
  const typed = myLogs
    .filter((r) => attendanceKindOf(r.notes) !== null && new Date(r.checked_at).getTime() <= nowMs + 5 * 60 * 1000)
    .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime());
  const latest = typed[0] || null;
  const latestKind = latest ? attendanceKindOf(latest.notes) : null;
  return { latest, latestKind, openStart: latestKind === 'start' ? latest : null };
};

export type StartDecision =
  | { kind: 'ok' }
  | { kind: 'duplicate'; record: AttendanceLog } // 今の稼働枠で出勤済み（退勤前）
  | { kind: 'unsettled'; start: AttendanceLog }; // 前の勤務の退勤が未記録

export const decideStart = (state: AttendanceState, now: Date = new Date()): StartDecision => {
  const open = state.openStart;
  if (!open) return { kind: 'ok' };
  const hoursSince = (now.getTime() - new Date(open.checked_at).getTime()) / HOUR_MS;
  if (isSameBusinessSlot(open.checked_at, now) && hoursSince < OPEN_SHIFT_MAX_HOURS) {
    return { kind: 'duplicate', record: open };
  }
  return { kind: 'unsettled', start: open };
};

export type FinishDecision =
  | { kind: 'ok'; start: AttendanceLog }
  | { kind: 'duplicate'; record: AttendanceLog } // 今の稼働枠で退勤済み
  | { kind: 'missing_start' } // 対応する出勤がない
  | { kind: 'unsettled'; start: AttendanceLog }; // 出勤が古すぎる（退勤忘れ）→ 後日入力へ

export const decideFinish = (state: AttendanceState, now: Date = new Date()): FinishDecision => {
  const open = state.openStart;
  if (open) {
    const hoursSince = (now.getTime() - new Date(open.checked_at).getTime()) / HOUR_MS;
    if (hoursSince <= OPEN_SHIFT_MAX_HOURS || isSameBusinessSlot(open.checked_at, now)) {
      return { kind: 'ok', start: open };
    }
    return { kind: 'unsettled', start: open };
  }
  if (state.latest && state.latestKind === 'finish' && isSameBusinessSlot(state.latest.checked_at, now)) {
    return { kind: 'duplicate', record: state.latest };
  }
  return { kind: 'missing_start' };
};

export type SettleDecision =
  | { kind: 'ok' }
  | { kind: 'already_settled' } // 対象の出勤は既に退勤済み（二重入力）
  | { kind: 'before_start' } // 退勤時刻が出勤より前
  | { kind: 'in_future' }; // 退勤時刻が未来

export const decideSettle = (
  state: AttendanceState,
  target: { id?: string; checkedAtIso: string },
  settleAt: Date,
  now: Date = new Date()
): SettleDecision => {
  const open = state.openStart;
  const sameRecord =
    !!open &&
    (target.id ? open.id === target.id : new Date(open.checked_at).getTime() === new Date(target.checkedAtIso).getTime());
  if (!sameRecord) return { kind: 'already_settled' };
  if (settleAt.getTime() <= new Date(target.checkedAtIso).getTime()) return { kind: 'before_start' };
  if (settleAt.getTime() > now.getTime() + 60 * 1000) return { kind: 'in_future' };
  return { kind: 'ok' };
};

// 後日入力の退勤時刻の初期値: 出勤+8時間（ただし稼働枠の終わりと現在時刻を超えない）
export const defaultSettleTime = (startIso: string, now: Date = new Date()): Date => {
  const start = new Date(startIso).getTime();
  const slotEnd = getBusinessSlotForDate(startIso).endMs;
  const t = Math.min(start + DEFAULT_SETTLE_HOURS * HOUR_MS, slotEnd - 60 * 1000, now.getTime() - 60 * 1000);
  return new Date(Math.max(t, start + 60 * 1000));
};

// ------------------------------------------------------------------
// 担当者名の照合（入力画面と同じルール: 空白を除いて一致、または一方が他方を含む）
// ------------------------------------------------------------------

export const normalizeStaffName = (name: string | null | undefined) => (name || '').replace(/[\s　]+/g, '').trim();

export const isSameStaff = (a: string | null | undefined, b: string | null | undefined) => {
  const x = normalizeStaffName(a);
  const y = normalizeStaffName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
};

// ------------------------------------------------------------------
// 勤怠の記録漏れ検出（案A）
// その稼働枠に他の業務記録があるのに、出勤・退勤の記録が1件も無い人を探す
// ------------------------------------------------------------------

export interface ActivityRecord {
  staff_name: string | null;
  at: string; // 記録日時
  source: string; // 例: 温度管理、運転日報
}

export interface MissingAttendance {
  name: string;
  sources: { source: string; count: number }[];
  firstAt: string;
  lastAt: string;
}

export const findMissingAttendance = (
  attendanceLogs: { staff_name?: string | null; notes: string | null }[],
  activities: ActivityRecord[]
): MissingAttendance[] => {
  const hasAttendance = (name: string) =>
    attendanceLogs.some((r) => attendanceKindOf(r.notes) !== null && isSameStaff(r.staff_name, name));

  const groups: { name: string; items: ActivityRecord[] }[] = [];
  for (const a of activities) {
    if (!normalizeStaffName(a.staff_name)) continue;
    const g = groups.find((x) => isSameStaff(x.name, a.staff_name));
    if (g) g.items.push(a);
    else groups.push({ name: (a.staff_name || '').trim(), items: [a] });
  }

  return groups
    .filter((g) => !hasAttendance(g.name))
    .map((g) => {
      const times = g.items.map((i) => new Date(i.at).getTime()).sort((a, b) => a - b);
      const counts = new Map<string, number>();
      g.items.forEach((i) => counts.set(i.source, (counts.get(i.source) || 0) + 1));
      return {
        name: g.name,
        sources: Array.from(counts, ([source, count]) => ({ source, count })),
        firstAt: new Date(times[0]).toISOString(),
        lastAt: new Date(times[times.length - 1]).toISOString(),
      };
    })
    .sort((a, b) => a.firstAt.localeCompare(b.firstAt));
};

// ------------------------------------------------------------------
// 管理者による勤怠の補正入力（案B）の妥当性チェック
// ------------------------------------------------------------------

export type CorrectionKind = 'both' | 'start' | 'finish';

const fmt = (iso: string) => {
  const p = jstParts(new Date(iso));
  return `${p.m}/${p.d} ${pad(p.h)}:${pad(p.min)}`;
};

// 問題があればエラーメッセージ、なければ null
export const validateCorrection = (
  kind: CorrectionKind,
  staffLogs: AttendanceLog[], // その人の出勤・退勤の記録
  startAt: Date | null,
  finishAt: Date | null,
  now: Date = new Date()
): string | null => {
  const logs = staffLogs
    .filter((r) => attendanceKindOf(r.notes) !== null)
    .map((r) => ({ ...r, t: new Date(r.checked_at).getTime(), k: attendanceKindOf(r.notes) }))
    .sort((a, b) => a.t - b.t);
  const lastBefore = (t: number) => [...logs].reverse().find((r) => r.t < t) || null;
  const firstAfter = (t: number) => logs.find((r) => r.t > t) || null;
  const nowMs = now.getTime();

  if (kind === 'both') {
    if (!startAt || !finishAt) return '出勤時刻と退勤時刻を入力してください';
    const s = startAt.getTime();
    const f = finishAt.getTime();
    if (f <= s) return '退勤時刻は出勤時刻より後にしてください';
    if (f > nowMs) return '退勤時刻が現在より後になっています';
    if (f - s > 24 * HOUR_MS) return '勤務時間が24時間を超えています。時刻を確認してください';
    const overlap = logs.find((r) => r.t >= s && r.t <= f);
    if (overlap) return `この時間帯にすでに${overlap.k === 'start' ? '出勤' : '退勤'}の記録があります（${fmt(overlap.checked_at)}）`;
    const prev = lastBefore(s);
    if (prev && prev.k === 'start') {
      return `${fmt(prev.checked_at)} の出勤に退勤の記録がありません。先にその出勤の「退勤のみ」を補正してください`;
    }
    return null;
  }

  if (kind === 'finish') {
    if (!finishAt) return '退勤時刻を入力してください';
    const f = finishAt.getTime();
    if (f > nowMs) return '退勤時刻が現在より後になっています';
    const prev = lastBefore(f);
    if (!prev || prev.k !== 'start') {
      return '退勤のみの補正は「出勤の記録はあるが退勤の記録が無い」場合に使います。この時刻の前に、退勤していない出勤が見つかりません';
    }
    if (f - prev.t > 24 * HOUR_MS) return `対象の出勤（${fmt(prev.checked_at)}）から24時間を超えています。時刻を確認してください`;
    const next = firstAfter(prev.t);
    if (next && next.t < f) return `この出勤のあとに別の記録があります（${fmt(next.checked_at)}）。時刻を確認してください`;
    return null;
  }

  // kind === 'start'
  if (!startAt) return '出勤時刻を入力してください';
  const s = startAt.getTime();
  if (s > nowMs) return '出勤時刻が現在より後になっています';
  const prev = lastBefore(s);
  if (prev && prev.k === 'start') {
    return `${fmt(prev.checked_at)} の出勤に退勤の記録がありません。時刻を確認してください`;
  }
  const next = firstAfter(s);
  if (next) {
    if (next.k !== 'finish') return `この時刻のあとに別の出勤の記録があります（${fmt(next.checked_at)}）。「出勤と退勤」で補正してください`;
    if (next.t - s > 24 * HOUR_MS) return `次の退勤（${fmt(next.checked_at)}）まで24時間を超えています。時刻を確認してください`;
    return null;
  }
  // 次の記録が無い = 今まさに勤務中で出勤を忘れた場合のみ
  if (nowMs - s > OPEN_SHIFT_MAX_HOURS * HOUR_MS) {
    return '出勤のみの補正は「退勤の記録はあるが出勤の記録が無い」場合か、勤務中に出勤を記録し忘れた場合に使います。両方無い場合は「出勤と退勤」で補正してください';
  }
  return null;
};

// 補正記録の特記事項
export const buildCorrectionNotes = (kind: AttendanceKind, basis: string, reason: string) =>
  `${kind === 'start' ? '出勤時' : '退勤時'} 【管理者補正】【根拠: ${basis}】【理由: ${reason}】【アルコールチェック未実施】`;
