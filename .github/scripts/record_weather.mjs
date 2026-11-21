// 毎日 08:00（JST）の天気を Open-Meteo から取得し、Supabase の daily_weather_logs に保存する
//
// 環境変数
//   SUPABASE_URL / SUPABASE_KEY : 保存先（GitHub の Secrets）
//   TARGET_DATE                 : 任意。YYYY-MM-DD を指定するとその日の分を記録（記録漏れの穴埋め用）
//                                 未指定なら日本時間の今日
//
// 天気サービスへの接続が一時的に失敗しても、間隔をあけて自動でやり直す。
// 同じ日付は上書き保存（upsert）なので、何度実行しても重複しない。

const LAT = 37.526823;
const LON = 139.94667;

const MAX_ATTEMPTS = Number(process.env.WEATHER_MAX_ATTEMPTS || 5);
const RETRY_BASE_MS = Number(process.env.WEATHER_RETRY_BASE_MS || 20000); // 20秒, 40秒, 60秒...
const TIMEOUT_MS = 30000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 通信エラー・タイムアウト・サーバー側エラー（5xx, 429）のときだけやり直す
async function fetchWithRetry(label, url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`${label}: HTTP ${res.status} ${await res.text().catch(() => '')}`);
      }
      return res;
    } catch (err) {
      lastError = err;
      const cause = err?.cause?.code || err?.name || '';
      console.warn(`[${label}] ${attempt}/${MAX_ATTEMPTS} 回目に失敗: ${err.message} ${cause}`);
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BASE_MS * attempt);
    }
  }
  throw lastError;
}

const parseWmo = (code) => {
  if (code === 0) return '☀️ 快晴';
  if (code === 1 || code === 2) return '🌤 晴れ';
  if (code === 3) return '☁️ 曇り';
  if (code === 45 || code === 48) return '🌫️ 霧';
  if (code >= 51 && code <= 55) return '🌦️ 霧雨';
  if (code >= 61 && code <= 65) return '🌧️ 雨';
  if (code >= 71 && code <= 77) return '❄️ 雪';
  if (code >= 80 && code <= 82) return '🌧️ にわか雨';
  if (code >= 85 && code <= 86) return '🌨️ にわか雪';
  if (code >= 95) return '⚡ 雷雨';
  return '☁️ 曇り';
};

async function main() {
  const requested = (process.env.TARGET_DATE || '').trim();
  if (requested && !/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    throw new Error(`TARGET_DATE の形式が正しくありません（YYYY-MM-DD）: ${requested}`);
  }
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = requested || jstNow.toISOString().slice(0, 10);
  const targetTimeStr = `${dateStr}T08:00`;
  const recordedAt = `${dateStr}T08:00:00+09:00`;

  // 対象日1日分の1時間ごとのデータ（過去の日付も取得できる）
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&hourly=temperature_2m,relative_humidity_2m,weather_code,precipitation,snowfall` +
    `&timezone=Asia%2FTokyo&start_date=${dateStr}&end_date=${dateStr}`;

  const resWeather = await fetchWithRetry('天気の取得', weatherUrl);
  if (!resWeather.ok) {
    throw new Error(`天気の取得に失敗しました: HTTP ${resWeather.status} ${await resWeather.text()}`);
  }
  const weatherJson = await resWeather.json();

  const idx = weatherJson.hourly.time.findIndex((t) => t === targetTimeStr);
  if (idx === -1) throw new Error(`${targetTimeStr} のデータがありません`);

  const temp = weatherJson.hourly.temperature_2m[idx];
  const hum = weatherJson.hourly.relative_humidity_2m[idx];
  const code = weatherJson.hourly.weather_code[idx];
  const prec = weatherJson.hourly.precipitation ? weatherJson.hourly.precipitation[idx] : 0;
  const snow = weatherJson.hourly.snowfall ? weatherJson.hourly.snowfall[idx] : 0;

  const baseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.SUPABASE_KEY || '').trim();

  const payload = [
    {
      target_date: dateStr,
      recorded_at: recordedAt,
      weather_text: parseWmo(code),
      temperature: Math.round(temp * 10) / 10,
      humidity: Math.round(hum),
      precipitation: Math.round((prec ?? 0) * 10) / 10,
      snowfall: Math.round((snow ?? 0) * 10) / 10,
    },
  ];

  // 同じ日付は上書き（upsert）
  const resDb = await fetchWithRetry('Supabase への保存', `${baseUrl}/rest/v1/daily_weather_logs?on_conflict=target_date`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });

  console.log('Supabase response status:', resDb.status);
  if (!resDb.ok) {
    throw new Error(`Supabase への保存に失敗しました: ${await resDb.text()}`);
  }
  console.log('保存しました:', dateStr, targetTimeStr, payload[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
