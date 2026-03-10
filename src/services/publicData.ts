import { DATA_GO_KR_KEY, SEOUL_OPEN_API_KEY } from '../config';

import { db } from './firebase';
import { ref, get, set } from 'firebase/database';

const isDev = import.meta.env.DEV;

// http API는 프로덕션에서 프록시 경유
function seoulUrl(path: string): string {
  if (isDev) return `/api/seoul/${path}`;
  return `/api/proxy?target=seoul&path=${encodeURIComponent(path)}`;
}
function guUrl(target: string, path: string): string {
  if (isDev) return `/api/${target}/${path}`;
  return `/api/proxy?target=${target}&path=${encodeURIComponent(path)}`;
}

export interface GovStore {
  bizesNm: string; brchNm: string; indsSclsNm: string;
  indsMclsNm: string; rdnmAdr: string; lon: number; lat: number;
}
export interface CheapStore { name: string; addr: string; induty: string; }
export interface CertStore { name: string; certType: string; lat: number; lng: number; }
export interface ModelRestaurant {
  name: string; address: string; category: string;
  mainMenu: string; phone: string; lat: number; lng: number;
}

// 소상공인 상권정보 (https - 직접 호출 OK)
export async function fetchGovStores(lat: number, lng: number, radius = 500): Promise<GovStore[]> {
  const url = isDev
    ? `/api/gov/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${DATA_GO_KR_KEY}&radius=${radius}&cx=${lng}&cy=${lat}&indsLclsCd=I2&numOfRows=200&pageNo=1&type=json`
    : `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${DATA_GO_KR_KEY}&radius=${radius}&cx=${lng}&cy=${lat}&indsLclsCd=I2&numOfRows=200&pageNo=1&type=json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const items = data?.body?.items;
    if (!items) return [];
    return items.map((item: any) => ({
      bizesNm: item.bizesNm, brchNm: item.brchNm || '',
      indsSclsNm: item.indsSclsNm, indsMclsNm: item.indsMclsNm,
      rdnmAdr: item.rdnmAdr, lon: item.lon, lat: item.lat,
    }));
  } catch { return []; }
}

// 서울시 착한가격업소
export async function fetchCheapStores(): Promise<CheapStore[]> {
  const url = seoulUrl(`${SEOUL_OPEN_API_KEY}/json/ListPriceModelStoreService/1/1000/`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    const rows = data?.ListPriceModelStoreService?.row;
    if (!rows) return [];
    return rows
      .filter((r: any) => ['한식', '중식', '경양식/일식', '기타외식업'].includes(r.INDUTY_CODE_SE_NAME))
      .map((r: any) => ({ name: r.SH_NAME, addr: r.SH_ADDR, induty: r.INDUTY_CODE_SE_NAME }));
  } catch { return []; }
}

// 서울시 인증업소
export async function fetchCertStores(): Promise<CertStore[]> {
  const url = seoulUrl(`${SEOUL_OPEN_API_KEY}/json/CrtfcUpsoInfo/1/366/`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    const rows = data?.CrtfcUpsoInfo?.row;
    if (!rows) return [];
    return rows.map((r: any) => ({
      name: r.UPSO_NM, certType: r.CRTFC_GBN_NM,
      lat: parseFloat(r.Y_DNTS) || 0, lng: parseFloat(r.X_CNTS) || 0,
    }));
  } catch { return []; }
}

// 구별 모범음식점
const MODEL_CFG: Record<string, { target: string; name: string; max: number }> = {
  '마곡': { target: 'gangseo', name: 'GangseoModelRestaurantDesignate', max: 200 },
  '상암': { target: 'mapo', name: 'MpModelRestaurantDesignate', max: 300 },
  '용산': { target: 'yongsan', name: 'YsModelRestaurantDesignate', max: 200 },
};

function geocodeAddress(addr: string): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) { resolve({ lat: 0, lng: 0 }); return; }
    const geocoder = new (window as any).kakao.maps.services.Geocoder();
    geocoder.addressSearch(addr, (result: any[], status: any) => {
      if (status === (window as any).kakao.maps.services.Status.OK && result[0]) {
        resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
      } else {
        resolve({ lat: 0, lng: 0 });
      }
    });
  });
}

export async function fetchModelRestaurants(office: string): Promise<ModelRestaurant[]> {
  const cfg = MODEL_CFG[office];
  if (!cfg) return [];

  // Firebase 캐시 확인 (30일 유효)
  const CACHE_DAYS = 30;
  try {
    const cacheRef = ref(db, `upmap/modelCache/${office}`);
    const snap = await get(cacheRef);
    if (snap.exists()) {
      const cached = snap.val();
      const age = Date.now() - (cached.updatedAt || 0);
      if (age < CACHE_DAYS * 24 * 60 * 60 * 1000 && cached.data?.length > 0) {
        return cached.data;
      }
    }
  } catch { /* 캐시 읽기 실패 시 그냥 API 호출 */ }

  // API 호출 + 지오코딩
  const path = `${SEOUL_OPEN_API_KEY}/json/${cfg.name}/1/${cfg.max}/`;
  const url = guUrl(cfg.target, path);
  try {
    const res = await fetch(url);
    const data = await res.json();
    const rows = data?.[cfg.name]?.row;
    if (!rows) return [];

    const places: ModelRestaurant[] = [];
    const batchSize = 5;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (r: any) => {
        const addr = r.SITE_ADDR_RD || r.SITE_ADDR || '';
        const { lat, lng } = addr ? await geocodeAddress(addr) : { lat: 0, lng: 0 };
        return {
          name: r.UPSO_NM, address: addr,
          category: r.SNT_UPTAE_NM || '', mainMenu: r.MAIN_EDF || '',
          phone: r.UPSO_SITE_TELNO || '', lat, lng,
        };
      }));
      places.push(...results);
    }
    const filtered = places.filter(p => p.lat !== 0 && p.lng !== 0);

    // Firebase에 캐싱
    try {
      const cacheRef = ref(db, `upmap/modelCache/${office}`);
      await set(cacheRef, { data: filtered, updatedAt: Date.now() });
    } catch { /* 캐시 저장 실패 무시 */ }

    return filtered;
  } catch { return []; }
}


// 식약처 모범음식점 (전국, HTTPS 직접 호출)
export interface FdaModelStore {
  name: string;
  region: string;
  mainMenu: string;
}

const FDA_API_KEY = '8a2cf7ce24d64ffbaaa4';

export async function fetchFdaModelStores(office: string): Promise<FdaModelStore[]> {
  const regionMap: Record<string, string> = {
    '마곡': '강서', '상암': '마포', '용산': '용산',
  };
  const keyword = regionMap[office];
  if (!keyword) return [];

  // Firebase 캐시 확인 (30일)
  const CACHE_DAYS = 30;
  try {
    const cacheRef = ref(db, `upmap/fdaModelCache/${office}`);
    const snap = await get(cacheRef);
    if (snap.exists()) {
      const cached = snap.val();
      const age = Date.now() - (cached.updatedAt || 0);
      if (age < CACHE_DAYS * 24 * 60 * 60 * 1000 && cached.data?.length > 0) {
        return cached.data;
      }
    }
  } catch { /* ignore */ }

  // 전체 데이터에서 해당 구 필터링 (1000건씩)
  const result: FdaModelStore[] = [];
  const total = 25000;
  for (let start = 1; start <= total; start += 1000) {
    const end = Math.min(start + 999, total);
    const url = `https://openapi.foodsafetykorea.go.kr/api/${FDA_API_KEY}/I1590/json/${start}/${end}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const rows = data?.I1590?.row;
      if (!rows) break;
      for (const r of rows) {
        if (r.SIGNGU_NM?.includes('서울') && r.SIGNGU_NM?.includes(keyword)) {
          result.push({
            name: r.BSSH_NM,
            region: r.SIGNGU_NM,
            mainMenu: r.PNCPL_FOOD_NM || '',
          });
        }
      }
    } catch { break; }
  }

  // Firebase 캐싱
  try {
    const cacheRef = ref(db, `upmap/fdaModelCache/${office}`);
    await set(cacheRef, { data: result, updatedAt: Date.now() });
  } catch { /* ignore */ }

  return result;
}

