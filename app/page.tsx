'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ==========================================
// 1. 各種プルダウン・選択肢の編集エリア
// ==========================================
const CHECKER_OPTIONS = ['山内', '五十嵐', '菊島', '高橋']; // アルコールチェック確認者
const VEHICLE_OPTIONS = ['ハイゼット 0539', 'ハイゼット 4076','ハイゼット 4000', 'ダイナ 3694', 'プロボックス 1475', 'ISUZU 4005', 'ISUZU 4004']; // 使用車両
const DESTINATION_OPTIONS = ['市内ルート', '田島方面', '喜多方方面', '猪苗代方面', '只見方面']; // 行先

// 日本時間の現在日時を取得（YYYY-MM-DDTHH:mm 形式）
const getNowJST = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

type TabType = 'alcohol' | 'fish' | 'temp' | 'closing' | 'drive';

function ChecksheetForm() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'alcohol';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 担当者名（localStorageで記憶＆オートコンプリート）
  const [staffName, setStaffName] = useState('');
  const [staffHistory, setStaffHistory] = useState<string[]>([]);

  // ---------------- 1. アルコールチェック state ----------------
  const [alcoholDate, setAlcoholDate] = useState(getNowJST());
  const [checkerType, setCheckerType] = useState(CHECKER_OPTIONS[0] || '');
  const [customChecker, setCustomChecker] = useState('');
  const [alcoholVal, setAlcoholVal] = useState('');
  const [alcoholNotes, setAlcoholNotes] = useState('');

  // ---------------- 2. 生魚加工衛生管理 state ----------------
  const [fishDate, setFishDate] = useState(getNowJST());
  const [healthStatus, setHealthStatus] = useState<'良' | '否' | ''>('');
  const [handWashing, setHandWashing] = useState<'実施済み' | '未実施' | ''>('');
  const [productCheck, setProductCheck] = useState<'よい' | 'わるい' | ''>('');
  const [fishWashing, setFishWashing] = useState<'よい' | 'わるい' | ''>('');
  const [workTemp, setWorkTemp] = useState<'よい' | 'わるい' | ''>('');
  const [facilityHygiene, setFacilityHygiene] = useState<'よい' | 'わるい' | ''>('');
  const [toolsHygiene, setToolsHygiene] = useState<'よい' | 'わるい' | ''>('');
  const [fishNotes, setFishNotes] = useState('');

  // ---------------- 3. 温度衛生管理 state ----------------
  const [tempDate, setTempDate] = useState(getNowJST());
  const [mainFreezerTemp, setMainFreezerTemp] = useState('');
  const [room2Temp, setRoom2Temp] = useState('');
  const [fishStorageTemp, setFishStorageTemp] = useState('');
  const [constantFloorTemp, setConstantFloorTemp] = useState('');
  const [floorTemp, setFloorTemp] = useState('');
  const [processingZoneStatus, setProcessingZoneStatus] = useState<'よい' | 'わるい' | ''>('');
  const [pestEvidence, setPestEvidence] = useState<'気になる所見なし' | '問題発生' | ''>('');
  const [tempNotes, setTempNotes] = useState('');

  // ---------------- 4. 温度衛生管理（退勤前） state ----------------
  const [closingDate, setClosingDate] = useState(getNowJST());
  const [closingMainTemp, setClosingMainTemp] = useState('');
  const [closingRoom2Temp, setClosingRoom2Temp] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // ---------------- 5. 運転日報 state ----------------
  const [driveMode, setDriveMode] = useState<'start' | 'finish'>('start');
  const [vehicle, setVehicle] = useState(VEHICLE_OPTIONS[0] || '');
  const [customVehicle, setCustomVehicle] = useState('');
  const [destination, setDestination] = useState(DESTINATION_OPTIONS[0] || '');
  const [customDestination, setCustomDestination] = useState('');
  const [passenger, setPassenger] = useState('');
  const [driveStart, setDriveStart] = useState(getNowJST());
  const [startMeter, setStartMeter] = useState('');

  // 車両ごとの前回最終メーター記録
  const [lastRecordedMeter, setLastRecordedMeter] = useState<number | null>(null);
  const [fetchingLastMeter, setFetchingLastMeter] = useState(false);

  // 帰社完了用 state
  const [activeDrives, setActiveDrives] = useState<any[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [driveEnd, setDriveEnd] = useState(getNowJST());
  const [endMeter, setEndMeter] = useState('');
  const [refuelLiters, setRefuelLiters] = useState('');
  const [driveNotes, setDriveNotes] = useState('');

  // 初期読み込み＆URLパラメータ反映
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType;
    if (['alcohol', 'fish', 'temp', 'closing', 'drive'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const savedName = localStorage.getItem('last_staff_name') || '';
    if (savedName) setStaffName(savedName);

    const history = JSON.parse(localStorage.getItem('staff_name_history') || '[]');
    setStaffHistory(history);
  }, [searchParams]);

  // 車両ごとの過去最新メーターを自動取得する関数
  const fetchVehicleLastMeter = async (targetVehicle: string) => {
    if (!targetVehicle || targetVehicle === 'その他') {
      setLastRecordedMeter(null);
      return;
    }
    setFetchingLastMeter(true);
    try {
      const { data, error } = await supabase
        .from('check_driving_report')
        .select('start_meter, end_meter, created_at')
        .eq('vehicle_name', targetVehicle)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const prev = data[0];
        const val = prev.end_meter !== null ? Number(prev.end_meter) : Number(prev.start_meter);
        setLastRecordedMeter(val);
        // 乗車メーター未入力なら自動補完
        setStartMeter(String(val));
      } else {
        setLastRecordedMeter(null);
      }
    } catch (e) {
      console.error('Failed to fetch last meter:', e);
    } finally {
      setFetchingLastMeter(false);
    }
  };

  // 車両選択が変わった時に過去メーターを照合
  useEffect(() => {
    if (activeTab === 'drive' && driveMode === 'start') {
      const target = vehicle === 'その他' ? customVehicle : vehicle;
      fetchVehicleLastMeter(target);
    }
  }, [vehicle, customVehicle, activeTab, driveMode]);

  // 運転日報タブに切り替わった時、未完了（運行中）データをSupabaseから取得
  const fetchActiveDrives = async () => {
    try {
      const { data, error } = await supabase
        .from('check_driving_report')
        .select('*')
        .is('end_meter', null)
        .order('start_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setActiveDrives(data || []);
      if (data && data.length > 0) {
        setSelectedDriveId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'drive') {
      fetchActiveDrives();
    }
  }, [activeTab]);

  const saveStaffNameHistory = (name: string) => {
    if (!name.trim()) return;
    localStorage.setItem('last_staff_name', name);
    const updated = Array.from(new Set([name, ...staffHistory])).slice(0, 10);
    localStorage.setItem('staff_name_history', JSON.stringify(updated));
    setStaffHistory(updated);
  };

  // アルコール判定
  const alcNum = parseFloat(alcoholVal);
  const isAlcoholWarning = !isNaN(alcNum) && alcNum > 0 && alcNum < 0.15;
  const isAlcoholDanger = !isNaN(alcNum) && alcNum >= 0.15 && alcNum < 0.25;
  const isAlcoholFlashing = !isNaN(alcNum) && alcNum >= 0.25;

  // 出発時メーターの桁違い・逆行判定
  const currentStartMeterNum = parseFloat(startMeter);
  const isStartMeterDecreased =
    lastRecordedMeter !== null && !isNaN(currentStartMeterNum) && currentStartMeterNum < lastRecordedMeter;
  const isStartMeterDigitError =
    lastRecordedMeter !== null &&
    lastRecordedMeter > 0 &&
    !isNaN(currentStartMeterNum) &&
    (currentStartMeterNum < lastRecordedMeter * 0.2 || currentStartMeterNum > lastRecordedMeter * 2.5);

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) {
      alert('担当者名を入力してください');
      return;
    }

    setSubmitting(true);
    setSuccessMsg('');
    saveStaffNameHistory(staffName);

    try {
      if (activeTab === 'alcohol') {
        const checker = checkerType === 'その他' ? customChecker : checkerType;
        if (!checker.trim()) throw new Error('確認者を入力してください');
        if (alcoholVal === '') throw new Error('アルコール測定値を入力してください');

        const { error } = await supabase.from('check_alcohol').insert([
          {
            checked_at: new Date(alcoholDate).toISOString(),
            staff_name: staffName,
            checker_name: checker,
            alcohol_value: parseFloat(alcoholVal),
            notes: alcoholNotes,
          },
        ]);
        if (error) throw error;
        setAlcoholVal('');
        setAlcoholNotes('');
      } else if (activeTab === 'fish') {
        if (!healthStatus) throw new Error('健康状態を選択してください');
        if (!handWashing) throw new Error('手洗い実施を選択してください');
        if (!productCheck) throw new Error('商品確認を選択してください');
        if (!fishWashing) throw new Error('魚体洗浄を選択してください');
        if (!workTemp) throw new Error('作業温度を選択してください');
        if (!facilityHygiene) throw new Error('施設の衛生を選択してください');
        if (!toolsHygiene) throw new Error('用具・備品の衛生を選択してください');

        const { error } = await supabase.from('check_fish_processing').insert([
          {
            checked_at: new Date(fishDate).toISOString(),
            staff_name: staffName,
            health_status: healthStatus,
            hand_washing: handWashing === '実施済み',
            product_check: productCheck,
            fish_washing: fishWashing,
            work_temp: workTemp,
            facility_hygiene: facilityHygiene,
            tools_hygiene: toolsHygiene,
            notes: fishNotes,
          },
        ]);
        if (error) throw error;
        setHealthStatus('');
        setHandWashing('');
        setProductCheck('');
        setFishWashing('');
        setWorkTemp('');
        setFacilityHygiene('');
        setToolsHygiene('');
        setFishNotes('');
      } else if (activeTab === 'temp') {
        if (!processingZoneStatus) throw new Error('太物売場の衛生状況を選択してください');
        if (!pestEvidence) throw new Error('害獣の痕跡を選択してください');

        const { error } = await supabase.from('check_temp_hygiene').insert([
          {
            checked_at: new Date(tempDate).toISOString(),
            staff_name: staffName,
            main_freezer_temp: mainFreezerTemp ? parseFloat(mainFreezerTemp) : null,
            room2_freezer_temp: room2Temp ? parseFloat(room2Temp) : null,
            fish_storage_temp: fishStorageTemp ? parseFloat(fishStorageTemp) : null,
            constant_floor_temp: constantFloorTemp ? parseFloat(constantFloorTemp) : null,
            floor_temp: floorTemp ? parseFloat(floorTemp) : null,
            processing_zone_status: processingZoneStatus,
            pest_evidence: pestEvidence,
            notes: tempNotes,
          },
        ]);
        if (error) throw error;
        setMainFreezerTemp('');
        setRoom2Temp('');
        setFishStorageTemp('');
        setConstantFloorTemp('');
        setFloorTemp('');
        setProcessingZoneStatus('');
        setPestEvidence('');
        setTempNotes('');
      } else if (activeTab === 'closing') {
        const { error } = await supabase.from('check_temp_closing').insert([
          {
            checked_at: new Date(closingDate).toISOString(),
            staff_name: staffName,
            main_freezer_temp: closingMainTemp ? parseFloat(closingMainTemp) : null,
            room2_freezer_temp: closingRoom2Temp ? parseFloat(closingRoom2Temp) : null,
            notes: closingNotes,
          },
        ]);
        if (error) throw error;
        setClosingMainTemp('');
        setClosingRoom2Temp('');
        setClosingNotes('');
      } else if (activeTab === 'drive') {
        if (driveMode === 'start') {
          const v = vehicle === 'その他' ? customVehicle : vehicle;
          const d = destination === 'その他' ? customDestination : destination;
          if (!startMeter) throw new Error('乗車時メーターを入力してください');

          // 出発時の桁違い・逆行バリデーション
          if (isStartMeterDecreased) {
            throw new Error(
              `乗車時メーター（${currentStartMeterNum} km）が前回の最終記録（${lastRecordedMeter} km）より小さくなっています。数値を再確認してください。`
            );
          }
          if (isStartMeterDigitError) {
            throw new Error(
              `乗車時メーター（${currentStartMeterNum} km）の桁数が前回の記録（${lastRecordedMeter} km）と大きく異なります。桁間違いがないか確認してください。`
            );
          }

          const { error } = await supabase.from('check_driving_report').insert([
            {
              staff_name: staffName,
              vehicle_name: v,
              destination: d,
              passenger: passenger,
              start_at: new Date(driveStart).toISOString(),
              start_meter: parseFloat(startMeter),
            },
          ]);
          if (error) throw error;
          setStartMeter('');
          setPassenger('');
          await fetchActiveDrives();
          alert('出発を記録しました。戻ったら「帰社・終了」から降車時メーターを記録してください。');
        } else {
          // 帰社完了記録（UPDATE）
          if (!selectedDriveId) throw new Error('完了対象の運行データを選択してください');
          if (!endMeter) throw new Error('降車時メーターを入力してください');

          const selectedDrive = activeDrives.find((d) => d.id === selectedDriveId);
          const startM = selectedDrive ? Number(selectedDrive.start_meter) : 0;
          const endM = parseFloat(endMeter);

          if (endM < startM) {
            throw new Error(
              `降車時メーター（${endM} km）が乗車時メーター（${startM} km）より小さくなっています。数値を再確認してください。`
            );
          }

          // 降車時の桁違いバリデーション（乗車メーターの2倍超など極端なケース）
          if (startM > 0 && endM > startM * 2) {
            if (!confirm(`走行距離が ${(endM - startM).toFixed(1)} km と非常に長距離になっています。この数値で記録しますか？`)) {
              setSubmitting(false);
              return;
            }
          }

          const { error } = await supabase
            .from('check_driving_report')
            .update({
              end_at: new Date(driveEnd).toISOString(),
              end_meter: endM,
              refuel_liters: refuelLiters ? parseFloat(refuelLiters) : null,
              notes: driveNotes,
            })
            .eq('id', selectedDriveId);

          if (error) throw error;
          setEndMeter('');
          setRefuelLiters('');
          setDriveNotes('');
          await fetchActiveDrives();
          setDriveMode('start');
        }
      }

      setSuccessMsg('送信が完了しました！');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert('エラーが発生しました: ' + (err.message || 'Supabase接続エラー'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-16 font-sans">
      {/* ヘッダー */}
      <header className="bg-blue-800 text-white p-4 shadow-md sticky top-0 z-30">
        <h1 className="text-lg font-bold text-center tracking-wide">業務管理チェックシート</h1>
      </header>

      {/* タブナビゲーション */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-20 overflow-x-auto shadow-sm">
        <div className="flex px-2 py-2 gap-1 min-w-max">
          {[
            { key: 'alcohol', label: '🍺 アルコール' },
            { key: 'fish', label: '🐟 生魚加工' },
            { key: 'temp', label: '🌡️ 温度管理' },
            { key: 'closing', label: '🌙 退勤前温度' },
            { key: 'drive', label: '🚗 運転日報' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key as TabType);
                setSuccessMsg('');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto p-3">
        {/* 送信成功トースト */}
        {successMsg && (
          <div className="mb-3 p-3 bg-emerald-100 border border-emerald-400 text-emerald-800 rounded-lg text-sm text-center font-bold">
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 共通：担当者名 */}
          <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 mb-1">
              担当者名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              list="staffList"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="氏名を入力（例：山田 太郎）"
              className="w-full text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <datalist id="staffList">
              {staffHistory.map((name, i) => (
                <option key={i} value={name} />
              ))}
            </datalist>
          </div>

          {/* ---------------- 1. アルコールチェック ---------------- */}
          {activeTab === 'alcohol' && (
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-bold text-sm text-slate-800 border-l-4 border-blue-600 pl-2">
                アルコールチェック記録
              </h2>

              <div>
                <label className="block text-xs text-slate-500 mb-1">確認日時</label>
                <input
                  type="datetime-local"
                  value={alcoholDate}
                  onChange={(e) => setAlcoholDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-600">
                    アルコールチェック確認者 <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                    第三者と対面で確認
                  </span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={checkerType}
                    onChange={(e) => setCheckerType(e.target.value)}
                    className="p-2 border border-slate-300 rounded-md text-xs flex-1 bg-white"
                  >
                    {CHECKER_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="その他">その他（手入力）</option>
                  </select>
                  {checkerType === 'その他' && (
                    <input
                      type="text"
                      placeholder="確認者氏名"
                      value={customChecker}
                      onChange={(e) => setCustomChecker(e.target.value)}
                      className="p-2 border border-slate-300 rounded-md text-xs flex-1"
                      required
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-600">
                    測定数値 (mg/L) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">数字を入力</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={alcoholVal}
                  onChange={(e) => setAlcoholVal(e.target.value)}
                  className="w-full text-2xl font-bold p-2.5 border-2 border-slate-300 rounded-lg text-center"
                />

                {alcoholVal !== '' && (
                  <div className="mt-2 text-xs font-bold text-center">
                    {alcNum === 0 && (
                      <div className="p-2 bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                        ✅ 0.00 正常
                      </div>
                    )}
                    {isAlcoholWarning && (
                      <div className="p-2 bg-amber-100 text-amber-900 rounded border border-amber-300">
                        ⚠️ 0.15未満（{alcNum} mg/L）再計測または確認を行ってください
                      </div>
                    )}
                    {isAlcoholDanger && (
                      <div className="p-2.5 bg-red-600 text-white rounded shadow">
                        🚨 0.15以上〜0.25未満：運転禁止！<br />
                        上席に指示を仰ぎ、特記事項に内容説明を記入してください
                      </div>
                    )}
                    {isAlcoholFlashing && (
                      <div className="p-2.5 bg-red-700 text-white rounded shadow-lg animate-pulse border-2 border-yellow-300">
                        ⚡ 0.25以上：運転厳禁！<br />
                        直ちに上席に連絡してください
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={alcoholNotes}
                  onChange={(e) => setAlcoholNotes(e.target.value)}
                  placeholder="0.15以上の場合は上席の指示内容を記入"
                  className="w-full p-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>
          )}

          {/* ---------------- 2. 生魚加工衛生管理 ---------------- */}
          {activeTab === 'fish' && (
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-bold text-sm text-slate-800 border-l-4 border-emerald-600 pl-2">
                生魚加工衛生管理
              </h2>

              <div>
                <label className="block text-xs text-slate-500 mb-1">記入日時</label>
                <input
                  type="datetime-local"
                  value={fishDate}
                  onChange={(e) => setFishDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              {/* 健康状態 */}
              <div className="border-t border-slate-100 pt-2.5">
                <div className="text-xs font-bold text-slate-800">
                  健康状態 <span className="text-red-500">*</span>
                </div>
                <div className="text-[10px] text-slate-500 mb-1.5">発熱・下痢・嘔吐等の症状なし</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '○良', val: '良' as const },
                    { label: '○否 (要報告)', val: '否' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setHealthStatus(btn.val)}
                      className={`py-2 text-xs font-bold rounded border ${
                        healthStatus === btn.val
                          ? btn.val === '良'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 手洗い実施 */}
              <div className="border-t border-slate-100 pt-2.5">
                <div className="text-xs font-bold text-slate-800">
                  手洗い実施 <span className="text-red-500">*</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { label: '○実施済み', val: '実施済み' as const },
                    { label: '○未実施', val: '未実施' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setHandWashing(btn.val)}
                      className={`py-2 text-xs font-bold rounded border ${
                        handWashing === btn.val
                          ? btn.val === '実施済み'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 各種確認 */}
              {[
                { label: '商品確認', sub: '鮮度、品温、産地情報・複数ある場合もそれぞれ確認', val: productCheck, setter: setProductCheck, badSub: '上席に報告指示を仰ぐ' },
                { label: '魚体洗浄', sub: '必ず真水で洗浄する事', val: fishWashing, setter: setFishWashing, badSub: '特記事項に内容説明' },
                { label: '作業温度', sub: '25℃以下での作業を', val: workTemp, setter: setWorkTemp, badSub: '特記事項に内容説明' },
                { label: '施設の衛生', sub: '手洗い設備・天井・壁・床・照明・整理整頓', val: facilityHygiene, setter: setFacilityHygiene, badSub: '特記事項に内容説明' },
                { label: '用具・備品の衛生', sub: '作業台・床・計量器・包丁・ノコギリ・ラップ等の衛生と整理整頓', val: toolsHygiene, setter: setToolsHygiene, badSub: '特記事項に内容説明' },
              ].map((item, idx) => (
                <div key={idx} className="border-t border-slate-100 pt-2.5">
                  <div className="text-xs font-bold text-slate-800">
                    {item.label} <span className="text-red-500">*</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mb-1.5">{item.sub}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '○よい', val: 'よい' as const },
                      { label: `○わるい (${item.badSub})`, val: 'わるい' as const },
                    ].map((btn) => (
                      <button
                        key={btn.val}
                        type="button"
                        onClick={() => item.setter(btn.val)}
                        className={`py-2 text-xs font-bold rounded border ${
                          item.val === btn.val
                            ? btn.val === 'よい'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="border-t border-slate-100 pt-2.5">
                <label className="block text-xs text-slate-500 mb-1">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={fishNotes}
                  onChange={(e) => setFishNotes(e.target.value)}
                  placeholder="悪い・否の場合は内容と指示内容を記入"
                  className="w-full p-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>
          )}

          {/* ---------------- 3. 温度衛生管理 ---------------- */}
          {activeTab === 'temp' && (
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-bold text-sm text-slate-800 border-l-4 border-cyan-600 pl-2">
                温度衛生管理
              </h2>
              <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded leading-tight">
                ⚠️ 予測や記憶で記入しないこと・緊急なトラブルがある時は直ちに責任者に連絡すること
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">記入日時</label>
                <input
                  type="datetime-local"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              {[
                { label: '本庫温度', target: 'マイナス20℃目安', val: mainFreezerTemp, set: setMainFreezerTemp, ph: '-20.0' },
                { label: '2号室温度', target: 'マイナス20℃目安', val: room2Temp, set: setRoom2Temp, ph: '-20.0' },
                { label: '鮮魚庫温度', target: 'マイナス1℃目安', val: fishStorageTemp, set: setFishStorageTemp, ph: '-1.0' },
                { label: '定温売場温度', target: '9℃以下目安', val: constantFloorTemp, set: setConstantFloorTemp, ph: '8.0' },
                { label: '売場温度（場内温度）', target: '場内実測', val: floorTemp, set: setFloorTemp, ph: '18.0' },
              ].map((item, idx) => (
                <div key={idx} className="border-t border-slate-100 pt-2">
                  <div className="flex justify-between items-baseline mb-1">
                    <label className="text-xs font-bold text-slate-700">{item.label}</label>
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {item.target}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder={`数字記入 (${item.ph})`}
                      value={item.val}
                      onChange={(e) => item.set(e.target.value)}
                      className="w-full p-2 pr-8 text-base font-bold border border-slate-300 rounded-md"
                    />
                    <span className="absolute right-2.5 top-2.5 text-slate-400 text-xs font-bold">℃</span>
                  </div>
                </div>
              ))}

              <div className="border-t border-slate-100 pt-2.5">
                <div className="text-xs font-bold text-slate-800">
                  太物売場（生魚加工ゾーン）衛生・整頓状況 <span className="text-red-500">*</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { label: '○よい', val: 'よい' as const },
                    { label: '○わるい (特記に説明)', val: 'わるい' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setProcessingZoneStatus(btn.val)}
                      className={`py-2 text-xs font-bold rounded border ${
                        processingZoneStatus === btn.val
                          ? btn.val === 'よい'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-2.5">
                <div className="text-xs font-bold text-slate-800">
                  害獣の痕跡 <span className="text-red-500">*</span>
                </div>
                <div className="text-[10px] text-slate-500 mb-1">ネズミ、鳥類他による汚れや商品破損</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '○気になる所見なし', val: '気になる所見なし' as const },
                    { label: '○問題発生 (特記に説明)', val: '問題発生' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setPestEvidence(btn.val)}
                      className={`py-2 text-xs font-bold rounded border ${
                        pestEvidence === btn.val
                          ? btn.val === '気になる所見なし'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-2.5">
                <label className="block text-xs text-slate-500 mb-1">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="悪い・問題発生の際は内容を説明"
                  className="w-full p-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>
          )}

          {/* ---------------- 4. 温度衛生管理（退勤前） ---------------- */}
          {activeTab === 'closing' && (
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-bold text-sm text-slate-800 border-l-4 border-indigo-600 pl-2">
                温度衛生管理（退勤前）
              </h2>

              <div>
                <label className="block text-xs text-slate-500 mb-1">記入日時</label>
                <input
                  type="datetime-local"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label className="text-xs font-bold text-slate-700">本庫温度</label>
                  <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    マイナス20℃目安
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="数字記入 (-20.0)"
                    value={closingMainTemp}
                    onChange={(e) => setClosingMainTemp(e.target.value)}
                    className="w-full p-2 pr-8 text-base font-bold border border-slate-300 rounded-md"
                  />
                  <span className="absolute right-2.5 top-2.5 text-slate-400 text-xs font-bold">℃</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label className="text-xs font-bold text-slate-700">2号室温度</label>
                  <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    マイナス20℃目安
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="数字記入 (-20.0)"
                    value={closingRoom2Temp}
                    onChange={(e) => setClosingRoom2Temp(e.target.value)}
                    className="w-full p-2 pr-8 text-base font-bold border border-slate-300 rounded-md"
                  />
                  <span className="absolute right-2.5 top-2.5 text-slate-400 text-xs font-bold">℃</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="特記事項があれば記入"
                  className="w-full p-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>
          )}

          {/* ---------------- 5. 運転日報（前回メーター参照＆桁違い検知付き） ---------------- */}
          {activeTab === 'drive' && (
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-bold text-sm text-slate-800 border-l-4 border-amber-600 pl-2">
                運転日報
              </h2>

              {/* 段階切り替えスイッチ */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDriveMode('start')}
                  className={`py-1.5 text-xs font-bold rounded ${
                    driveMode === 'start' ? 'bg-amber-600 text-white shadow' : 'text-slate-600'
                  }`}
                >
                  ① 出発時（乗車）
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDriveMode('finish');
                    fetchActiveDrives();
                  }}
                  className={`py-1.5 text-xs font-bold rounded ${
                    driveMode === 'finish' ? 'bg-amber-600 text-white shadow' : 'text-slate-600'
                  }`}
                >
                  ② 帰社時（降車・完了）
                </button>
              </div>

              {driveMode === 'start' ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">使用車両</label>
                    <div className="flex gap-2">
                      <select
                        value={vehicle}
                        onChange={(e) => setVehicle(e.target.value)}
                        className="p-2 border border-slate-300 rounded-md text-xs flex-1 bg-white font-bold"
                      >
                        {VEHICLE_OPTIONS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                        <option value="その他">その他（手入力）</option>
                      </select>
                      {vehicle === 'その他' && (
                        <input
                          type="text"
                          placeholder="車両名"
                          value={customVehicle}
                          onChange={(e) => setCustomVehicle(e.target.value)}
                          className="p-2 border border-slate-300 rounded-md text-xs flex-1"
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">行先</label>
                    <div className="flex gap-2">
                      <select
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="p-2 border border-slate-300 rounded-md text-xs flex-1 bg-white"
                      >
                        {DESTINATION_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                        <option value="その他">その他（手入力）</option>
                      </select>
                      {destination === 'その他' && (
                        <input
                          type="text"
                          placeholder="行先"
                          value={customDestination}
                          onChange={(e) => setCustomDestination(e.target.value)}
                          className="p-2 border border-slate-300 rounded-md text-xs flex-1"
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">同乗者（ある場合記入）</label>
                    <input
                      type="text"
                      placeholder="なし、または同乗者氏名"
                      value={passenger}
                      onChange={(e) => setPassenger(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">開始時（自動入力）</label>
                      <input
                        type="datetime-local"
                        value={driveStart}
                        onChange={(e) => setDriveStart(e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          乗車時メーター (km) <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        required
                        placeholder="例: 12500.5"
                        value={startMeter}
                        onChange={(e) => setStartMeter(e.target.value)}
                        className={`w-full p-1.5 border rounded-md text-sm font-bold ${
                          isStartMeterDecreased || isStartMeterDigitError
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-slate-300'
                        }`}
                      />
                    </div>
                  </div>

                  {/* 前回到達メーター表示 */}
                  {fetchingLastMeter ? (
                    <div className="text-[11px] text-slate-400 italic">車両の過去メーターを参照中...</div>
                  ) : lastRecordedMeter !== null ? (
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs flex justify-between items-center">
                      <span className="text-slate-600">前回最終メーター記録:</span>
                      <span className="font-mono font-bold text-slate-800">{lastRecordedMeter.toLocaleString()} km</span>
                    </div>
                  ) : null}

                  {/* 桁違い・逆行アラート */}
                  {isStartMeterDecreased && (
                    <div className="p-2.5 bg-red-100 border border-red-400 text-red-800 rounded-md text-xs font-bold animate-pulse">
                      🚨 メーター逆行エラー：前回の最終記録（{lastRecordedMeter} km）より小さくなっています。数値を再確認してください。
                    </div>
                  )}

                  {isStartMeterDigitError && !isStartMeterDecreased && (
                    <div className="p-2.5 bg-amber-100 border border-amber-400 text-amber-900 rounded-md text-xs font-bold">
                      ⚠️ 桁数違いの疑い：前回の記録（{lastRecordedMeter} km）と桁数が大きく異なります。一桁多い、または少ない可能性があります。
                    </div>
                  )}
                </div>
              ) : (
                /* 帰社時（降車・完了）ブロック */
                (() => {
                  const currentDrive = activeDrives.find((d) => d.id === selectedDriveId);
                  const currentStartMeter = currentDrive ? Number(currentDrive.start_meter) : null;
                  const currentEndMeter = endMeter !== '' ? parseFloat(endMeter) : null;
                  const isMeterInvalid = currentStartMeter !== null && currentEndMeter !== null && currentEndMeter < currentStartMeter;
                  const calculatedDistance =
                    currentStartMeter !== null && currentEndMeter !== null && !isMeterInvalid
                      ? (currentEndMeter - currentStartMeter).toFixed(1)
                      : null;

                  return (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          完了する運行データを選択 <span className="text-red-500">*</span>
                        </label>
                        {activeDrives.length === 0 ? (
                          <div className="p-3 bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center rounded">
                            現在運行中のデータはありません
                          </div>
                        ) : (
                          <select
                            value={selectedDriveId}
                            onChange={(e) => setSelectedDriveId(e.target.value)}
                            className="w-full p-2 border border-amber-300 bg-amber-50 rounded-md text-xs font-bold"
                          >
                            {activeDrives.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.vehicle_name} ({d.staff_name}さん / 乗車時: {d.start_meter} km)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">終了時（自動入力）</label>
                          <input
                            type="datetime-local"
                            value={driveEnd}
                            onChange={(e) => setDriveEnd(e.target.value)}
                            className="w-full p-1.5 border border-slate-300 rounded-md text-xs"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-700">
                              降車時メーター (km) <span className="text-red-500">*</span>
                            </label>
                            {currentStartMeter !== null && (
                              <span className="text-[10px] text-slate-500 font-mono">乗車: {currentStartMeter} km</span>
                            )}
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            required
                            placeholder="例: 12550.0"
                            value={endMeter}
                            onChange={(e) => setEndMeter(e.target.value)}
                            className={`w-full p-1.5 border rounded-md text-sm font-bold ${
                              isMeterInvalid
                                ? 'border-red-500 bg-red-50 text-red-700 focus:ring-red-500'
                                : 'border-slate-300'
                            }`}
                          />
                        </div>
                      </div>

                      {/* 降車時リアルタイム判定 */}
                      {isMeterInvalid && (
                        <div className="p-2.5 bg-red-100 border border-red-400 text-red-800 rounded-md text-xs font-bold animate-pulse">
                          🚨 メーター不整合：乗車時（{currentStartMeter} km）より小さくなっています。数値を再確認してください。
                        </div>
                      )}

                      {calculatedDistance !== null && (
                        <div className="p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-md text-xs font-bold flex justify-between items-center">
                          <span>走行距離（自動計算）:</span>
                          <span className="text-sm font-mono">{calculatedDistance} km</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs text-slate-500 mb-1">給油ある場合は記入（単位ℓ）</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="例: 35.0"
                          value={refuelLiters}
                          onChange={(e) => setRefuelLiters(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-md text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1">特記事項・連絡事項</label>
                        <textarea
                          rows={2}
                          value={driveNotes}
                          onChange={(e) => setDriveNotes(e.target.value)}
                          placeholder="異常や連絡事項があれば記入"
                          className="w-full p-2 text-xs border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* 送信ボタン */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                submitting ||
                (activeTab === 'drive' && driveMode === 'finish' && activeDrives.length === 0) ||
                (activeTab === 'drive' && driveMode === 'start' && (isStartMeterDecreased || isStartMeterDigitError))
              }
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-base rounded-xl shadow transition-all disabled:opacity-40"
            >
              {submitting
                ? '送信中...'
                : activeTab === 'drive'
                ? driveMode === 'start'
                  ? '① 出発を記録する'
                  : '② 運行完了を記録する'
                : '送信する'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-center">読み込み中...</div>}>
      <ChecksheetForm />
    </Suspense>
  );
}