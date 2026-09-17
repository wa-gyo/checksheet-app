'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRItem {
  title: string;
  tabKey: string;
  place: string;
  desc: string;
  color: string;
}

const QR_LIST: QRItem[] = [
  {
    title: '温度衛生管理（出勤時）',
    tabKey: 'temp',
    place: '各保冷庫・売場 掲示用',
    desc: '出勤時の本庫・鮮魚庫・売場温度および衛生状況の記録',
    color: 'border-cyan-600 text-cyan-800',
  },
  {
    title: '生魚加工 衛生管理',
    tabKey: 'fish',
    place: '加工場・手洗い場 掲示用',
    desc: '加工前の健康確認、手洗い、魚体洗浄、作業温度の記録',
    color: 'border-emerald-600 text-emerald-800',
  },
  {
    title: 'アルコールチェック',
    tabKey: 'alcohol',
    place: '事務所・点呼デスク 掲示用',
    desc: '対面点呼での検知器測定値と確認者の記録',
    color: 'border-blue-600 text-blue-800',
  },
  {
    title: '運転日報（乗車・降車）',
    tabKey: 'drive',
    place: '社用車キー置き場・車内用',
    desc: '出発時の乗車メーター・帰社時の降車メーター記録',
    color: 'border-amber-600 text-amber-800',
  },
  {
    title: '退勤前 温度管理',
    tabKey: 'closing',
    place: '本庫・2号室 扉前用',
    desc: '業務終了・退勤時の保冷庫最終温度記録',
    color: 'border-indigo-600 text-indigo-800',
  },
  {
    title: '業務日報 管理画面',
    tabKey: 'admin',
    place: '管理者・責任者 デスク用',
    desc: '日次集計データの閲覧・印刷・PDF保存用',
    color: 'border-slate-800 text-slate-800',
  },
];

export default function QRPrintPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [customHost, setCustomHost] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setBaseUrl(origin);
      setCustomHost(origin);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-4 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">現場掲示用 QRコード印刷シート</h1>
            <p className="text-xs text-slate-500">
              各作業エリア・車両・保冷庫にラミネート掲示するためのカードを出力します。
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow flex items-center gap-2"
          >
            🖨️ A4用紙に印刷する
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs">
          <label className="font-bold text-slate-600">発行元ベースURL:</label>
          <input
            type="text"
            value={customHost}
            onChange={(e) => setCustomHost(e.target.value)}
            className="p-1.5 border border-slate-300 rounded text-xs flex-1 font-mono"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 print:max-w-none">
        <div className="grid grid-cols-2 gap-4 print:gap-3">
          {QR_LIST.map((item) => {
            const url =
              item.tabKey === 'admin'
                ? `${customHost || baseUrl}/admin`
                : `${customHost || baseUrl}/?tab=${item.tabKey}`;

            return (
              <div
                key={item.tabKey}
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col justify-between items-center text-center print:border-solid print:p-3 ${item.color}`}
              >
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                    {item.place}
                  </span>
                  <h2 className="text-base font-bold mt-1.5 leading-snug">{item.title}</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.desc}</p>
                </div>

                <div className="my-3 p-2 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-center">
                  <QRCodeSVG value={url} size={130} level="M" />
                </div>

                <div className="w-full text-center">
                  <span className="text-[10px] text-slate-400 font-mono block break-all">{url}</span>
                  <div className="mt-1 text-[11px] font-bold text-slate-700 bg-slate-50 py-0.5 rounded">
                    スマホのカメラでスキャンして入力
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
