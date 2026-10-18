'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type ViewMode = 'all' | 'temp_sheet' | 'fish_sheet' | 'kowari_sheet' | 'alcohol' | 'drive';

// 管理者パスコード
const ADMIN_PASSCODE = 'gyorui370220';

interface EditTarget {
  table: string;
  id: string;
  name: string;
  currentIso: string;
  notes?: string;
  timeField: string;
}

interface WeatherInfo {
  weatherText: string;
  temp: number | null;
  humidity: number | null;
}

// 出勤・退勤の判定ヘルパー
const getTimingType = (notes: string | null = ''): 'start' | 'finish' | 'unknown' => {
  if (!notes) return 'unknown';
  if (notes.includes('出勤時') || notes.includes('業務前')) return 'start';
  if (notes.includes('退勤時') || notes.includes('業務後')) return 'finish';
  return 'unknown';
};

// 開いた時点の日本時間（JST）の今日の日付文字列(YYYY-MM-DD)を取得
const getTodayJST = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

// 西暦なしの日時フォーマット（M/D HH:mm）
const formatShortDateTime = (isoString: string) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${date} ${hours}:${minutes}`;
};

// 期間指定（開始日〜終了日）からクエリ用のISO範囲を算出
const getPeriodRange = (startDateStr: string, endDateStr: string) => {
  const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
  const startBase = new Date(sYear, sMonth - 1, sDay - 1, 16, 0, 0);
  const prevMonth = startBase.getMonth() + 1;
  const prevDay = startBase.getDate();
  const prevDateStr = `${startBase.getFullYear()}-${String(prevMonth).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
  const startIso = `${prevDateStr}T16:00:00+09:00`;

  const endIso = `${endDateStr}T16:00:00+09:00`;
  const label = `${prevMonth}/${prevDay} 16:00 ～ ${endDateStr.replace('-', '/')} 16:00`;

  return { startIso, endIso, label };
};

