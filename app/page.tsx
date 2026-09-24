'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const CHECKER_OPTIONS = ['石川', '武藤', '長谷川', '五十嵐'];
const VEHICLE_OPTIONS = ['ハイゼット 0539', 'ハイゼット 4076', 'ハイゼット 4000', 'ダイナ 3694', 'プロボックス 1475', 'ISUZU 4005', 'ISUZU 4004'];
const DESTINATION_OPTIONS = ['市内ルート', '田島方面', '喜多方方面', '猪苗代方面', '只見方面'];
const DEFAULT_FLIGHT_OPTIONS = ['郡配', '東配', '丸水', 'N-丸水', 'N-キャリー', '村瀬エコライン'];

// 日本時間の現在日時を取得（内部送信用 ISO 文字列）
const getNowJST = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// 画面表示用：日付曜日と時刻の間を一文字分（全角スペース）広げたフォーマット
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

type TabType = 'alcohol' | 'fish' | 'temp' | 'receiving' | 'closing' | 'drive';

const normalizeTab = (raw: string | null): TabType => {
  if (!raw) return 'alcohol';
  if (raw === 'temp_hygiene' || raw === 'temp') return 'temp';
  if (raw === 'fish_processing' || raw === 'fish') return 'fish';
  if (raw === 'alcohol' || raw === 'basic') return 'alcohol';
  if (raw === 'receiving') return 'receiving';
  if (raw === 'driving_report' || raw === 'drive') return 'drive';
  if (raw === 'temp_closing' || raw === 'closing') return 'closing';
  return 'alcohol';
};

// 温度微調整ヘルパー（1℃単位の整数増減）
const adjustTempValue = (current: string, delta: number, defaultBase: number): string => {
  const base = current !== '' ? parseInt(current, 10) : defaultBase;
  if (isNaN(base)) return String(defaultBase);
  return String(base + delta);
};

// 温度の範囲チェックヘルパー（整数ベース）
const isTempValid = (valStr: string, min: number, max: number): boolean => {
  if (valStr === '') return true;
  const n = parseInt(valStr, 10);
  return !isNaN(n) && n >= min && n <= max;
};

