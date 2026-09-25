'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type ViewMode = 'all' | 'temp' | 'fish' | 'alcohol' | 'drive';

// 管理者パスコード（必要に応じて自由に変更してください）
const ADMIN_PASSCODE = 'gyorui370220';

interface EditTarget {
  table: string;
  id: string;
  name: string;
  currentIso: string;
  notes?: string;
  timeField: string;
}

export default function AdminDashboard() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [targetDate, setTargetDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  // 認証ステート
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPass, setInputPass] = useState('');
  const [passError, setPassError] = useState('');

  // 編集モーダルステート
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editTimeValue, setEditTimeValue] = useState('');
  const [editNotesValue, setEditNotesValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // 各種データ
  const [alcohols, setAlcohols] = useState<any[]>([]);
  const [fishes, setFishes] = useState<any[]>([]);
  const [temps, setTemps] = useState<any[]>([]);
  const [closings, setClosings] = useState<any[]>([]);
  const [receivings, setReceivings] = useState<any[]>([]);
  const [drives, setDrives] = useState<any[]>([]);

  // 認証チェック
  useEffect(() => {
    const authStatus = sessionStorage.getItem('admin_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPass === ADMIN_PASSCODE) {
      sessionStorage.setItem('admin_authenticated', 'true');
      setIsAuthenticated(true);
      setPassError('');
    } else {
      setPassError('パスコードが正しくありません');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
    setInputPass('');
  };

  // データ取得
  const fetchData = async (dateStr: string) => {
    if (!isAuthenticated) return;
    setLoading(true);
    const start = `${dateStr}T00:00:00+09:00`;
    const end = `${dateStr}T23:59:59+09:00`;

    try {
      const [rAlc, rFish, rTemp, rClose, rRec, rDrive] = await Promise.all([
        supabase.from('check_alcohol').select('*').gte('checked_at', start).lte('checked_at', end).order('checked_at', { ascending: true }),
        supabase.from('check_fish_processing').select('*').gte('checked_at', start).lte('checked_at', end).order('checked_at', { ascending: true }),
        supabase.from('check_temp_hygiene').select('*').gte('checked_at', start).lte('checked_at', end).order('checked_at', { ascending: true }),
        supabase.from('check_temp_closing').select('*').gte('checked_at', start).lte('checked_at', end).order('checked_at', { ascending: true }),
        supabase.from('check_receiving').select('*').gte('checked_at', start).lte('checked_at', end).order('checked_at', { ascending: true }),
        supabase.from('check_driving_report').select('*').gte('start_at', start).lte('start_at', end).order('start_at', { ascending: true }),
      ]);

      setAlcohols(rAlc.data || []);
      setFishes(rFish.data || []);
      setTemps(rTemp.data || []);
      setClosings(rClose.data || []);
      setReceivings(rRec.data || []);
      setDrives(rDrive.data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData(targetDate);
    }
  }, [targetDate, isAuthenticated]);

  // レコード削除
  const handleDelete = async (table: string, id: string, label: string) => {
    if (!confirm(`【警告】この記録（${label}）を完全に削除しますか？\n誤入力やテストデータ以外は削除しないでください。`)) {
      return;
    }
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      await fetchData(targetDate);
      alert('削除が完了しました。');
    } catch (err: any) {
      alert('削除エラー: ' + (err.message || 'Supabase接続エラー'));
    }
  };

  // 編集モーダルを開く
  const openEditModal = (target: EditTarget) => {
    setEditTarget(target);
    const d = new Date(target.currentIso);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setEditTimeValue(d.toISOString().slice(0, 16));
    setEditNotesValue(target.notes || '');
  };

  // 編集の保存
  const handleSaveEdit = async () => {
    if (!editTarget || !editTimeValue) return;
    setSavingEdit(true);
    try {
      const updatedIso = new Date(editTimeValue).toISOString();
      const updatePayload: any = {
        [editTarget.timeField]: updatedIso,
      };
      if (editTarget.notes !== undefined) {
        updatePayload.notes = editNotesValue;
      }

      const { error } = await supabase.from(editTarget.table).update(updatePayload).eq('id', editTarget.id);
      if (error) throw error;

      setEditTarget(null);
      await fetchData(targetDate);
      alert('修正を保存しました。');
    } catch (err: any) {
      alert('更新エラー: ' + (err.message || 'Supabase接続エラー'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // ログイン画面（未認証時）
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-2xl border-4 border-slate-700 space-y-6">
          <div className="text-center space-y-2">
            <span className="text-4xl">🔐</span>
            <h1 className="text-2xl font-black text-slate-900">管理者ログイン</h1>
            <p className="text-xs font-bold text-slate-500">
              業務管理簿の閲覧・修正・削除にはパスコードが必要です
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">管理者パスコード</label>
              <input
                type="password"
                required
                value={inputPass}
                onChange={(e) => setInputPass(e.target.value)}
                placeholder="パスコードを入力"
                className="w-full h-14 px-4 text-center text-2xl tracking-widest font-black border-2 border-slate-400 rounded-xl focus:border-blue-600 outline-none"
              />
              {passError && <p className="text-xs font-bold text-red-600 mt-2 text-center">{passError}</p>}
            </div>

            <button
              type="submit"
              className="w-full h-14 bg-blue-700 hover:bg-blue-800 text-white font-black text-lg rounded-xl shadow-lg transition-all"
            >
              認証して管理画面を開く
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link href="/" className="text-xs text-slate-500 font-bold hover:underline">
              ← 入力フォーム画面へ戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 管理者メイン画面（認証完了時）
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 print:p-0 print:bg-white font-sans">
      {/* 画面操作コントロールバー（印刷時は非表示） */}
      <div className="max-w-5xl mx-auto mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">業務管理簿・日報集計</h1>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                管理者認証済
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold">点検確認・時刻修正・誤送信削除・印刷PDF出力</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-600">日付:</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="p-1.5 border border-slate-300 rounded text-xs font-semibold"
              />
            </div>

            <button
              onClick={() => fetchData(targetDate)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded"
            >
              🔄 更新
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow flex items-center gap-1"
            >
              🖨️ 印刷 / PDF保存
            </button>

            <Link
              href="/"
              className="px-2.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded"
            >
              入力画面
            </Link>

            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 text-xs font-bold rounded"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* 単体リスト切り替えタブ */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-1.5 overflow-x-auto">
          {[
            { key: 'all', label: '📋 日報まとめ（一括・印刷用）' },
            { key: 'temp', label: `🌡️ 温度・受入管理 (${temps.length + closings.length + receivings.length})` },
            { key: 'fish', label: `🐟 生魚加工 (${fishes.length})` },
            { key: 'alcohol', label: `📋 基本・点呼 (${alcohols.length})` },
            { key: 'drive', label: `🚗 運転日報 (${drives.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key as ViewMode)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                viewMode === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* メイン表示エリア */}
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-2 print:max-w-none">
        {/* 帳票ヘッダー */}
        <div className="border-b-2 border-slate-800 pb-2 mb-4 flex justify-between items-end">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 print:text-lg">
              {viewMode === 'all' && '業務点検日報（日次取りまとめ）'}
              {viewMode === 'temp' && '温度衛生管理・荷物受入 点検記録簿'}
              {viewMode === 'fish' && '生魚加工 衛生管理点検記録簿'}
              {viewMode === 'alcohol' && '基本チェック・点呼記録簿（対面確認）'}
              {viewMode === 'drive' && '運転日報 運行記録簿'}
            </h2>
            <div className="text-xs font-bold text-slate-700 mt-1">
              対象日: <span className="text-sm text-blue-900 underline">{targetDate}</span>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500" suppressHydrationWarning>
            出力: {new Date().toLocaleString('ja-JP')}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 font-bold text-xs">データを取得中...</div>
        ) : (
          <div className="space-y-6 print:space-y-4 text-xs">
            {/* ========================================================
                1. 温度衛生管理（出勤時 & 退勤前 & 荷物受入）
               ======================================================== */}
            {(viewMode === 'all' || viewMode === 'temp') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-cyan-600 mb-2">
                  1. 温度衛生管理（日常・出勤時 & 退勤前 & 荷物受入）
                </h3>

                {/* 温度管理グリッド（出勤時・退勤前） */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 mb-3">
                  {/* 出勤時 */}
                  <div className="border border-slate-300 rounded p-2.5">
                    <div className="font-bold text-slate-700 mb-1.5 border-b pb-1">■ 日常・出勤時 点検</div>
                    {temps.length === 0 ? (
                      <div className="text-slate-400 italic p-1">記録なし</div>
                    ) : (
                      temps.map((row) => (
                        <div key={row.id} className="space-y-1.5 mb-2 last:mb-0 border-b last:border-b-0 pb-2 last:pb-0">
                          <div className="flex justify-between items-center text-slate-500 font-mono">
                            <span>記入者: <b>{row.staff_name}</b></span>
                            <div className="flex items-center gap-1.5">
                              <span>{new Date(row.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <button
                                onClick={() => openEditModal({ table: 'check_temp_hygiene', id: row.id, name: row.staff_name, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })}
                                className="print:hidden text-[10px] text-blue-600 hover:underline px-1"
                              >
                                ✏️時刻
                              </button>
                              <button
                                onClick={() => handleDelete('check_temp_hygiene', row.id, `${row.staff_name}さんの出勤時温度`)}
                                className="print:hidden text-[10px] text-red-600 hover:underline px-1"
                              >
                                🗑️削除
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-slate-50 p-2 rounded font-mono">
                            <div>本庫: <b>{row.main_freezer_temp !== null ? `${row.main_freezer_temp}℃` : '-'}</b></div>
                            <div>2号室: <b>{row.room2_freezer_temp !== null ? `${row.room2_freezer_temp}℃` : '-'}</b></div>
                            <div>鮮魚庫: <b>{row.fish_storage_temp !== null ? `${row.fish_storage_temp}℃` : '-'}</b></div>
                            <div>定温売場: <b>{row.constant_floor_temp !== null ? `${row.constant_floor_temp}℃` : '-'}</b></div>
                            <div>売場(場内): <b>{row.floor_temp !== null ? `${row.floor_temp}℃` : '-'}</b></div>
                          </div>
                          <div className="text-[11px] text-slate-600 space-y-0.5">
                            <div>太物売場衛生: <b>{row.processing_zone_status}</b></div>
                            <div>害獣痕跡: <b>{row.pest_evidence}</b></div>
                            {row.notes && <div className="text-amber-800">特記: {row.notes}</div>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 退勤前 */}
                  <div className="border border-slate-300 rounded p-2.5">
                    <div className="font-bold text-slate-700 mb-1.5 border-b pb-1">■ 退勤前 点検</div>
                    {closings.length === 0 ? (
                      <div className="text-slate-400 italic p-1">記録なし</div>
                    ) : (
                      closings.map((row) => (
                        <div key={row.id} className="space-y-1.5 mb-2 last:mb-0 border-b last:border-b-0 pb-2 last:pb-0">
                          <div className="flex justify-between items-center text-slate-500 font-mono">
                            <span>記入者: <b>{row.staff_name}</b></span>
                            <div className="flex items-center gap-1.5">
                              <span>{new Date(row.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <button
                                onClick={() => openEditModal({ table: 'check_temp_closing', id: row.id, name: row.staff_name, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })}
                                className="print:hidden text-[10px] text-blue-600 hover:underline px-1"
                              >
                                ✏️時刻
                              </button>
                              <button
                                onClick={() => handleDelete('check_temp_closing', row.id, `${row.staff_name}さんの退勤前温度`)}
                                className="print:hidden text-[10px] text-red-600 hover:underline px-1"
                              >
                                🗑️削除
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-slate-50 p-2 rounded font-mono">
                            <div>本庫: <b>{row.main_freezer_temp !== null ? `${row.main_freezer_temp}℃` : '-'}</b></div>
                            <div>2号室: <b>{row.room2_freezer_temp !== null ? `${row.room2_freezer_temp}℃` : '-'}</b></div>
                          </div>
                          {row.notes && <div className="text-[11px] text-amber-800">特記: {row.notes}</div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ★ 荷物受入 点検記録（便名カラム対応 ＋ 修正・削除ボタン） */}
                <div className="border border-slate-300 rounded p-2.5 bg-white">
                  <div className="font-bold text-slate-700 mb-1.5 border-b pb-1 flex justify-between items-center">
                    <span>■ 荷物受入 点検記録</span>
                    <span className="text-[11px] text-slate-500 font-normal">（外観・包装破損／鮮度におい／輸送温度）</span>
                  </div>
                  {receivings.length === 0 ? (
                    <div className="text-slate-400 italic p-1">記録なし</div>
                  ) : (
                    <table className="w-full border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-50 text-center">
                          <th className="border border-slate-300 p-1">受入時刻</th>
                          <th className="border border-slate-300 p-1">受入担当</th>
                          <th className="border border-slate-300 p-1 bg-teal-50">便名</th>
                          <th className="border border-slate-300 p-1">外観・包装</th>
                          <th className="border border-slate-300 p-1">鮮度・におい</th>
                          <th className="border border-slate-300 p-1">輸送温度</th>
                          <th className="border border-slate-300 p-1">特記事項・連絡事項</th>
                          <th className="border border-slate-300 p-1 print:hidden w-16">管理</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receivings.map((row) => {
                          const hasBad = row.pkg_status === 'わるい' || row.freshness_status === 'わるい' || row.transit_temp_status === 'わるい';
                          return (
                            <tr key={row.id} className="text-center">
                              <td className="border border-slate-300 p-1 font-mono">
                                {new Date(row.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="border border-slate-300 p-1 font-bold">{row.staff_name}</td>
                              <td className="border border-slate-300 p-1 font-black text-teal-800 bg-teal-50/50">
                                {row.flight_name || '-'}
                              </td>
                              <td className={`border border-slate-300 p-1 ${row.pkg_status === 'わるい' ? 'text-red-600 bg-red-50 font-bold' : ''}`}>
                                {row.pkg_status}
                              </td>
                              <td className={`border border-slate-300 p-1 ${row.freshness_status === 'わるい' ? 'text-red-600 bg-red-50 font-bold' : ''}`}>
                                {row.freshness_status}
                              </td>
                              <td className={`border border-slate-300 p-1 ${row.transit_temp_status === 'わるい' ? 'text-red-600 bg-red-50 font-bold' : ''}`}>
                                {row.transit_temp_status}
                              </td>
                              <td className={`border border-slate-300 p-1 text-left ${hasBad ? 'text-red-700 font-bold' : ''}`}>
                                {row.notes || '-'}
                              </td>
                              <td className="border border-slate-300 p-1 print:hidden whitespace-nowrap">
                                <button
                                  onClick={() => openEditModal({ table: 'check_receiving', id: row.id, name: `${row.staff_name} (${row.flight_name})`, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })}
                                  className="text-[10px] text-blue-600 hover:underline mr-1"
                                >
                                  ✏️時刻
                                </button>
                                <button
                                  onClick={() => handleDelete('check_receiving', row.id, `${row.staff_name}さんの受入記録`)}
                                  className="text-[10px] text-red-600 hover:underline"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            )}

            {/* ========================================================
                2. 生魚加工 衛生管理点検
               ======================================================== */}
            {(viewMode === 'all' || viewMode === 'fish') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-emerald-600 mb-2">
                  2. 生魚加工 衛生管理点検
                </h3>
                {fishes.length === 0 ? (
                  <div className="text-slate-400 italic p-2">記録なし</div>
                ) : (
                  <table className="w-full border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50 text-center">
                        <th className="border border-slate-300 p-1.5">時刻</th>
                        <th className="border border-slate-300 p-1.5">点検者</th>
                        <th className="border border-slate-300 p-1.5">健康状態</th>
                        <th className="border border-slate-300 p-1.5">手洗い</th>
                        <th className="border border-slate-300 p-1.5">商品確認</th>
                        <th className="border border-slate-300 p-1.5">魚体洗浄</th>
                        <th className="border border-slate-300 p-1.5">作業温度</th>
                        <th className="border border-slate-300 p-1.5">施設衛生</th>
                        <th className="border border-slate-300 p-1.5">用具衛生</th>
                        <th className="border border-slate-300 p-1.5">特記事項</th>
                        <th className="border border-slate-300 p-1.5 print:hidden w-16">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fishes.map((row) => (
                        <tr key={row.id} className="text-center">
                          <td className="border border-slate-300 p-1.5 font-mono">
                            {new Date(row.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="border border-slate-300 p-1.5 font-bold">{row.staff_name}</td>
                          <td className={`border border-slate-300 p-1.5 font-bold ${row.health_status === '否' ? 'text-red-600 bg-red-50' : ''}`}>
                            {row.health_status}
                          </td>
                          <td className="border border-slate-300 p-1.5">
                            {row.hand_washing ? '済' : <span className="text-red-600 font-bold">未</span>}
                          </td>
                          <td className={`border border-slate-300 p-1.5 ${row.product_check === 'わるい' ? 'text-red-600 bg-red-50 font-bold' : ''}`}>
                            {row.product_check}
                          </td>
                          <td className="border border-slate-300 p-1.5">{row.fish_washing}</td>
                          <td className="border border-slate-300 p-1.5">{row.work_temp}</td>
                          <td className="border border-slate-300 p-1.5">{row.facility_hygiene}</td>
                          <td className="border border-slate-300 p-1.5">{row.tools_hygiene}</td>
                          <td className="border border-slate-300 p-1.5 text-left">{row.notes || '-'}</td>
                          <td className="border border-slate-300 p-1.5 print:hidden whitespace-nowrap">
                            <button
                              onClick={() => openEditModal({ table: 'check_fish_processing', id: row.id, name: row.staff_name, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })}
                              className="text-[10px] text-blue-600 hover:underline mr-1"
                            >
                              ✏️時刻
                            </button>
                            <button
                              onClick={() => handleDelete('check_fish_processing', row.id, `${row.staff_name}さんの生魚加工記録`)}
                              className="text-[10px] text-red-600 hover:underline"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {/* ========================================================
                3. 基本チェック・アルコール点呼記録簿（対面確認）
               ======================================================== */}
            {(viewMode === 'all' || viewMode === 'alcohol') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-blue-600 mb-2">
                  3. 基本チェック・アルコール点呼記録簿（対面確認）
                </h3>
                {alcohols.length === 0 ? (
                  <div className="text-slate-400 italic p-2">記録なし</div>
                ) : (
                  <table className="w-full border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-1.5">時刻</th>
                        <th className="border border-slate-300 p-1.5">担当者名</th>
                        <th className="border border-slate-300 p-1.5">確認者名</th>
                        <th className="border border-slate-300 p-1.5">測定値 (mg/L)</th>
                        <th className="border border-slate-300 p-1.5">判定</th>
                        <th className="border border-slate-300 p-1.5">点検・特記事項</th>
                        <th className="border border-slate-300 p-1.5 print:hidden w-16">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alcohols.map((row) => {
                        const v = Number(row.alcohol_value);
                        const isDanger = v >= 0.15;
                        return (
                          <tr key={row.id} className="text-center">
                            <td className="border border-slate-300 p-1.5 font-mono">
                              {new Date(row.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="border border-slate-300 p-1.5 font-bold">{row.staff_name}</td>
                            <td className="border border-slate-300 p-1.5">{row.checker_name}</td>
                            <td className="border border-slate-300 p-1.5 font-bold font-mono">
                              {Number(row.alcohol_value).toFixed(2)}
                            </td>
                            <td className="border border-slate-300 p-1.5 font-bold">
                              {v === 0 ? (
                                <span className="text-emerald-700">合格 (0.00)</span>
                              ) : isDanger ? (
                                <span className="text-red-700 bg-red-50 px-1 py-0.5 rounded border border-red-300">
                                  🚨 基準値超過 (乗車禁止)
                                </span>
                              ) : (
                                <span className="text-amber-700">微量検出</span>
                              )}
                            </td>
                            <td className="border border-slate-300 p-1.5 text-left">{row.notes || '-'}</td>
                            <td className="border border-slate-300 p-1.5 print:hidden whitespace-nowrap">
                              <button
                                onClick={() => openEditModal({ table: 'check_alcohol', id: row.id, name: row.staff_name, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })}
                                className="text-[10px] text-blue-600 hover:underline mr-1"
                              >
                                ✏️時刻
                              </button>
                              <button
                                onClick={() => handleDelete('check_alcohol', row.id, `${row.staff_name}さんの点呼記録`)}
                                className="text-[10px] text-red-600 hover:underline"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {/* ========================================================
                4. 運転日報
               ======================================================== */}
            {(viewMode === 'all' || viewMode === 'drive') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-amber-600 mb-2">
                  4. 運転日報
                </h3>
                {drives.length === 0 ? (
                  <div className="text-slate-400 italic p-2">記録なし</div>
                ) : (
                  <table className="w-full border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50 text-center">
                        <th className="border border-slate-300 p-1.5">運転者</th>
                        <th className="border border-slate-300 p-1.5">車両</th>
                        <th className="border border-slate-300 p-1.5">行先</th>
                        <th className="border border-slate-300 p-1.5">同乗者</th>
                        <th className="border border-slate-300 p-1.5">出発 / メーター</th>
                        <th className="border border-slate-300 p-1.5">帰社 / メーター</th>
                        <th className="border border-slate-300 p-1.5">走行距離</th>
                        <th className="border border-slate-300 p-1.5">給油</th>
                        <th className="border border-slate-300 p-1.5">特記事項</th>
                        <th className="border border-slate-300 p-1.5 print:hidden w-16">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drives.map((row) => {
                        const distance =
                          row.start_meter && row.end_meter
                            ? (Number(row.end_meter) - Number(row.start_meter)).toFixed(1)
                            : '-';
                        return (
                          <tr key={row.id} className="text-center">
                            <td className="border border-slate-300 p-1.5 font-bold">{row.staff_name}</td>
                            <td className="border border-slate-300 p-1.5">{row.vehicle_name}</td>
                            <td className="border border-slate-300 p-1.5">{row.destination}</td>
                            <td className="border border-slate-300 p-1.5">{row.passenger || '-'}</td>
                            <td className="border border-slate-300 p-1.5 font-mono">
                              {new Date(row.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              <br />
                              <span className="text-slate-500 font-bold">{row.start_meter} km</span>
                            </td>
                            <td className="border border-slate-300 p-1.5 font-mono">
                              {row.end_at ? (
                                <>
                                  {new Date(row.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  <br />
                                  <span className="text-slate-500 font-bold">{row.end_meter} km</span>
                                </>
                              ) : (
                                <span className="text-amber-600 font-bold">運行中</span>
                              )}
                            </td>
                            <td className="border border-slate-300 p-1.5 font-bold font-mono">
                              {distance !== '-' ? `${distance} km` : '-'}
                            </td>
                            <td className="border border-slate-300 p-1.5 font-mono">
                              {row.refuel_liters ? `${row.refuel_liters} L` : '-'}
                            </td>
                            <td className="border border-slate-300 p-1.5 text-left">{row.notes || '-'}</td>
                            <td className="border border-slate-300 p-1.5 print:hidden whitespace-nowrap">
                              <button
                                onClick={() => openEditModal({ table: 'check_driving_report', id: row.id, name: row.staff_name, currentIso: row.start_at, notes: row.notes, timeField: 'start_at' })}
                                className="text-[10px] text-blue-600 hover:underline mr-1"
                              >
                                ✏️時刻
                              </button>
                              <button
                                onClick={() => handleDelete('check_driving_report', row.id, `${row.staff_name}さんの運行記録`)}
                                className="text-[10px] text-red-600 hover:underline"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            )}
          </div>
        )}

        {/* 帳票フッター（署名・承認欄） */}
        <div className="mt-8 pt-4 border-t border-slate-300 flex justify-end gap-6 text-center text-xs">
          <div className="w-24 border border-slate-400 p-1 h-20 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500">管理者確認印</span>
            <div className="h-10"></div>
          </div>
          <div className="w-24 border border-slate-400 p-1 h-20 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500">責任者承認印</span>
            <div className="h-10"></div>
          </div>
        </div>
      </div>

      {/* ========================================================
          時刻修正・特記編集モーダルダイアログ
         ======================================================== */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-4 border-blue-600 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-black text-slate-900">
                📝 記録の修正（{editTarget.name}）
              </h3>
              <button
                onClick={() => setEditTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  記録日時（修正後）
                </label>
                <input
                  type="datetime-local"
                  value={editTimeValue}
                  onChange={(e) => setEditTimeValue(e.target.value)}
                  className="w-full h-11 px-3 border-2 border-slate-400 rounded-lg text-sm font-bold bg-white"
                />
              </div>

              {editTarget.notes !== undefined && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    特記事項・連絡事項
                  </label>
                  <textarea
                    rows={3}
                    value={editNotesValue}
                    onChange={(e) => setEditNotesValue(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-400 rounded-lg text-xs"
                    placeholder="修正理由や特記事項を入力"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="flex-1 h-10 bg-slate-200 hover:bg-slate-300 font-bold rounded-lg text-xs"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow disabled:opacity-50"
              >
                {savingEdit ? '保存中...' : '修正を保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}