'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type ViewMode = 'all' | 'temp' | 'fish' | 'alcohol' | 'drive';

export default function AdminDashboard() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [targetDate, setTargetDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  // 各種データ
  const [alcohols, setAlcohols] = useState<any[]>([]);
  const [fishes, setFishes] = useState<any[]>([]);
  const [temps, setTemps] = useState<any[]>([]);
  const [closings, setClosings] = useState<any[]>([]);
  const [drives, setDrives] = useState<any[]>([]);

  // データ取得
  const fetchData = async (dateStr: string) => {
    setLoading(true);
    const start = `${dateStr}T00:00:00+09:00`;
    const end = `${dateStr}T23:59:59+09:00`;

    try {
      // 1. アルコール
      const { data: dAlc } = await supabase
        .from('check_alcohol')
        .select('*')
        .gte('checked_at', start)
        .lte('checked_at', end)
        .order('checked_at', { ascending: true });
      setAlcohols(dAlc || []);

      // 2. 生魚加工
      const { data: dFish } = await supabase
        .from('check_fish_processing')
        .select('*')
        .gte('checked_at', start)
        .lte('checked_at', end)
        .order('checked_at', { ascending: true });
      setFishes(dFish || []);

      // 3. 温度管理
      const { data: dTemp } = await supabase
        .from('check_temp_hygiene')
        .select('*')
        .gte('checked_at', start)
        .lte('checked_at', end)
        .order('checked_at', { ascending: true });
      setTemps(dTemp || []);

      // 4. 退勤前温度
      const { data: dClose } = await supabase
        .from('check_temp_closing')
        .select('*')
        .gte('checked_at', start)
        .lte('checked_at', end)
        .order('checked_at', { ascending: true });
      setClosings(dClose || []);

      // 5. 運転日報
      const { data: dDrive } = await supabase
        .from('check_driving_report')
        .select('*')
        .gte('start_at', start)
        .lte('start_at', end)
        .order('start_at', { ascending: true });
      setDrives(dDrive || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(targetDate);
  }, [targetDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 print:p-0 print:bg-white">
      {/* 画面操作コントロールバー（印刷時は非表示） */}
      <div className="max-w-5xl mx-auto mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">業務管理簿・日報集計</h1>
            <p className="text-xs text-slate-500">点検確認・単体リスト・印刷・PDF出力</p>
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
          </div>
        </div>

        {/* 単体リスト切り替えタブ */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-1.5 overflow-x-auto">
          {[
            { key: 'all', label: '📋 日報まとめ（一括・印刷用）' },
            { key: 'temp', label: `🌡️ 温度管理 (${temps.length + closings.length})` },
            { key: 'fish', label: `🐟 生魚加工 (${fishes.length})` },
            { key: 'alcohol', label: `🍺 アルコール (${alcohols.length})` },
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
              {viewMode === 'temp' && '温度衛生管理 点検記録簿'}
              {viewMode === 'fish' && '生魚加工 衛生管理点検記録簿'}
              {viewMode === 'alcohol' && 'アルコールチェック点検簿（対面確認）'}
              {viewMode === 'drive' && '運転日報 運行記録簿'}
            </h2>
            <div className="text-xs font-bold text-slate-700 mt-1">
              対象日: <span className="text-sm text-blue-900 underline">{targetDate}</span>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            出力: {new Date().toLocaleString('ja-JP')}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 font-bold text-xs">データを取得中...</div>
        ) : (
          <div className="space-y-6 print:space-y-4 text-xs">
            {/* ========================================================
                1. 温度衛生管理（日常・出勤時 & 退勤前）
               ======================================================== */}
            {(viewMode === 'all' || viewMode === 'temp') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-cyan-600 mb-2">
                  1. 温度衛生管理（日常・出勤時 & 退勤前）
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                  {/* 出勤時 */}
                  <div className="border border-slate-300 rounded p-2.5">
                    <div className="font-bold text-slate-700 mb-1.5 border-b pb-1">■ 日常・出勤時 点検</div>
                    {temps.length === 0 ? (
                      <div className="text-slate-400 italic p-1">記録なし</div>
                    ) : (
                      temps.map((row) => (
                        <div key={row.id} className="space-y-1.5 mb-2 last:mb-0">
                          <div className="flex justify-between text-slate-500 font-mono">
                            <span>記入者: <b>{row.staff_name}</b></span>
                            <span>{new Date(row.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-slate-50 p-2 rounded font-mono">
                            <div>本庫: <b>{row.main_freezer_temp ?? '-'}℃</b></div>
                            <div>2号室: <b>{row.room2_freezer_temp ?? '-'}℃</b></div>
                            <div>鮮魚庫: <b>{row.fish_storage_temp ?? '-'}℃</b></div>
                            <div>定温売場: <b>{row.constant_floor_temp ?? '-'}℃</b></div>
                            <div>売場(場内): <b>{row.floor_temp ?? '-'}℃</b></div>
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
                        <div key={row.id} className="space-y-1.5 mb-2 last:mb-0">
                          <div className="flex justify-between text-slate-500 font-mono">
                            <span>記入者: <b>{row.staff_name}</b></span>
                            <span>{new Date(row.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-slate-50 p-2 rounded font-mono">
                            <div>本庫: <b>{row.main_freezer_temp ?? '-'}℃</b></div>
                            <div>2号室: <b>{row.room2_freezer_temp ?? '-'}℃</b></div>
                          </div>
                          {row.notes && <div className="text-[11px] text-amber-800">特記: {row.notes}</div>}
                        </div>
                      ))
                    )}
                  </div>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {/* ========================================================
                3. アルコールチェック点検簿（対面確認）
               ======================================================== */}
            {(viewMode === 'all' || viewMode === 'alcohol') && (
              <section className="break-inside-avoid">
                <h3 className="font-bold text-sm bg-slate-100 print:bg-slate-200 px-2 py-1 border-l-4 border-blue-600 mb-2">
                  3. アルコールチェック点検簿（対面確認）
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
                        <th className="border border-slate-300 p-1.5">特記事項</th>
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
    </div>
  );
}