// 日時表示コンポーネント（文字拡大でも崩れない設計）
function BigDateDisplay({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleOpen = () => {
    setTempValue(value);
    setIsOpen(true);
  };

  const handleApply = () => {
    onChange(tempValue);
    setIsOpen(false);
  };

  const handleResetNow = () => {
    const now = getNowJST();
    setTempValue(now);
    onChange(now);
    setIsOpen(false);
  };

  return (
    <>
      {/* 通常表示エリア */}
      <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">記録日時</span>
          <span className="text-base sm:text-lg font-black text-slate-800 tracking-tight font-mono">
            {formatDisplayJST(value)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-slate-100 active:bg-slate-200 border-2 border-slate-300 rounded-xl text-xs font-black text-blue-700 shadow-sm flex items-center gap-1 shrink-0"
        >
          <span>🕒</span>
          <span>変更</span>
        </button>
      </div>

      {/* 修正用モーダル（画面高さを超えてもスクロール可能） */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border-4 border-blue-600 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🕒</span>
                <h3 className="text-base font-black text-slate-900">記録日時の変更</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold w-9 h-9 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                日付と時刻を選択してください
              </label>

              <input
                type="datetime-local"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="w-full min-h-[52px] py-2 px-3 border-2 border-slate-400 rounded-xl text-lg font-black bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-600 outline-none text-center shadow-inner"
              />

              <p className="text-[11px] text-slate-500 font-bold text-center">
                ※枠をタップすると時計・カレンダーが出ます
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleApply}
                className="w-full min-h-[50px] py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-base rounded-xl shadow-md transition-all flex items-center justify-center"
              >
                この日時で決定する
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleResetNow}
                  className="min-h-[44px] py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-emerald-300 font-bold rounded-xl text-xs flex items-center justify-center text-center leading-tight px-1"
                >
                  ⚡ 現在時刻に戻す
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="min-h-[44px] py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 直感的な温度入力・微調整コンポーネント（可変高さ＆文字拡大耐性）
function TempInputRow({
  label,
  target,
  value,
  onChange,
  base,
  min,
  max,
}: {
  label: string;
  target: string;
  value: string;
  onChange: (v: string) => void;
  base: number;
  min: number;
  max: number;
}) {
  const valid = isTempValid(value, min, max);

  return (
    <div className="border-t-3 border-slate-200 pt-4">
      <div className="flex flex-wrap justify-between items-baseline mb-2 gap-1.5">
        <label className="text-lg font-black text-slate-900 leading-snug">
          {label} <span className="text-red-600 text-xl">*</span>
        </label>
        <span className="text-xs font-black text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-300">
          {target}
        </span>
      </div>

      {/* 目安ボタン ＆ 1℃単位の矢印微調整ボタン */}
      <div className="grid grid-cols-4 gap-2 mb-2.5">
        <button
          type="button"
          onClick={() => onChange(String(base))}
          className="col-span-2 min-h-[48px] py-2 px-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-base rounded-xl shadow border-2 border-blue-700 flex items-center justify-center gap-1 leading-tight"
        >
          <span>目安</span>
          <span>{base > 0 ? `+${base}` : base}℃</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(adjustTempValue(value, -1, base))}
          className="min-h-[48px] py-2 px-1 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-950 font-black text-sm sm:text-base rounded-xl border-2 border-sky-400 flex items-center justify-center gap-0.5 shadow-sm"
          title="温度を下げる（冷やす）"
        >
          <span className="text-lg text-sky-700 font-black">↓</span>
          <span>-1℃</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(adjustTempValue(value, +1, base))}
          className="min-h-[48px] py-2 px-1 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-950 font-black text-sm sm:text-base rounded-xl border-2 border-amber-400 flex items-center justify-center gap-0.5 shadow-sm"
          title="温度を上げる（暖める）"
        >
          <span className="text-lg text-amber-600 font-black">↑</span>
          <span>+1℃</span>
        </button>
      </div>

      {/* 入力欄 */}
      <div className="relative">
        <input
          type="number"
          step="1"
          inputMode="numeric"
          required
          placeholder={`数字を入力 (${base})`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full min-h-[58px] py-2 text-2xl font-black px-4 pr-16 border-2 rounded-xl transition-colors ${
            !valid
              ? 'border-red-500 bg-red-50 text-red-700'
              : value === ''
              ? 'border-amber-400 bg-amber-50/40'
              : 'border-slate-400 bg-white'
          }`}
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {value !== '' && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full w-6 h-6 flex items-center justify-center font-bold"
              title="クリア"
            >
              ✕
            </button>
          )}
          <span className="text-slate-400 text-xl font-black">℃</span>
        </div>
      </div>

      {!valid && (
        <p className="text-xs text-red-600 font-black mt-1 px-1 leading-tight">
          ⚠️ 入力値が正常範囲（{min}℃ 〜 {max}℃）を超えています。数値をご確認ください。
        </p>
      )}
    </div>
  );
}

function ChecksheetForm() {
  const searchParams = useSearchParams();
  const initialParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(() => normalizeTab(initialParam));
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [dialogError, setDialogError] = useState('');

  const [staffName, setStaffName] = useState('');
  const [staffHistory, setStaffHistory] = useState<string[]>([]);

  // 1. 基本チェック
  const [alcoholMode, setAlcoholMode] = useState<'start' | 'finish'>('start');
  const [alcoholDate, setAlcoholDate] = useState(getNowJST());
  const [basicHealthStatus, setBasicHealthStatus] = useState<'良' | '否' | ''>('');
  const [handHygieneStatus, setHandHygieneStatus] = useState<'良' | '否' | ''>('');
  const [checkerType, setCheckerType] = useState(CHECKER_OPTIONS[0] || '');
  const [customChecker, setCustomChecker] = useState('');
  const [alcoholVal, setAlcoholVal] = useState('');
  const [alcoholNotes, setAlcoholNotes] = useState('');

  // 2. 生魚加工
  const [fishDate, setFishDate] = useState(getNowJST());
  const [healthStatus, setHealthStatus] = useState<'良' | '否' | ''>('');
  const [handWashing, setHandWashing] = useState<'実施済み' | '未実施' | ''>('');
  const [productCheck, setProductCheck] = useState<'よい' | 'わるい' | ''>('');
  const [fishWashing, setFishWashing] = useState<'よい' | 'わるい' | ''>('');
  const [workTemp, setWorkTemp] = useState<'よい' | 'わるい' | ''>('');
  const [facilityHygiene, setFacilityHygiene] = useState<'よい' | 'わるい' | ''>('');
  const [toolsHygiene, setToolsHygiene] = useState<'よい' | 'わるい' | ''>('');
  const [fishNotes, setFishNotes] = useState('');

  // 3. 荷物受入
  const [receivingDate, setReceivingDate] = useState(getNowJST());
  const [flightOptions, setFlightOptions] = useState<string[]>(DEFAULT_FLIGHT_OPTIONS);
  const [selectedFlight, setSelectedFlight] = useState(DEFAULT_FLIGHT_OPTIONS[0] || '郡配');
  const [customFlight, setCustomFlight] = useState('');
  const [pkgStatus, setPkgStatus] = useState<'よい' | 'わるい' | ''>('');
  const [freshnessStatus, setFreshnessStatus] = useState<'よい' | 'わるい' | ''>('');
  const [transitTempStatus, setTransitTempStatus] = useState<'よい' | 'わるい' | ''>('');
  const [receivingNotes, setReceivingNotes] = useState('');

  // 4. 保管庫温度
  const [tempDate, setTempDate] = useState(getNowJST());
  const [mainFreezerTemp, setMainFreezerTemp] = useState('');
  const [room2Temp, setRoom2Temp] = useState('');
  const [fishStorageTemp, setFishStorageTemp] = useState('');
  const [constantFloorTemp, setConstantFloorTemp] = useState('');
  const [floorTemp, setFloorTemp] = useState('');
  const [processingZoneStatus, setProcessingZoneStatus] = useState<'よい' | 'わるい' | ''>('');
  const [pestEvidence, setPestEvidence] = useState<'気になる所見なし' | '問題発生' | ''>('');
  const [tempNotes, setTempNotes] = useState('');

  // 5. 退勤前温度
  const [closingDate, setClosingDate] = useState(getNowJST());
  const [closingMainTemp, setClosingMainTemp] = useState('');
  const [closingRoom2Temp, setClosingRoom2Temp] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // 6. 運転日報
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
    const now = getNowJST();
    if (activeTab === 'alcohol') {
      setAlcoholDate(now);
    } else if (activeTab === 'receiving') {
      setReceivingDate(now);
    } else if (activeTab === 'fish') {
      setFishDate(now);
    } else if (activeTab === 'temp') {
      setTempDate(now);
    } else if (activeTab === 'closing') {
      setClosingDate(now);
    } else if (activeTab === 'drive') {
      if (driveMode === 'start') {
        setDriveStart(now);
      } else {
        setDriveEnd(now);
      }
    }
  }, [activeTab, driveMode]);

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('last_staff_name') || '';
      if (savedName) setStaffName(savedName);
      const history = JSON.parse(localStorage.getItem('staff_name_history') || '[]');
      setStaffHistory(history);

      const savedFlights = JSON.parse(localStorage.getItem('custom_flight_options') || '[]');
      if (savedFlights && Array.isArray(savedFlights) && savedFlights.length > 0) {
        const merged = Array.from(new Set([...DEFAULT_FLIGHT_OPTIONS, ...savedFlights]));
        setFlightOptions(merged);
      }
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
      setDialogError('あなたのお名前を入力してください');
      return;
    }

    setSubmitting(true);
    setSuccessMsg('');
    saveStaffNameHistory(staffName);

    try {
      if (activeTab === 'alcohol') {
        if (!basicHealthStatus) throw new Error('体調チェックを選択してください');
        if (!handHygieneStatus) throw new Error('手の衛生チェックを選択してください');
        const checker = checkerType === 'その他' ? customChecker : checkerType;
        if (!checker.trim()) throw new Error('確認者を入力してください');
        if (alcoholVal === '') throw new Error('アルコール測定値を入力してください');

        const timingLabel = alcoholMode === 'start' ? '出勤時（業務前）' : '退勤時（業務後）';
        const healthNote = `【体調: ${basicHealthStatus === '良' ? '異常なし' : '要報告'}】`;
        const handNote = `【手の衛生: ${handHygieneStatus === '良' ? '良好' : '要確認'}】`;

        const { error } = await supabase.from('check_alcohol').insert([
          {
            checked_at: new Date(alcoholDate).toISOString(),
            staff_name: staffName,
            checker_name: checker,
            alcohol_value: parseFloat(alcoholVal),
            notes: `${timingLabel} ${healthNote} ${handNote} ${alcoholNotes}`.trim(),
          },
        ]);
        if (error) throw error;
        setAlcoholVal('');
        setAlcoholNotes('');
        setBasicHealthStatus('');
        setHandHygieneStatus('');
      } else if (activeTab === 'receiving') {
        let flightNameToSave = selectedFlight;
        if (selectedFlight === 'その他') {
          if (!customFlight.trim()) throw new Error('便名を入力してください');
          flightNameToSave = customFlight.trim();

          if (!flightOptions.includes(flightNameToSave)) {
            const updated = [...flightOptions, flightNameToSave];
            setFlightOptions(updated);
            try {
              localStorage.setItem('custom_flight_options', JSON.stringify(updated));
            } catch (err) {
              console.error(err);
            }
          }
        }

        if (!pkgStatus) throw new Error('外観・包装の破損有無を選択してください');
        if (!freshnessStatus) throw new Error('鮮度・においを選択してください');
        if (!transitTempStatus) throw new Error('輸送温度を選択してください');

        const hasBad = pkgStatus === 'わるい' || freshnessStatus === 'わるい' || transitTempStatus === 'わるい';
        if (hasBad && !receivingNotes.trim()) {
          throw new Error('「わるい」が選択されている項目があります。特記事項に具体的な状態や対応内容を必ず記入してください。');
        }

        const { error } = await supabase.from('check_receiving').insert([
          {
            checked_at: new Date(receivingDate).toISOString(),
            staff_name: staffName,
            flight_name: flightNameToSave,
            pkg_status: pkgStatus,
            freshness_status: freshnessStatus,
            transit_temp_status: transitTempStatus,
            notes: receivingNotes.trim() || null,
          },
        ]);
        if (error) throw error;

        setSelectedFlight(flightNameToSave);
        setCustomFlight('');
        setPkgStatus('');
        setFreshnessStatus('');
        setTransitTempStatus('');
        setReceivingNotes('');
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
        if (!isTempValid(mainFreezerTemp, -40, 0)) throw new Error('本庫温度の数値が異常です（許容範囲: -40℃ 〜 0℃）');

        if (room2Temp === '') throw new Error('「2号室温度」を入力してください');
        if (!isTempValid(room2Temp, -40, 0)) throw new Error('2号室温度の数値が異常です（許容範囲: -40℃ 〜 0℃）');

        if (fishStorageTemp === '') throw new Error('「鮮魚庫温度」を入力してください');
        if (!isTempValid(fishStorageTemp, -15, 15)) throw new Error('鮮魚庫温度の数値が異常です（許容範囲: -15℃ 〜 15℃）');

        if (constantFloorTemp === '') throw new Error('「定温売場温度」を入力してください');
        if (!isTempValid(constantFloorTemp, -5, 45)) throw new Error('定温売場温度の数値が異常です（許容範囲: -5℃ 〜 45℃）');

        if (floorTemp === '') throw new Error('「売場温度（場内温度）」を入力してください');
        if (!isTempValid(floorTemp, -5, 45)) throw new Error('売場温度の数値が異常です（許容範囲: -5℃ 〜 45℃）');

        if (!processingZoneStatus) throw new Error('太物売場の衛生状況を選択してください');
        if (!pestEvidence) throw new Error('害獣の痕跡を選択してください');

        const { error } = await supabase.from('check_temp_hygiene').insert([
          {
            checked_at: new Date(tempDate).toISOString(),
            staff_name: staffName,
            main_freezer_temp: parseInt(mainFreezerTemp, 10),
            room2_freezer_temp: parseInt(room2Temp, 10),
            fish_storage_temp: parseInt(fishStorageTemp, 10),
            constant_floor_temp: parseInt(constantFloorTemp, 10),
            floor_temp: parseInt(floorTemp, 10),
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
        if (!isTempValid(closingMainTemp, -40, 0)) throw new Error('本庫温度の数値が異常です（許容範囲: -40℃ 〜 0℃）');

        if (closingRoom2Temp === '') throw new Error('「2号室温度」を入力してください');
        if (!isTempValid(closingRoom2Temp, -40, 0)) throw new Error('2号室温度の数値が異常です（許容範囲: -40℃ 〜 0℃）');

        const { error } = await supabase.from('check_temp_closing').insert([
          {
            checked_at: new Date(closingDate).toISOString(),
            staff_name: staffName,
            main_freezer_temp: parseInt(closingMainTemp, 10),
            room2_freezer_temp: parseInt(closingRoom2Temp, 10),
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
          setSuccessMsg('出発を記録しました。戻ったら「帰社・終了」から降車時メーターを記録してください。');
          return;
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
      setDialogError(err.message || 'Supabase接続エラー');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-28 font-sans">
      <header className="bg-blue-900 text-white p-4 shadow-lg sticky top-0 z-30">
        <h1 className="text-xl font-black text-center tracking-wide">業務管理チェックシート</h1>
      </header>

      {/* タブナビゲーション */}
      <div className="bg-white border-b-2 border-slate-300 sticky top-[61px] z-20 overflow-x-auto shadow-sm">
        <div className="flex px-2 py-2 gap-1.5 min-w-max">
          {[
            { key: 'alcohol', label: '📋 基本チェック' },
            { key: 'receiving', label: '📦 荷物受入' },
            { key: 'temp', label: '🌡️ 保管庫温度' },
            { key: 'fish', label: '🐟 生魚加工' },
            { key: 'closing', label: '🌙 退勤前温度' },
            { key: 'drive', label: '🚗 運転日報' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key as TabType);
                setSuccessMsg('');
                setDialogError('');
              }}
              className={`min-h-[46px] px-3.5 py-2 text-sm sm:text-base font-black rounded-xl transition-all flex items-center justify-center ${
                activeTab === tab.key
                  ? 'bg-blue-700 text-white shadow ring-2 ring-blue-300'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto p-3.5 space-y-5">
        {successMsg && (
          <div className="p-4 bg-emerald-100 border-3 border-emerald-500 text-emerald-950 rounded-2xl text-base sm:text-lg text-center font-black shadow-md animate-bounce leading-snug">
            ✅ {successMsg}
          </div>
        )}

        {dialogError && (
          <div className="p-4 bg-red-100 border-3 border-red-500 text-red-950 rounded-2xl shadow-lg flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-base font-black">
              <span>⚠️</span>
              <span>入力内容をご確認ください</span>
            </div>
            <p className="text-sm font-bold text-center leading-snug">{dialogError}</p>
            <button
              type="button"
              onClick={() => setDialogError('')}
              className="mt-1 px-6 min-h-[40px] py-1.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs shadow flex items-center justify-center"
            >
              閉じる
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-slate-300">
            <label className="block text-lg font-black text-slate-900 mb-2 leading-tight">
              あなたのお名前 <span className="text-red-600 text-xl">*</span>
            </label>
            <input
              type="text"
              list="staffList"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="お名前を入力（例：山田 太郎）"
              className="w-full text-lg font-bold min-h-[54px] py-2 px-3.5 border-2 border-slate-400 rounded-xl focus:border-blue-600 focus:bg-blue-50 outline-none"
            />
            <datalist id="staffList">
              {staffHistory.map((name, i) => (
                <option key={i} value={name} />
              ))}
            </datalist>
          </div>

          {/* 1. 基本チェック */}
          {activeTab === 'alcohol' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-slate-300 space-y-4">
                <h2 className="font-black text-xl text-slate-900 border-l-8 border-blue-600 pl-3">
                  基本チェック
                </h2>

                <BigDateDisplay value={alcoholDate} onChange={setAlcoholDate} />

                {/* 体調チェック項目 */}
                <div className="bg-white border-2 border-slate-300 p-4 rounded-2xl space-y-2.5">
                  <div className="flex justify-between items-baseline gap-1">
                    <label className="text-lg font-black text-slate-900 leading-snug">
                      体調チェック <span className="text-red-600">*</span>
                    </label>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                      出勤時
                    </span>
                  </div>

                  <div className="text-sm font-black text-red-950 bg-amber-100 p-3 rounded-xl border border-amber-400 shadow-sm leading-snug">
                    ※本人、同居者に発熱、下痢、嘔吐がない
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setBasicHealthStatus('良')}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        basicHealthStatus === '良'
                          ? 'bg-emerald-600 text-white border-emerald-800 shadow scale-[1.01]'
                          : 'bg-white text-slate-800 border-slate-300'
                      }`}
                    >
                      ○ よい（症状なし）
                    </button>
                    <button
                      type="button"
                      onClick={() => setBasicHealthStatus('否')}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        basicHealthStatus === '否'
                          ? 'bg-red-600 text-white border-red-800 shadow scale-[1.01]'
                          : 'bg-white text-slate-800 border-slate-300'
                      }`}
                    >
                      ○ 否（要報告）
                    </button>
                  </div>
                </div>

                {/* 手の衛生チェック項目 */}
                <div className="bg-white border-2 border-slate-300 p-4 rounded-2xl space-y-2.5">
                  <div className="flex justify-between items-baseline gap-1">
                    <label className="text-lg font-black text-slate-900 leading-snug">
                      手の衛生チェック <span className="text-red-600">*</span>
                    </label>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                      点検項目
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm font-black text-slate-800 bg-blue-50 p-2.5 rounded-xl border border-blue-200 leading-snug">
                    ※爪の長さ・手荒れ・傷・手指消毒の実施
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setHandHygieneStatus('良')}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        handHygieneStatus === '良'
                          ? 'bg-emerald-600 text-white border-emerald-800 shadow scale-[1.01]'
                          : 'bg-white text-slate-800 border-slate-300'
                      }`}
                    >
                      ○ よい（異常なし）
                    </button>
                    <button
                      type="button"
                      onClick={() => setHandHygieneStatus('否')}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        handHygieneStatus === '否'
                          ? 'bg-red-600 text-white border-red-800 shadow scale-[1.01]'
                          : 'bg-white text-slate-800 border-slate-300'
                      }`}
                    >
                      ○ 否（要報告）
                    </button>
                  </div>
                </div>
              </div>

              {/* アルコールチェックカード */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-slate-300 space-y-4">
                <h3 className="font-black text-xl text-slate-900 border-l-8 border-blue-600 pl-3">
                  アルコールチェック
                </h3>

                <div className="grid grid-cols-2 gap-2 bg-slate-200 p-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setAlcoholMode('start')}
                    className={`min-h-[52px] py-2 px-2 text-sm sm:text-base font-black rounded-xl transition-all flex items-center justify-center text-center leading-tight ${
                      alcoholMode === 'start' ? 'bg-blue-600 text-white shadow ring-2 ring-blue-300' : 'text-slate-800'
                    }`}
                  >
                    ① 出勤時（業務前）
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlcoholMode('finish')}
                    className={`min-h-[52px] py-2 px-2 text-sm sm:text-base font-black rounded-xl transition-all flex items-center justify-center text-center leading-tight ${
                      alcoholMode === 'finish' ? 'bg-blue-600 text-white shadow ring-2 ring-blue-300' : 'text-slate-800'
                    }`}
                  >
                    ② 退勤時（業務後）
                  </button>
                </div>

                <div>
                  <div className="flex flex-wrap justify-between items-baseline mb-1.5 gap-1.5">
                    <label className="text-lg font-black text-slate-900 leading-snug">
                      確認者（対面確認） <span className="text-red-600">*</span>
                    </label>
                    <span className="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      第三者と対面
                    </span>
                  </div>
                  <div className="space-y-2">
                    <select
                      value={checkerType}
                      onChange={(e) => setCheckerType(e.target.value)}
                      className="w-full min-h-[52px] py-2 px-3 border-2 border-slate-300 rounded-xl text-lg font-black bg-white outline-none focus:border-blue-600"
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
                        className="w-full min-h-[52px] py-2 px-3 border-2 border-blue-400 bg-blue-50 rounded-xl text-lg font-bold"
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-300 space-y-2.5">
                  <div className="flex justify-between items-baseline gap-1">
                    <label className="text-lg font-black text-slate-900 leading-snug">
                      アルコール測定値 (mg/L) <span className="text-red-600">*</span>
                    </label>
                    <span className="text-xs font-bold text-slate-500">検知器の数字</span>
                  </div>
                  <div className="flex gap-2 items-stretch">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={alcoholVal}
                      onChange={(e) => setAlcoholVal(e.target.value)}
                      className="w-full text-3xl sm:text-4xl font-black min-h-[64px] py-1 px-3 border-2 border-slate-400 rounded-xl text-center bg-white shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setAlcoholVal('0.00')}
                      className="min-h-[64px] px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black rounded-xl shadow whitespace-nowrap flex flex-col items-center justify-center border-2 border-emerald-700 shrink-0"
                    >
                      <span className="text-[10px]">一発入力</span>
                      <span className="text-xl mt-0.5">0.00</span>
                    </button>
                  </div>

                  {alcoholVal !== '' && (
                    <div className="mt-3 text-center">
                      {alcNum === 0 && (
                        <div className="p-3 bg-emerald-100 text-emerald-950 rounded-xl border border-emerald-500 text-base font-black">
                          ✅ 0.00（正常・運転可）
                        </div>
                      )}
                      {isAlcoholWarning && (
                        <div className="p-3 bg-amber-100 text-amber-950 rounded-xl border border-amber-400 text-sm font-black leading-snug">
                          ⚠️ 0.15未満（{alcNum} mg/L）再計測または確認を行ってください
                        </div>
                      )}
                      {isAlcoholDanger && (
                        <div className="p-3.5 bg-red-600 text-white rounded-xl shadow text-sm font-black leading-snug">
                          🚨 0.15以上〜0.25未満：運転禁止！<br />
                          上席に指示を仰ぎ、特記事項に理由を記入してください
                        </div>
                      )}
                      {isAlcoholFlashing && (
                        <div className="p-4 bg-red-700 text-white rounded-xl shadow-xl animate-pulse border-2 border-yellow-300 text-base font-black leading-snug">
                          ⚡ 0.25以上：運転厳禁！<br />
                          直ちに上席に連絡してください
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">特記事項・連絡事項</label>
                  <textarea
                    rows={2}
                    value={alcoholNotes}
                    onChange={(e) => setAlcoholNotes(e.target.value)}
                    placeholder="0.15以上の場合や体調不良時は内容を記入"
                    className="w-full p-3 text-base border-2 border-slate-400 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. 荷物受入チェック */}
          {activeTab === 'receiving' && (
            <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-slate-300 space-y-5">
              <h2 className="font-black text-xl text-slate-900 border-l-8 border-teal-600 pl-3">
                荷物受入チェック
              </h2>

              <BigDateDisplay value={receivingDate} onChange={setReceivingDate} />

              <div className="bg-slate-50 border-2 border-slate-300 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between items-baseline gap-1">
                  <label className="text-lg font-black text-slate-900 leading-snug">
                    便名 <span className="text-red-600">*</span>
                  </label>
                  <span className="text-xs font-bold text-slate-500">
                    受入トラック・便を選択
                  </span>
                </div>
                <div className="space-y-2">
                  <select
                    value={selectedFlight}
                    onChange={(e) => setSelectedFlight(e.target.value)}
                    className="w-full min-h-[52px] py-2 px-3 border-2 border-slate-400 rounded-xl text-lg font-black bg-white outline-none focus:border-teal-600 shadow-sm"
                  >
                    {flightOptions.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                    <option value="その他">その他（直接文字入力）</option>
                  </select>

                  {selectedFlight === 'その他' && (
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="便名を入力（例：ヤマト便、4便、臨時便）"
                        value={customFlight}
                        onChange={(e) => setCustomFlight(e.target.value)}
                        className="w-full min-h-[52px] py-2 px-3 border-2 border-teal-500 bg-teal-50/40 rounded-xl text-lg font-bold outline-none"
                        required
                      />
                      <p className="text-[11px] text-teal-800 font-bold px-1 leading-tight">
                        ※入力して送信すると、次回からメニューの最後尾に自動追加されます。
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {[
                { label: '外観、包装に破損がないこと', sub: '箱潰れ・破れ・液漏れ等なし', val: pkgStatus, set: setPkgStatus },
                { label: '鮮度・においに問題がないこと', sub: '異臭・変色・ドリップ異常なし', val: freshnessStatus, set: setFreshnessStatus },
                { label: '輸送温度に問題がなかったこと（目視、触診）', sub: '保冷状態・品温の異常なし', val: transitTempStatus, set: setTransitTempStatus },
              ].map((item, idx) => (
                <div key={idx} className="border-t-2 border-slate-200 pt-4">
                  <div className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                    {item.label} <span className="text-red-600">*</span>
                  </div>
                  <div className="text-xs text-slate-600 font-bold mb-2 leading-tight">{item.sub}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => item.set('よい')}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        item.val === 'よい'
                          ? 'bg-emerald-600 text-white border-emerald-800 shadow scale-[1.01]'
                          : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      ○ よい（異常なし）
                    </button>
                    <button
                      type="button"
                      onClick={() => item.set('わるい')}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        item.val === 'わるい'
                          ? 'bg-red-600 text-white border-red-800 shadow scale-[1.01]'
                          : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      ○ わるい（要報告）
                    </button>
                  </div>
                </div>
              ))}

              <div className="border-t-2 border-slate-200 pt-4">
                <div className="flex justify-between items-baseline mb-1.5 gap-1">
                  <label className="text-sm font-bold text-slate-700">
                    特記事項・連絡事項
                  </label>
                  {(pkgStatus === 'わるい' || freshnessStatus === 'わるい' || transitTempStatus === 'わるい') && (
                    <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-300">
                      ※「わるい」があるため記入必須
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={receivingNotes}
                  onChange={(e) => setReceivingNotes(e.target.value)}
                  placeholder="「わるい」がある場合は、品名、担当営業名、具体的な破損・温度異常の状態、指示内容を必ず記入してください。"
                  className={`w-full p-3 text-base border-2 rounded-xl ${
                    (pkgStatus === 'わるい' || freshnessStatus === 'わるい' || transitTempStatus === 'わるい') && !receivingNotes.trim()
                      ? 'border-red-500 bg-red-50/50'
                      : 'border-slate-400'
                  }`}
                />
              </div>
            </div>
          )}

          {/* 3. 生魚加工衛生管理 */}
          {activeTab === 'fish' && (
            <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-slate-300 space-y-5">
              <h2 className="font-black text-xl text-slate-900 border-l-8 border-emerald-600 pl-3">
                生魚加工衛生管理
              </h2>

              <BigDateDisplay value={fishDate} onChange={setFishDate} />

              <div className="border-t-2 border-slate-200 pt-4">
                <div className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                  健康状態 <span className="text-red-600">*</span>
                </div>
                <div className="text-xs text-slate-600 font-bold mb-2">発熱・下痢・嘔吐等の症状なし</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '○ 良（異常なし）', val: '良' as const },
                    { label: '○ 否（要報告）', val: '否' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setHealthStatus(btn.val)}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        healthStatus === btn.val
                          ? btn.val === '良'
                            ? 'bg-emerald-600 text-white border-emerald-800 shadow scale-[1.01]'
                            : 'bg-red-600 text-white border-red-800 shadow scale-[1.01]'
                          : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t-2 border-slate-200 pt-4">
                <div className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                  手洗い実施 <span className="text-red-600">*</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { label: '○ 実施済み', val: '実施済み' as const },
                    { label: '○ 未実施', val: '未実施' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setHandWashing(btn.val)}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        handWashing === btn.val
                          ? btn.val === '実施済み'
                            ? 'bg-blue-600 text-white border-blue-800 shadow scale-[1.01]'
                            : 'bg-red-600 text-white border-red-800 shadow scale-[1.01]'
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
                <div key={idx} className="border-t-2 border-slate-200 pt-4">
                  <div className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                    {item.label} <span className="text-red-600">*</span>
                  </div>
                  <div className="text-xs text-slate-600 font-bold mb-2 leading-tight">{item.sub}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '○ よい', val: 'よい' as const },
                      { label: `○ わるい (${item.badSub})`, val: 'わるい' as const },
                    ].map((btn) => (
                      <button
                        key={btn.val}
                        type="button"
                        onClick={() => item.setter(btn.val)}
                        className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                          item.val === btn.val
                            ? btn.val === 'よい'
                              ? 'bg-emerald-600 text-white border-emerald-800 shadow scale-[1.01]'
                              : 'bg-red-600 text-white border-red-800 shadow scale-[1.01]'
                            : 'bg-slate-50 text-slate-800 border-slate-300'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="border-t-2 border-slate-200 pt-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={fishNotes}
                  onChange={(e) => setFishNotes(e.target.value)}
                  placeholder="悪い・否の場合は内容と指示内容を記入"
                  className="w-full p-3 text-base border-2 border-slate-400 rounded-xl"
                />
              </div>
            </div>
          )}

          {/* 4. 保管庫温度管理 */}
          {activeTab === 'temp' && (
            <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-slate-300 space-y-5">
              <h2 className="font-black text-xl text-slate-900 border-l-8 border-cyan-600 pl-3">
                保管庫温度管理
              </h2>
              <div className="p-3.5 bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs sm:text-sm font-bold rounded-xl leading-relaxed">
                ⚠️ 全ての温度入力が必須です。「目安」ボタンで基準値を一発入力し、「↓」「↑」で1℃単位の微調整が可能です。
              </div>

              <BigDateDisplay value={tempDate} onChange={setTempDate} />

              <TempInputRow
                label="本庫温度"
                target="マイナス20℃目安"
                value={mainFreezerTemp}
                onChange={setMainFreezerTemp}
                base={-20}
                min={-40}
                max={0}
              />

              <TempInputRow
                label="2号室温度"
                target="マイナス20℃目安"
                value={room2Temp}
                onChange={setRoom2Temp}
                base={-20}
                min={-40}
                max={0}
              />

              <TempInputRow
                label="鮮魚庫温度"
                target="マイナス1℃目安"
                value={fishStorageTemp}
                onChange={setFishStorageTemp}
                base={-1}
                min={-15}
                max={15}
              />

              <TempInputRow
                label="定温売場温度"
                target="9℃以下目安"
                value={constantFloorTemp}
                onChange={setConstantFloorTemp}
                base={8}
                min={-5}
                max={45}
              />

              <TempInputRow
                label="売場温度（場内実測）"
                target="場内実測"
                value={floorTemp}
                onChange={setFloorTemp}
                base={18}
                min={-5}
                max={45}
              />

              <div className="border-t-2 border-slate-200 pt-4">
                <div className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                  太物売場（生魚加工ゾーン）衛生・整頓状況 <span className="text-red-600">*</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { label: '○ よい', val: 'よい' as const },
                    { label: '○ わるい (特記に説明)', val: 'わるい' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setProcessingZoneStatus(btn.val)}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        processingZoneStatus === btn.val
                          ? btn.val === 'よい'
                            ? 'bg-emerald-600 text-white border-emerald-800 shadow scale-[1.01]'
                            : 'bg-red-600 text-white border-red-800 shadow scale-[1.01]'
                          : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t-2 border-slate-200 pt-4">
                <div className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                  害獣の痕跡 <span className="text-red-600">*</span>
                </div>
                <div className="text-xs text-slate-600 font-bold mb-2 leading-tight">ネズミ、鳥類他による汚れや商品破損</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '○ 気になる所見なし', val: '気になる所見なし' as const },
                    { label: '○ 問題発生 (特記に説明)', val: '問題発生' as const },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setPestEvidence(btn.val)}
                      className={`min-h-[56px] py-2 px-2 text-sm sm:text-base font-black rounded-xl border-2 transition-all flex items-center justify-center text-center leading-tight ${
                        pestEvidence === btn.val
                          ? btn.val === '気になる所見なし'
                            ? 'bg-emerald-600 text-white border-emerald-800 shadow scale-[1.01]'
                            : 'bg-red-600 text-white border-red-800 shadow scale-[1.01]'
                          : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t-2 border-slate-200 pt-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="悪い・問題発生の際は内容を説明"
                  className="w-full p-3 text-base border-2 border-slate-400 rounded-xl"
                />
              </div>
            </div>
          )}

          {/* 5. 退勤前温度管理 */}
          {activeTab === 'closing' && (
            <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-slate-300 space-y-5">
              <h2 className="font-black text-xl text-slate-900 border-l-8 border-indigo-600 pl-3">
                退勤前温度管理
              </h2>

              <BigDateDisplay value={closingDate} onChange={setClosingDate} />

              <TempInputRow
                label="本庫温度"
                target="マイナス20℃目安"
                value={closingMainTemp}
                onChange={setClosingMainTemp}
                base={-20}
                min={-40}
                max={0}
              />

              <TempInputRow
                label="2号室温度"
                target="マイナス20℃目安"
                value={closingRoom2Temp}
                onChange={setClosingRoom2Temp}
                base={-20}
                min={-40}
                max={0}
              />

              <div className="border-t-2 border-slate-200 pt-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">特記事項・連絡事項</label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="特記事項があれば記入"
                  className="w-full p-3 text-base border-2 border-slate-400 rounded-xl"
                />
              </div>
            </div>
          )}

          {/* 6. 運転日報 */}
          {activeTab === 'drive' && (
            <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-slate-300 space-y-5">
              <h2 className="font-black text-xl text-slate-900 border-l-8 border-amber-600 pl-3">
                運転日報
              </h2>

              <div className="grid grid-cols-2 gap-2 bg-slate-200 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setDriveMode('start')}
                  className={`min-h-[52px] py-2 px-2 text-sm sm:text-base font-black rounded-xl transition-all flex items-center justify-center text-center leading-tight ${
                    driveMode === 'start' ? 'bg-amber-600 text-white shadow ring-2 ring-amber-300' : 'text-slate-800'
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
                  className={`min-h-[52px] py-2 px-2 text-sm sm:text-base font-black rounded-xl transition-all flex items-center justify-center text-center leading-tight ${
                    driveMode === 'finish' ? 'bg-amber-600 text-white shadow ring-2 ring-amber-300' : 'text-slate-800'
                  }`}
                >
                  ② 帰社時（降車）
                </button>
              </div>

              {driveMode === 'start' ? (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-lg font-black text-slate-900 mb-1.5 leading-snug">
                      使用車両 <span className="text-red-600">*</span>
                    </label>
                    <div className="space-y-2">
                      <select
                        value={vehicle}
                        onChange={(e) => setVehicle(e.target.value)}
                        className="w-full min-h-[52px] py-2 px-3 border-2 border-slate-400 rounded-xl text-lg font-black bg-white"
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
                          className="w-full min-h-[52px] py-2 px-3 border-2 border-amber-400 bg-amber-50 rounded-xl text-lg font-bold"
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-lg font-black text-slate-900 mb-1.5 leading-snug">
                      行先 <span className="text-red-600">*</span>
                    </label>
                    <div className="space-y-2">
                      <select
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="w-full min-h-[52px] py-2 px-3 border-2 border-slate-400 rounded-xl text-lg font-black bg-white"
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
                          className="w-full min-h-[52px] py-2 px-3 border-2 border-amber-400 bg-amber-50 rounded-xl text-lg font-bold"
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">同乗者（ある場合記入）</label>
                    <input
                      type="text"
                      value={passenger}
                      onChange={(e) => setPassenger(e.target.value)}
                      className="w-full min-h-[50px] py-2 px-3 border-2 border-slate-400 rounded-xl text-base font-bold"
                    />
                  </div>

                  <div>
                    <BigDateDisplay value={driveStart} onChange={setDriveStart} />

                    <div className="flex justify-between items-baseline mb-1.5 mt-3">
                      <label className="text-lg font-black text-slate-900 leading-snug">
                        乗車時メーター (km) <span className="text-red-600">*</span>
                      </label>
                      <span className="text-xs font-bold text-slate-500">車のメーター値</span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      required
                      placeholder="例: 12500.5"
                      value={startMeter}
                      onChange={(e) => setStartMeter(e.target.value)}
                      className={`w-full min-h-[60px] py-2 px-3 text-3xl font-black border-2 rounded-xl ${
                        isStartMeterDecreased || isStartMeterDigitError
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-slate-400'
                      }`}
                    />
                  </div>

                  {fetchingLastMeter ? (
                    <div className="text-xs text-slate-400 italic">車両の過去メーターを参照中...</div>
                  ) : lastRecordedMeter !== null ? (
                    <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-sm flex justify-between items-center">
                      <span className="font-bold text-slate-700">前回最終記録:</span>
                      <span className="font-mono font-black text-lg text-slate-950">{lastRecordedMeter.toLocaleString()} km</span>
                    </div>
                  ) : null}

                  {isStartMeterDecreased && (
                    <div className="p-3 bg-red-100 border-2 border-red-500 text-red-950 rounded-xl text-xs sm:text-sm font-black animate-pulse leading-snug">
                      🚨 メーター逆行エラー：前回の最終記録（{lastRecordedMeter} km）より小さくなっています。
                    </div>
                  )}

                  {isStartMeterDigitError && !isStartMeterDecreased && (
                    <div className="p-3 bg-amber-100 border-2 border-amber-500 text-amber-950 rounded-xl text-xs sm:text-sm font-black leading-snug">
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
                    <div className="space-y-4 pt-1">
                      <div>
                        <label className="block text-lg font-black text-slate-900 mb-1.5 leading-snug">
                          完了する運行を選択 <span className="text-red-600">*</span>
                        </label>
                        {activeDrives.length === 0 ? (
                          <div className="p-4 bg-slate-50 border-2 border-slate-200 text-base font-bold text-slate-500 text-center rounded-xl">
                            現在運行中のデータはありません
                          </div>
                        ) : (
                          <select
                            value={selectedDriveId}
                            onChange={(e) => setSelectedDriveId(e.target.value)}
                            className="w-full min-h-[52px] py-2 px-3 border-2 border-amber-400 bg-amber-50 rounded-xl text-base sm:text-lg font-black"
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

                        <div className="flex justify-between items-baseline mb-1.5 mt-3">
                          <label className="text-lg font-black text-slate-900 leading-snug">
                            降車時メーター (km) <span className="text-red-600">*</span>
                          </label>
                          {currentStartMeter !== null && (
                            <span className="text-xs font-bold text-slate-600">乗車時: {currentStartMeter} km</span>
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
                          className={`w-full min-h-[60px] py-2 px-3 text-3xl font-black border-2 rounded-xl ${
                            isMeterInvalid
                              ? 'border-red-500 bg-red-50 text-red-700'
                              : 'border-slate-400'
                          }`}
                        />
                      </div>

                      {isMeterInvalid && (
                        <div className="p-3 bg-red-100 border-2 border-red-500 text-red-950 rounded-xl text-xs sm:text-sm font-black animate-pulse leading-snug">
                          🚨 メーター不整合：乗車時（{currentStartMeter} km）より小さくなっています。
                        </div>
                      )}

                      {calculatedDistance !== null && (
                        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-950 rounded-xl text-base font-black flex justify-between items-center shadow-sm">
                          <span>走行距離（自動計算）:</span>
                          <span className="text-2xl font-mono text-emerald-900">{calculatedDistance} km</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-lg font-black text-slate-900 mb-1.5 leading-snug">給油（ある場合記入・ℓ）</label>
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="例: 35.0"
                          value={refuelLiters}
                          onChange={(e) => setRefuelLiters(e.target.value)}
                          className="w-full min-h-[52px] py-2 px-3 text-xl font-bold border-2 border-slate-400 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">特記事項・連絡事項</label>
                        <textarea
                          rows={2}
                          value={driveNotes}
                          onChange={(e) => setDriveNotes(e.target.value)}
                          placeholder="異常や連絡事項があれば記入"
                          className="w-full p-3 text-base border-2 border-slate-400 rounded-xl"
                        />
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          <div className="pt-3">
            <button
              type="submit"
              disabled={
                submitting ||
                (activeTab === 'drive' && driveMode === 'finish' && activeDrives.length === 0) ||
                (activeTab === 'drive' && driveMode === 'start' && (isStartMeterDecreased || isStartMeterDigitError))
              }
              className="w-full min-h-[64px] py-3.5 px-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-black text-xl rounded-2xl shadow-lg transition-all disabled:opacity-40 tracking-wider flex items-center justify-center text-center leading-tight"
            >
              {submitting
                ? '送信中...'
                : activeTab === 'drive'
                ? driveMode === 'start'
                  ? '① 出発を記録する'
                  : '② 運行完了を記録する'
                : activeTab === 'alcohol'
                ? alcoholMode === 'start'
                  ? '① 出勤時 基本チェックを送信'
                  : '② 退勤時 基本チェックを送信'
                : activeTab === 'receiving'
                ? '荷物受入チェックを送信'
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
    <Suspense fallback={<div className="p-8 text-center text-xl font-black">読み込み中...</div>}>
      <ChecksheetForm />
    </Suspense>
  );
}