'use client';

// 勤怠の記録漏れ検出（案A）と、管理者による補正入力（案B）

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  buildCorrectionNotes,
  isSameStaff,
  toJstInputValue,
  validateCorrection,
  type AttendanceLog,
  type CorrectionKind,
  type MissingAttendance,
} from '@/lib/attendance';

const formatHm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ------------------------------------------------------------------
// 記録漏れの一覧
// ------------------------------------------------------------------
export function MissingAttendancePanel({
  items,
  onCorrect,
}: {
  items: MissingAttendance[];
  onCorrect: (item: MissingAttendance) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="print:hidden border-2 border-amber-400 bg-amber-50 rounded-xl p-3 space-y-2">
      <h3 className="font-black text-sm text-amber-900">
        ⚠️ 勤怠の記録漏れの可能性（{items.length}名）
      </h3>
      <p className="text-[11px] text-amber-900 font-bold">
        この営業日に業務の記録があるのに、出勤・退勤の記録がありません。本人に確認のうえ、必要なら補正入力してください。
      </p>
      <ul className="space-y-1.5">
        {items.map((m) => (
          <li
            key={m.name}
            className="flex flex-wrap items-center justify-between gap-2 bg-white border border-amber-300 rounded-lg px-3 py-2"
          >
            <div className="text-xs">
              <span className="font-black text-slate-900 text-sm mr-2">{m.name}</span>
              <span className="text-slate-600">
                {m.sources.map((s) => `${s.source} ${s.count}件`).join('・')}（{formatHm(m.firstAt)}〜{formatHm(m.lastAt)}）
              </span>
            </div>
            <button
              type="button"
              onClick={() => onCorrect(m)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg shadow"
            >
              🛠 補正入力
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------
// 補正入力ダイアログ
// ------------------------------------------------------------------
export interface CorrectionInitial {
  staffName?: string;
  kind?: CorrectionKind;
  startJst?: string; // YYYY-MM-DDTHH:mm
  finishJst?: string;
  hint?: string;
}

const BASIS_OPTIONS = ['本人の申告', '運転日報', '他のチェック記録', '確認者・上長の確認', 'その他'];

export function CorrectionModal({
  initial,
  staffSuggestions,
  onClose,
  onSaved,
}: {
  initial: CorrectionInitial;
  staffSuggestions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<CorrectionKind>(initial.kind || 'both');
  const [staffName, setStaffName] = useState(initial.staffName || '');
  const [startJst, setStartJst] = useState(initial.startJst || '');
  const [finishJst, setFinishJst] = useState(initial.finishJst || '');
  const [basis, setBasis] = useState(BASIS_OPTIONS[0]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const needStart = kind === 'both' || kind === 'start';
  const needFinish = kind === 'both' || kind === 'finish';

  const handleSave = async () => {
    if (saving) return;
    setError('');
    const name = staffName.trim();
    if (!name) return setError('担当者名を入力してください');
    if (!reason.trim()) return setError('補正の理由を入力してください');

    const startAt = needStart && startJst ? new Date(startJst) : null;
    const finishAt = needFinish && finishJst ? new Date(finishJst) : null;

    setSaving(true);
    try {
      // 対象者の直近の出勤・退勤記録で妥当性を確認
      const base = (startAt || finishAt || new Date()).getTime();
      const from = new Date(base - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: qErr } = await supabase
        .from('check_alcohol')
        .select('id, checked_at, notes, staff_name')
        .gte('checked_at', from)
        .order('checked_at', { ascending: true });
      if (qErr) throw qErr;
      const mine = ((data || []) as AttendanceLog[]).filter((r) => isSameStaff(r.staff_name, name));

      const problem = validateCorrection(kind, mine, startAt, finishAt);
      if (problem) {
        setError(problem);
        return;
      }

      const basisText = basis;
      const reasonText = reason.trim();
      const rows: Record<string, unknown>[] = [];
      const makeRow = (k: 'start' | 'finish', at: Date) => ({
        checked_at: at.toISOString(),
        staff_name: name,
        checker_name: '管理者補正',
        alcohol_value: null,
        notes: buildCorrectionNotes(k, basisText, reasonText),
        is_admin_correction: true,
        correction_reason: `根拠: ${basisText} / 理由: ${reasonText}`,
      });
      if (startAt) rows.push(makeRow('start', startAt));
      if (finishAt) rows.push(makeRow('finish', finishAt));

      const { error: insErr } = await supabase.from('check_alcohol').insert(rows);
      if (insErr) {
        const msg = `${insErr.message || ''} ${insErr.details || ''}`;
        if (/is_admin_correction|correction_reason|alcohol_value|null value/.test(msg)) {
          throw new Error('データベースの準備ができていません。Supabase で 04_admin_attendance_correction.sql を実行してください。');
        }
        if (/row-level security|permission/.test(msg)) {
          throw new Error('補正入力の権限がありません。管理者アカウントで再ログインしてください。');
        }
        throw insErr;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full h-11 px-3 border-2 border-slate-400 rounded-lg text-sm font-bold bg-white';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-4 border-amber-500 space-y-4 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-base font-black text-slate-900">🛠 勤怠の補正入力（管理者）</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
            ✕
          </button>
        </div>

        <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
          出勤・退勤の記録を忘れた場合に、実際に働いた時刻を管理者が補正します。
          アルコールチェックは<span className="text-red-700">「未実施」</span>として記録され、測定値は入りません。
          補正した管理者と入力日時は自動で残ります。
        </p>
        {initial.hint && (
          <p className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-300 rounded p-2">{initial.hint}</p>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">補正の種類</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { k: 'both', label: '出勤と退勤' },
                  { k: 'finish', label: '退勤のみ' },
                  { k: 'start', label: '出勤のみ' },
                ] as { k: CorrectionKind; label: string }[]
              ).map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setKind(o.k)}
                  className={`h-10 rounded-lg font-black border-2 ${
                    kind === o.k ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">担当者名</label>
            <input
              list="correction-staff-list"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className={inputCls}
              placeholder="例：山田 太郎"
            />
            <datalist id="correction-staff-list">
              {staffSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          {needStart && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">出勤時刻</label>
              <input type="datetime-local" value={startJst} onChange={(e) => setStartJst(e.target.value)} className={inputCls} />
            </div>
          )}
          {needFinish && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">退勤時刻</label>
              <input type="datetime-local" value={finishJst} onChange={(e) => setFinishJst(e.target.value)} className={inputCls} />
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">根拠</label>
            <select value={basis} onChange={(e) => setBasis(e.target.value)} className={inputCls}>
              {BASIS_OPTIONS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">補正の理由</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputCls}
              placeholder="例：出勤・退勤とも記録を忘れた"
            />
          </div>

          {error && (
            <p className="text-xs font-black text-red-700 bg-red-50 border border-red-300 rounded p-2 whitespace-pre-line">{error}</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-10 bg-slate-200 hover:bg-slate-300 font-bold rounded-lg text-xs">
            キャンセル
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 h-10 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-xs shadow disabled:opacity-50"
          >
            {saving ? '保存中...' : '補正を記録する'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 業務記録の時刻（JST入力値）を補正の初期値にする
export const correctionInitialFromMissing = (m: MissingAttendance): CorrectionInitial => ({
  staffName: m.name,
  kind: 'both',
  startJst: toJstInputValue(new Date(m.firstAt)),
  finishJst: toJstInputValue(new Date(m.lastAt)),
  hint: '初期値は、その日の業務記録の最初と最後の時刻です。実際の出勤・退勤時刻に直してください。',
});
