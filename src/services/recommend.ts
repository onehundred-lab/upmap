import { db } from './firebase';
import { ref, get, set, push, increment, onValue, off } from 'firebase/database';

const STORAGE_KEY = 'upmap_recommended';

export interface RegisteredPlace {
  id: string;
  kakaoId: string;
  name: string;
  category: string;
  foodType: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  url: string;
  office: string;
  recommends: number;
  createdAt: string;
}

// 이미 추천했는지 확인 (localStorage)
export function hasRecommended(placeId: string): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  const ids: string[] = saved ? JSON.parse(saved) : [];
  return ids.includes(placeId);
}

// 추천하기
export async function recommendPlace(placeId: string): Promise<number> {
  if (hasRecommended(placeId)) return -1;

  const countRef = ref(db, `upmap/places/${placeId}/recommends`);
  await set(countRef, increment(1));

  // localStorage에 기록
  const saved = localStorage.getItem(STORAGE_KEY);
  const ids: string[] = saved ? JSON.parse(saved) : [];
  ids.push(placeId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));

  const snap = await get(countRef);
  return snap.val() || 0;
}

// 맛집 등록
export async function registerPlace(place: {
  kakaoId: string;
  name: string;
  category: string;
  foodType: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  url: string;
  office: string;
}): Promise<string> {
  const listRef = ref(db, 'upmap/places');
  const newRef = push(listRef);
  await set(newRef, {
    ...place,
    recommends: 1,
    createdAt: new Date().toISOString(),
  });
  // 등록한 사람은 자동 추천 처리
  const id = newRef.key!;
  const saved = localStorage.getItem(STORAGE_KEY);
  const ids: string[] = saved ? JSON.parse(saved) : [];
  ids.push(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  return id;
}

// 등록된 맛집 실시간 리스닝 (사옥별) - 최초만 정렬, 이후 순서 유지
export function listenPlaces(
  office: string,
  callback: (places: RegisteredPlace[]) => void,
): () => void {
  const placesRef = ref(db, 'upmap/places');
  let orderRef: string[] | null = null;
  const handler = (snap: any) => {
    if (!snap.exists()) { callback([]); return; }
    const val = snap.val();
    const list: RegisteredPlace[] = Object.entries(val)
      .map(([id, v]: [string, any]) => ({ id, ...v }))
      .filter((p: any) => p.office === office);

    if (!orderRef) {
      // 최초 로드: 추천순 정렬 후 순서 기억
      list.sort((a, b) => (b.recommends || 0) - (a.recommends || 0));
      orderRef = list.map(p => p.id);
    } else {
      // 이후: 기존 순서 유지, 새 항목은 맨 위에
      const sorted: RegisteredPlace[] = [];
      const remaining = new Map(list.map(p => [p.id, p]));
      for (const id of orderRef) {
        const p = remaining.get(id);
        if (p) { sorted.push(p); remaining.delete(id); }
      }
      // 새로 추가된 항목은 맨 앞에
      remaining.forEach(p => sorted.unshift(p));
      orderRef = sorted.map(p => p.id);
      list.length = 0;
      list.push(...sorted);
    }
    callback(list);
  };
  onValue(placesRef, handler);
  return () => off(placesRef, 'value', handler);
}

// 카카오 키워드 검색 (등록용)
export async function searchKakaoPlaces(
  keyword: string, lat: number, lng: number,
): Promise<any[]> {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) { resolve([]); return; }
    const ps = new (window as any).kakao.maps.services.Places();
    const location = new (window as any).kakao.maps.LatLng(lat, lng);
    ps.keywordSearch(keyword, (result: any[], status: any) => {
      if (status === (window as any).kakao.maps.services.Status.OK) {
        resolve(result);
      } else {
        resolve([]);
      }
    }, { location, radius: 2000, size: 15 });
  });
}
