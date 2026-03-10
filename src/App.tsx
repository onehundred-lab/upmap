import { useState, useEffect, useRef, useCallback } from 'react';
import { OFFICES, FOOD_CATEGORIES } from './config';
import type { Office } from './config';
import { fetchGovStores, fetchCheapStores, fetchCertStores, fetchModelRestaurants, fetchFdaModelStores } from './services/publicData';
import type { GovStore, CheapStore, CertStore, ModelRestaurant, FdaModelStore } from './services/publicData';
import {
  hasRecommended, recommendPlace, registerPlace,
  listenPlaces, searchKakaoPlaces,
} from './services/recommend';
import type { RegisteredPlace } from './services/recommend';
import { submitInquiry, listenInquiries, deleteInquiry } from './services/inquiry';
import type { Inquiry } from './services/inquiry';
import { addTip, listenTips } from './services/tips';
import type { Tip } from './services/tips';
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
  const [fdaModelStores, setFdaModelStores] = useState<FdaModelStore[]>([]);

  // 등록 모달
  const [showRegister, setShowRegister] = useState(false);
  const [regStep, setRegStep] = useState<'category' | 'search' | 'results'>('category');
  const [regFoodType, setRegFoodType] = useState('');
  const [regKeyword, setRegKeyword] = useState('');
  const [regResults, setRegResults] = useState<any[]>([]);
  const [regSearching, setRegSearching] = useState(false);

  // 문의하기
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [inquiryPw, setInquiryPw] = useState('');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiryUnlocked, setInquiryUnlocked] = useState(false);

  // 꿀팁
  const [openTipId, setOpenTipId] = useState<string | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [tipText, setTipText] = useState('');
  const tipUnsubRef = useRef<(() => void) | null>(null);

  // 공공데이터 로드
  useEffect(() => {
    fetchGovStores(selectedOffice.lat, selectedOffice.lng, 1000).then(setGovStores);
    fetchCheapStores().then(setCheapStores);
    fetchCertStores().then(setCertStores);
    fetchModelRestaurants(selectedOffice.shortName).then(setModelRestaurants);
    fetchFdaModelStores(selectedOffice.shortName).then(setFdaModelStores);
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
    if (govMatch) {} // badges.push('🏛️ 정부등록') - 보류

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

    // 식약처 모범음식점
    const fdaMatch = fdaModelStores.find(f => {
      const n1 = name.replace(/\s/g, '');
      const n2 = f.name.replace(/\s/g, '');
      return n1.includes(n2) || n2.includes(n1);
    });
    if (fdaMatch) badges.push('🏆 식약처모범');

    return badges;
  }, [govStores, cheapStores, certStores, modelRestaurants, fdaModelStores]);

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
            content: `<div style="padding:10px 30px 10px 12px;font-size:13px;min-width:180px;max-width:260px;color:#e6edf3;background:#0d1117;border:1px solid #30363d;border-radius:8px;position:relative;word-break:keep-all;">
              <span onclick="window.__closeIW && window.__closeIW()" style="position:absolute;top:4px;right:8px;cursor:pointer;font-size:15px;color:#8b949e;line-height:1;">✕</span>
              ${link ? `<a href="${link}" target="_blank" rel="noopener" style="color:#ccff00;font-weight:700;text-decoration:underline;text-underline-offset:3px;">${place.name}</a>` : `<strong style="color:#ccff00;">${place.name}</strong>`}<br/>
              <span style="color:#f0860a;font-size:11px;">${place.category}</span><br/>
              ${place.phone ? `<a href="tel:${place.phone}" style="font-size:11px;color:#58a6ff;text-decoration:underline;">📞 ${place.phone}</a>` : ''}
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
    if (infoWindowRef.current) { infoWindowRef.current.close(); infoWindowRef.current = null; }
    if (mapReady) displayMarkers(displayPlaces);
  }, [displayPlaces, mapReady]);

  // 추천하기
  const handleRecommend = async (placeId: string) => {
    if (hasRecommended(placeId)) return;
    await recommendPlace(placeId);
  };

  const toggleTip = (placeId: string) => {
    if (openTipId === placeId) {
      setOpenTipId(null);
      setTips([]);
      setTipText('');
      if (tipUnsubRef.current) { tipUnsubRef.current(); tipUnsubRef.current = null; }
    } else {
      if (tipUnsubRef.current) tipUnsubRef.current();
      setOpenTipId(placeId);
      setTipText('');
      tipUnsubRef.current = listenTips(placeId, setTips);
    }
  };

  const [tipSubmitting, setTipSubmitting] = useState(false);

  const submitTip = async (placeId: string) => {
    if (!tipText.trim() || tipSubmitting) return;
    setTipSubmitting(true);
    await addTip(placeId, tipText.trim());
    setTipText('');
    setTipSubmitting(false);
  };

  // 등록 모달 열기
  const openRegister = () => {
    setShowRegister(true);
    const currentFood = FOOD_CATEGORIES.find(c => c.type === 'food' && c.code !== 'all' && c.code === selectedCategory);
    if (currentFood) {
      setRegFoodType(currentFood.code);
      setRegStep('search');
    } else {
      setRegStep('category');
      setRegFoodType('');
    }
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
        <button className="inquiry-btn" onClick={() => setShowInquiry(true)}>💬 문의</button>
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
                          <button
                            className={`tip-btn ${openTipId === place.id ? 'active' : ''}`}
                            onClick={() => toggleTip(place.id)}
                          >
                            🍯 꿀팁
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="place-category-row">
                      <span className="place-category">{place.category}</span>
                      {badges.length > 0 && (
                        <div className="place-badges">
                          {badges.map(b => <span key={b} className="badge">{b}</span>)}
                        </div>
                      )}
                    </div>
                    {(place as any).mainMenu && (
                      <div className="place-menu">🍽️ {(place as any).mainMenu}</div>
                    )}
                    <div className="place-address">{place.address}</div>
                    {place.phone && <div className="place-phone"><a href={`tel:${place.phone}`}>📞 {place.phone}</a></div>}
                    {openTipId === place.id && (
                      <div className="tip-section">
                        <div className="tip-input-row">
                          <input
                            className="tip-input"
                            placeholder="꿀팁을 남겨보세요"
                            value={tipText}
                            onChange={e => setTipText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && submitTip(place.id)}
                          />
                          <button className="tip-submit" onClick={() => submitTip(place.id)} disabled={tipSubmitting}>{tipSubmitting ? '...' : '등록'}</button>
                        </div>
                        <ul className="tip-list">
                          {tips.map(t => (
                            <li key={t.id} className="tip-item">
                              <span className="tip-text">🍯 {t.text}</span>
                              <span className="tip-date">{new Date(t.createdAt).toLocaleDateString('ko-KR')}</span>
                            </li>
                          ))}
                          {tips.length === 0 && <li className="tip-empty">아직 꿀팁이 없어요. 첫 꿀팁을 남겨보세요!</li>}
                        </ul>
                      </div>
                    )}
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
      {/* 문의하기 모달 */}
      {showInquiry && (
        <div className="modal-overlay" onClick={() => { setShowInquiry(false); setInquiryUnlocked(false); setInquiryPw(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💬 문의하기</h2>
              <button className="modal-close" onClick={() => { setShowInquiry(false); setInquiryUnlocked(false); setInquiryPw(''); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="inquiry-form">
                <textarea
                  className="inquiry-input"
                  placeholder="문의 내용을 입력하세요"
                  value={inquiryText}
                  onChange={e => setInquiryText(e.target.value)}
                  rows={3}
                />
                <button
                  className="inquiry-submit"
                  onClick={async () => {
                    if (!inquiryText.trim()) return;
                    await submitInquiry(inquiryText.trim());
                    setInquiryText('');
                  }}
                >보내기</button>
              </div>
              <div className="inquiry-admin">
                {!inquiryUnlocked ? (
                  <div className="inquiry-pw-row">
                    <span className="inquiry-pw-label">📋 문의 확인</span>
                    <input
                      className="inquiry-pw"
                      type="password"
                      placeholder="비밀번호 입력"
                      value={inquiryPw}
                      onChange={e => setInquiryPw(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && inquiryPw === '8821') { setInquiryUnlocked(true); const unsub = listenInquiries(setInquiries); (window as any).__inquiryUnsub = unsub; } }}
                    />
                    <button className="inquiry-pw-btn" onClick={() => { if (inquiryPw === '8821') { setInquiryUnlocked(true); const unsub = listenInquiries(setInquiries); (window as any).__inquiryUnsub = unsub; } }}>확인</button>
                  </div>
                ) : (
                  <ul className="inquiry-list">
                    {inquiries.map(inq => (
                      <li key={inq.id} className="inquiry-item">
                        <div className="inquiry-item-text">{inq.text}</div>
                        <div className="inquiry-item-meta">
                          <span>{new Date(inq.createdAt).toLocaleString('ko-KR')}</span>
                          <button className="inquiry-del" onClick={() => deleteInquiry(inq.id)}>삭제</button>
                        </div>
                      </li>
                    ))}
                    {inquiries.length === 0 && <li className="inquiry-empty">문의 내역이 없습니다</li>}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