export default function AdminDashboard() {
  const [startDate, setStartDate] = useState(getTodayJST);
  const [endDate, setEndDate] = useState(getTodayJST);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all'); // デフォルトは一括まとめ

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
  const [kowaris, setKowaris] = useState<any[]>([]);
  const [temps, setTemps] = useState<any[]>([]);
  const [closings, setClosings] = useState<any[]>([]);
  const [receivings, setReceivings] = useState<any[]>([]);
  const [drives, setDrives] = useState<any[]>([]);

  // Supabase (daily_weather_logs) から読み込む気象データステート
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

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

  // daily_weather_logs テーブルから確定気象データを取得
  const fetchWeather = async (dateStr: string) => {
    setWeatherLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_weather_logs')
        .select('weather_text, temperature, humidity')
        .eq('target_date', dateStr)
        .maybeSingle();

      if (error) {
        console.error('気象データの取得エラー:', error);
        setWeather(null);
        return;
      }

      if (data) {
        setWeather({
          weatherText: data.weather_text,
          temp: data.temperature !== null ? Number(data.temperature) : null,
          humidity: data.humidity !== null ? Number(data.humidity) : null,
        });
      } else {
        setWeather(null);
      }
    } catch (e) {
      console.error('気象データのロードに失敗しました:', e);
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  // 業務データ取得（期間指定対応）
  const fetchData = async (sDate: string, eDate: string) => {
    if (!isAuthenticated) return;
    setLoading(true);
    const { startIso, endIso } = getPeriodRange(sDate, eDate);

    try {
      const [rAlc, rFish, rKowari, rTemp, rClose, rRec, rDrive] = await Promise.all([
        supabase.from('check_alcohol').select('*').gte('checked_at', startIso).lte('checked_at', endIso).order('checked_at', { ascending: true }),
        supabase.from('check_fish_processing').select('*').gte('checked_at', startIso).lte('checked_at', endIso).order('checked_at', { ascending: true }),
        supabase.from('check_kowari_processing').select('*').gte('checked_at', startIso).lte('checked_at', endIso).order('checked_at', { ascending: true }),
        supabase.from('check_temp_hygiene').select('*').gte('checked_at', startIso).lte('checked_at', endIso).order('checked_at', { ascending: true }),
        supabase.from('check_temp_closing').select('*').gte('checked_at', startIso).lte('checked_at', endIso).order('checked_at', { ascending: true }),
        supabase.from('check_receiving').select('*').gte('checked_at', startIso).lte('checked_at', endIso).order('checked_at', { ascending: true }),
        supabase.from('check_driving_report').select('*').gte('start_at', startIso).lte('start_at', endIso).order('start_at', { ascending: true }),
      ]);

      setAlcohols(rAlc.data || []);
      setFishes(rFish.data || []);
      setKowaris(rKowari.data || []);
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
      fetchData(startDate, endDate);
      fetchWeather(endDate);
    }
  }, [startDate, endDate, isAuthenticated]);

  // レコード削除
  const handleDelete = async (table: string, id: string, label: string) => {
    if (!confirm(`【警告】この記録（${label}）を完全に削除しますか？\n誤入力やテストデータ以外は削除しないでください。`)) {
      return;
    }
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      await fetchData(startDate, endDate);
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
      await fetchData(startDate, endDate);
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

  // =============================================================
  // CSV出力機能の実装
  // =============================================================
  const handleExportCSV = () => {
    let csvContent = '\uFEFF'; // 文字化け防止のBOM
    let filename = `gyorui_report_${startDate}_to_${endDate}.csv`;

    if (viewMode === 'temp_sheet' || viewMode === 'all') {
      csvContent += '【日常・出勤時 点検(温度 & 衛生)】\n';
      csvContent += '日時,記入者,本庫(℃),2号(℃),鮮魚庫(℃),定温(℃),保管庫衛生,太物衛生,売場衛生,害獣痕跡,特記事項\n';
      temps.forEach((r) => {
        const notes = (r.notes || '').replace(/,/g, ' ');
        csvContent += `${r.checked_at},${r.staff_name},${r.main_freezer_temp ?? ''},${r.room2_freezer_temp ?? ''},${r.fish_storage_temp ?? ''},${r.constant_floor_temp ?? ''},${r.storage_hygiene_status || ''},${r.processing_zone_status || ''},${r.floor_hygiene_status || ''},${r.pest_evidence || ''},${notes}\n`;
      });
      csvContent += '\n';

      csvContent += '【退勤前 点検】\n';
      csvContent += '日時,記入者,本庫(℃),2号(℃),特記事項\n';
      closings.forEach((r) => {
        const notes = (r.notes || '').replace(/,/g, ' ');
        csvContent += `${r.checked_at},${r.staff_name},${r.main_freezer_temp ?? ''},${r.room2_freezer_temp ?? ''},${notes}\n`;
      });
      csvContent += '\n';
    }

    if (viewMode === 'fish_sheet' || viewMode === 'all') {
      csvContent += '【生魚加工 衛生管理点検】\n';
      csvContent += '日時,点検者,健康状態,手洗い,商品確認,魚体洗浄,作業温度,施設衛生,用具衛生,特記事項\n';
      fishes.forEach((r) => {
        const notes = (r.notes || '').replace(/,/g, ' ');
        csvContent += `${r.checked_at},${r.staff_name},${r.health_status || ''},${r.hand_washing ? '済' : '未'},${r.product_check || ''},${r.fish_washing || ''},${r.work_temp || ''},${r.facility_hygiene || ''},${r.tools_hygiene || ''},${notes}\n`;
      });
      csvContent += '\n';
    }

    if (viewMode === 'kowari_sheet' || viewMode === 'all') {
      csvContent += '【小割加工 衛生管理点検】\n';
      csvContent += '日時,点検者,作業品目,健康状態,手の衛生,作業温度,施設衛生,用具衛生,ラベル貼付,特記事項\n';
      kowaris.forEach((r) => {
        const notes = (r.notes || '').replace(/,/g, ' ');
        csvContent += `${r.checked_at},${r.staff_name},${r.item_type || ''},${r.health_status || ''},${r.hand_hygiene || ''},${r.work_temp || ''},${r.facility_hygiene || ''},${r.tools_hygiene || ''},${r.label_check || ''},${notes}\n`;
      });
      csvContent += '\n';
    }

    if (viewMode === 'alcohol' || viewMode === 'all') {
      csvContent += '【基本チェック・アルコール点呼】\n';
      csvContent += '点呼区分,日時,担当者名,確認者名,測定値(mg/L),特記事項\n';
      alcohols.forEach((r) => {
        const timing = getTimingType(r.notes) === 'start' ? '出勤時' : '退勤時';
        const notes = (r.notes || '').replace(/,/g, ' ');
        csvContent += `${timing},${r.checked_at},${r.staff_name},${r.checker_name},${r.alcohol_value},${notes}\n`;
      });
      csvContent += '\n';
    }

    if (viewMode === 'drive' || viewMode === 'all') {
      csvContent += '【運転日報】\n';
      csvContent += '運転者,車両,行先,同乗者,出発日時,乗車時メーター,帰社日時,降車時メーター,走行距離(km),給油(L),特記事項\n';
      drives.forEach((r) => {
        const distance = r.start_meter && r.end_meter ? (Number(r.end_meter) - Number(r.start_meter)).toFixed(1) : '';
        const notes = (r.notes || '').replace(/,/g, ' ');
        csvContent += `${r.staff_name},${r.vehicle_name},${r.destination},${r.passenger || ''},${r.start_at},${r.start_meter},${r.end_at || ''},${r.end_meter || ''},${distance},${r.refuel_liters || ''},${notes}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentPeriod = getPeriodRange(startDate, endDate);

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
      <div className="max-w-6xl mx-auto mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">業務管理簿・日報集計</h1>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                管理者認証済
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold">期間指定集計・時刻修正・誤送信削除・CSV出力・印刷</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 期間指定コントロール */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              <label className="text-[11px] font-bold text-slate-600">期間:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-1 border border-slate-300 rounded text-xs font-semibold"
              />
              <span className="text-xs text-slate-400">～</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-1 border border-slate-300 rounded text-xs font-semibold"
              />
            </div>

            <button
              onClick={() => {
                fetchData(startDate, endDate);
                fetchWeather(endDate);
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded"
            >
              🔄 更新
            </button>

            {/* CSV出力ボタン */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow flex items-center gap-1"
            >
              📥 CSV出力
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

        {/* タブ切り替え */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-1.5 overflow-x-auto">
          {[
            { key: 'all', label: '📋 日報まとめ（一括表示）' },
            { key: 'temp_sheet', label: `🌡️ 温度衛生管理 (${temps.length + closings.length})` },
            { key: 'fish_sheet', label: `🐟 生魚加工 (${fishes.length})` },
            { key: 'kowari_sheet', label: `🔪 小割加工 (${kowaris.length})` },
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
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-2 print:max-w-none">
        {/* 帳票ヘッダー */}
        <div className="border-b-2 border-slate-800 pb-2 mb-4 flex flex-wrap justify-between items-end gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 print:text-lg">
              {viewMode === 'all' && '業務点検日報（一括まとめ）'}
              {viewMode === 'temp_sheet' && '温度衛生管理 / 退勤前 点検記録簿'}
              {viewMode === 'fish_sheet' && '生魚加工 衛生管理点検記録簿'}
              {viewMode === 'kowari_sheet' && '小割加工 衛生管理点検記録簿'}
              {viewMode === 'alcohol' && '基本チェック・点呼記録簿（対面確認）'}
              {viewMode === 'drive' && '運転日報 運行記録簿'}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <div className="text-xs font-bold text-slate-700">
                指定期間: <span className="text-sm text-blue-900 underline font-mono font-black">{startDate} ～ {endDate}</span>
                <span className="ml-2 text-xs font-bold text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                  （{currentPeriod.label}）
                </span>
              </div>

              {/* 公設市場の確定気象情報バッジ */}
              <div className="text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-300 rounded px-2.5 py-0.5 flex items-center gap-2 print:border-slate-400">
                <span className="text-slate-500 font-normal">気象(終了日):</span>
                {weatherLoading ? (
                  <span className="text-slate-400">取得中...</span>
                ) : weather ? (
                  <span className="flex items-center gap-1.5 font-mono">
                    <span className="font-sans font-bold">{weather.weatherText}</span>
                    <span>/</span>
                    <span>{weather.temp !== null ? `${weather.temp}℃` : '-'}</span>
                    <span>/</span>
                    <span>湿度 {weather.humidity !== null ? `${weather.humidity}%` : '-'}</span>
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal font-sans">（気象ログなし）</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500 font-mono" suppressHydrationWarning>
            出力: {new Date().toLocaleString('ja-JP')}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 font-bold text-xs">データを取得中...</div>
        ) : (
          <div className="space-y-6 print:space-y-4 text-xs">
            {/* ========================================================
                ■ 日報まとめ（一括表示）の順序指定反映部分
                順序: 
                1.日常・出勤時 点検（温度 & 衛生管理）
                2.荷受管理
                3.生魚加工 衛生管理点検
                4.小割加工 衛生管理点検
                5.基本、アルコールチェック
                6.運転日報
               ======================================================== */}

            {/* 1. 日常・出勤時 点検（温度 & 衛生管理） */}
            {(viewMode === 'all' || viewMode === 'temp_sheet') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-cyan-600 mb-2">
                  1. 日常・出勤時 点検（温度 & 衛生管理）
                </h3>
                {temps.length === 0 ? (
                  <div className="text-slate-400 italic p-2">記録なし</div>
                ) : (
                  <table className="w-full border-collapse border border-slate-300 text-center">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-1">日時</th>
                        <th className="border border-slate-300 p-1">点検者</th>
                        <th className="border border-slate-300 p-1">本庫(℃)</th>
                        <th className="border border-slate-300 p-1">2号室(℃)</th>
                        <th className="border border-slate-300 p-1">鮮魚庫(℃)</th>
                        <th className="border border-slate-300 p-1">定温売場(℃)</th>
                        <th className="border border-slate-300 p-1">保管庫衛生</th>
                        <th className="border border-slate-300 p-1">加工室衛生</th>
                        <th className="border border-slate-300 p-1">売場衛生</th>
                        <th className="border border-slate-300 p-1">害獣痕跡</th>
                        <th className="border border-slate-300 p-1 print:hidden w-16">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {temps.map((row) => (
                        <tr key={row.id}>
                          <td className="border border-slate-300 p-1 font-mono">{formatShortDateTime(row.checked_at)}</td>
                          <td className="border border-slate-300 p-1 font-bold">{row.staff_name}</td>
                          <td className="border border-slate-300 p-1 font-mono font-bold">{row.main_freezer_temp ?? '-'}</td>
                          <td className="border border-slate-300 p-1 font-mono font-bold">{row.room2_freezer_temp ?? '-'}</td>
                          <td className="border border-slate-300 p-1 font-mono font-bold">{row.fish_storage_temp ?? '-'}</td>
                          <td className="border border-slate-300 p-1 font-mono font-bold">{row.constant_floor_temp ?? '-'}</td>
                          <td className={`border border-slate-300 p-1 ${row.storage_hygiene_status === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.storage_hygiene_status || '-'}</td>
                          <td className={`border border-slate-300 p-1 ${row.processing_zone_status === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.processing_zone_status || '-'}</td>
                          <td className={`border border-slate-300 p-1 ${row.floor_hygiene_status === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.floor_hygiene_status || '-'}</td>
                          <td className={`border border-slate-300 p-1 ${row.pest_evidence === '問題発生' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.pest_evidence || '-'}</td>
                          <td className="border border-slate-300 p-1 print:hidden whitespace-nowrap">
                            <button onClick={() => openEditModal({ table: 'check_temp_hygiene', id: row.id, name: row.staff_name, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })} className="text-[10px] text-blue-600 hover:underline mr-1">✏️時刻</button>
                            <button onClick={() => handleDelete('check_temp_hygiene', row.id, `${row.staff_name}さんの出勤時温度`)} className="text-[10px] text-red-600 hover:underline">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {/* 2. 荷受管理 */}
            {(viewMode === 'all' || viewMode === 'temp_sheet') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-teal-600 mb-2">
                  2. 荷受管理
                </h3>
                {receivings.length === 0 ? (
                  <div className="text-slate-400 italic p-2">記録なし</div>
                ) : (
                  <table className="w-full border-collapse border border-slate-300 text-center">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-1">受入日時</th>
                        <th className="border border-slate-300 p-1">受入担当</th>
                        <th className="border border-slate-300 p-1 bg-teal-50">便名</th>
                        <th className="border border-slate-300 p-1">外観・包装</th>
                        <th className="border border-slate-300 p-1">鮮度・におい</th>
                        <th className="border border-slate-300 p-1">輸送温度</th>
                        <th className="border border-slate-300 p-1">特記事項</th>
                        <th className="border border-slate-300 p-1 print:hidden w-16">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivings.map((row) => (
                        <tr key={row.id}>
                          <td className="border border-slate-300 p-1 font-mono">{formatShortDateTime(row.checked_at)}</td>
                          <td className="border border-slate-300 p-1 font-bold">{row.staff_name}</td>
                          <td className="border border-slate-300 p-1 font-black text-teal-800 bg-teal-50/50">{row.flight_name || '-'}</td>
                          <td className={`border border-slate-300 p-1 ${row.pkg_status === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.pkg_status}</td>
                          <td className={`border border-slate-300 p-1 ${row.freshness_status === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.freshness_status}</td>
                          <td className={`border border-slate-300 p-1 ${row.transit_temp_status === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.transit_temp_status}</td>
                          <td className={`border border-slate-300 p-1 text-left ${row.notes ? 'text-red-600 font-bold' : ''}`}>{row.notes || '-'}</td>
                          <td className="border border-slate-300 p-1 print:hidden whitespace-nowrap">
                            <button onClick={() => openEditModal({ table: 'check_receiving', id: row.id, name: `${row.staff_name} (${row.flight_name})`, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })} className="text-[10px] text-blue-600 hover:underline mr-1">✏️時刻</button>
                            <button onClick={() => handleDelete('check_receiving', row.id, `${row.staff_name}さんの受入記録`)} className="text-[10px] text-red-600 hover:underline">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {/* 3. 生魚加工 衛生管理点検 */}
            {(viewMode === 'all' || viewMode === 'fish_sheet') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-emerald-600 mb-2">
                  3. 生魚加工 衛生管理点検
                </h3>
                {fishes.length === 0 ? (
                  <div className="text-slate-400 italic p-2">記録なし</div>
                ) : (
                  <table className="w-full border-collapse border border-slate-300 text-center">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-1">日時</th>
                        <th className="border border-slate-300 p-1">点検者</th>
                        <th className="border border-slate-300 p-1">健康状態</th>
                        <th className="border border-slate-300 p-1">手洗い</th>
                        <th className="border border-slate-300 p-1">商品確認</th>
                        <th className="border border-slate-300 p-1">魚体洗浄</th>
                        <th className="border border-slate-300 p-1">作業温度</th>
                        <th className="border border-slate-300 p-1">施設衛生</th>
                        <th className="border border-slate-300 p-1">用具衛生</th>
                        <th className="border border-slate-300 p-1">特記事項</th>
                        <th className="border border-slate-300 p-1 print:hidden w-16">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fishes.map((row) => (
                        <tr key={row.id}>
                          <td className="border border-slate-300 p-1 font-mono">{formatShortDateTime(row.checked_at)}</td>
                          <td className="border border-slate-300 p-1 font-bold">{row.staff_name}</td>
                          <td className={`border border-slate-300 p-1 font-bold ${row.health_status === '否' ? 'text-red-600 bg-red-50' : ''}`}>{row.health_status}</td>
                          <td className="border border-slate-300 p-1">{row.hand_washing ? '済' : <span className="text-red-600 font-bold">未</span>}</td>
                          <td className={`border border-slate-300 p-1 ${row.product_check === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.product_check}</td>
                          <td className="border border-slate-300 p-1">{row.fish_washing}</td>
                          <td className={`border border-slate-300 p-1 ${row.work_temp === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.work_temp}</td>
                          <td className={`border border-slate-300 p-1 ${row.facility_hygiene === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.facility_hygiene}</td>
                          <td className={`border border-slate-300 p-1 ${row.tools_hygiene === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.tools_hygiene}</td>
                          <td className={`border border-slate-300 p-1 text-left ${row.notes ? 'text-red-600 font-bold' : ''}`}>{row.notes || '-'}</td>
                          <td className="border border-slate-300 p-1 print:hidden whitespace-nowrap">
                            <button onClick={() => openEditModal({ table: 'check_fish_processing', id: row.id, name: row.staff_name, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })} className="text-[10px] text-blue-600 hover:underline mr-1">✏️時刻</button>
                            <button onClick={() => handleDelete('check_fish_processing', row.id, `${row.staff_name}さんの生魚加工記録`)} className="text-[10px] text-red-600 hover:underline">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {/* 4. 小割加工 衛生管理点検 */}
            {(viewMode === 'all' || viewMode === 'kowari_sheet') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-purple-600 mb-2">
                  4. 小割加工 衛生管理点検
                </h3>
                {kowaris.length === 0 ? (
                  <div className="text-slate-400 italic p-2">記録なし</div>
                ) : (
                  <table className="w-full border-collapse border border-slate-300 text-center">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-1">日時</th>
                        <th className="border border-slate-300 p-1">点検者</th>
                        <th className="border border-slate-300 p-1 bg-purple-50">作業品目</th>
                        <th className="border border-slate-300 p-1">健康状態</th>
                        <th className="border border-slate-300 p-1">手の衛生</th>
                        <th className="border border-slate-300 p-1">作業温度</th>
                        <th className="border border-slate-300 p-1">施設衛生</th>
                        <th className="border border-slate-300 p-1">用具衛生</th>
                        <th className="border border-slate-300 p-1">ラベル貼付</th>
                        <th className="border border-slate-300 p-1">特記事項</th>
                        <th className="border border-slate-300 p-1 print:hidden w-16">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kowaris.map((row) => (
                        <tr key={row.id}>
                          <td className="border border-slate-300 p-1 font-mono">{formatShortDateTime(row.checked_at)}</td>
                          <td className="border border-slate-300 p-1 font-bold">{row.staff_name}</td>
                          <td className="border border-slate-300 p-1 font-black text-purple-900 bg-purple-50/50">{row.item_type || '-'}</td>
                          <td className={`border border-slate-300 p-1 font-bold ${row.health_status === '否' ? 'text-red-600 bg-red-50' : ''}`}>{row.health_status}</td>
                          <td className="border border-slate-300 p-1">{row.hand_hygiene === '実施済み' ? '済' : <span className="text-red-600 font-bold">未</span>}</td>
                          <td className={`border border-slate-300 p-1 ${row.work_temp === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.work_temp}</td>
                          <td className={`border border-slate-300 p-1 ${row.facility_hygiene === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.facility_hygiene}</td>
                          <td className={`border border-slate-300 p-1 ${row.tools_hygiene === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.tools_hygiene}</td>
                          <td className={`border border-slate-300 p-1 ${row.label_check === 'わるい' ? 'text-red-600 font-bold bg-red-50' : ''}`}>{row.label_check}</td>
                          <td className={`border border-slate-300 p-1 text-left ${row.notes ? 'text-red-600 font-bold' : ''}`}>{row.notes || '-'}</td>
                          <td className="border border-slate-300 p-1 print:hidden whitespace-nowrap">
                            <button onClick={() => openEditModal({ table: 'check_kowari_processing', id: row.id, name: `${row.staff_name} (小割:${row.item_type || ''})`, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })} className="text-[10px] text-blue-600 hover:underline mr-1">✏️時刻</button>
                            <button onClick={() => handleDelete('check_kowari_processing', row.id, `${row.staff_name}さんの小割加工記録`)} className="text-[10px] text-red-600 hover:underline">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {/* 5. 基本、アルコールチェック */}
            {(viewMode === 'all' || viewMode === 'alcohol') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-blue-600 mb-2">
                  5. 基本、アルコールチェック
                </h3>
                {alcohols.length === 0 ? (
                  <div className="text-slate-400 italic p-2">記録なし</div>
                ) : (
                  <table className="w-full border-collapse border border-slate-300 text-center">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-1.5 w-28">点呼区分</th>
                        <th className="border border-slate-300 p-1.5">日時</th>
                        <th className="border border-slate-300 p-1.5">担当者名</th>
                        <th className="border border-slate-300 p-1.5">確認者名</th>
                        <th className="border border-slate-300 p-1.5">測定値 (mg/L)</th>
                        <th className="border border-slate-300 p-1.5">判定</th>
                        <th className="border border-slate-300 p-1.5">特記事項</th>
                        <th className="border border-slate-300 p-1.5 print:hidden w-16">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alcohols.map((row) => {
                        const v = Number(row.alcohol_value);
                        const isDanger = v >= 0.15;
                        const timing = getTimingType(row.notes);
                        const isStart = timing === 'start';
                        const isFinish = timing === 'finish';
                        return (
                          <tr key={row.id}>
                            <td className="border border-slate-300 p-1.5">
                              {isStart && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900">出勤時</span>}
                              {isFinish && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-900">退勤時</span>}
                              {!isStart && !isFinish && <span>-</span>}
                            </td>
                            <td className="border border-slate-300 p-1.5 font-mono">{formatShortDateTime(row.checked_at)}</td>
                            <td className="border border-slate-300 p-1.5 font-bold">{row.staff_name}</td>
                            <td className="border border-slate-300 p-1.5">{row.checker_name}</td>
                            <td className="border border-slate-300 p-1.5 font-mono font-bold">{Number(row.alcohol_value).toFixed(2)}</td>
                            <td className="border border-slate-300 p-1.5 font-bold">
                              {v === 0 ? <span className="text-emerald-700">合格 (0.00)</span> : isDanger ? <span className="text-red-700">🚨 超過</span> : <span className="text-amber-700">微量</span>}
                            </td>
                            <td className={`border border-slate-300 p-1.5 text-left ${row.notes ? 'text-red-600 font-bold' : ''}`}>{row.notes || '-'}</td>
                            <td className="border border-slate-300 p-1.5 print:hidden">
                              <button onClick={() => openEditModal({ table: 'check_alcohol', id: row.id, name: row.staff_name, currentIso: row.checked_at, notes: row.notes, timeField: 'checked_at' })} className="text-[10px] text-blue-600 hover:underline mr-1">✏️時刻</button>
                              <button onClick={() => handleDelete('check_alcohol', row.id, `${row.staff_name}さんの点呼記録`)} className="text-[10px] text-red-600 hover:underline">🗑️</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {/* 6. 運転日報 */}
            {(viewMode === 'all' || viewMode === 'drive') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-amber-600 mb-2">
                  6. 運転日報
                </h3>
                {drives.length === 0 ? (
                  <div className="text-slate-400 italic p-2">記録なし</div>
                ) : (
                  <table className="w-full border-collapse border border-slate-300 text-center">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-1.5">運転者</th>
                        <th className="border border-slate-300 p-1.5">車両</th>
                        <th className="border border-slate-300 p-1.5">行先</th>
                        <th className="border border-slate-300 p-1.5">出発 / メーター</th>
                        <th className="border border-slate-300 p-1.5">帰社 / メーター</th>
                        <th className="border border-slate-300 p-1.5">走行距離</th>
                        <th className="border border-slate-300 p-1.5">特記事項</th>
                        <th className="border border-slate-300 p-1.5 print:hidden w-16">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drives.map((row) => {
                        const distance = row.start_meter && row.end_meter ? (Number(row.end_meter) - Number(row.start_meter)).toFixed(1) : '-';
                        return (
                          <tr key={row.id}>
                            <td className="border border-slate-300 p-1.5 font-bold">{row.staff_name}</td>
                            <td className="border border-slate-300 p-1.5">{row.vehicle_name}</td>
                            <td className="border border-slate-300 p-1.5">{row.destination}</td>
                            <td className="border border-slate-300 p-1.5 font-mono">{formatShortDateTime(row.start_at)}<br />{row.start_meter} km</td>
                            <td className="border border-slate-300 p-1.5 font-mono">{row.end_at ? <>{formatShortDateTime(row.end_at)}<br />{row.end_meter} km</> : <span className="text-amber-600 font-bold">運行中</span>}</td>
                            <td className="border border-slate-300 p-1.5 font-bold font-mono">{distance !== '-' ? `${distance} km` : '-'}</td>
                            <td className={`border border-slate-300 p-1.5 text-left ${row.notes ? 'text-red-600 font-bold' : ''}`}>{row.notes || '-'}</td>
                            <td className="border border-slate-300 p-1.5 print:hidden">
                              <button onClick={() => openEditModal({ table: 'check_driving_report', id: row.id, name: row.staff_name, currentIso: row.start_at, notes: row.notes, timeField: 'start_at' })} className="text-[10px] text-blue-600 hover:underline mr-1">✏️時刻</button>
                              <button onClick={() => handleDelete('check_driving_report', row.id, `${row.staff_name}さんの運行記録`)} className="text-[10px] text-red-600 hover:underline">🗑️</button>
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