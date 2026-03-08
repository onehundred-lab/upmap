export const KAKAO_REST_API_KEY = 'bebfb73197c72408e6231cbc3e19582a';
export const DATA_GO_KR_KEY = 'a42075a37cfdddfaa2aecf30a1b0daaf23e08a12c58e1740d307beb1fbdc64a9';
export const SEOUL_OPEN_API_KEY = '416253446d72686b353165704f675a';

export interface Office {
  name: string;
  shortName: string;
  lat: number;
  lng: number;
}

export const OFFICES: Office[] = [
  { name: 'LG U+ 마곡', shortName: '마곡', lat: 37.5619, lng: 126.8343 },
  { name: 'LG U+ 상암', shortName: '상암', lat: 37.5805, lng: 126.8877 },
  { name: 'LG U+ 용산', shortName: '용산', lat: 37.5238, lng: 126.9635 },
];

export const FOOD_CATEGORIES = [
  { code: 'cheap', label: '💰 착한가격', type: 'badge' },
  { code: 'cert', label: '🌿 인증업소', type: 'badge' },
  { code: 'gov', label: '🏛️ 정부등록', type: 'badge' },
  { code: 'all', label: '전체', type: 'food' },
  { code: 'lunch', label: '🍚 점심맛집', type: 'food' },
  { code: 'coffee', label: '☕ 커피맛집', type: 'food' },
  { code: 'honbap', label: '🍜 혼밥', type: 'food' },
  { code: 'lunchhoesik', label: '🍱 점심회식', type: 'food' },
  { code: 'dinnerhoesik', label: '🍻 저녁회식', type: 'food' },
  { code: 'bakery', label: '🥐 베이커리', type: 'food' },
  { code: 'drink', label: '🍺 한잔어때', type: 'food' },
  { code: 'delivery', label: '🥡 배달/포장', type: 'food' },
  { code: 'room', label: '👔 중요자리', type: 'food' },
  { code: 'date', label: '💕 데이트', type: 'food' },
];
