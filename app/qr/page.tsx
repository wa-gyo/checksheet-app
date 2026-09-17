'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRItem {
  id: string;
  title: string;
  subTitle: string;
  path: string;
  note: string;
}

const qrList: QRItem[] = [
  {
    id: 'temp_hygiene',
    title: '出勤時：温度・衛生チェック',
    subTitle: '保冷庫温度・手洗い・健康状態確認',
    path: '/?tab=temp_hygiene',
    note: '出勤後、身支度を整えたら最初に読み取って入力してください。',
  },
  {
    id: 'fish_processing',
    title: '生魚加工：衛生管理チェック',
    subTitle: 'まな板消毒・手洗い・作業前点検',
    path: '/?tab=fish_processing',
    note: '加工場に入る前、まな板・包丁の消毒後に読み取ってください。',
  },
  {
    id: 'alcohol',
    title: '点呼：アルコールチェック',
    subTitle: '乗車前・降車後の呼気検査記録',
    path: '/?tab=alcohol',
    note: '事務所デスクで検知器の測定値を確認しながら入力してください。',
  },
  {
    id: 'driving_report',
    title: '社用車：運転日報記録',
    subTitle: 'メーター・給油・日常点検',
    path: '/?tab=driving_report',
    note: '出発前のメーターと、帰着後のメーター・給油量を入力してください。',
  },
  {
    id: 'temp_closing',
    title: '退勤前：温度・施錠チェック',
    subTitle: '最終保冷庫温度・消灯・火気確認',
    path: '/?tab=temp_closing',
    note: '退勤時、保冷庫の最終温度を確認して送信してください。',
  },
];

export default function QRPrintPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [mode, setMode] = useState<'wall' | 'compact'>('wall');

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      {/* 操作コントロールバー（印刷時は非表示） */}
      <div className="max-w-4xl mx-auto mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden">
        <h1 className="text-2xl font-black text-slate-800 mb-2">QRコード印刷センター</h1>
        <p className="text-slate-600 mb-6 text-sm">
          現場の掲示場所に合わせて、印刷スタイルを選択できます。
        </p>

        {/* スタイル切り替えタブ */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setMode('wall')}
            className={`px-5 py-3 rounded-xl font-bold text-base transition-all flex items-center gap-2 ${
              mode === 'wall'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🏢 A4壁面用（1枚に特大1個）
          </button>
          <button
            onClick={() => setMode('compact')}
            className={`px-5 py-3 rounded-xl font-bold text-base transition-all flex items-center gap-2 ${
              mode === 'compact'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📋 コンパクト一覧（A4にまとめて配置）
          </button>
        </div>

        <button
          onClick={handlePrint}
          className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all text-lg flex items-center justify-center gap-2"
        >
          🖨️ {mode === 'wall' ? 'A4特大サイズ（各1枚）で印刷する' : 'コンパクト一覧を印刷する'}
        </button>
      </div>

      {/* --- パターン 1: A4壁貼り特大モード --- */}
      {mode === 'wall' && (
        <div className="max-w-4xl mx-auto space-y-12 print:space-y-0">
          {qrList.map((item, index) => {
            const targetUrl = baseUrl ? `${baseUrl}${item.path}` : '';

            return (
              <div
                key={index}
                className="bg-white border-4 border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-between text-center print:border-none print:p-8 print:m-0 print:h-screen print:break-after-page"
                style={{ minHeight: '680px' }}
              >
                <div className="w-full border-b-4 border-slate-800 pb-6 mb-6">
                  <span className="inline-block bg-slate-800 text-white text-lg font-black px-4 py-1 rounded-md mb-3 tracking-widest">
                    業務チェックシート
                  </span>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                    {item.title}
                  </h2>
                  <p className="text-xl font-bold text-slate-600 mt-2">
                    {item.subTitle}
                  </p>
                </div>

                <div className="my-auto py-6">
                  <div className="p-6 bg-white border-4 border-dashed border-slate-300 rounded-3xl inline-block shadow-sm">
                    {targetUrl ? (
                      <QRCodeSVG
                        value={targetUrl}
                        size={320}
                        level="H"
                        includeMargin={true}
                      />
                    ) : (
                      <div className="w-80 h-80 flex items-center justify-center bg-slate-100 rounded-2xl text-slate-400 font-bold">
                        生成中...
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-2xl font-black text-blue-700 tracking-wide">
                    ▲ スマホのカメラを向けてください ▲
                  </p>
                </div>

                <div className="w-full bg-slate-100 border-2 border-slate-300 rounded-2xl p-6 mt-6">
                  <p className="text-lg font-bold text-slate-800">
                    【案内】{item.note}
                  </p>
                  <p className="text-xs text-slate-400 mt-2 break-all">
                    URL: {targetUrl}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- パターン 2: コンパクトカード一覧モード --- */}
      {mode === 'compact' && (
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print:p-0">
          {qrList.map((item, index) => {
            const targetUrl = baseUrl ? `${baseUrl}${item.path}` : '';

            return (
              <div
                key={index}
                className="bg-white border-2 border-slate-300 rounded-2xl p-6 flex flex-col justify-between shadow-sm print:shadow-none print:border-slate-400 print:break-inside-avoid"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded">
                      場所・車両掲示用
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">
                    {item.subTitle}
                  </p>
                </div>

                <div className="flex items-center justify-center my-4">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-inner">
                    {targetUrl ? (
                      <QRCodeSVG
                        value={targetUrl}
                        size={150}
                        level="M"
                        includeMargin={true}
                      />
                    ) : (
                      <div className="w-36 h-36 flex items-center justify-center bg-slate-100 rounded text-slate-400 text-xs">
                        生成中...
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 border border-slate-100">
                  {item.note}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}