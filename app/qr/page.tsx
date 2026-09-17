'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRItem {
  title: string;
  subTitle: string;
  path: string;
  note: string;
}

const qrList: QRItem[] = [
  {
    title: '出勤時：温度・衛生チェック',
    subTitle: '保冷庫温度・手洗い・健康状態確認',
    path: '/?tab=temp_hygiene',
    note: '出勤後、身支度を整えたら最初に読み取って入力してください。',
  },
  {
    title: '生魚加工：衛生管理チェック',
    subTitle: 'まな板消毒・手洗い・作業前点検',
    path: '/?tab=fish_processing',
    note: '加工場に入る前、まな板・包丁の消毒後に読み取ってください。',
  },
  {
    title: '点呼：アルコールチェック',
    subTitle: '乗車前・降車後の呼気検査記録',
    path: '/?tab=alcohol',
    note: '事務所デスクで検知器の測定値を確認しながら入力してください。',
  },
  {
    title: '社用車：運転日報記録',
    subTitle: 'メーター・給油・日常点検',
    path: '/?tab=driving_report',
    note: '出発前のメーターと、帰着後のメーター・給油量を入力してください。',
  },
  {
    title: '退勤前：温度・施錠チェック',
    subTitle: '最終保冷庫温度・消灯・火気確認',
    path: '/?tab=temp_closing',
    note: '退勤時、保冷庫の最終温度を確認して送信してください。',
  },
];

export default function QRPrintPage() {
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      {/* 画面操作用コントロールバー（印刷時は非表示） */}
      <div className="max-w-4xl mx-auto mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden">
        <h1 className="text-2xl font-black text-slate-800 mb-2">壁面掲示用 特大QRコード印刷</h1>
        <p className="text-slate-600 mb-4 text-sm">
          各チェックシートが **A4用紙1枚に1つずつ特大サイズ** で印刷されます。
        </p>
        <button
          onClick={handlePrint}
          className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all text-lg flex items-center justify-center gap-2"
        >
          🖨️ A4特大サイズで印刷する
        </button>
      </div>

      {/* 印刷対象コンテナ */}
      <div className="max-w-4xl mx-auto space-y-12 print:space-y-0">
        {qrList.map((item, index) => {
          const targetUrl = baseUrl ? `${baseUrl}${item.path}` : '';

          return (
            <div
              key={index}
              className="bg-white border-4 border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-between text-center print:border-none print:p-8 print:m-0 print:h-screen print:break-after-page"
              style={{ minHeight: '680px' }}
            >
              {/* ヘッダータイトル */}
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

              {/* 特大QRコード */}
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

              {/* フッター案内枠 */}
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
    </div>
  );
}