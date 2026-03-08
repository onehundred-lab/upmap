import { useState, useEffect, useRef, useCallback } from 'react';
import { OFFICES, FOOD_CATEGORIES } from './config';
import type { Office } from './config';
import { fetchGovStores, fetchCheapStores, fetchCertStores, fetchModelRestaurants } from './services/publicData';
import type { GovStore, CheapStore, CertStore, ModelRestaurant } from './services/publicData';
import {
  hasRecommended, recommendPlace, registerPlace,
  listenPlaces, searchKakaoPlaces,
} from './services/recommend';
import type { RegisteredPlace } from './services/recommend';
import './App.css';

function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const officeMarkerRef = useRef<any>(null);

  const [selectedOffice, setSelectedOffice] = useState<Office>(OFFICES[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [places, setPlaces] = useState<RegisteredPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // 공공데이터
  const [govStores, setGovStores] = useState<GovStore[]>([]);
  const [cheapStores, setCheapStores] = useState<CheapStore[]>([]);
  const [certStores, setCertStores] = useState<CertStore[]>([]);
  const [modelRestaurants, setModelRestaurants] = useState<ModelRestaurant[]>([]);

  // 등록 모달
  const [showRegister, setShowRegister] = useState(false);
  const [regStep, setRegStep] = useState<'category' | 'search' | 'results'>('category');
  const [regFoodType, setRegFoodType] = useState('');
  const [regKeyword, setRegKeyword] = useState('');
  const [regResults, setRegResults] = useState<any[]>([]);
  const [regSearching, setRegSearching] = useState(false);

  // 공공데이터 로드
  useEffect(() => {
    fetchGovStores(selectedOffice.lat, selectedOffice.lng, 1000).then(setGovStores);
    fetchCheapStores().then(setCheapStores);
    fetchCertStores().then(setCertStores);
    fetchModelRestaurants(selectedOffice.shortName).then(setModelRestaurants);
  }, [selectedOffice]);

  // Firebase 실시간 리스닝
  useEffect(() => {
    setLoading(true);
    const unsub = listenPlaces(selectedOffice.shortName, (list) => {
      setPlaces(list);
      setLoading(false);
    });
    return unsub;
  }, [selectedOffice]);

  // 카카오 SDK 로드 대기
  useEffect(() => {
    const check = () => {
      if (window.kakao?.maps?.LatLng) setMapReady(true);
      else setTimeout(check, 300);
    };
    check();
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const center = new kakao.maps.LatLng(selectedOffice.lat, selectedOffice.lng);
    mapInstance.current = new kakao.maps.Map(mapRef.current, { center, level: 4 });
  }, [mapReady]);

  // 사옥 변경 시 지도 이동 + 사옥 마커
  useEffect(() => {
    if (!mapInstance.current) return;
    const center = new kakao.maps.LatLng(selectedOffice.lat, selectedOffice.lng);
    mapInstance.current.setCenter(center);
    if (officeMarkerRef.current) officeMarkerRef.current.setMap(null);
    officeMarkerRef.current = new kakao.maps.Marker({
      map: mapInstance.current,
      position: center,
      image: new kakao.maps.MarkerImage(
        'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
        new kakao.maps.Size(24, 35),
      ),
    });
  }, [mapReady, selectedOffice]);

  // 뱃지 계산
  const getBadges = useCallback((name: string, lat: number, lng: number): string[] => {
    const badges: string[] = [];
    const cheapMatch = cheapStores.find(c => {
      const n1 = name.replace(/\s/g, '');
      const n2 = c.name.replace(/\s/g, '');
      return n1.includes(n2) || n2.includes(n1);
    });
    if (cheapMatch) badges.push('💰 착한가격');

    const govMatch = govStores.find(g => {
      const dist = Math.sqrt(Math.pow((g.lat - lat) * 111000, 2) + Math.pow((g.lon - lng) * 88000, 2));
      if (dist < 100) return true;
      const n1 = name.replace(/\s/g, '').replace(/[점관호]/g, '');
      const n2 = g.bizesNm.replace(/\s/g, '').replace(/[점관호]/g, '');
      return n1.includes(n2) || n2.includes(n1);
    });
    if (govMatch) badges.push('🏛️ 정부등록');

    const certMatch = certStores.find(c => {
      if (c.lat && c.lng) {
        const dist = Math.sqrt(Math.pow((c.lat - lat) * 111000, 2) + Math.pow((c.lng - lng) * 88000, 2));
        if (dist < 50) return true;
      }
      const n1 = name.replace(/\s/g, '');
      const n2 = c.name.replace(/\s/g, '');
      return n1.includes(n2) || n2.includes(n1);
    });
    if (certMatch) badges.push('🌿 ' + certMatch.certType);

    // 강서구 모범음식점
    const modelMatch = modelRestaurants.find(m => {
      const n1 = name.replace(/\s/g, '');
      const n2 = m.name.replace(/\s/g, '');
      return n1.includes(n2) || n2.includes(n1);
    });
    if (modelMatch) badges.push('🏅 모범음식점');

    return badges;
  }, [govStores, cheapStores, certStores, modelRestaurants]);

  // 마커 표시
  const displayMarkers = useCallback((list: RegisteredPlace[]) => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (!mapInstance.current) return;

    // 겹치는 좌표 오프셋 처리
    const posCount: Record<string, number> = {};
    list.forEach(place => {
      const key = `${place.lat.toFixed(5)}_${place.lng.toFixed(5)}`;
      posCount[key] = (posCount[key] || 0);
      const offset = posCount[key] * 0.00015;
      posCount[key]++;

      const marker = new kakao.maps.Marker({
        map: mapInstance.current!,
        position: new kakao.maps.LatLng(place.lat + offset, place.lng + offset),
      });
      kakao.maps.event.addListener(marker, 'click', () => {
        if (infoWindowRef.current) infoWindowRef.current.close();

        const showInfoWindow = (url?: string) => {
          if (infoWindowRef.current) infoWindowRef.current.close();
          const link = url || place.url;
          const iw = new kakao.maps.InfoWindow({
            content: `<div style="padding:8px 28px 8px 12px;font-size:13px;min-width:150px;color:#000;position:relative;">
              <span onclick="window.__closeIW && window.__closeIW()" style="position:absolute;top:4px;right:8px;cursor:pointer;font-size:15px;color:#999;line-height:1;">✕</span>
              <strong>${place.name}</strong>
              <span style="color:#333;font-size:11px;"> (${place.category})</span><br/>
              ${place.phone ? `<span style="font-size:11px;">📞 ${place.phone}</span><br/>` : ''}
              ${link ? `<a href="${link}" target="_blank" rel="noopener" style="font-size:11px;color:#1a73e8;">카카오맵</a>` : '<span style="font-size:11px;color:#999;">검색 중...</span>'}
            </div>`,
          });
          iw.open(mapInstance.current!, marker);
          infoWindowRef.current = iw;
          (window as any).__closeIW = () => { iw.close(); infoWindowRef.current = null; };
        };

        if (place.url) {
          showInfoWindow();
        } else {
          // URL 없으면 카카오 검색으로 찾기
          showInfoWindow();
          const ps = new kakao.maps.services.Places();
          ps.keywordSearch(place.name, (result: any[], status: any) => {
            if (status === kakao.maps.services.Status.OK && result.length > 0) {
              showInfoWindow(result[0].place_url);
            }
          }, { location: new kakao.maps.LatLng(place.lat, place.lng), radius: 500, size: 1 });
        }
      });
      markersRef.current.push(marker);
    });
  }, []);

  // 공공데이터를 RegisteredPlace 형태로 변환
  const autoPlaces = useCallback((): RegisteredPlace[] => {
    if (selectedCategory === 'model') {
      const oLat = selectedOffice.lat;
      const oLng = selectedOffice.lng;
      return modelRestaurants
        .filter(m => {
          if (m.lat === 0 || m.lng === 0) return false;
          const dist = Math.sqrt(Math.pow((m.lat - oLat) * 111000, 2) + Math.pow((m.lng - oLng) * 88000, 2));
          return dist <= 600;
        })
        .map((m, i) => ({
        id: `model_${i}`,
        kakaoId: '',
        name: m.name,
        category: m.category,
        foodType: 'model',
        phone: m.phone,
        address: m.address,
        lat: m.lat,
        lng: m.lng,
        url: '',
        office: selectedOffice.shortName,
        recommends: 0,
        createdAt: '',
        mainMenu: m.mainMenu,
      }));
    }
    return [];
  }, [selectedCategory, modelRestaurants, selectedOffice]);

  const isAutoCategory = selectedCategory === 'model';

  // 필터링된 목록
  const displayPlaces = (() => {
    if (isAutoCategory) return autoPlaces();
    let list = places;
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.foodType === selectedCategory);
    }
    return list;
  })();

  // 마커 업데이트
  useEffect(() => {
    if (mapReady) displayMarkers(displayPlaces);
  }, [displayPlaces, mapReady]);

  // 추천하기
  const handleRecommend = async (placeId: string) => {
    if (hasRecommended(placeId)) return;
    await recommendPlace(placeId);
  };

  // 등록 모달 열기
  const openRegister = () => {
    setShowRegister(true);
    setRegStep('category');
    setRegFoodType('');
    setRegKeyword('');
    setRegResults([]);
  };

  // 카테고리 선택 후 검색 단계로
  const selectRegCategory = (code: string) => {
    setRegFoodType(code);
    setRegStep('search');
    setRegKeyword('');
    setRegResults([]);
  };

  // 키워드 검색
  const doRegSearch = async () => {
    if (!regKeyword.trim()) return;
    setRegSearching(true);
    const results = await searchKakaoPlaces(
      regKeyword, selectedOffice.lat, selectedOffice.lng,
    );
    setRegResults(results);
    setRegSearching(false);
    setRegStep('results');
  };

  // 검색 결과에서 선택 → Firebase 등록
  const selectRegPlace = async (r: any) => {
    await registerPlace({
      kakaoId: r.id,
      name: r.place_name,
      category: r.category_name?.split('>').pop()?.trim() || '',
      foodType: regFoodType,
      phone: r.phone || '',
      address: r.road_address_name || r.address_name || '',
      lat: parseFloat(r.y),
      lng: parseFloat(r.x),
      url: r.place_url || '',
      office: selectedOffice.shortName,
    });
    setShowRegister(false);
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo"><img src="/icon-header.svg" alt="UPmap" className="logo-icon" /> UPmap</h1>
      </header>

      <div className="controls">
        <div className="office-tabs">
          {OFFICES.map(office => (
            <button
              key={office.shortName}
              className={`tab ${selectedOffice.shortName === office.shortName ? 'active' : ''}`}
              onClick={() => { setSelectedOffice(office); if (selectedCategory === 'model') setSelectedCategory('all'); }}
            >
              {office.shortName}
            </button>
          ))}
          <button
            className={`tab model-tab ${selectedCategory === 'model' ? 'active' : ''}`}
            onClick={() => setSelectedCategory(selectedCategory === 'model' ? 'all' : 'model')}
          >
            🏅 {selectedOffice.shortName === '마곡' ? '강서구' : selectedOffice.shortName === '상암' ? '마포구' : '용산구'} 모범음식점
          </button>
        </div>
        <div className="category-tabs">
          <div className="filter-row">
            {FOOD_CATEGORIES.filter(c => c.type === 'food').map(cat => (
              <button
                key={cat.code}
                className={`chip ${selectedCategory === cat.code ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.code)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="content">
        <div className="map-container" ref={mapRef} />

        <div className="list-panel">
          <div className="list-header">
            <span className="result-count">
              {loading ? '불러오는 중...' : `${displayPlaces.length}개 맛집`}
            </span>
            {!isAutoCategory && (
              <button className="register-btn" onClick={openRegister}>+ 맛집 등록</button>
            )}
          </div>

          <ul className="place-list">
            {displayPlaces.map(place => {
              const badges = isAutoCategory ? [] : getBadges(place.name, place.lat, place.lng);
              const recommended = hasRecommended(place.id);
              return (
                <li key={place.id} className="place-item">
                  <div className="place-info">
                    <div className="place-name">
                      {place.url ? (
                        <a href={place.url} target="_blank" rel="noopener noreferrer">{place.name}</a>
                      ) : (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            const newWin = window.open('about:blank', '_blank');
                            const ps = new kakao.maps.services.Places();
                            ps.keywordSearch(place.name, (result: any[], status: any) => {
                              const url = (status === kakao.maps.services.Status.OK && result[0]?.place_url)
                                ? result[0].place_url
                                : `https://map.kakao.com/?q=${encodeURIComponent(place.name)}`;
                              if (newWin) newWin.location.href = url;
                            }, { location: new kakao.maps.LatLng(place.lat, place.lng), radius: 1000, size: 1 });
                          }}
                        >{place.name}</a>
                      )}
                      {!isAutoCategory && (
                        <div className="place-actions">
                          <button
                            className={`recommend-btn ${recommended ? 'done' : ''}`}
                            onClick={() => handleRecommend(place.id)}
                            disabled={recommended}
                          >
                            👍 {place.recommends || ''}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="place-category">{place.category}</div>
                    {(place as any).mainMenu && (
                      <div className="place-menu">🍽️ {(place as any).mainMenu}</div>
                    )}
                    {badges.length > 0 && (
                      <div className="place-badges">
                        {badges.map(b => <span key={b} className="badge">{b}</span>)}
                      </div>
                    )}
                    <div className="place-address">{place.address}</div>
                    {place.phone && <div className="place-phone">📞 {place.phone}</div>}
                  </div>
                </li>
              );
            })}
            {!loading && displayPlaces.length === 0 && (
              <li className="empty">
                {isAutoCategory
                  ? '해당 공공데이터가 없습니다'
                  : <>아직 등록된 맛집이 없어요<br />
                    <span style={{ fontSize: 12, color: '#8b949e' }}>+ 맛집 등록으로 첫 추천을 남겨보세요</span></>
                }
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* 등록 모달 */}
      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>맛집 등록</h2>
              <button className="modal-close" onClick={() => setShowRegister(false)}>✕</button>
            </div>

            {regStep === 'category' && (
              <div className="modal-body">
                <p className="modal-desc">음식 종류를 선택하세요</p>
                <div className="reg-categories">
                  {FOOD_CATEGORIES.filter(c => c.type === 'food' && c.code !== 'all').map(cat => (
                    <button
                      key={cat.code}
                      className="reg-cat-btn"
                      onClick={() => selectRegCategory(cat.code)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {regStep === 'search' && (
              <div className="modal-body">
                <p className="modal-desc">상호명을 검색하세요</p>
                <div className="reg-search-row">
                  <input
                    className="reg-input"
                    placeholder="예: 스타벅스 마곡점"
                    value={regKeyword}
                    onChange={e => setRegKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doRegSearch()}
                    autoFocus
                  />
                  <button className="reg-search-btn" onClick={doRegSearch} disabled={regSearching}>
                    {regSearching ? '...' : '검색'}
                  </button>
                </div>
                <button className="reg-back" onClick={() => setRegStep('category')}>← 카테고리 다시 선택</button>
              </div>
            )}

            {regStep === 'results' && (
              <div className="modal-body">
                <p className="modal-desc">등록할 가게를 선택하세요</p>
                {regResults.length === 0 ? (
                  <p className="modal-empty">검색 결과가 없습니다</p>
                ) : (
                  <ul className="reg-results">
                    {regResults.map((r: any) => (
                      <li key={r.id} className="reg-result-item" onClick={() => selectRegPlace(r)}>
                        <div className="reg-result-name">{r.place_name}</div>
                        <div className="reg-result-addr">{r.road_address_name || r.address_name}</div>
                        <div className="reg-result-cat">{r.category_name?.split('>').pop()?.trim()}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <button className="reg-back" onClick={() => setRegStep('search')}>← 다시 검색</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
