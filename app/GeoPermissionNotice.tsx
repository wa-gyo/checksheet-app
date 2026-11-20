'use client';

// 位置情報が「許可しない」になっている人への案内（基本チェック画面に表示）

import React, { useEffect, useState } from 'react';
import { checkGeofence, queryGeoPermission, type GeoPermission } from '@/lib/geofence';

export default function GeoPermissionNotice({ forceDenied = false }: { forceDenied?: boolean }) {
  const [permission, setPermission] = useState<GeoPermission>('unknown');
  // 表示は許可状態の取得後なので、初回描画時に端末の種類を判定してよい
  const [isAndroid] = useState(() => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent));
  const [rechecking, setRechecking] = useState(false);
  const [recheckMsg, setRecheckMsg] = useState('');

  useEffect(() => {
    let status: PermissionStatus | undefined;
    const onChange = () => status && setPermission(status.state as GeoPermission);
    queryGeoPermission().then((r) => {
      setPermission(r.state);
      status = r.status;
      status?.addEventListener('change', onChange);
    });
    return () => status?.removeEventListener('change', onChange);
  }, []);

  // 許可状態が取れない端末でも、送信時に「許可されていません」となった場合は表示する
  const denied = permission === 'denied' || (forceDenied && permission !== 'granted');
  if (!denied) return null;

  const handleRecheck = async () => {
    setRechecking(true);
    setRecheckMsg('');
    const r = await queryGeoPermission();
    setPermission(r.state);
    const geo = await checkGeofence();
    setRechecking(false);
    if (geo.status !== 'unavailable') {
      setPermission('granted');
      return;
    }
    setRecheckMsg(geo.permissionDenied ? 'まだ「許可しない」のままです。上の手順で許可してから、もう一度押してください。' : geo.reason || '位置情報を取得できませんでした');
  };

  return (
    <div className="p-4 bg-red-950 border-2 border-red-400 rounded-2xl shadow-xl space-y-3 text-white">
      <p className="text-lg sm:text-xl font-black text-red-200">⚠️ 位置情報がオフになっています</p>
      <p className="text-sm font-bold text-slate-100 leading-relaxed">
        このままでも記録はできますが、「位置確認不可」として記録され、管理者に確認されます。次の手順で位置情報を許可してください。
      </p>

      {isAndroid ? (
        <div className="bg-slate-900 border border-slate-600 rounded-xl p-3 space-y-2 text-sm font-bold leading-relaxed">
          <p className="text-amber-300 font-black">Android（Chrome）の場合</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              画面上の<span className="text-amber-300">アドレスバーの左端のマーク</span>（調整マーク・鍵マーク）をタップ
            </li>
            <li>
              <span className="text-amber-300">「権限」→「位置情報」→「許可」</span>を選ぶ（「権限をリセット」でも可）
            </li>
            <li>このページを再読み込みする</li>
          </ol>
          <p className="text-xs text-slate-300 pt-1">
            それでも直らない場合：スマホの「設定」→「位置情報」をオンにし、「設定」→「アプリ」→「Chrome」→「権限」→「位置情報」を「アプリの使用中のみ許可」にしてください。
          </p>
          <p className="text-xs text-slate-300">LINE から開いている場合は、右上のメニューから「ブラウザで開く」を選んでください。</p>
        </div>
      ) : (
        <p className="text-sm font-bold text-slate-200 bg-slate-900 border border-slate-600 rounded-xl p-3">
          スマホの設定で、このサイトの位置情報を「許可」にしてください。分からない場合は管理者に確認してください。
        </p>
      )}

      <button
        type="button"
        onClick={handleRecheck}
        disabled={rechecking}
        className="w-full min-h-[50px] bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-base rounded-xl border-2 border-red-300 disabled:opacity-60"
      >
        {rechecking ? '確認中...' : '許可したので、もう一度確認する'}
      </button>
      {recheckMsg && <p className="text-sm font-black text-amber-300">{recheckMsg}</p>}
    </div>
  );
}
