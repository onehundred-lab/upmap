import { DATA_GO_KR_KEY } from '../config';
import { db } from './firebase';
import { ref, get, set } from 'firebase/database';

export interface WeatherData {
  temp: number;       // 현재 기온
  sky: number;        // 하늘상태 1맑음 3구름많음 4흐림
  pty: number;        // 강수형태 0없음 1비 2비/눈 3눈 4소나기
  pop: number;        // 강수확률
  tmn: number | null; // 최저기온
  tmx: number | null; // 최고기온
  wsd: number;        // 풍속
  reh: number;        // 습도
  updatedAt: number;
}

// 사옥별 격자 좌표 (기상청 격자)
const GRID: Record<string, { nx: number; ny: number }> = {
  '마곡': { nx: 58, ny: 125 },
  '상암': { nx: 58, ny: 127 },
  '용산': { nx: 60, ny: 126 },
};

// 가장 최근 발표시각 계산 (0200,0500,0800,1100,1400,1700,2000,2300)
function getBaseDateTime(): { baseDate: string; baseTime: string } {
  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes();

  const baseTimes = [23, 20, 17, 14, 11, 8, 5, 2];
  let baseHour = 2;
  let dayOffset = 0;

  for (const bt of baseTimes) {
    if (hours > bt || (hours === bt && mins >= 10)) {
      baseHour = bt;
      break;
    }
  }
  // 자정~02:10 사이면 전날 2300 사용
  if (hours < 2 || (hours === 2 && mins < 10)) {
    baseHour = 23;
    dayOffset = -1;
  }

  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  const baseDate = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const baseTime = String(baseHour).padStart(2, '0') + '00';
  return { baseDate, baseTime };
}

// 현재 시각에 가장 가까운 예보 시각 찾기
function getNearestFcstTime(): string {
  const h = new Date().getHours();
  return String(h).padStart(2, '0') + '00';
}

function skyText(sky: number, pty: number): string {
  if (pty === 1 || pty === 4) return '🌧️ 비';
  if (pty === 2) return '🌨️ 비/눈';
  if (pty === 3) return '❄️ 눈';
  if (sky === 1) return '☀️ 맑음';
  if (sky === 3) return '⛅ 구름많음';
  if (sky === 4) return '☁️ 흐림';
  return '🌤️';
}

export function getWeatherEmoji(w: WeatherData): string {
  return skyText(w.sky, w.pty);
}

export function getWeatherSummary(w: WeatherData): string {
  const sky = skyText(w.sky, w.pty);
  let s = `${sky} ${w.temp}°`;
  if (w.tmn !== null && w.tmx !== null) {
    s += ` (${w.tmn}°/${w.tmx}°)`;
  }
  s += ` 💧${w.pop}%`;
  return s;
}

export async function fetchWeather(office: string): Promise<WeatherData | null> {
  const grid = GRID[office];
  if (!grid) return null;

  // Firebase 캐시 (3시간 TTL)
  const CACHE_MS = 3 * 60 * 60 * 1000;
  try {
    const cacheRef = ref(db, `upmap/weatherCache/${office}`);
    const snap = await get(cacheRef);
    if (snap.exists()) {
      const cached = snap.val();
      if (Date.now() - (cached.updatedAt || 0) < CACHE_MS) {
        return cached as WeatherData;
      }
    }
  } catch { /* ignore */ }

  // API 호출 (Vercel 프록시 경유 - CORS 우회)
  const { baseDate, baseTime } = getBaseDateTime();
  const params = new URLSearchParams({
    target: 'weather',
    path: '1360000/VilageFcstInfoService_2.0/getVilageFcst',
    serviceKey: DATA_GO_KR_KEY,
    pageNo: '1',
    numOfRows: '300',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(grid.nx),
    ny: String(grid.ny),
  });
  const url = `/api/proxy?${params.toString()}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const items = data?.response?.body?.items?.item;
    if (!items) return null;

    const nearTime = getNearestFcstTime();
    // 현재 시각에 가장 가까운 예보 데이터 찾기
    const nearItems = items.filter((i: any) => i.fcstDate === baseDate && i.fcstTime >= nearTime);
    const targetTime = nearItems.length > 0 ? nearItems[0].fcstTime : items[0]?.fcstTime;
    const targetDate = nearItems.length > 0 ? baseDate : items[0]?.fcstDate;

    const val = (cat: string): number | null => {
      const item = items.find((i: any) => i.category === cat && i.fcstDate === targetDate && i.fcstTime === targetTime);
      return item ? parseFloat(item.fcstValue) : null;
    };

    // TMN/TMX는 특정 시각에만 나옴 - 전체에서 찾기
    const tmnItem = items.find((i: any) => i.category === 'TMN');
    const tmxItem = items.find((i: any) => i.category === 'TMX');

    const weather: WeatherData = {
      temp: val('TMP') ?? 0,
      sky: val('SKY') ?? 1,
      pty: val('PTY') ?? 0,
      pop: val('POP') ?? 0,
      tmn: tmnItem ? parseFloat(tmnItem.fcstValue) : null,
      tmx: tmxItem ? parseFloat(tmxItem.fcstValue) : null,
      wsd: val('WSD') ?? 0,
      reh: val('REH') ?? 0,
      updatedAt: Date.now(),
    };

    // Firebase 캐싱
    try {
      const cacheRef = ref(db, `upmap/weatherCache/${office}`);
      await set(cacheRef, weather);
    } catch { /* ignore */ }

    return weather;
  } catch {
    return null;
  }
}
