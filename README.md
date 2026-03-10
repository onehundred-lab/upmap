# UPmap - U+ 직장인 맛집지도

LG U+ 사옥 주변 맛집을 직원들이 직접 등록하고 추천하는 참여형 웹앱

🔗 https://upmap.vercel.app

## 주요 기능

- 🗺️ 카카오맵 기반 맛집 지도 (마곡/상암/용산 사옥별)
- ➕ 맛집 등록 (카카오 키워드 검색 → Firebase 저장)
- 👍 추천 (중복 방지, 추천순 정렬)
- 🍯 꿀팁 (맛집별 추천 메뉴/팁 공유)
- 🏅 모범음식점 탭 (구별 공공데이터, 600m 반경 필터)
- 🏷️ 뱃지 시스템 (착한가격, 인증업소, 모범음식점, 식약처모범)
- 🔍 음식 카테고리 필터 (점심맛집, 커피, 혼밥, 회식, 베이커리 등 11종)
- 💬 문의하기 (관리자 비밀번호로 확인/삭제)
- 📱 PWA 지원 (홈화면 설치, 오프라인 아이콘)

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 19 + TypeScript + Vite 7 |
| 지도 | Kakao Maps JavaScript SDK (지도, 마커, InfoWindow, Geocoder) |
| DB | Firebase Realtime Database |
| 배포 | Vercel (SPA + Serverless Functions) |
| PWA | Web App Manifest + 커스텀 아이콘 |

## 공공데이터 API

| 데이터 | 제공기관 | 프로토콜 | 용도 |
|--------|----------|----------|------|
| 소상공인 상권정보 | data.go.kr | HTTPS | 음식점 위치 매칭 |
| 착한가격업소 | 서울 열린데이터광장 | HTTP (프록시) | 💰 착한가격 뱃지 |
| 인증업소 | 서울 열린데이터광장 | HTTP (프록시) | 🌿 인증업소 뱃지 |
| 강서구 모범음식점 | 강서구청 | HTTP (프록시) | 🏅 모범음식점 탭/뱃지 |
| 마포구 모범음식점 | 마포구청 | HTTP (프록시) | 🏅 모범음식점 탭/뱃지 |
| 용산구 모범음식점 | 용산구청 | HTTP (프록시) | 🏅 모범음식점 탭/뱃지 |
| 모범음식점 (전국) | 식품의약품안전처 | HTTPS | 🏆 식약처모범 뱃지 |

## 외부 API

| API | 용도 |
|-----|------|
| Kakao Maps JavaScript SDK | 지도 렌더링, 마커, InfoWindow |
| Kakao Maps Services (Places) | 키워드 검색, 장소 URL 조회 |
| Kakao Maps Services (Geocoder) | 주소 → 좌표 변환 (모범음식점) |

## 프로젝트 구조

```
upmap/
├── api/proxy.ts              # Vercel 서버리스 프록시 (HTTP API 중계)
├── public/
│   ├── manifest.json          # PWA 매니페스트
│   ├── icon-magenta.svg       # 앱 아이콘
│   └── icon-header.svg        # 헤더 캐릭터 아이콘
├── src/
│   ├── App.tsx                # 메인 컴포넌트
│   ├── App.css                # 스타일
│   ├── config.ts              # 사옥 좌표, 카테고리, API 키
│   └── services/
│       ├── firebase.ts        # Firebase 초기화
│       ├── recommend.ts       # 맛집 등록/추천/검색 CRUD
│       ├── publicData.ts      # 공공데이터 API + Firebase 캐싱
│       ├── inquiry.ts         # 문의하기 CRUD
│       └── tips.ts            # 꿀팁 CRUD
├── vercel.json                # Vercel 배포 설정
└── vite.config.ts             # 개발 프록시 설정
```

## 캐싱 전략

- 모범음식점 데이터 (구별/식약처): Firebase에 30일 TTL 캐싱
- 지오코딩 결과 포함 캐싱으로 반복 API 호출 방지

## 개발 환경

```bash
cd upmap
npm install
npm run dev        # http://localhost:5173
```

## 배포

```bash
git push origin main   # Vercel 자동 배포
```
