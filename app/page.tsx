'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const CHECKER_OPTIONS = ['山内', '五十嵐', '菊島', '高橋'];
const VEHICLE_OPTIONS = ['ハイゼット 0539', 'ハイゼット 4076', 'ハイゼット 4000', 'ダイナ 3694', 'プロボックス 1475', 'ISUZU 4005', 'ISUZU 4004'];
const DESTINATION_OPTIONS = ['市内ルート', '田島方面', '喜多方方面', '猪苗代方面', '只見方面'];

// 日本時間の現在日時を取得（内部送信用 ISO 文字列）
const getNowJST = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// 画面表示用：西暦なし・曜日付き特大フォーマット（例: 9/22(火) 15:07）
const formatDisplayJST = (isoString: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const day = dayNames[d.getDay()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${date}(${day}) ${hours}:${minutes}`;
};

type TabType = 'alcohol' | 'fish' | 'temp' | 'closing' | 'drive';

const normalizeTab = (raw: string | null): TabType => {
  if (!raw) return 'alcohol';
  if (raw === 'temp_hygiene' || raw === 'temp') return 'temp';
  if (raw === 'fish_processing' || raw === 'fish') return 'fish';
  if (raw === 'alcohol') return 'alcohol';
  if (raw === 'driving_report' || raw === 'drive') return 'drive';
  if (raw === 'temp_closing' || raw === 'closing') return 'closing';
  return 'alcohol';
};

// 温度微調整ヘルパー
const adjustTempValue = (current: string, delta: number, defaultBase: number): string => {
  const base = current !== '' ? parseFloat(current) : defaultBase;
  if (isNaN(base)) return defaultBase.toFixed(1);
  return (Math.round((base + delta) * 10) / 10).toFixed(1);
};

// 日時表示コンポーネント（タップで時刻微調整も可能）
function BigDateDisplay({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="bg-slate-50 border-3 border-slate-300 rounded-2xl p-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-bold text-slate-500">記録日時</span>
        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">自動取得</span>
      </div>
      <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight text-center py-1">
        {formatDisplayJST(value)}
      </div>
      <div className="mt-2 text-right">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs text-slate-400 border border-slate-200 rounded px-2 py-1 bg-white"
        />
      </div>
    </div>
  );
}

function ChecksheetForm() {
  const searchParams = useSearchParams();
  const initialParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(() => normalizeTab(initialParam));
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [staffName, setStaffName] = useState('');
  const [staffHistory, setStaffHistory] = useState<string[]>([]);

  // ---------------- 1. アルコール（出勤時 / 退勤時 セレクト対応） ----------------
  const [alcoholMode, setAlcoholMode] = useState<'start' | 'finish'>('start');
  const [alcoholDate, setAlcoholDate] = useState(getNowJST());
  const [checkerType, setCheckerType] = useState(CHECKER_OPTIONS[0] || '');
  const [customChecker, setCustomChecker] = useState('');
  const [alcoholVal, setAlcoholVal] = useState('');
  const [alcoholNotes, setAlcoholNotes] = useState('');

  // ---------------- 2. 生魚加工 ----------------
  const [fishDate, setFishDate] = useState(getNowJST());
  const [healthStatus, setHealthStatus] = useState<'良' | '否' | ''>('');
  const [handWashing, setHandWashing] = useState<'実施済み' | '未実施' | ''>('');
  const [productCheck, setProductCheck] = useState<'よい' | 'わるい' | ''>('');
  const [fishWashing, setFishWashing] = useState<'よい' | 'わるい' | ''>('');
  const [workTemp, setWorkTemp] = useState<'よい' | 'わるい' | ''>('');
  const [facilityHygiene, setFacilityHygiene] = useState<'よい' | 'わるい' | ''>('');
  const [toolsHygiene, setToolsHygiene] = useState<'よい' | 'わるい' | ''>('');
  const [fishNotes, setFishNotes] = useState('');

  // ---------------- 3. 保管庫温度 ----------------
  const [tempDate, setTempDate] = useState(getNowJST());
  const [mainFreezerTemp, setMainFreezerTemp] = useState('');
  const [room2Temp, setRoom2Temp] = useState('');
  const [fishStorageTemp, setFishStorageTemp] = useState('');
  const [constantFloorTemp, setConstantFloorTemp] = useState('');
  const [floorTemp, setFloorTemp] = useState('');
  const [processingZoneStatus, setProcessingZoneStatus] = useState<'よい' | 'わるい' | ''>('');
  const [pestEvidence, setPestEvidence] = useState<'気になる所見なし' | '問題発生' | ''>('');
  const [tempNotes, setTempNotes] = useState('');

  // ---------------- 4. 退勤前温度 ----------------
  const [closingDate, setClosingDate] = useState(getNowJST());
  const [closingMainTemp, setClosingMainTemp] = useState('');
  const [closingRoom2Temp, setClosingRoom2Temp] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // ---------------- 5. 運転日報 ----------------
  const [driveMode, setDriveMode] = useState<'start' | 'finish'>('start');
  const [vehicle, setVehicle] = useState(VEHICLE_OPTIONS[0] || '');
  const [customVehicle, setCustomVehicle] = useState('');
  const [destination, setDestination] = useState(DESTINATION_OPTIONS[0] || '');
  const [customDestination, setCustomDestination] = useState('');
  const [passenger, setPassenger] = useState('');
  const [driveStart, setDriveStart] = useState(getNowJST());
  const [startMeter, setStartMeter] = useState('');
  const [lastRecordedMeter, setLastRecordedMeter] = useState<number | null>(null);
  const [fetchingLastMeter, setFetchingLastMeter] = useState(false);

  const [activeDrives, setActiveDrives] = useState<any[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [driveEnd, setDriveEnd] = useState(getNowJST());
  const [endMeter, setEndMeter] = useState('');
  const [refuelLiters, setRefuelLiters] = useState('');
  const [driveNotes, setDriveNotes] = useState('');

  useEffect(() => {
    const rawParam = searchParams.get('tab') || new URLSearchParams(window.location.search).get('tab');
    if (rawParam) {
      setActiveTab(normalizeTab(rawParam));
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('last_staff_name') || '';
      if (savedName) setStaffName(savedName);
      const history = JSON.parse(localStorage.getItem('staff_name_history') || '[]');
      setStaffHistory(history);
    } catch (e) {
      console.error(e);
    }
  }, []);

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

  useEffect(() => {
    if (activeTab === 'drive' && driveMode === 'start') {
      const target = vehicle === 'その他' ? customVehicle : vehicle;
      fetchVehicleLastMeter(target);
    }
  }, [vehicle, customVehicle, activeTab, driveMode]);

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
    try {
      localStorage.setItem('last_staff_name', name);
      const updated = Array.from(new Set([name, ...staffHistory])).slice(0, 10);
      localStorage.setItem('staff_name_history', JSON.stringify(updated));
      setStaffHistory(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const alcNum = parseFloat(alcoholVal);
  const isAlcoholWarning = !isNaN(alcNum) && alcNum > 0 && alcNum < 0.15;
  const isAlcoholDanger = !isNaN(alcNum) && alcNum >= 0.15 && alcNum < 0.25;
  const isAlcoholFlashing = !isNaN(alcNum) && alcNum >= 0.25;

  const currentStartMeterNum = parseFloat(startMeter);
  const isStartMeterDecreased =
    lastRecordedMeter !== null && !isNaN(currentStartMeterNum) && currentStartMeterNum < lastRecordedMeter;
  const isStartMeterDigitError =
    lastRecordedMeter !== null &&
    lastRecordedMeter > 0 &&
    !isNaN(currentStartMeterNum) &&
    (currentStartMeterNum < lastRecordedMeter * 0.2 || currentStartMeterNum > lastRecordedMeter * 2.5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) {
      alert('あなたのお名前を入力してください');
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

        const timingLabel = alcoholMode === 'start' ? '出勤時（業務前）' : '退勤時（業務後）';

        const { error } = await supabase.from('check_alcohol').insert([
          {
            checked_at: new Date(alcoholDate).toISOString(),
            staff_name: staffName,
            checker_name: checker,
            alcohol_value: parseFloat(alcoholVal),
            notes: `${timingLabel} ${alcoholNotes}`.trim(),
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
        if (mainFreezerTemp === '') throw new Error('「本庫温度」を入力してください');
        if (room2Temp === '') throw new Error('「2号室温度」を入力してください');
        if (fishStorageTemp === '') throw new Error('「鮮魚庫温度」を入力してください');
        if (constantFloorTemp === '') throw new Error('「定温売場温度」を入力してください');
        if (floorTemp === '') throw new Error('「売場温度（場内温度）」を入力してください');
        if (!processingZoneStatus) throw new Error('太物売場の衛生状況を選択してください');
        if (!pestEvidence) throw new Error('害獣の痕跡を選択してください');

        const { error } = await supabase.from('check_temp_hygiene').insert([
          {
            checked_at: new Date(tempDate).toISOString(),
            staff_name: staffName,
            main_freezer_temp: parseFloat(mainFreezerTemp),
            room2_freezer_temp: parseFloat(room2Temp),
            fish_storage_temp: parseFloat(fishStorageTemp),
            constant_floor_temp: parseFloat(constantFloorTemp),
            floor_temp: parseFloat(floorTemp),
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
        if (closingMainTemp === '') throw new Error('「本庫温度」を入力してください');
        if (closingRoom2Temp === '') throw new Error('「2号室温度」を入力してください');

        const { error } = await supabase.from('check_temp_closing').insert([
          {
            checked_at: new Date(closingDate).toISOString(),
            staff_name: staffName,
            main_freezer_temp: parseFloat(closingMainTemp),
            room2_freezer_temp: parseFloat(closingRoom2Temp),
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
      alert('入力エラー: ' + (err.message || 'Supabase接続エラー'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-32 font-sans">
      <header className="bg-blue-900 text-white p-5 shadow-lg sticky top-0 z-30">
        <h1 className="text-2xl font-black text-center tracking-wide">業務管理チェックシート</h1>
      </header>

      {/* タブナビゲーション */}
      <div className="bg-white border-b-4 border-slate-300 sticky top-[72px] z-20 overflow-x-auto shadow-md">
        <div className="flex px-3 py-3 gap-2 min-w-max">
          {[
            { key: 'alcohol', label: '🍺 アルコール' },
            { key: 'fish', label: '🐟 生魚加工' },
            { key: 'temp', label: '🌡️ 保管庫温度' },
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
              className={`px-5 py-3 text-base md:text-lg font-black rounded-xl transition-all ${
                activeTab === tab.key
                  ? 'bg-blue-700 text-white shadow-lg ring-2 ring-blue-300'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-2 border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-6">
        {successMsg && (
          <div className="p-6 bg-emerald-100 border-4 border-emerald-500 text-emerald-950 rounded-2xl text-2xl text-center font-black shadow-lg animate-bounce">
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-md border-3 border-slate-300">
            <label className="block text-xl font-black text-slate-900 mb-2">
              あなたのお名前 <span className="text-red-600 text-2xl">*</span>
            </label>
            <input
              type="text"
              list="staffList"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="お名前を入力（例：山田 太郎）"
              className="w-full text-xl font-bold h-16 px-4 border-3 border-slate-400 rounded-2xl focus:border-blue-600 focus:bg-blue-50 outline-none"
            />
            <datalist id="staffList">
              {staffHistory.map((name, i) => (
                <option key={i} value={name} />
              ))}
            </datalist>
          </div>

          {/* ---------------- 1. アルコールチェック（出勤時 / 退勤時 セレクト化） ---------------- */}
          {activeTab === 'alcohol' && (
            <div className="bg-white p-6 rounded-3xl shadow-md border-3 border-slate-300 space-y-6">
              <h2 className="font-black text-2xl text-slate-900 border-l-8 border-blue-600 pl-3">
                アルコールチェック記録
              </h2>

              {/* 出勤時・退勤時の切り替えボタン */}
              <div className="grid grid-cols-2 gap-3 bg-slate-200 p-2 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setAlcoholMode('start')}
                  className={`h-16 text-lg md:text-xl font-black rounded-xl transition-all ${
                    alcoholMode === 'start' ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300' : 'text-slate-800'
                  }`}
                >
                  ① 出勤時（業務前）
                </button>
                <button
                  type="button"
                  onClick={() => setAlcoholMode('finish')}
                  className={`h-16 text-lg md:text-xl font-black rounded-xl transition-all ${
                    alcoholMode === 'finish' ? 'bg-indigo-700 text-white shadow-lg ring-2 ring-indigo-300' : 'text-slate-800'
                  }`}
                >
                  ② 退勤時（業務後）
                </button>
              </div>

              {/* 特大日時表示 */}
              <BigDateDisplay value={alcoholDate} onChange={setAlcoholDate} />

              <div>
                <div className="flex flex-wrap justify-between items-baseline mb-2 gap-2">
                  <label className="text-xl font-black text-slate-900">
                    確認者（対面確認） <span className="text-red-600">*</span>
                  </label>
                  <span className="text-sm font-black text-amber-900 bg-amber-100 px-3 py-1 rounded-lg border-2 border-amber-300">
                    第三者と対面
                  </span>
                </div>
                <div className="space-y-3">
                  <select
                    value={checkerType}
                    onChange={(e) => setCheckerType(e.target.value)}
                    className="w-full h-16 px-4 border-3 border-slate-400 rounded-2xl text-xl font-black bg-white"
                  >
                    {CHECKER_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="その他">その他（手入力）</option>
                  </select>
                  {checkerType === 'その他' && (
                    <input
                      type="text"
                      placeholder="確認者の名前を入力"
                      value={customChecker}
                      onChange={(e) => setCustomChecker(e.target.value)}
                      className="w-full h-16 px-4 border-3 border-blue-400 bg-blue-50 rounded-2xl text-xl font-bold"
                      required
                    />
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-300 space-y-3">
                <div className="flex justify-between items-baseline">
                  <label className="text-xl font-black text-slate-900">
                    測定数値 (mg/L) <span className="text-red-600">*</span>
                  </label>
                  <span className="text-sm font-bold text-slate-500">検知器の数字</span>
                </div>
                <div className="flex gap-3 items-stretch">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    required
                    placeholder="0.00"
                    value={alcoholVal}
                    onChange={(e) => setAlcoholVal(e.target.value)}
                    className="w-full text-5xl font-black h-20 px-4 border-3 border-slate-400 rounded-2xl text-center bg-white shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setAlcoholVal('0.00')}
                    className="px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black rounded-2xl shadow-md whitespace-nowrap flex flex-col items-center justify-center border-2 border-emerald-700"
                  >
                    <span className="text-xs">一発入力</span>
                    <span className="text-2xl mt-0.5">0.00</span>
                  </button>
                </div>

                {alcoholVal !== '' && (
                  <div className="mt-4 text-center">
                    {alcNum === 0 && (
                      <div className="p-4 bg-emerald-100 text-emerald-950 rounded-2xl border-3 border-emerald-500 text-xl font-black">
                        ✅ 0.00（正常・運転可）
                      </div>
                    )}
                    {isAlcoholWarning && (
                      <div className="p-4 bg-amber-100 text-amber-950 rounded-2xl border-3 border-amber-400 text-lg font-black leading-snug">
                        ⚠️ 0.15未満（{alcNum} mg/L）再計測または確認を行ってください
                      </div>
                    )}
                    {isAlcoholDanger && (
                      <div className="p-5 bg-red-600 text-white rounded-2xl shadow-xl text-lg font-black leading-relaxed">
                        🚨 0.15以上〜0.25未満：運転禁止！<br />
                        上席に指示を仰ぎ、特記事項に理由を記入してください
                      </div>
                    )}
                    {isAlcoholFlashing && (
                      <div className="p-5 bg-red-700 text-white rounded-2xl shadow-2xl animate-pulse border-4 border-yellow-300 text-xl font-black leading-relaxed">
                        ⚡ 0.25以上：運転厳禁！<br />
                        直ちに上席に連絡してください
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-base font-bold text-slate-700 mb-2">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={alcoholNotes}
                  onChange={(e) => setAlcoholNotes(e.target.value)}
                  placeholder="0.15以上の場合は上席の指示内容を記入"
                  className="w-full p-4 text-lg border-3 border-slate-400 rounded-2xl"
                />
              </div>
            </div>
          )}

          {/* ---------------- 2. 生魚加工衛生管理 ---------------- */}
          {activeTab === 'fish' && (
            <div className="bg-white p-6 rounded-3xl shadow-md border-3 border-slate-300 space-y-6">
              <h2 className="font-black text-2xl text-slate-900 border-l-8 border-emerald-600 pl-3">
                生魚加工衛生管理
              </h2>

              <BigDateDisplay value={fishDate} onChange={setFishDate} />

              <div className="border-t-3 border-slate-200 pt-5">
                <div className="text-xl font-black text-slate-900">
                  健康状態 <span className="text-red-600">*</span>
                </div>
                <div className="text-sm text-slate-600 font-bold mb-3">発熱・下痢・嘔吐等の症状なし</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '○ 良（異常なし）', val: '良' as const },
                    { label: '○ 否（要報告）', val: '否' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setHealthStatus(btn.val)}
                      className={`h-20 text-lg md:text-xl font-black rounded-2xl border-3 transition-all ${
                        healthStatus === btn.val
                          ? btn.val === '良'
                            ? 'bg-emerald-600 text-white border-emerald-800 shadow-lg scale-[1.02]'
                            : 'bg-red-600 text-white border-red-800 shadow-lg scale-[1.02]'
                          : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t-3 border-slate-200 pt-5">
                <div className="text-xl font-black text-slate-900">
                  手洗い実施 <span className="text-red-600">*</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {[
                    { label: '○ 実施済み', val: '実施済み' as const },
                    { label: '○ 未実施', val: '未実施' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setHandWashing(btn.val)}
                      className={`h-20 text-lg md:text-xl font-black rounded-2xl border-3 transition-all ${
                        handWashing === btn.val
                          ? btn.val === '実施済み'
                            ? 'bg-blue-600 text-white border-blue-800 shadow-lg scale-[1.02]'
                            : 'bg-red-600 text-white border-red-800 shadow-lg scale-[1.02]'
                          : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {[
                { label: '商品確認', sub: '鮮度、品温、産地情報・複数ある場合もそれぞれ確認', val: productCheck, setter: setProductCheck, badSub: '上席に報告' },
                { label: '魚体洗浄', sub: '必ず真水で洗浄する事', val: fishWashing, setter: setFishWashing, badSub: '特記に説明' },
                { label: '作業温度', sub: '25℃以下での作業を', val: workTemp, setter: setWorkTemp, badSub: '特記に説明' },
                { label: '施設の衛生', sub: '手洗い設備・天井・壁・床・照明・整理整頓', val: facilityHygiene, setter: setFacilityHygiene, badSub: '特記に説明' },
                { label: '用具・備品の衛生', sub: '作業台・床・計量器・包丁・ノコギリ・ラップ等', val: toolsHygiene, setter: setToolsHygiene, badSub: '特記に説明' },
              ].map((item, idx) => (
                <div key={idx} className="border-t-3 border-slate-200 pt-5">
                  <div className="text-xl font-black text-slate-900">
                    {item.label} <span className="text-red-600">*</span>
                  </div>
                  <div className="text-sm text-slate-600 font-bold mb-3">{item.sub}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: '○ よい', val: 'よい' as const },
                      { label: `○ わるい (${item.badSub})`, val: 'わるい' as const },
                    ].map((btn) => (
                      <button
                        key={btn.val}
                        type="button"
                        onClick={() => item.setter(btn.val)}
                        className={`h-20 text-base md:text-lg font-black rounded-2xl border-3 transition-all ${
                          item.val === btn.val
                            ? btn.val === 'よい'
                              ? 'bg-emerald-600 text-white border-emerald-800 shadow-lg scale-[1.02]'
                              : 'bg-red-600 text-white border-red-800 shadow-lg scale-[1.02]'
                            : 'bg-slate-50 text-slate-800 border-slate-300'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="border-t-3 border-slate-200 pt-5">
                <label className="block text-base font-bold text-slate-700 mb-2">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={fishNotes}
                  onChange={(e) => setFishNotes(e.target.value)}
                  placeholder="悪い・否の場合は内容と指示内容を記入"
                  className="w-full p-4 text-lg border-3 border-slate-400 rounded-2xl"
                />
              </div>
            </div>
          )}

          {/* ---------------- 3. 保管庫温度管理 ---------------- */}
          {activeTab === 'temp' && (
            <div className="bg-white p-6 rounded-3xl shadow-md border-3 border-slate-300 space-y-6">
              <h2 className="font-black text-2xl text-slate-900 border-l-8 border-cyan-600 pl-3">
                保管庫温度管理
              </h2>
              <div className="p-4 bg-amber-50 border-3 border-amber-300 text-amber-950 text-sm font-bold rounded-2xl leading-relaxed">
                ⚠️ 全ての温度入力が必須です。ボタンを押すだけで目安温度を一発入力できます。
              </div>

              <BigDateDisplay value={tempDate} onChange={setTempDate} />

              {[
                { label: '本庫温度', target: 'マイナス20℃目安', val: mainFreezerTemp, set: setMainFreezerTemp, base: -20.0 },
                { label: '2号室温度', target: 'マイナス20℃目安', val: room2Temp, set: setRoom2Temp, base: -20.0 },
                { label: '鮮魚庫温度', target: 'マイナス1℃目安', val: fishStorageTemp, set: setFishStorageTemp, base: -1.0 },
                { label: '定温売場温度', target: '9℃以下目安', val: constantFloorTemp, set: setConstantFloorTemp, base: 8.0 },
                { label: '売場温度（場内実測）', target: '場内実測', val: floorTemp, set: setFloorTemp, base: 18.0 },
              ].map((item, idx) => (
                <div key={idx} className="border-t-3 border-slate-200 pt-5">
                  <div className="flex flex-wrap justify-between items-baseline mb-2 gap-2">
                    <label className="text-xl font-black text-slate-900">
                      {item.label} <span className="text-red-600 text-2xl">*</span>
                    </label>
                    <span className="text-sm font-black text-blue-800 bg-blue-100 px-3 py-1 rounded-lg border-2 border-blue-300">
                      {item.target}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => item.set(item.base.toFixed(1))}
                      className="col-span-2 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-lg rounded-xl shadow-md border-2 border-blue-700 flex items-center justify-center gap-1"
                    >
                      <span>目安</span>
                      <span>{item.base > 0 ? `+${item.base.toFixed(1)}` : item.base.toFixed(1)}℃</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => item.set(adjustTempValue(item.val, -0.5, item.base))}
                      className="py-3 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-900 font-black text-lg rounded-xl border-2 border-slate-400"
                    >
                      -0.5
                    </button>
                    <button
                      type="button"
                      onClick={() => item.set(adjustTempValue(item.val, +0.5, item.base))}
                      className="py-3 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-900 font-black text-lg rounded-xl border-2 border-slate-400"
                    >
                      +0.5
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      required
                      placeholder={`数字を入力 (${item.base.toFixed(1)})`}
                      value={item.val}
                      onChange={(e) => item.set(e.target.value)}
                      className={`w-full h-18 text-3xl font-black px-4 pr-12 border-3 rounded-2xl focus:border-blue-600 ${
                        item.val === '' ? 'border-amber-400 bg-amber-50/40' : 'border-slate-400 bg-white'
                      }`}
                    />
                    <span className="absolute right-4 top-4 text-slate-400 text-2xl font-black">℃</span>
                  </div>
                </div>
              ))}

              <div className="border-t-3 border-slate-200 pt-5">
                <div className="text-xl font-black text-slate-900">
                  太物売場（生魚加工ゾーン）衛生・整頓状況 <span className="text-red-600">*</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {[
                    { label: '○ よい', val: 'よい' as const },
                    { label: '○ わるい (特記に説明)', val: 'わるい' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setProcessingZoneStatus(btn.val)}
                      className={`h-20 text-base md:text-lg font-black rounded-2xl border-3 transition-all ${
                        processingZoneStatus === btn.val
                          ? btn.val === 'よい'
                            ? 'bg-emerald-600 text-white border-emerald-800 shadow-lg scale-[1.02]'
                            : 'bg-red-600 text-white border-red-800 shadow-lg scale-[1.02]'
                          : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t-3 border-slate-200 pt-5">
                <div className="text-xl font-black text-slate-900">
                  害獣の痕跡 <span className="text-red-600">*</span>
                </div>
                <div className="text-sm text-slate-600 font-bold mb-3">ネズミ、鳥類他による汚れや商品破損</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '○ 気になる所見なし', val: '気になる所見なし' as const },
                    { label: '○ 問題発生 (特記に説明)', val: '問題発生' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setPestEvidence(btn.val)}
                      className={`h-20 text-base md:text-lg font-black rounded-2xl border-3 transition-all ${
                        pestEvidence === btn.val
                          ? btn.val === '気になる所見なし'
                            ? 'bg-emerald-600 text-white border-emerald-800 shadow-lg scale-[1.02]'
                            : 'bg-red-600 text-white border-red-800 shadow-lg scale-[1.02]'
                          : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t-3 border-slate-200 pt-5">
                <label className="block text-base font-bold text-slate-700 mb-2">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="悪い・問題発生の際は内容を説明"
                  className="w-full p-4 text-lg border-3 border-slate-400 rounded-2xl"
                />
              </div>
            </div>
          )}

          {/* ---------------- 4. 退勤前温度管理 ---------------- */}
          {activeTab === 'closing' && (
            <div className="bg-white p-6 rounded-3xl shadow-md border-3 border-slate-300 space-y-6">
              <h2 className="font-black text-2xl text-slate-900 border-l-8 border-indigo-600 pl-3">
                退勤前温度管理
              </h2>

              <BigDateDisplay value={closingDate} onChange={setClosingDate} />

              <div>
                <div className="flex flex-wrap justify-between items-baseline mb-2 gap-2">
                  <label className="text-xl font-black text-slate-900">
                    本庫温度 <span className="text-red-600 text-2xl">*</span>
                  </label>
                  <span className="text-sm font-black text-blue-800 bg-blue-100 px-3 py-1 rounded-lg border-2 border-blue-300">
                    マイナス20℃目安
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setClosingMainTemp('-20.0')}
                    className="col-span-2 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-lg rounded-xl shadow-md border-2 border-blue-700"
                  >
                    目安 -20.0℃
                  </button>
                  <button
                    type="button"
                    onClick={() => setClosingMainTemp(adjustTempValue(closingMainTemp, -0.5, -20.0))}
                    className="py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-black text-lg rounded-xl border-2 border-slate-400"
                  >
                    -0.5
                  </button>
                  <button
                    type="button"
                    onClick={() => setClosingMainTemp(adjustTempValue(closingMainTemp, +0.5, -20.0))}
                    className="py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-black text-lg rounded-xl border-2 border-slate-400"
                  >
                    +0.5
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    required
                    placeholder="数字を入力 (-20.0)"
                    value={closingMainTemp}
                    onChange={(e) => setClosingMainTemp(e.target.value)}
                    className={`w-full h-18 text-3xl font-black px-4 pr-12 border-3 rounded-2xl ${
                      closingMainTemp === '' ? 'border-amber-400 bg-amber-50/40' : 'border-slate-400 bg-white'
                    }`}
                  />
                  <span className="absolute right-4 top-4 text-slate-400 text-2xl font-black">℃</span>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap justify-between items-baseline mb-2 gap-2">
                  <label className="text-xl font-black text-slate-900">
                    2号室温度 <span className="text-red-600 text-2xl">*</span>
                  </label>
                  <span className="text-sm font-black text-blue-800 bg-blue-100 px-3 py-1 rounded-lg border-2 border-blue-300">
                    マイナス20℃目安
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setClosingRoom2Temp('-20.0')}
                    className="col-span-2 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-lg rounded-xl shadow-md border-2 border-blue-700"
                  >
                    目安 -20.0℃
                  </button>
                  <button
                    type="button"
                    onClick={() => setClosingRoom2Temp(adjustTempValue(closingRoom2Temp, -0.5, -20.0))}
                    className="py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-black text-lg rounded-xl border-2 border-slate-400"
                  >
                    -0.5
                  </button>
                  <button
                    type="button"
                    onClick={() => setClosingRoom2Temp(adjustTempValue(closingRoom2Temp, +0.5, -20.0))}
                    className="py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-black text-lg rounded-xl border-2 border-slate-400"
                  >
                    +0.5
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    required
                    placeholder="数字を入力 (-20.0)"
                    value={closingRoom2Temp}
                    onChange={(e) => setClosingRoom2Temp(e.target.value)}
                    className={`w-full h-18 text-3xl font-black px-4 pr-12 border-3 rounded-2xl ${
                      closingRoom2Temp === '' ? 'border-amber-400 bg-amber-50/40' : 'border-slate-400 bg-white'
                    }`}
                  />
                  <span className="absolute right-4 top-4 text-slate-400 text-2xl font-black">℃</span>
                </div>
              </div>

              <div>
                <label className="block text-base font-bold text-slate-700 mb-2">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="特記事項があれば記入"
                  className="w-full p-4 text-lg border-3 border-slate-400 rounded-2xl"
                />
              </div>
            </div>
          )}

          {/* ---------------- 5. 運転日報 ---------------- */}
          {activeTab === 'drive' && (
            <div className="bg-white p-6 rounded-3xl shadow-md border-3 border-slate-300 space-y-6">
              <h2 className="font-black text-2xl text-slate-900 border-l-8 border-amber-600 pl-3">
                運転日報
              </h2>

              <div className="grid grid-cols-2 gap-3 bg-slate-200 p-2 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setDriveMode('start')}
                  className={`h-16 text-lg md:text-xl font-black rounded-xl transition-all ${
                    driveMode === 'start' ? 'bg-amber-600 text-white shadow-lg ring-2 ring-amber-300' : 'text-slate-800'
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
                  className={`h-16 text-lg md:text-xl font-black rounded-xl transition-all ${
                    driveMode === 'finish' ? 'bg-amber-600 text-white shadow-lg ring-2 ring-amber-300' : 'text-slate-800'
                  }`}
                >
                  ② 帰社時（降車）
                </button>
              </div>

              {driveMode === 'start' ? (
                <div className="space-y-6 pt-2">
                  <div>
                    <label className="block text-xl font-black text-slate-900 mb-2">
                      使用車両 <span className="text-red-600">*</span>
                    </label>
                    <div className="space-y-3">
                      <select
                        value={vehicle}
                        onChange={(e) => setVehicle(e.target.value)}
                        className="w-full h-16 px-4 border-3 border-slate-400 rounded-2xl text-xl font-black bg-white"
                      >
                        {VEHICLE_OPTIONS.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                        <option value="その他">その他（手入力）</option>
                      </select>
                      {vehicle === 'その他' && (
                        <input
                          type="text"
                          placeholder="車両名を入力"
                          value={customVehicle}
                          onChange={(e) => setCustomVehicle(e.target.value)}
                          className="w-full h-16 px-4 border-3 border-amber-400 bg-amber-50 rounded-2xl text-xl font-bold"
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xl font-black text-slate-900 mb-2">
                      行先 <span className="text-red-600">*</span>
                    </label>
                    <div className="space-y-3">
                      <select
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="w-full h-16 px-4 border-3 border-slate-400 rounded-2xl text-xl font-black bg-white"
                      >
                        {DESTINATION_OPTIONS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                        <option value="その他">その他（手入力）</option>
                      </select>
                      {destination === 'その他' && (
                        <input
                          type="text"
                          placeholder="行先を入力"
                          value={customDestination}
                          onChange={(e) => setCustomDestination(e.target.value)}
                          className="w-full h-16 px-4 border-3 border-amber-400 bg-amber-50 rounded-2xl text-xl font-bold"
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-base font-bold text-slate-700 mb-2">同乗者（ある場合記入）</label>
                    <input
                      type="text"
                      placeholder="なし、または同乗者名"
                      value={passenger}
                      onChange={(e) => setPassenger(e.target.value)}
                      className="w-full h-16 px-4 border-3 border-slate-400 rounded-2xl text-lg font-bold"
                    />
                  </div>

                  <div>
                    <BigDateDisplay value={driveStart} onChange={setDriveStart} />

                    <div className="flex justify-between items-baseline mb-2 mt-4">
                      <label className="text-xl font-black text-slate-900">
                        乗車時メーター (km) <span className="text-red-600">*</span>
                      </label>
                      <span className="text-sm font-bold text-slate-500">車のメーター値</span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      required
                      placeholder="例: 12500.5"
                      value={startMeter}
                      onChange={(e) => setStartMeter(e.target.value)}
                      className={`w-full h-20 px-4 text-4xl font-black border-3 rounded-2xl ${
                        isStartMeterDecreased || isStartMeterDigitError
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-slate-400'
                      }`}
                    />
                  </div>

                  {fetchingLastMeter ? (
                    <div className="text-sm text-slate-400 italic">車両の過去メーターを参照中...</div>
                  ) : lastRecordedMeter !== null ? (
                    <div className="p-4 bg-slate-100 border-2 border-slate-300 rounded-2xl text-base flex justify-between items-center">
                      <span className="font-bold text-slate-700">前回最終記録:</span>
                      <span className="font-mono font-black text-xl text-slate-950">{lastRecordedMeter.toLocaleString()} km</span>
                    </div>
                  ) : null}

                  {isStartMeterDecreased && (
                    <div className="p-4 bg-red-100 border-3 border-red-500 text-red-950 rounded-2xl text-base font-black animate-pulse">
                      🚨 メーター逆行エラー：前回の最終記録（{lastRecordedMeter} km）より小さくなっています。
                    </div>
                  )}

                  {isStartMeterDigitError && !isStartMeterDecreased && (
                    <div className="p-4 bg-amber-100 border-3 border-amber-500 text-amber-950 rounded-2xl text-base font-black">
                      ⚠️ 桁数違いの疑い：前回の記録（{lastRecordedMeter} km）と桁数が大きく異なります。
                    </div>
                  )}
                </div>
              ) : (
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
                    <div className="space-y-6 pt-2">
                      <div>
                        <label className="block text-xl font-black text-slate-900 mb-2">
                          完了する運行を選択 <span className="text-red-600">*</span>
                        </label>
                        {activeDrives.length === 0 ? (
                          <div className="p-5 bg-slate-50 border-3 border-slate-200 text-lg font-bold text-slate-500 text-center rounded-2xl">
                            現在運行中のデータはありません
                          </div>
                        ) : (
                          <select
                            value={selectedDriveId}
                            onChange={(e) => setSelectedDriveId(e.target.value)}
                            className="w-full h-16 px-4 border-3 border-amber-400 bg-amber-50 rounded-2xl text-lg font-black"
                          >
                            {activeDrives.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.vehicle_name} ({d.staff_name}さん / 乗車: {d.start_meter} km)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <BigDateDisplay value={driveEnd} onChange={setDriveEnd} />

                        <div className="flex justify-between items-baseline mb-2 mt-4">
                          <label className="text-xl font-black text-slate-900">
                            降車時メーター (km) <span className="text-red-600">*</span>
                          </label>
                          {currentStartMeter !== null && (
                            <span className="text-sm font-bold text-slate-600">乗車時: {currentStartMeter} km</span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          required
                          placeholder="例: 12550.0"
                          value={endMeter}
                          onChange={(e) => setEndMeter(e.target.value)}
                          className={`w-full h-20 px-4 text-4xl font-black border-3 rounded-2xl ${
                            isMeterInvalid
                              ? 'border-red-500 bg-red-50 text-red-700'
                              : 'border-slate-400'
                          }`}
                        />
                      </div>

                      {isMeterInvalid && (
                        <div className="p-4 bg-red-100 border-3 border-red-500 text-red-950 rounded-2xl text-base font-black animate-pulse">
                          🚨 メーター不整合：乗車時（{currentStartMeter} km）より小さくなっています。
                        </div>
                      )}

                      {calculatedDistance !== null && (
                        <div className="p-5 bg-emerald-50 border-3 border-emerald-400 text-emerald-950 rounded-2xl text-lg font-black flex justify-between items-center shadow-md">
                          <span>走行距離（自動計算）:</span>
                          <span className="text-3xl font-mono text-emerald-900">{calculatedDistance} km</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-xl font-black text-slate-900 mb-2">給油（ある場合記入・ℓ）</label>
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="例: 35.0"
                          value={refuelLiters}
                          onChange={(e) => setRefuelLiters(e.target.value)}
                          className="w-full h-16 px-4 text-2xl font-bold border-3 border-slate-400 rounded-2xl"
                        />
                      </div>

                      <div>
                        <label className="block text-base font-bold text-slate-700 mb-2">特記事項・連絡事項</label>
                        <textarea
                          rows={2}
                          value={driveNotes}
                          onChange={(e) => setDriveNotes(e.target.value)}
                          placeholder="異常や連絡事項があれば記入"
                          className="w-full p-4 text-lg border-3 border-slate-400 rounded-2xl"
                        />
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={
                submitting ||
                (activeTab === 'drive' && driveMode === 'finish' && activeDrives.length === 0) ||
                (activeTab === 'drive' && driveMode === 'start' && (isStartMeterDecreased || isStartMeterDigitError))
              }
              className="w-full h-20 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-black text-2xl rounded-3xl shadow-xl transition-all disabled:opacity-40 tracking-wider"
            >
              {submitting
                ? '送信中...'
                : activeTab === 'drive'
                ? driveMode === 'start'
                  ? '① 出発を記録する'
                  : '② 運行完了を記録する'
                : activeTab === 'alcohol'
                ? alcoholMode === 'start'
                  ? '① 出勤時アルコール記録を送信'
                  : '② 退勤時アルコール記録を送信'
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
    <Suspense fallback={<div className="p-8 text-center text-2xl font-black">読み込み中...</div>}>
      <ChecksheetForm />
    </Suspense>
  );
}
