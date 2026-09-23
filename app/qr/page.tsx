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
    id: 'basic',
    title: '基本チェック',
    subTitle: '体調確認・手の衛生・アルコール点呼',
    path: '/?tab=alcohol',
    note: '出勤時・退勤時に対面確認の上、呼気測定・体調確認を行ってください。',
  },
  {
    id: 'receiving',
    title: '荷物受入チェック',
    subTitle: '外観包装・鮮度におい・輸送温度確認',
    path: '/?tab=receiving',
    note: '荷受時、商品荷下ろしと同時に外観・鮮度・品温を確認して送信してください。',
  },
  {
    id: 'temp',
    title: '保管庫温度管理',
    subTitle: '本庫・2号室・鮮魚庫・売場温度点検',
    path: '/?tab=temp',
    note: '出勤後、身支度を整えたら各保管庫・売場の温度を確認して入力してください。',
  },
  {
    id: 'fish',
    title: '生魚加工：衛生管理チェック',
    subTitle: '健康状態・手洗い・器具衛生点検',
    path: '/?tab=fish',
    note: '加工場に入る前、まな板・包丁の消毒後に読み取ってください。',
  },
  {
    id: 'closing',
    title: '退勤前：温度管理',
    subTitle: '本庫・2号室 最終温度確認',
    path: '/?tab=closing',
    note: '退勤時、冷凍保冷庫の最終温度を確認して送信してください。',
  },
  {
    id: 'drive',
    title: '社用車：運転日報記録',
    subTitle: '乗車時・降車時メーター・給油記録',
    path: '/?tab=drive',
    note: '出発前のメーターと、帰着後の降車メーター・給油量を入力してください。',
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

  // Excelでそのまま開けるスプレッドシート形式（.xls）のダウンロード
  const handleExportExcel = () => {
    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>QR一覧</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #000; }
          td { border: 1px solid #ccc; font-size: 11pt; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th style="width: 120px;">ID</th>
              <th style="width: 220px;">チェック項目名</th>
              <th style="width: 260px;">サブタイトル</th>
              <th style="width: 320px;">直接アクセスURL</th>
              <th style="width: 380px;">運用案内</th>
            </tr>
          </thead>
          <tbody>
            ${qrList
              .map(
                (item) => `
              <tr>
                <td>${item.id}</td>
                <td style="font-weight: bold;">${item.title}</td>
                <td>${item.subTitle}</td>
                <td><a href="${baseUrl}${item.path}">${baseUrl}${item.path}</a></td>
                <td>${item.note}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '業務チェックシート_URL一覧.xls';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans">
      {/* 印刷用CSSスタイル定義：A4縦1枚に厳密に収まるように制御 */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .a4-page-box {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            padding: 16mm 18mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            border: none !important;
          }
        }
      `}</style>

      {/* 操作コントロールバー（印刷時は自動非表示） */}
      <div className="max-w-4xl mx-auto mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden">
        <h1 className="text-2xl font-black text-slate-800 mb-2">QRコード印刷センター</h1>
        <p className="text-slate-600 mb-6 text-sm">
          現場掲示用（A4ぴったり1枚）または一覧出力、Excelでの台帳出力が可能です。
        </p>

        {/* スタイル切り替え */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setMode('wall')}
            className={`px-5 py-3 rounded-xl font-bold text-base transition-all flex items-center gap-2 ${
              mode === 'wall'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🏢 A4壁面用（1枚に1個・A4収縮対応）
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

        {/* ボタン群 */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handlePrint}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black rounded-xl shadow-lg transition-all text-lg flex items-center justify-center gap-2"
          >
            🖨️ {mode === 'wall' ? 'A4壁貼り印刷（1項目1枚）' : 'コンパクト一覧を印刷'}
          </button>
          <button
            onClick={handleExportExcel}
            className="px-6 py-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black rounded-xl shadow-lg transition-all text-lg flex items-center justify-center gap-2"
          >
            📊 Excel形式で保存（.xls）
          </button>
        </div>
      </div>

      {/* --- パターン 1: A4壁貼り特大モード（A4 1枚に確実に収まるレイアウト） --- */}
      {mode === 'wall' && (
        <div className="max-w-3xl mx-auto space-y-12 print:space-y-0 print:max-w-none">
          {qrList.map((item, index) => {
            const targetUrl = baseUrl ? `${baseUrl}${item.path}` : '';

            return (
              <div
                key={index}
                className="a4-page-box bg-white border-4 border-slate-900 rounded-3xl p-10 flex flex-col justify-between text-center mx-auto shadow-sm print:shadow-none"
              >
                {/* ヘッダーエリア */}
                <div className="w-full border-b-4 border-slate-900 pb-5">
                  <span className="inline-block bg-slate-900 text-white text-base font-black px-4 py-1.5 rounded-lg mb-2 tracking-widest">
                    業務管理チェックシート
                  </span>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-snug">
                    {item.title}
                  </h2>
                  <p className="text-xl font-bold text-slate-600 mt-1">
                    {item.subTitle}
                  </p>
                </div>

                {/* QRコード表示部（270pxでA4用紙の中央にベストバランス） */}
                <div className="my-auto py-4">
                  <div className="p-4 bg-white border-4 border-dashed border-slate-400 rounded-3xl inline-block shadow-inner">
                    {targetUrl ? (
                      <QRCodeSVG
                        value={targetUrl}
                        size={270}
                        level="H"
                        includeMargin={true}
                      />
                    ) : (
                      <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-2xl text-slate-400 font-bold">
                        生成中...
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-2xl font-black text-blue-800 tracking-wider">
                    ▲ スマホのカメラを向けてください ▲
                  </p>
                </div>

                {/* フッターエリア */}
                <div className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl p-5">
                  <p className="text-lg font-bold text-slate-800">
                    【案内】{item.note}
                  </p>
                  <p className="text-xs text-slate-500 mt-2 break-all font-mono font-bold">
                    URL: {targetUrl}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- パターン 2: コンパクト一覧モード --- */}
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
                      現場掲示用
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
                        size={140}
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