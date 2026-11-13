// 勤怠（基本チェック）の位置情報判定
//
// 事業所: 〒965-0006 福島県会津若松市一箕町大字鶴賀船ケ森東470
// 座標は環境変数 NEXT_PUBLIC_STORE_LAT / NEXT_PUBLIC_STORE_LNG で上書きできます。
// 既定値は事業所の敷地（Google マップで確認済みの座標）です。

const parseEnvNumber = (raw: string | undefined, fallback: number): number => {
  const n = raw !== undefined && raw !== '' ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const STORE_LAT = parseEnvNumber(process.env.NEXT_PUBLIC_STORE_LAT, 37.526823);
export const STORE_LNG = parseEnvNumber(process.env.NEXT_PUBLIC_STORE_LNG, 139.94667);
export const GEOFENCE_RADIUS_M = parseEnvNumber(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS_M, 300);

// 屋内ではGPSの誤差が大きくなるため、測位誤差のうち最大この距離までは許容する
const MAX_ACCURACY_ALLOWANCE_M = 100;

// 'block'  : 範囲外なら送信させない（既定）
// 'warn'   : 範囲外でも送信できるが、記録に「範囲外」と残す（試験運用・座標確認用）
export const GEOFENCE_MODE: 'block' | 'warn' =
  process.env.NEXT_PUBLIC_GEOFENCE_MODE === 'warn' ? 'warn' : 'block';

export type GeoStatus = 'inside' | 'outside' | 'unavailable';

export interface GeoResult {
  status: GeoStatus;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  reason?: string;
}

export const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const getPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
  });

export const checkGeofence = async (): Promise<GeoResult> => {
  const empty = { lat: null, lng: null, accuracyM: null, distanceM: null };

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { status: 'unavailable', ...empty, reason: 'この端末・ブラウザは位置情報に対応していません' };
  }

  try {
    const pos = await getPosition();
    const { latitude, longitude, accuracy } = pos.coords;
    const distance = distanceMeters(latitude, longitude, STORE_LAT, STORE_LNG);
    const allowance = Math.min(accuracy || 0, MAX_ACCURACY_ALLOWANCE_M);
    const inside = distance <= GEOFENCE_RADIUS_M + allowance;

    return {
      status: inside ? 'inside' : 'outside',
      lat: latitude,
      lng: longitude,
      accuracyM: Math.round(accuracy),
      distanceM: Math.round(distance),
    };
  } catch (err) {
    const e = err as GeolocationPositionError;
    let reason = '位置情報を取得できませんでした';
    if (e && e.code === 1) reason = '位置情報の利用が許可されていません';
    else if (e && e.code === 2) reason = '現在地を特定できませんでした';
    else if (e && e.code === 3) reason = '位置情報の取得がタイムアウトしました';
    return { status: 'unavailable', ...empty, reason };
  }
};
