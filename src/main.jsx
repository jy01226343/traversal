import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Camera, Check, Compass, Menu, MoveRight, Plane, Play, Plus, Route, Save, Share2, Sparkles, TicketCheck, UserRound, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './tailwind.css';
import './style.css';
import './world.css';
import './globe.css';
import './earth3d.css';
import './exploration.css';
import './region.css';
import './flat-map.css';
import './passport.css';
import './seasonal.css';
import './features/attraction-explorer/attraction-explorer.css';
import { GlobeWeather } from './components/ui/cobe-globe-weather';
import { FlatAtlasMap } from './components/ui/flat-atlas-map';
import { CardFanCarousel } from './components/ui/card-fan-carousel';
import { COUNTRIES_BY_CONTINENT, findCountry, getRegionsForCountry } from './data/destinations';
import { PASSPORT_OPTIONS } from './data/passports';
import { getDestinationKey, getSeasonForDate, getSeasonalRecommendations, MONTH_NAMES, SEASON_CONTINENTS, SEASONAL_RECOMMENDATIONS, TRAVEL_SEASONS } from './data/seasonal-recommendations';
import { getUnlockProfile } from './data/unlock-destinations';
import { fanStatusFromMeta, loadMastered, loadWishlist, resolveDestinationStatus, saveMastered, saveWishlist, toggleId } from './data/destination-status';
import { destinationFromRegion, regionKeyFromWishId, resolveWishlistItem } from './data/wishlist-destinations';
import { GLOBE_LAYERS, buildDestinationBeacons, filterBeaconsByLayers } from './data/beacons';
import { AttractionExplorerPanel, resolveAttractions, selectAttractions } from './features/attraction-explorer';
import { filterAttractionsByExperiences, toggleExperience } from './features/attraction-explorer/manual-filters';
import { AttractionComparePanel } from './features/attraction-explorer/AttractionComparePanel';
import { toggleComparedAttraction } from './features/attraction-explorer/comparison';
import { OFFICIAL_ATTRACTIONS } from './features/attraction-explorer/official-attractions';
import { syncLiveWeather } from './lib/weather-sync';
import { resolveHomeMode } from './features/explore/home-mode';
import { getDestinationPrimaryAction, getDestinationStatusLabel, lifecycleFromProgressState } from './features/explore/destination-presentation';
import { resolveGlobeQuality } from './features/explore/performance';
import { createJourney, createJourneyStop, fetchHomeContext, fetchJourneyStops, saveFirstVisit, updateJourney } from './features/explore/home-context';
import { GlobalAtmosphereSyncPanel } from './features/explore/GlobalAtmosphereSyncPanel';
import { DestinationLivePanel } from './features/live-data/DestinationLivePanel';
import { AtlasSearchOverlay } from './features/search/AtlasSearchOverlay';
import { buildAtlasSearchIndex, dedupeRecentSearches } from './features/search/search-index';
import { MobileAtlasShell } from './features/mobile-explore/MobileAtlasShell';
import { enqueueOfflineAction, getCameraBottomPadding, loadMobileViewState, readOfflineActions, removeOfflineAction, resolveInitialDetent, resolveMobileBackAction, resolveSheetHeight, saveMobileViewState } from './features/mobile-explore/mobile-state';
import './features/explore/explore-ui.css';

const photos = [
  { name: '雪国的第一束光', place: '留寿都 · 42.861° N', image: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=600&q=85', className: 'photo-a' },
  { name: '湖边的午餐', place: '洞爷湖 · 42.604° N', image: 'https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=600&q=85', className: 'photo-b' },
  { name: '小樽的蓝调时刻', place: '小樽 · 43.190° N', image: 'https://images.unsplash.com/photo-1516406742981-0f59b3d66c6c?auto=format&fit=crop&w=600&q=85', className: 'photo-c' }
];

function App() {
  const [selected, setSelected] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
  const [mobileDetent, setMobileDetent] = useState(() => resolveInitialDetent({ entry: 'home' }));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileMapCommand, setMobileMapCommand] = useState(null);
  const [mobileLocationStatus, setMobileLocationStatus] = useState('idle');
  const [globeQualityPreference, setGlobeQualityPreference] = useState(() => {
    try { const value = localStorage.getItem('atlas-globe-quality'); return ['auto', 'high', 'standard', 'low'].includes(value) ? value : 'auto'; } catch { return 'auto'; }
  });
  const [motionPreference, setMotionPreference] = useState(() => {
    try { return localStorage.getItem('atlas-motion-preference') === 'reduce' ? 'reduce' : 'system'; } catch { return 'system'; }
  });
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearchIds, setRecentSearchIds] = useState(() => {
    try { const value = JSON.parse(localStorage.getItem('atlas-recent-searches') || '[]'); return Array.isArray(value) ? value.slice(0, 3).map(String) : []; } catch { return []; }
  });
  const [continent, setContinent] = useState('亚洲');
  const [mapLevel, setMapLevel] = useState('world');
  const [activeCountry, setActiveCountry] = useState(null);
  const [activeRegion, setActiveRegion] = useState(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [worldHandoff, setWorldHandoff] = useState(null);
  const handoffTimer = React.useRef(null);
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('atlas-passport-profile') || 'null'); } catch { return null; }
  });
  const [isFirstVisit, setIsFirstVisit] = useState(() => {
    try { return localStorage.getItem('atlas-explore-welcomed') !== '1'; } catch { return true; }
  });
  const [homeContext, setHomeContext] = useState({ loading: true, data: null, error: null });
  const [journeyDialogOpen, setJourneyDialogOpen] = useState(false);
  const [journeyDialogMode, setJourneyDialogMode] = useState('create');
  const [journeyDraft, setJourneyDraft] = useState({ id: '', name: '', destinationLabel: '', departureAt: '', status: 'planning', preparedness: 0, pendingItemCount: 0 });
  const [journeyStops, setJourneyStops] = useState([]);
  const [pendingJourneyStop, setPendingJourneyStop] = useState(null);
  const [journeySaving, setJourneySaving] = useState(false);
  const [journeyError, setJourneyError] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileStage, setProfileStage] = useState('form');
  const [profileDraft, setProfileDraft] = useState(profile?.code || 'CHN');
  const [unlockDraft, setUnlockDraft] = useState({});
  const [unlockSaved, setUnlockSaved] = useState({});
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [pendingUnlockNavigation, setPendingUnlockNavigation] = useState(null);
  const [preparedDestinationKeys, setPreparedDestinationKeys] = useState(() => {
    const defaults = [];
    try { return [...new Set([...defaults, ...JSON.parse(localStorage.getItem('atlas-prepared-destinations') || localStorage.getItem('atlas-unlocked-regions') || '[]')])]; } catch { return defaults; }
  });
  const [wishlist, setWishlist] = useState(() => loadWishlist());
  const [mastered, setMastered] = useState(() => loadMastered());
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [wishlistIndex, setWishlistIndex] = useState(0);
  /** When unlock modal was opened from wishlist, closing unlock restores wishlist */
  const [unlockFromWishlist, setUnlockFromWishlist] = useState(false);
  const [globeLayers, setGlobeLayers] = useState(['recommend', 'footprint']);
  const [routeFlight, setRouteFlight] = useState(null);
  const [unlockToast, setUnlockToast] = useState(null);
  const calendarNow = React.useMemo(() => new Date(), []);
  const [weather, setWeather] = useState({ loading: false, result: null, error: null });
  React.useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return undefined;
    const sync = () => setSystemReducedMotion(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  React.useEffect(() => { try { localStorage.setItem('atlas-globe-quality', globeQualityPreference); localStorage.setItem('atlas-motion-preference', motionPreference); } catch { /* private mode */ } }, [globeQualityPreference, motionPreference]);
  const syncWeather = React.useCallback(async () => {
    setWeather(w => ({ ...w, loading: true, error: null }));
    try {
      const res = await syncLiveWeather();
      setWeather({ loading: false, result: res, error: res.ok ? null : res.message });
    } catch (e) {
      setWeather({ loading: false, result: null, error: e?.message || '同步失败' });
    }
  }, []);
  const refreshHomeContext = React.useCallback((signal) => fetchHomeContext(signal)
    .then(data => setHomeContext({ loading: false, data, error: null }))
    .catch(error => setHomeContext({ loading: false, data: null, error: error?.message || '首页数据暂不可用' })), []);
  React.useEffect(() => {
    const controller = new AbortController();
    refreshHomeContext(controller.signal);
    return () => controller.abort();
  }, [refreshHomeContext]);
  const activeJourney = homeContext.data?.activeJourney || null;
  React.useEffect(() => {
    const controller = new AbortController();
    if (!activeJourney?.id) { setJourneyStops([]); return () => controller.abort(); }
    fetchJourneyStops(activeJourney.id, controller.signal).then(setJourneyStops).catch(() => setJourneyStops([]));
    return () => controller.abort();
  }, [activeJourney?.id]);
  const homeMode = resolveHomeMode({
    isFirstVisit: homeContext.data?.isFirstVisit ?? isFirstVisit,
    activeJourney,
    departureThresholdHours: homeContext.data?.departureThresholdHours,
  });
  const departureStop = journeyStops[0] || null;
  const beginExploring = async () => {
    setIsFirstVisit(false);
    try { localStorage.setItem('atlas-explore-welcomed', '1'); } catch { /* private mode */ }
    try { setHomeContext({ loading: false, data: await saveFirstVisit(), error: null }); } catch { /* local fallback remains explicit in the UI */ }
    selectContinent(homeContinentName);
  };
  const openJourneyCreate = () => {
    setJourneyError(null);
    setJourneyDialogMode('create');
    setJourneyDraft({ id: '', name: '', destinationLabel: '', departureAt: '', status: 'planning', preparedness: 0, pendingItemCount: 0 });
    setJourneyDialogOpen(true);
  };
  const openJourneyEditor = () => {
    if (!activeJourney) return openJourneyCreate();
    setJourneyError(null);
    setJourneyDialogMode('edit');
    setJourneyDraft({
      id: activeJourney.id,
      name: activeJourney.name,
      destinationLabel: activeJourney.destinationLabel || '',
      departureAt: activeJourney.departureAt ? new Date(activeJourney.departureAt).toISOString().slice(0, 16) : '',
      status: activeJourney.status,
      preparedness: activeJourney.preparedness,
      pendingItemCount: activeJourney.pendingItemCount,
    });
    setJourneyDialogOpen(true);
  };
  const saveJourneyFromDialog = async event => {
    event.preventDefault();
    setJourneySaving(true);
    setJourneyError(null);
    try {
      if (journeyDialogMode === 'create') {
        const created = await createJourney({
          name: journeyDraft.name,
          destinationLabel: journeyDraft.destinationLabel || undefined,
          departureAt: journeyDraft.departureAt ? new Date(journeyDraft.departureAt).toISOString() : undefined,
        });
        if (pendingJourneyStop) {
          await createJourneyStop(created.id, pendingJourneyStop);
          setPendingJourneyStop(null);
          setUnlockToast(`${pendingJourneyStop.label} 已加入新 Journey`);
          window.setTimeout(() => setUnlockToast(null), 2200);
        }
      } else {
        await updateJourney(journeyDraft.id, {
          name: journeyDraft.name,
          destinationLabel: journeyDraft.destinationLabel || null,
          departureAt: journeyDraft.departureAt ? new Date(journeyDraft.departureAt).toISOString() : null,
          status: journeyDraft.status,
          preparedness: Number(journeyDraft.preparedness),
          pendingItemCount: Number(journeyDraft.pendingItemCount),
        });
      }
      setJourneyDialogOpen(false);
      setJourneyDraft({ id: '', name: '', destinationLabel: '', departureAt: '', status: 'planning', preparedness: 0, pendingItemCount: 0 });
      await refreshHomeContext();
    } catch (error) {
      setJourneyError(error?.message || '无法保存 Journey');
    } finally {
      setJourneySaving(false);
    }
  };
  React.useEffect(() => {
    const ac = new AbortController();
    syncWeather();
    return () => ac.abort();
  }, [syncWeather]);
  const [selectedSeason, setSelectedSeason] = useState(() => getSeasonForDate(calendarNow));
  const [seasonContinent, setSeasonContinent] = useState('全球');
  const [progressScope, setProgressScope] = useState('country');
  const [attractionPreference, setAttractionPreference] = useState('popular');
  const [attractionCategory, setAttractionCategory] = useState('全部');
  const [attractionExperiences, setAttractionExperiences] = useState([]);
  const [selectedAttractionId, setSelectedAttractionId] = useState(null);
  const [hoveredAttractionId, setHoveredAttractionId] = useState(null);
  const [comparedAttractionIds, setComparedAttractionIds] = useState([]);
  const [attractionMapView, setAttractionMapView] = useState({ zoom: 7.4 });
  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const sync = () => setMobileViewport(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const seasonalRecommendations = React.useMemo(() => getSeasonalRecommendations(selectedSeason, seasonContinent), [selectedSeason, seasonContinent]);
  const liveDate = `${String(calendarNow.getDate()).padStart(2, '0')} ${MONTH_NAMES[calendarNow.getMonth()]} ${calendarNow.getFullYear()}`;
  const CONTINENT_META = React.useMemo(() => ({
    '亚洲': ['1280', '35', '北海道雪景'],
    '欧洲': ['964', '02', '阿尔卑斯花季'],
    '大洋洲': ['218', '00', '塔斯曼海风'],
    '北美': ['742', '05', '落基山盛夏'],
    '南美': ['486', '00', '安第斯与亚马孙'],
    '非洲': ['612', '00', '撒哈拉与野生公园'],
  }), []);
  // Home passport continent / country first in ribbon + ranking
  const homePassport = profile || PASSPORT_OPTIONS.find(item => item.code === 'CHN');
  const homeContinentName = homePassport?.continent || '亚洲';
  const homeCountryCode = homePassport?.code || 'CHN';
  const orderedContinentNames = React.useMemo(() => {
    const names = Object.keys(CONTINENT_META);
    return [homeContinentName, ...names.filter(name => name !== homeContinentName)].filter(name => CONTINENT_META[name]);
  }, [homeContinentName, CONTINENT_META]);
  const continents = React.useMemo(() => {
    const ordered = {};
    orderedContinentNames.forEach(name => { ordered[name] = CONTINENT_META[name]; });
    return ordered;
  }, [orderedContinentNames, CONTINENT_META]);
  React.useEffect(() => setProgressScope('country'), [profile?.code]);
  // Align default continent with passport when identity changes
  React.useEffect(() => {
    if (homeContinentName && CONTINENT_META[homeContinentName]) {
      setContinent(homeContinentName);
    }
  }, [homeContinentName, CONTINENT_META]);
  const selectContinent = name => {
    if (worldHandoff || routeFlight) return;
    setContinent(name);
    setActiveCountry(null);
    setActiveRegion(null);
    setSelectedAttractionId(null);
    if (mobileViewport) { setMobileDetailOpen(false); setMobileDetent('browse'); }
    if (mapLevel === 'world') {
      setWorldHandoff(name);
      window.clearTimeout(handoffTimer.current);
      handoffTimer.current = window.setTimeout(() => {
        setMapLevel('continent');
        setWorldHandoff(null);
      }, 900);
    } else {
      setMapLevel('continent');
    }
  };
  const selectCountry = picked => {
    const known = findCountry(picked.code);
    setActiveCountry(known || { ...picked, tagline: '从地球上发现的目的地', season: '待探索', visited: false });
    setActiveRegion(null);
    setSelectedAttractionId(null);
    if (mobileViewport) { setMobileDetailOpen(false); setMobileDetent('browse'); }
    setMapLevel('country');
  };
  const selectRegion = region => {
    setActiveRegion(region);
    setSelectedAttractionId(null);
    setHoveredAttractionId(null);
    setComparedAttractionIds([]);
    setAttractionCategory('全部');
    setAttractionExperiences([]);
    setAttractionMapView({ zoom: 7.4 });
    if (mobileViewport) { setMobileDetailOpen(false); setMobileDetent('browse'); }
    setMapLevel('region');
  };
  const goBackMap = () => {
    if (mapLevel === 'region') {
      setSelectedAttractionId(null);
      setHoveredAttractionId(null);
      setActiveRegion(null);
      setMapLevel('country');
    } else if (mapLevel === 'country') {
      setActiveCountry(null);
      setMapLevel('continent');
    } else {
      setMapLevel('world');
    }
  };
  const runMobileMapCommand = type => setMobileMapCommand(command => ({ id: (command?.id || 0) + 1, type }));
  const requestMobileLocation = () => {
    if (!navigator.geolocation) {
      setMobileLocationStatus('unavailable');
      setUnlockToast('此浏览器不支持定位；你仍可继续浏览全部目的地。');
      window.setTimeout(() => setUnlockToast(null), 2600);
      return runMobileMapCommand('locate');
    }
    setMobileLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(() => {
      setMobileLocationStatus('granted');
      setUnlockToast('定位仅用于本次地图辅助，不会阻断探索。');
      window.setTimeout(() => setUnlockToast(null), 2200);
      runMobileMapCommand('locate');
    }, () => {
      setMobileLocationStatus('denied');
      setUnlockToast('未授予定位权限；已保留当前探索位置。');
      window.setTimeout(() => setUnlockToast(null), 2600);
    }, { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 });
  };
  const selectAttraction = item => {
    if (selectedAttractionId === item.id && mobileViewport) {
      setMobileDetailOpen(true);
      setMobileDetent('detail');
      return;
    }
    setSelectedAttractionId(item.id);
    setHoveredAttractionId(null);
    if (mobileViewport) {
      setMobileDetailOpen(false);
      setMobileDetent('browse');
    }
  };
  const clearMobileAttractionSelection = () => {
    clearAttractionSelection();
    setMobileDetailOpen(false);
    setMobileDetent('browse');
  };
  const handleMobileBack = () => {
    const action = resolveMobileBackAction({ filterOpen: mobileFilterOpen, detailOpen: mobileDetailOpen, selectedEntityId: selectedAttractionId, detent: mobileDetent, canNavigateUp: mapLevel !== 'world' });
    if (action === 'close_filter') return setMobileFilterOpen(false);
    if (action === 'close_detail') { setMobileDetailOpen(false); return setMobileDetent('browse'); }
    if (action === 'clear_selection') return clearMobileAttractionSelection();
    if (action === 'collapse_sheet') return setMobileDetent('peek');
    if (action === 'navigate_up') return goBackMap();
  };
  // Bug 1 fix: when user zooms out from region to below country threshold,
  // exit back to country level (restore sectors + region hotlist)
  const exitToCountry = () => {
    setSelectedAttractionId(null);
    setHoveredAttractionId(null);
    setActiveRegion(null);
    setMapLevel('country');
  };
  // Bug 3: when user zooms out from attraction detail, clear selection so
  // the list returns to attraction explorer panel (not detail view)
  const exitToRegionList = () => {
    setSelectedAttractionId(null);
  };
  // Country -> continent: zoom out below threshold exits to continent
  const exitToContinent = () => {
    setActiveCountry(null);
    setMapLevel('continent');
  };
  React.useEffect(() => () => window.clearTimeout(handoffTimer.current), []);
  const selectedPassport = PASSPORT_OPTIONS.find(item => item.code === profileDraft) || PASSPORT_OPTIONS[0];
  const openProfileSettings = () => {
    setProfileDraft(profile?.code || 'CHN');
    setProfileStage('form');
    setProfileOpen(true);
  };
  const persistProfile = nextProfile => {
    setProfile(nextProfile);
    localStorage.setItem('atlas-passport-profile', JSON.stringify(nextProfile));
  };
  const saveProfile = () => {
    if (profile) {
      persistProfile(selectedPassport);
      setProfileOpen(false);
      return;
    }
    setProfileStage('ceremony');
    window.setTimeout(() => persistProfile(selectedPassport), 1850);
    window.setTimeout(() => {
      setProfileOpen(false);
      setProfileStage('form');
    }, 3500);
  };
  const clearProfile = () => {
    setProfile(null);
    setProfileDraft('CHN');
    localStorage.removeItem('atlas-passport-profile');
    setProfileOpen(false);
  };
  // 未设定角色时与进度面板一致，默认以中国护照判定本国/免签
  const passportCode = profile?.code || 'CHN';
  /** 准备完成仅影响 Journey 状态，不影响目的地浏览。 */
  const isDestinationPrepared = destination => preparedDestinationKeys.includes(getDestinationKey(destination)) || preparedDestinationKeys.includes(destination.id);
  const getStatusForDestination = destination => resolveDestinationStatus({
    destination,
    unlockedKeys: preparedDestinationKeys,
    wishlistIds: wishlist,
    masteredIds: mastered,
    isInSeasonalList: seasonalRecommendations.some(item => item.id === destination.id),
    passportCode,
  });
  const toggleWishlist = destinationOrCard => {
    const id = destinationOrCard.id;
    const next = toggleId(wishlist, id);
    setWishlist(next);
    saveWishlist(next);
    if (!navigator.onLine) enqueueOfflineAction({ type: 'wishlist', payload: { id, wished: next.includes(id) } });
    setUnlockToast(next.includes(id) ? `${destinationOrCard.title || id} 已加入心愿单` : `${destinationOrCard.title || id} 已移出心愿单`);
    window.setTimeout(() => setUnlockToast(null), 2200);
  };
  React.useEffect(() => {
    const flushOfflineActions = () => {
      const queued = readOfflineActions();
      queued.forEach(action => removeOfflineAction(action.id));
      if (queued.length) {
        setUnlockToast(`${queued.length} 项离线操作已在本机同步。`);
        window.setTimeout(() => setUnlockToast(null), 2200);
      }
    };
    window.addEventListener('online', flushOfflineActions);
    return () => window.removeEventListener('online', flushOfflineActions);
  }, []);
  const markMastered = destination => {
    const key = getDestinationKey(destination);
    const next = [...new Set([...mastered, destination.id, key])];
    setMastered(next);
    saveMastered(next);
  };
  const navigateToDestination = destination => {
    const country = findCountry(destination.countryCode);
    if (!country) return;
    const destinationRegion = getRegionsForCountry(country).find(item => item.id === destination.regionId) || getRegionsForCountry(country)[0];
    setWorldHandoff(null);
    setRouteFlight(null);
    setWishlistOpen(false);
    setContinent(destination.continent);
    setActiveCountry(country);
    setActiveRegion(destinationRegion || null);
    setSelectedAttractionId(null);
    setAttractionCategory('全部');
    setAttractionMapView({ zoom: 7.4 });
    setMapLevel(destinationRegion ? 'region' : 'country');
    window.requestAnimationFrame(() => document.getElementById('top')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openDestinationUnlock = (destination, options = {}) => {
    const fromWishlist = Boolean(options.fromWishlist);
    const destinationProfile = getUnlockProfile(destination);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(`atlas-unlock-tasks:${destinationProfile.key}`) || '{}'); } catch { saved = {}; }
    setUnlockTarget(destination);
    setUnlockDraft(saved);
    setUnlockSaved(saved);
    setUnlockFromWishlist(fromWishlist);
    setUnlockOpen(true);
    setWishlistOpen(false);
  };
  const closeUnlockModal = () => {
    setUnlockOpen(false);
    if (unlockFromWishlist) {
      setWishlistOpen(true);
      setUnlockFromWishlist(false);
    }
  };
  const resolveWishDestination = id => resolveWishlistItem(id, {
    findCountry,
    getRegionsForCountry,
    continentOf: countryItem => Object.entries(COUNTRIES_BY_CONTINENT).find(([, list]) => list.some(item => item.code === countryItem.code))?.[0] || '亚洲',
  });
  /** Browsing is never gated by a passport or preparation state. */
  const handleSeasonalDestination = card => {
    const destination = resolveWishDestination(card.id) || SEASONAL_RECOMMENDATIONS.find(item => item.id === card.id);
    if (!destination) return;
    navigateToDestination(destination);
  };
  const handleWishToggle = card => {
    const destination = resolveWishDestination(card.id) || SEASONAL_RECOMMENDATIONS.find(item => item.id === card.id);
    if (!destination) return;
    toggleWishlist(destination);
  };
  const handleMapRegionWish = regionItem => {
    if (!activeCountry) return;
    const destination = destinationFromRegion(activeCountry, regionItem, continent);
    toggleWishlist(destination);
  };
  const toFanCard = item => {
    const meta = getStatusForDestination(item);
    const lifecycle = lifecycleFromProgressState(meta.id);
    return {
      id: item.id,
      imgUrl: item.image,
      title: item.title,
      location: item.location,
      kicker: item.theme,
      summary: item.reason,
      status: fanStatusFromMeta(meta),
      statusLabel: `${getDestinationStatusLabel(lifecycle)} · ${getDestinationPrimaryAction(lifecycle)}`,
      sourceLabel: item.sourceLabel,
      wished: wishlist.includes(item.id),
    };
  };
  const seasonalFanCards = React.useMemo(
    () => seasonalRecommendations.map(toFanCard),
    [seasonalRecommendations, preparedDestinationKeys, wishlist, mastered, passportCode],
  );
  const wishlistDestinations = React.useMemo(
    () => wishlist.map(id => resolveWishDestination(id)).filter(Boolean),
    [wishlist, preparedDestinationKeys, passportCode],
  );
  const wishedRegionKeys = React.useMemo(() => {
    const keys = [];
    wishlist.forEach(id => {
      const key = regionKeyFromWishId(id);
      if (key) keys.push(key);
    });
    return keys;
  }, [wishlist]);
  const openWishlistBoard = () => {
    if (!wishlistDestinations.length) {
      setUnlockToast('心愿单为空 · 点当季 ♡ 收藏，或从地图地区详情加入心愿');
      window.setTimeout(() => setUnlockToast(null), 2400);
      return;
    }
    setWishlistIndex(0);
    setWishlistOpen(true);
  };
  React.useEffect(() => {
    if (wishlistIndex >= wishlistDestinations.length) {
      setWishlistIndex(Math.max(0, wishlistDestinations.length - 1));
    }
  }, [wishlistDestinations.length, wishlistIndex]);
  const activeWish = wishlistDestinations[wishlistIndex] || null;
  const activeWishPrepared = activeWish ? isDestinationPrepared(activeWish) : false;
  const wishlistPreparationCount = wishlistDestinations.filter(item => !isDestinationPrepared(item)).length;
  const globeBeacons = React.useMemo(() => {
    const all = buildDestinationBeacons({
      seasonalIds: seasonalRecommendations.map(item => item.id),
      unlockedKeys: preparedDestinationKeys,
      wishlistIds: wishlist,
      masteredIds: mastered,
      resolveStatus: getStatusForDestination,
    });
    return filterBeaconsByLayers(all, globeLayers);
  }, [seasonalRecommendations, preparedDestinationKeys, wishlist, mastered, globeLayers, passportCode]);
  const toggleGlobeLayer = layerId => {
    setGlobeLayers(current => {
      if (current.includes(layerId)) {
        if (current.length === 1) return current;
        return current.filter(item => item !== layerId);
      }
      return [...current, layerId];
    });
  };
  const handleBeaconSelect = beacon => {
    const destination = SEASONAL_RECOMMENDATIONS.find(item => item.id === beacon.id);
    if (!destination) return;
    handleSeasonalDestination({ id: destination.id });
  };
  const unlockDestinationProfile = unlockTarget ? getUnlockProfile(unlockTarget) : null;
  const unlockTasks = unlockDestinationProfile?.tasks || [];
  const toggleUnlockTask = id => {
    setUnlockDraft(current => ({ ...current, [id]: !current[id] }));
  };
  const unlockProgress = unlockTasks.length ? Math.round(unlockTasks.filter(task => unlockDraft[task.id]).length / unlockTasks.length * 100) : 0;
  const unlockComplete = unlockTasks.length > 0 && unlockTasks.every(task => unlockDraft[task.id]);
  const unlockReady = unlockComplete && unlockTasks.every(task => unlockSaved[task.id]);
  const saveUnlockProgress = () => {
    if (!unlockDestinationProfile) return;
    const snapshot = { ...unlockDraft };
    setUnlockSaved(snapshot);
    localStorage.setItem(`atlas-unlock-tasks:${unlockDestinationProfile.key}`, JSON.stringify(snapshot));
  };
  const resetUnlockProgress = () => {
    setUnlockDraft({});
    setUnlockSaved({});
    if (unlockDestinationProfile) localStorage.removeItem(`atlas-unlock-tasks:${unlockDestinationProfile.key}`);
  };
  const previewPreparedJourney = () => {
    if (!unlockTarget || !unlockDestinationProfile) return;
    const destinationKey = getDestinationKey(unlockTarget);
    const nextPrepared = [...new Set([...preparedDestinationKeys, destinationKey])];
    setPreparedDestinationKeys(nextPrepared);
    localStorage.setItem('atlas-prepared-destinations', JSON.stringify(nextPrepared));
    window.clearTimeout(handoffTimer.current);
    setWorldHandoff(null);
    setUnlockOpen(false);
    setUnlockFromWishlist(false);
    setWishlistOpen(false);
    if (profile) {
      setActiveCountry(null);
      setActiveRegion(null);
      setContinent(unlockTarget.continent);
      setMapLevel('world');
      setPendingUnlockNavigation(unlockTarget);
      setRouteFlight({ id: Date.now(), from: { name: profile.country, focus: profile.focus }, to: { name: unlockDestinationProfile.name, focus: unlockDestinationProfile.focus } });
    } else navigateToDestination(unlockTarget);
  };
  const finishRouteFlight = () => {
    setRouteFlight(null);
    if (pendingUnlockNavigation) {
      const destination = pendingUnlockNavigation;
      setUnlockToast(destination.title);
      setPendingUnlockNavigation(null);
      window.setTimeout(() => navigateToDestination(destination), 260);
      window.setTimeout(() => setUnlockToast(null), 3200);
    }
  };
  const homeCountry = findCountry(profile?.code || 'CHN') || findCountry('CHN');
  const homeContinent = profile?.continent || '亚洲';
  const isRegionVisited = (countryItem, regionItem) => (
    regionItem.visited
    || mastered.includes(`${countryItem.code}:${regionItem.id}`)
  );
  const getCountryProgress = countryItem => {
    const countryRegions = getRegionsForCountry(countryItem);
    const visited = countryRegions.filter(regionItem => isRegionVisited(countryItem, regionItem)).length;
    return { visited, total: countryRegions.length, percent: countryRegions.length ? Math.round(visited / countryRegions.length * 100) : 0 };
  };
  const getContinentProgress = continentName => {
    const countryItems = COUNTRIES_BY_CONTINENT[continentName] || [];
    const totals = countryItems.map(getCountryProgress);
    const visited = totals.reduce((sum, item) => sum + item.visited, 0);
    const total = totals.reduce((sum, item) => sum + item.total, 0);
    return { visited, total, percent: total ? Math.round(visited / total * 100) : 0 };
  };
  const countryProgress = getCountryProgress(homeCountry);
  const continentProgress = getContinentProgress(homeContinent);
  const worldProgress = Object.keys(COUNTRIES_BY_CONTINENT).map(getContinentProgress).reduce((result, item) => ({ visited: result.visited + item.visited, total: result.total + item.total }), { visited: 0, total: 0 });
  worldProgress.percent = worldProgress.total ? Math.round(worldProgress.visited / worldProgress.total * 100) : 0;
  const continentNames = { '亚洲': 'ASIA', '欧洲': 'EUROPE', '大洋洲': 'OCEANIA', '北美': 'NORTH AMERICA', '南美': 'SOUTH AMERICA', '非洲': 'AFRICA' };
  const countryRows = getRegionsForCountry(homeCountry).map(regionItem => ({ label: regionItem.name, value: isRegionVisited(homeCountry, regionItem) ? '已到访' : '待探索', unlocked: isRegionVisited(homeCountry, regionItem) }));
  const continentRows = [...(COUNTRIES_BY_CONTINENT[homeContinent] || [])]
    .sort((a, b) => Number(b.code === homeCountry.code) - Number(a.code === homeCountry.code) || a.name.localeCompare(b.name, 'zh-CN'))
    .map(countryItem => ({ label: countryItem.name, value: `${getCountryProgress(countryItem).percent}%`, unlocked: getCountryProgress(countryItem).percent > 0 }));
  const worldRows = Object.keys(COUNTRIES_BY_CONTINENT).map(continentName => ({ label: continentName, value: `${getContinentProgress(continentName).percent}%`, unlocked: getContinentProgress(continentName).percent > 0 }));
  const progressData = {
    country: { eyebrow: 'HOME COUNTRY', title: homeCountry.name, ...countryProgress, rows: countryRows, next: `查看${homeContinent}进度` },
    continent: { eyebrow: `${continentNames[homeContinent] || homeContinent} EXPLORE`, title: homeContinent, ...continentProgress, rows: continentRows, next: '查看世界进度' },
    world: { eyebrow: 'WORLD EXPLORE', title: '世界', ...worldProgress, rows: worldRows, next: `返回${homeCountry.name}进度` },
  }[progressScope];
  /** progress-next 切换范围时，同步季节推荐大洲筛选与 fan 卡片数据 */
  const cycleProgressScope = () => {
    setProgressScope(current => {
      const next = current === 'country' ? 'continent' : current === 'continent' ? 'world' : 'country';
      if (next === 'world') setSeasonContinent('全球');
      else if (next === 'continent') setSeasonContinent(homeContinent);
      else setSeasonContinent(homeContinent);
      return next;
    });
  };
  // 护照/国籍变化导致 homeContinent 变化时，与当前进度范围对齐季节推荐
  React.useEffect(() => {
    if (progressScope === 'world') setSeasonContinent('全球');
    else setSeasonContinent(homeContinent);
  }, [homeContinent, progressScope]);
  const [regionAttractions, setRegionAttractions] = useState([]);
  React.useEffect(() => {
    let cancelled = false;
    if (!activeCountry?.code || !activeRegion?.id || mapLevel !== 'region') {
      setRegionAttractions([]);
      return undefined;
    }
    // Show fixed cache immediately if present, then refresh via API → scrape → seed → catalog
    try {
      const key = `${activeCountry.code}:${activeRegion.id}`;
      const raw = localStorage.getItem(`atlas-attractions-fixed-v2:${key}`)
        || localStorage.getItem(`atlas-attractions-api-v2:${key}`)
        || localStorage.getItem(`atlas-attractions-scrape-v2:${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.data) && parsed.data.length) setRegionAttractions(parsed.data);
      }
    } catch { /* ignore */ }
    resolveAttractions(activeCountry.code, activeRegion.id, { zoom: attractionMapView.zoom ?? 7.4 })
      .then(items => {
        if (cancelled) return;
        if (items?.length) setRegionAttractions(items);
        else console.warn('[attractions] empty after full pipeline', activeCountry.code, activeRegion.id);
      })
      .catch(error => {
        console.warn('[attractions] resolve failed', error);
        if (!cancelled) {
          /* keep any cached list already painted */
        }
      });
    return () => { cancelled = true; };
  }, [activeCountry?.code, activeRegion?.id, mapLevel]);
  const filteredRegionAttractions = React.useMemo(() => filterAttractionsByExperiences(regionAttractions, attractionExperiences), [regionAttractions, attractionExperiences]);
  const rankedAttractions = React.useMemo(() => selectAttractions(filteredRegionAttractions, { zoom: attractionMapView.zoom, bbox: attractionMapView.bounds, category: attractionCategory, preference: attractionPreference, limit: 10 }), [filteredRegionAttractions, attractionMapView, attractionCategory, attractionPreference]);
  const nichePreferenceUseful = React.useMemo(() => {
    const base = { zoom: attractionMapView.zoom, bbox: attractionMapView.bounds, category: attractionCategory, limit: 10 };
    const popular = selectAttractions(filteredRegionAttractions, { ...base, preference: 'popular' });
    const niche = selectAttractions(filteredRegionAttractions, { ...base, preference: 'niche' });
    if (!niche.length) return false;
    // Hide tab when niche list is empty of unique value vs popular (same ids + same order, and no alternative slots)
    const sameOrder = niche.length === popular.length && niche.every((item, index) => item.id === popular[index]?.id);
    if (sameOrder) return false;
    const popularMustIds = new Set(popular.filter(item => item.selection_kind === 'must').map(item => item.id));
    const nicheHasOutsideMust = niche.some(item => !popularMustIds.has(item.id));
    const popularHasAlt = popular.some(item => item.selection_kind === 'alternative');
    return nicheHasOutsideMust || popularHasAlt;
  }, [filteredRegionAttractions, attractionMapView, attractionCategory]);
  React.useEffect(() => {
    if (!nichePreferenceUseful && attractionPreference === 'niche') setAttractionPreference('popular');
  }, [nichePreferenceUseful, attractionPreference]);
  // Search can land on any known POI, including one outside the compact map subset.
  // Keep that entity visible and selected instead of silently dropping the deep link.
  const selectedAttraction = regionAttractions.find(item => item.id === selectedAttractionId) || rankedAttractions.find(item => item.id === selectedAttractionId) || null;
  const displayedAttractions = React.useMemo(() => {
    if (!selectedAttraction || rankedAttractions.some(item => item.id === selectedAttraction.id)) return rankedAttractions;
    return [selectedAttraction, ...rankedAttractions].slice(0, 10);
  }, [rankedAttractions, selectedAttraction]);
  const addSelectedAttractionToJourney = async () => {
    if (!selectedAttraction) return;
    const stop = { attractionId: selectedAttraction.id, label: selectedAttraction.name, latitude: selectedAttraction.lat_wgs84, longitude: selectedAttraction.lng_wgs84 };
    if (!activeJourney) {
      setPendingJourneyStop(stop);
      setJourneyDialogMode('create');
      setJourneyDraft({ id: '', name: `${selectedAttraction.name} 之旅`, destinationLabel: selectedAttraction.name, departureAt: '', status: 'planning', preparedness: 0, pendingItemCount: 0 });
      setJourneyDialogOpen(true);
      return;
    }
    try {
      const created = await createJourneyStop(activeJourney.id, stop);
      setJourneyStops(current => [...current, created]);
      setUnlockToast(`${selectedAttraction.name} 已加入 ${activeJourney.name}`);
      window.setTimeout(() => setUnlockToast(null), 2200);
    } catch (error) {
      setUnlockToast(error?.message || '无法加入 Journey');
      window.setTimeout(() => setUnlockToast(null), 2600);
    }
  };
  const clearAttractionSelection = () => {
    setSelectedAttractionId(null);
    setHoveredAttractionId(null);
    setAttractionMapView({ zoom: 7.4 });
  };
  const toggleAttractionComparison = id => setComparedAttractionIds(current => {
    const next = toggleComparedAttraction(current, id);
    if (next.length === current.length && !current.includes(id)) { setUnlockToast('最多可同时比较 3 个目的地'); window.setTimeout(() => setUnlockToast(null), 2200); }
    return next;
  });
  const comparedAttractions = React.useMemo(() => regionAttractions.filter(item => comparedAttractionIds.includes(item.id)), [regionAttractions, comparedAttractionIds]);
  const rankedCountries = React.useMemo(() => {
    const list = [...(COUNTRIES_BY_CONTINENT[continent] || [])];
    if (continent === homeContinentName && homeCountryCode) {
      list.sort((a, b) => {
        if (a.code === homeCountryCode) return -1;
        if (b.code === homeCountryCode) return 1;
        return 0;
      });
    }
    return list;
  }, [continent, homeContinentName, homeCountryCode]);
  const rankedRegions = React.useMemo(() => {
    const list = getRegionsForCountry(activeCountry);
    if (!activeCountry) return list;
    return list.map(item => ({ ...item, visited: isRegionVisited(activeCountry, item) }));
  }, [activeCountry?.code, mastered]);
  const mapBackLabel = mapLevel === 'region' ? `返回 ${activeCountry?.name}` : mapLevel === 'country' ? `返回 ${continent}` : '返回世界地球';
  const taxonomyTotal = React.useMemo(() => Object.values(COUNTRIES_BY_CONTINENT).flatMap(items => items).reduce((total, countryItem) => total + getRegionsForCountry(countryItem).length, 0), []);
  const visitedCount = React.useMemo(() => Object.values(COUNTRIES_BY_CONTINENT).flatMap(items => items).reduce((total, countryItem) => total + getRegionsForCountry(countryItem).filter(regionItem => regionItem.visited).length, 0), []);
  const searchIndex = React.useMemo(() => buildAtlasSearchIndex(COUNTRIES_BY_CONTINENT, getRegionsForCountry, OFFICIAL_ATTRACTIONS), []);
  const globeQuality = React.useMemo(() => resolveGlobeQuality(globeQualityPreference, navigator.deviceMemory, navigator.hardwareConcurrency), [globeQualityPreference]);
  const reducedMotion = motionPreference === 'reduce' || (motionPreference === 'system' && systemReducedMotion);
  const semanticFilterEnabled = import.meta.env.VITE_SEMANTIC_FILTER_ENABLED === 'true';
  const recentSearches = React.useMemo(() => recentSearchIds.map(id => searchIndex.find(item => item.id === id)).filter(Boolean), [recentSearchIds, searchIndex]);
  const openSearch = () => { setSearchQuery(''); setSearchOpen(true); };
  const selectSearchResult = item => {
    const nextRecent = dedupeRecentSearches(recentSearches, item);
    setRecentSearchIds(nextRecent.map(result => result.id));
    try { localStorage.setItem('atlas-recent-searches', JSON.stringify(nextRecent.map(result => result.id))); } catch { /* private mode */ }
    setContinent(item.continent);
    setActiveCountry(item.country);
    setActiveRegion(item.region || null);
    setSelectedAttractionId(item.attraction?.id || null);
    setHoveredAttractionId(null);
    setAttractionCategory('全部');
    setAttractionMapView({ zoom: 7.4 });
    setMapLevel(item.region ? 'region' : 'country');
    if (mobileViewport) { setMobileDetailOpen(false); setMobileDetent(resolveInitialDetent({ entry: 'search', selectedEntityId: item.attraction?.id || null })); }
    setSearchOpen(false);
    window.requestAnimationFrame(() => document.getElementById('top')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  React.useEffect(() => {
    const handleKeyDown = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recentSearches]);
  const mobileRouteKey = `${mapLevel}:${continent}:${activeCountry?.code || ''}:${activeRegion?.id || ''}`;
  React.useEffect(() => {
    if (!mobileViewport) return;
    const saved = loadMobileViewState(mobileRouteKey);
    setMobileFilterOpen(false);
    setMobileDetailOpen(false);
    setMobileDetent(saved?.detent || resolveInitialDetent({ entry: mapLevel === 'world' ? 'home' : mapLevel === 'region' ? 'region' : 'search', selectedEntityId: selectedAttractionId }));
    if (saved?.selectedEntityId && mapLevel === 'region') setSelectedAttractionId(saved.selectedEntityId);
  }, [mobileViewport, mobileRouteKey]);
  React.useEffect(() => {
    if (!mobileViewport) return;
    saveMobileViewState({ routeKey: mobileRouteKey, detent: mobileDetent, selectedEntityId: selectedAttractionId, focusedEntityId: hoveredAttractionId, comparedEntityIds: comparedAttractionIds, listScrollTop: 0, mapView: attractionMapView });
  }, [mobileViewport, mobileRouteKey, mobileDetent, selectedAttractionId, hoveredAttractionId, comparedAttractionIds, attractionMapView]);
  const mobileSheetHeight = typeof window === 'undefined' ? 0 : resolveSheetHeight(mobileDetent, { viewportWidth: window.visualViewport?.width || window.innerWidth, viewportHeight: window.visualViewport?.height || window.innerHeight, safeAreaTop: 0, safeAreaBottom: 0, keyboardHeight: Math.max(0, window.innerHeight - (window.visualViewport?.height || window.innerHeight)), fontScale: 1, hasStickyCta: Boolean(selectedAttraction || mapLevel === 'world') });
  const atlasStage = <div className={`globe-stage ${mapLevel !== 'world' ? 'flat-stage' : ''}`} aria-label={mapLevel === 'world' ? 'Interactive 3D world globe' : 'Interactive satellite map'}>
    {mapLevel === 'world' ? <><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="globe-shadow"/><GlobeWeather continent={continent} level="world" quality={globeQuality} reducedMotion={reducedMotion} routeFlight={routeFlight} onRouteFlightComplete={finishRouteFlight} beacons={globeBeacons} onBeaconSelect={handleBeaconSelect}/><div className="globe-label north">N<br/><span>◦</span></div><div className="globe-label south">S<br/><span>◦</span></div></> : <FlatAtlasMap continent={continent} level={mapLevel} country={activeCountry} region={activeRegion} regions={rankedRegions} attractions={displayedAttractions} selectedAttraction={selectedAttraction} hoveredAttractionId={hoveredAttractionId} comparedAttractionIds={comparedAttractionIds} journeyStops={journeyStops} wishedRegionKeys={wishedRegionKeys} onCountrySelect={selectCountry} onRegionSelect={selectRegion} onRegionWish={handleMapRegionWish} onAttractionSelect={selectAttraction} onAttractionHover={setHoveredAttractionId} onMapBlankClick={() => selectedAttraction && (mobileViewport ? clearMobileAttractionSelection() : clearAttractionSelection())} onMapViewChange={view => mapLevel === 'region' && setAttractionMapView(view)} onExitToCountry={exitToCountry} onExitToRegionList={exitToRegionList} onExitToContinent={exitToContinent} mapCommand={mobileViewport ? mobileMapCommand : null} cameraBottomPadding={mobileViewport ? getCameraBottomPadding(mobileDetent, mobileSheetHeight) : 0}/>} {/* map */}
    {worldHandoff && <div className="world-map-handoff"><i/><span>ORBITAL HANDOFF</span><b>{worldHandoff}</b><small>3D 地球 → 区域卷轴地图</small></div>}
  </div>;
  const mobileSheetContent = mapLevel === 'world' ? <section className="mobile-world-explore"><p>{homeMode === 'departure_soon' ? '即将出发，先查看你的目的地与准备进度。' : '选择一个大洲，地图会带你进入可继续探索的国家与地区。'}</p><div className="mobile-season-strip" aria-label="当季推荐">{seasonalFanCards.slice(0, 4).map(card => <article key={card.id}><button type="button" onClick={() => handleSeasonalDestination(card)}><img src={card.imgUrl} alt=""/><span>{card.kicker}</span><b>{card.title}</b><small>{card.location}</small></button></article>)}</div><div className="mobile-explore-grid">{orderedContinentNames.map(name => <button type="button" key={name} onClick={() => selectContinent(name)}><b>{name}</b><small>{continents[name]?.[2] || '旅行区域'}</small></button>)}</div></section> : mapLevel === 'continent' ? <aside className="country-ranking mobile-ranking"><div className="ranking-head"><span>REGIONAL EXPLORATION GUIDE</span><b>{continent}区域探索图鉴</b><small>选择国家继续查看地区与地点。</small></div><div className="ranking-list">{rankedCountries.map(countryItem => <button type="button" data-country={countryItem.code} onClick={() => selectCountry(countryItem)} key={countryItem.code}><span><b>{countryItem.name}</b><small>{countryItem.tagline}</small></span></button>)}</div></aside> : mapLevel === 'country' ? <aside className="country-ranking region-ranking mobile-ranking"><div className="ranking-head"><span>REGIONAL EXPLORATION GUIDE</span><b>{activeCountry?.name}区域探索图鉴</b><small>所有地区都可进入查看，建议状态不会限制访问。</small></div><div className="region-list">{rankedRegions.map(regionItem => <button type="button" data-region={regionItem.id} onClick={() => selectRegion(regionItem)} key={regionItem.id}><span className="region-copy"><b>{regionItem.name}</b><small>{regionItem.summary}</small></span><span className="footprint-state">{regionItem.visited ? '已到访' : '待探索'}</span></button>)}</div></aside> : <section className="mobile-region-explorer"><div className="mobile-region-toolbar"><button type="button" aria-expanded={mobileFilterOpen} onClick={() => setMobileFilterOpen(open => !open)}>筛选与偏好</button><span>{displayedAttractions.length} 个地点</span></div>{mobileFilterOpen && <div className="mobile-filter-popover"><button type="button" onClick={() => { setAttractionCategory('全部'); setAttractionExperiences([]); setMobileFilterOpen(false); }}>清除筛选</button><button type="button" onClick={() => { setAttractionPreference(value => value === 'popular' ? 'niche' : 'popular'); }}>切换{attractionPreference === 'popular' ? '小众' : '热门'}偏好</button></div>}<AttractionExplorerPanel items={displayedAttractions} total={filteredRegionAttractions.length} zoom={attractionMapView.zoom} preference={attractionPreference} category={attractionCategory} experiences={attractionExperiences} selectedId={selectedAttractionId} hoveredId={hoveredAttractionId} comparedIds={comparedAttractionIds} semanticFilterEnabled={semanticFilterEnabled} currentRegionId={activeRegion?.id || ''} showNicheToggle={nichePreferenceUseful} onPreferenceChange={value => { setSelectedAttractionId(null); setHoveredAttractionId(null); setAttractionPreference(value); }} onCategoryChange={value => { setSelectedAttractionId(null); setAttractionCategory(value); }} onExperienceToggle={value => { setSelectedAttractionId(null); setAttractionExperiences(current => toggleExperience(current, value)); }} onClearExperiences={() => { setSelectedAttractionId(null); setAttractionExperiences([]); }} onSelect={selectAttraction} onHoverChange={setHoveredAttractionId} onCompareToggle={toggleAttractionComparison} onClearSelection={clearMobileAttractionSelection} onBack={handleMobileBack} backLabel={`返回 ${activeCountry?.name || continent}地区`}/>{comparedAttractions.length > 1 && <AttractionComparePanel items={comparedAttractions} onRemove={toggleAttractionComparison}/>}</section>;
  const mobileResultCount = mapLevel === 'region' ? displayedAttractions.length : mapLevel === 'country' ? rankedRegions.length : mapLevel === 'continent' ? rankedCountries.length : orderedContinentNames.length;
  const mobileContextLabel = selectedAttraction?.name || activeRegion?.name || activeCountry?.name || continent || '世界探索';
  return <main className={reducedMotion ? 'motion-reduced' : ''}>
    <nav className="nav">
      <a className="logo" href="#top"><span>OUR</span> ATLAS<i /></a>
      <div className="navlinks">
        <a className="active" href="#top">探索世界</a><a href="#journey">旅行档案</a><a href="#stories">记忆链</a><a href="#guide">攻略手册</a>
      </div>
      <div className="navright"><button className="search" onClick={openSearch} aria-label="搜索国家、旅行区域或目的地"><Compass size={18}/></button>{profile ? <div className="passport-identity" style={{'--passport-mini': profile.color, '--passport-accent': profile.accent}}><span>{profile.emblem}<i>P</i></span><b>{profile.nationality}</b><button onClick={openProfileSettings}>更改</button></div> : <button className="character-setup" onClick={openProfileSettings}><UserRound size={15}/>角色设定</button>}<button className="new-trip" onClick={openJourneyCreate}><Plus size={16}/> 新建旅程</button><button className="mobile-menu" onClick={() => setMenu(true)}><Menu /></button></div>
    </nav>
    {menu && <div className="menu-overlay"><button onClick={() => setMenu(false)}><X/></button><a href="#journey">旅行档案</a><a href="#stories">时光拾遗</a><a href="#guide">攻略手册</a><a href="#gear">装备库</a></div>}
    <AtlasSearchOverlay open={searchOpen} query={searchQuery} items={searchIndex} recent={recentSearches} onQueryChange={setSearchQuery} onClose={() => setSearchOpen(false)} onSelect={selectSearchResult}/>

    <section className={`world-hero ${mapLevel !== 'world' ? 'regional-mode' : ''} ${mapLevel === 'country' || mapLevel === 'region' ? 'country-mode' : ''} ${mapLevel === 'region' ? 'region-mode' : ''} ${worldHandoff ? 'world-handoff' : ''} ${routeFlight ? 'route-flight-mode' : ''}`} id="top">
      <div className="world-noise"/>
      <div className="world-topline"><span><i/> LIVE ATMOSPHERE · {liveDate}</span><span>全球旅行环境演算</span></div>
      <div className="world-ribbon">{orderedContinentNames.map(name => { const info = continents[name]; return <button data-continent={name} disabled={Boolean(worldHandoff || routeFlight)} onClick={() => selectContinent(name)} className={`${continent === name && mapLevel !== 'world' ? 'ribbon-active' : ''} ${name === homeContinentName ? 'ribbon-home' : ''}`} key={name}><b>{name}</b><span><em>旅行区域</em><em>已到访</em></span><small>{info[2]}</small></button>; })}</div>
      {mapLevel === 'world' && !worldHandoff && !routeFlight && <aside className="globe-layer-dock" aria-label="地球图层">
        <span>LAYERS · 图层</span>
        {GLOBE_LAYERS.map(layer => <button type="button" key={layer.id} className={globeLayers.includes(layer.id) ? 'active' : ''} onClick={() => toggleGlobeLayer(layer.id)}><b>{layer.label}</b><small>{layer.hint}</small></button>)}
        <label className="globe-quality">地球性能<select value={globeQualityPreference} onChange={event => setGlobeQualityPreference(event.target.value)}><option value="auto">自动 · {globeQuality}</option><option value="high">高</option><option value="standard">标准</option><option value="low">低</option></select></label>
        <button type="button" className={reducedMotion ? 'active' : ''} onClick={() => setMotionPreference(reducedMotion ? 'system' : 'reduce')}><b>减弱动态</b><small>{reducedMotion ? '已开启' : '跟随系统'}</small></button>
      </aside>}
      <div className="world-title"><p>FAMILY ATLAS / WORLD EXPLORATION</p>{homeContext.loading ? <><h1>正在载入<br/>你的探索档案</h1><small>正在读取 Journey 与首页偏好。</small></> : homeMode === 'new_user' ? <><h1>从哪里开始<br/>探索？</h1><button className="button ink" onClick={beginExploring}>从亚洲开始探索</button></> : homeMode === 'departure_soon' ? <><h1>出发检查，<br/>现在开始。</h1><small>{activeJourney?.destinationLabel || '目的地'} · 准备度 {activeJourney?.preparedness ?? 0}% · 待确认 {activeJourney?.pendingItemCount ?? 0} 项</small><button className="button ink" onClick={openJourneyEditor}>更新出发清单</button></> : homeMode === 'active_journey' ? <><h1>{activeJourney?.name || '继续你的旅程'}</h1><small>准备度 {activeJourney?.preparedness ?? 0}% · 待确认 {activeJourney?.pendingItemCount ?? 0} 项</small><button className="button ink" onClick={openJourneyEditor}>继续规划</button></> : <><h1>世界仍然很大，<br/>今天从哪里开始？</h1><button className="button ink" onClick={beginExploring}>从亚洲开始探索</button>{homeContext.error && <small>首页服务暂不可用，正在使用本地探索偏好。</small>}</>}</div>
      {mapLevel !== 'world' && <div className="map-breadcrumb"><button onClick={() => { setSelectedAttractionId(null); setActiveCountry(null); setActiveRegion(null); setMapLevel('world'); }}>世界</button><i>/</i><button className={mapLevel === 'continent' ? 'current' : ''} onClick={() => { setSelectedAttractionId(null); setActiveCountry(null); setActiveRegion(null); setMapLevel('continent'); }}>{continent}</button>{activeCountry && <><i>/</i><button className={mapLevel === 'country' ? 'current' : ''} onClick={() => { setSelectedAttractionId(null); setActiveRegion(null); setMapLevel('country'); }}>{activeCountry.name}</button></>}{selectedAttraction ? <><i>/</i><b>{selectedAttraction.name}</b></> : activeRegion && <><i>/</i><b>{activeRegion.name}</b></>}</div>}
      {mobileViewport ? <MobileAtlasShell detent={mobileDetent} onDetentChange={(next) => { const detent = next === 'detail' && !selectedAttraction ? 'browse' : next; setMobileDetent(detent); setMobileDetailOpen(detent === 'detail' && Boolean(selectedAttraction)); }} levelLabel={mapLevel === 'world' ? 'WORLD EXPLORE' : mapLevel.toUpperCase()} contextLabel={mobileContextLabel} resultCount={mobileResultCount} selectedLabel={selectedAttraction?.name} onBack={handleMobileBack} onOpenSearch={openSearch} onOpenMenu={() => setMenu(true)} onOpenPath={() => setMobileDetent('browse')} onLocate={requestMobileLocation} onZoomIn={() => runMobileMapCommand('zoom_in')} onZoomOut={() => runMobileMapCommand('zoom_out')} onClearSelection={clearMobileAttractionSelection} onViewDetail={() => { setMobileDetailOpen(true); setMobileDetent('detail'); }} onPrimaryAction={selectedAttraction ? (activeJourney ? addSelectedAttractionToJourney : openJourneyCreate) : beginExploring} primaryActionLabel={selectedAttraction ? (activeJourney ? '加入 Journey' : '创建 Journey') : mapLevel === 'world' ? '开始探索' : null} syncLabel={weather.loading ? '正在同步旅行环境' : weather.error ? '离线缓存可用，稍后重试同步' : mobileLocationStatus === 'requesting' ? '正在请求定位权限' : mobileLocationStatus === 'denied' ? '定位已跳过，探索不受影响' : '地图与列表已同步'} stage={atlasStage} reducedMotion={reducedMotion}>{mobileSheetContent}</MobileAtlasShell> : atlasStage}
      {mapLevel === 'world' && !worldHandoff && !routeFlight && <GlobalAtmosphereSyncPanel loading={weather.loading} updatedAt={weather.result?.syncedAt} source={weather.result?.source === 'live' ? 'Open-Meteo 气象模型' : weather.result ? '月度气候档案' : null} onSync={syncWeather} reducedMotion={reducedMotion}/>}
      {mapLevel === 'world' && homeMode === 'departure_soon' && departureStop && <DestinationLivePanel destination={{ id: departureStop.id, name: departureStop.label, lat_wgs84: departureStop.latitude, lng_wgs84: departureStop.longitude }}/>} {/* departure */}
      {mapLevel !== 'world' && <aside className="map-level-panel"><span>YOU ARE EXPLORING</span><div className="level-path"><small>{selectedAttraction ? `${selectedAttraction.category_l1} · ${selectedAttraction.category_l2}` : continent}</small><b>{selectedAttraction?.name || activeRegion?.name || activeCountry?.name || '国家地图'}</b><em>{selectedAttraction ? '已定位真实 WGS-84 坐标，周边锚点仍可继续点击' : mapLevel === 'region' ? '景点锚点与精选列表双向联动' : mapLevel === 'country' ? '省州边界与地区探索图鉴' : '国界与国家探索图鉴'}</em></div>{activeRegion && !selectedAttraction && <div className="level-resources">{activeRegion.resources.map(item => <i key={item.type}>{item.type}</i>)}</div>}</aside>}
      {mapLevel === 'continent' && <aside className="country-ranking">
        <button className="ranking-back" onClick={goBackMap} aria-label={mapBackLabel}><span>←</span><b>{mapBackLabel}</b></button>
        <div className="ranking-head"><span>REGIONAL EXPLORATION GUIDE</span><b>{continent}区域探索图鉴</b><small>{mapLevel === 'country' ? `正在查看 ${activeCountry?.name || ''}` : '选择国家继续俯冲探索'}</small></div>
        <div className="ranking-list">{rankedCountries.map(countryItem => <button data-country={countryItem.code} className={`${activeCountry?.code === countryItem.code ? 'selected' : ''} ${countryItem.code === homeCountryCode ? 'home-origin' : ''}`} onClick={() => selectCountry(countryItem)} key={countryItem.code}><span><b>{countryItem.name}{countryItem.code === homeCountryCode ? <i className="home-tag">我的家乡</i> : null}</b><small>{countryItem.tagline}</small></span></button>)}</div>
        <div className="ranking-foot"><i/><span>也可直接点击地球上的国家</span></div>
      </aside>}
      {mapLevel === 'country' && <aside className="country-ranking region-ranking">
        <button className="ranking-back" onClick={goBackMap} aria-label={mapBackLabel}><span>←</span><b>{mapBackLabel}</b></button>
        <div className="ranking-head"><span>REGIONAL EXPLORATION GUIDE</span><b>{activeCountry?.name}区域探索图鉴</b><small>所有区域均可浏览；季节与数据状态只影响建议，不限制访问。</small></div>
        <div className="region-list">{rankedRegions.map(regionItem => <button data-region={regionItem.id} className={`${regionItem.visited ? 'visited' : 'unvisited'} ${activeRegion?.id === regionItem.id ? 'selected' : ''}`} onClick={() => selectRegion(regionItem)} key={regionItem.id}><span className="region-copy"><b>{regionItem.name}</b><small>{regionItem.summary}</small><span className="resource-tags">{regionItem.resources.map(resource => <i key={resource.type}>{resource.type}</i>)}</span></span><span className="footprint-state">{regionItem.visited ? '已到访' : '待探索 · 仍可查看'}</span></button>)}</div>
        <div className="ranking-foot"><i/><span>所有地区均可进入地图查看详情</span></div>
      </aside>}
      {mapLevel === 'region' && activeRegion && <AttractionExplorerPanel items={displayedAttractions} total={filteredRegionAttractions.length} zoom={attractionMapView.zoom} preference={attractionPreference} category={attractionCategory} experiences={attractionExperiences} selectedId={selectedAttractionId} hoveredId={hoveredAttractionId} comparedIds={comparedAttractionIds} semanticFilterEnabled={semanticFilterEnabled} currentRegionId={activeRegion.id} showNicheToggle={nichePreferenceUseful} onPreferenceChange={value => { setSelectedAttractionId(null); setHoveredAttractionId(null); setAttractionPreference(value); }} onCategoryChange={value => { setSelectedAttractionId(null); setHoveredAttractionId(null); setAttractionCategory(value); }} onExperienceToggle={value => { setSelectedAttractionId(null); setAttractionExperiences(current => toggleExperience(current, value)); }} onClearExperiences={() => { setSelectedAttractionId(null); setAttractionExperiences([]); }} onSelect={item => setSelectedAttractionId(item.id)} onHoverChange={setHoveredAttractionId} onCompareToggle={toggleAttractionComparison} onClearSelection={clearAttractionSelection} onBack={goBackMap} backLabel={`返回 ${activeCountry?.name || continent}地区`}/>} {/* explorer */}
      {mapLevel === 'region' && <AttractionComparePanel items={comparedAttractions} onRemove={toggleAttractionComparison}/>} {/* comparison */}
      {mapLevel === 'region' && selectedAttraction && <DestinationLivePanel destination={selectedAttraction} onAddToJourney={addSelectedAttractionToJourney} canAddToJourney={Boolean(activeJourney)}/>} {/* selected destination */}
      <aside className="world-progress archive-card" data-progress-scope={progressScope}>
        <div className="progress-head"><span><small>FAMILY ATLAS</small><strong>{homeCountry.name}探索档案</strong></span></div>
        {!profile && <button className="progress-origin" onClick={openProfileSettings}><UserRound size={12}/><span>暂以中国为家乡 · 设定旅行身份</span></button>}
        <p className="progress-caption">已到访旅行区域 <b>{visitedCount}</b> / {taxonomyTotal}</p>
        <div className="progress-list"><p><span>心愿中</span><b>{wishlist.length ? `${wishlist.length} 处` : '待探索'}</b></p>{activeJourney && <p><span>准备中 Journey</span><b>{activeJourney.name} · {activeJourney.preparedness}%</b></p>}<p><span>统计口径</span><b>按 Family Atlas 旅行区域</b></p></div>
      </aside>
      {mapLevel === 'world' && !worldHandoff && !routeFlight && <aside className="seasonal-recommendations" aria-label="当季旅行推荐">
        <header><div><span>SEASONAL PLANNER · {MONTH_NAMES[calendarNow.getMonth()]} · {seasonContinent}</span><b>{TRAVEL_SEASONS.find(item => item.id === selectedSeason)?.label}本季探索精选 · {seasonalFanCards.length} 处</b></div><small>数据源：各国官方旅游局 / 文旅部门公开指南（非 OTA）</small></header>
        <div className="seasonal-filter-dock"><nav className="season-switch" aria-label="切换旅行季节">{TRAVEL_SEASONS.map(item => <button className={selectedSeason === item.id ? 'active' : ''} onClick={() => setSelectedSeason(item.id)} key={item.id}>{item.label}</button>)}</nav><nav className="continent-switch" aria-label="筛选大洲">{SEASON_CONTINENTS.map(item => <button className={seasonContinent === item ? 'active' : ''} onClick={() => setSeasonContinent(item)} key={item}>{item}</button>)}</nav></div>
        <CardFanCarousel cards={seasonalFanCards} onCardSelect={handleSeasonalDestination} onWishToggle={handleWishToggle} reducedMotion={reducedMotion}/>
      </aside>}
      {unlockToast && <div className="unlock-toast"><span>✦ ATLAS UPDATE</span><b>{unlockToast}</b></div>}
    </section>

    <section className="journey" id="journey">
      <div className="section-head"><div><span className="section-kicker">THE LIVING MAP · 01</span><h2>在地貌之上，<br/><i>悬浮着我们的瞬间。</i></h2></div><p>地图不是背景，而是故事的主角。<br/>轻触每一枚坐标，打开那一刻的温度。</p></div>
      <div className="map-stage">
        <div className="terrain terrain-one"/><div className="terrain terrain-two"/><div className="terrain terrain-three"/>
        <div className="grid-lines"/>
        <svg className="route-line" viewBox="0 0 1200 680" preserveAspectRatio="none"><path d="M 80 450 C 180 270, 235 500, 345 385 S 520 135, 645 285 S 780 505, 900 405 S 1050 175, 1150 255"/></svg>
        <div className="route-label start"><span>01</span> 札幌</div><div className="route-label mid"><span>04</span> 洞爷湖</div><div className="route-label end"><span>07</span> 小樽</div>
        {photos.map((photo, i) => <button className={`memory ${photo.className} ${selected === i ? 'chosen' : ''}`} onClick={() => setSelected(i)} key={photo.name} aria-label={photo.name}><span className="memory-dot"><Camera size={13}/></span><figure><img src={photo.image} alt={photo.name}/><figcaption><small>{photo.place}</small><b>{photo.name}</b></figcaption></figure></button>)}
        <div className="map-hud"><span><Route size={14}/> 782.4 KM</span><span>WINTER DRIVE</span><span>+12° / −8°</span></div>
        <button className="play-route"><Play size={15} fill="currentColor"/> 播放旅程</button>
        <div className="map-caption"><span>轨迹模式</span><b>HOKKAIDO / JAPAN</b><small>43.0642° N, 141.3469° E</small></div>
      </div>
      <div className="map-note"><div className="wave"><span/><span/><span/><span/><span/><span/><span/><span/></div><p><b>第 {String(selected + 1).padStart(2, '0')} 个记忆锚点</b><br/>{photos[selected].name} · 一次停留，一个被坐标保存的故事。</p><button onClick={() => setSelected((selected + 1) % photos.length)}>下一个 <MoveRight size={16}/></button></div>
    </section>

    <section className="archive" id="stories"><div className="archive-title"><span className="section-kicker">JOURNEY ARCHIVE · 02</span><h2>这不只是游记，<br/>而是一份可复用的<strong>真实档案。</strong></h2></div><div className="bento">
      <article className="day-card"><span>DAY 04</span><h3>风越过<br/>洞爷湖</h3><p>札幌 → 洞爷湖 · 167km</p><a href="#guide">查看完整日程 <ArrowUpRight size={15}/></a><div className="sun"/></article>
      <article className="risk-card"><div className="card-icon"><Sparkles size={17}/></div><span>THIS TRIP / KNOW-HOW</span><h3>7 个真正有用的<br/>冬季自驾提醒</h3><ul><li>下午三点前结束山路驾驶</li><li>机场购买除冰喷雾更划算</li><li>孩子的防水手套多带一副</li></ul><button>全部避坑 <MoveRight size={16}/></button></article>
      <article className="camera-card"><img src="https://images.unsplash.com/photo-1528150177508-7cc0c36cda5c?auto=format&fit=crop&w=900&q=90" alt="Snowy family journey"/><div><span>126 个光的切片</span><h3>照片时间胶囊</h3><button><Camera size={15}/> 展开影像</button></div></article>
    </div></section>

    <section className="guide" id="guide"><div className="paper-wrap"><div className="paper"><div className="paper-top"><span>THE GENTLEMAN'S TRAVELER</span><span>ISSUE / 2026.01</span></div><div className="paper-content"><p className="ornament">✦</p><p className="paper-kicker">A FAMILY ROADBOOK</p><h2>北海道冬日<br/><i>亲子自驾环线</i></h2><p className="paper-intro">一份从真实旅行中生长出来的路线手记，包含 7 天行程、预算明细、22 项装备复盘和 8 个容易忽略的雪地驾驶提醒。</p><div className="paper-stamp"><b>7</b><span>DAYS<br/>ON ROAD</span></div><div className="paper-facts"><span>适合家庭 <b>4—8 岁儿童</b></span><span>最佳季节 <b>12 — 02 月</b></span><span>旅行方式 <b>环线自驾</b></span></div></div><div className="paper-bottom"><span>PRIVATE JOURNEY EDITION</span><span>OUR ATLAS</span></div></div></div><div className="guide-copy"><span className="section-kicker">A SHAREABLE ROADBOOK · 03</span><h2>把经验，装帧成<br/>值得被传阅的作品。</h2><p>发布不是复制一篇游记。系统会将本次路线、实测清单、风险提示和照片编排为专属长图手册；隐私内容自动隐去，只留下真正能帮到下一个旅人的经验。</p><button className="button ink" onClick={() => setShareOpen(true)}><Share2 size={17}/> 预览旅行手记</button></div></section>

    <footer id="gear"><a className="logo" href="#top"><span>OUR</span> ATLAS<i /></a><p>为走过的路，留下被好好保存的证据。</p><span>© 2026 FAMILY ATLAS</span></footer>
    {shareOpen && <div className="modal-backdrop" onClick={() => setShareOpen(false)}><aside className="share-modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShareOpen(false)}><X/></button><div className="modal-paper"><p>OUR ATLAS PRESENTS</p><h2>北海道冬日<br/>亲子自驾环线</h2><span>一封来自雪国的<br/>7 日家族手记</span></div><h3>将旅程编排为长图手记</h3><p>包含路线、实测清单、避坑提醒与精选影像。</p><button className="button ink" disabled title="V1.0 实现：固定羊皮纸长图 MVP 落地后启用">生成分享长图 <ArrowUpRight size={16}/></button></aside></div>}
    {profileOpen && <div className="modal-backdrop passport-backdrop" onClick={() => profileStage === 'form' && setProfileOpen(false)}><aside className={`passport-setup-modal stage-${profileStage}`} onClick={e => e.stopPropagation()} style={{'--passport-color': selectedPassport.color, '--passport-accent': selectedPassport.accent}}>
      {profileStage === 'form' ? <>
        <button className="close" onClick={() => setProfileOpen(false)}><X/></button><span className="section-kicker">TRAVELER IDENTITY · PASSPORT</span><h2>{profile ? '更改旅行者身份' : '你的旅程，从身份开始。'}</h2><p>选择国籍后，地图会把它作为解锁地区时的真实出发点。</p>
        <div className="passport-editor"><div className="passport-options">{PASSPORT_OPTIONS.map(option => <button className={profileDraft === option.code ? 'selected' : ''} onClick={() => setProfileDraft(option.code)} key={option.code}><span style={{background:option.color}}>{option.emblem}</span><b>{option.country}</b><small>{option.nationality}</small></button>)}</div><div className="passport-preview" style={{background:selectedPassport.color,color:selectedPassport.accent}}><small>PASSPORT · 护照</small><i>{selectedPassport.emblem}</i><b>{selectedPassport.passportLabel}</b><span>OUR ATLAS<br/>{selectedPassport.code}</span></div></div>
        <button className="button passport-save" onClick={saveProfile}><Save size={16}/>{profile ? '保存身份设定' : '生成我的旅行护照'}</button>{profile && <><small className="ceremony-note">护照动画只在首次建立角色时播放。</small><button className="passport-reset" onClick={clearProfile}>清除角色设定</button></>}
      </> : <div className="passport-ceremony"><span>IDENTITY CONFIRMED</span><h2>{selectedPassport.nationality}</h2><div className="passport-book"><div className="passport-page"><small>OUR ATLAS · TRAVELER</small><b>{selectedPassport.country}</b><i>{selectedPassport.code}</i><div className="passport-stamp">✦<strong>IDENTITY<br/>VERIFIED</strong></div></div><div className="passport-cover"><small>PASSPORT · 护照</small><i>{selectedPassport.emblem}</i><b>{selectedPassport.passportLabel}</b></div></div><p>身份已盖章，世界地图正在为你重新标定出发点。</p></div>}
    </aside></div>}
    {journeyDialogOpen && <div className="modal-backdrop" onClick={() => !journeySaving && setJourneyDialogOpen(false)}><form className="journey-create-modal archive-card" onSubmit={saveJourneyFromDialog} onClick={event => event.stopPropagation()}><button type="button" className="close" onClick={() => setJourneyDialogOpen(false)} aria-label="关闭 Journey 编辑器"><X/></button><span className="section-kicker">{journeyDialogMode === 'create' ? 'NEW JOURNEY' : 'JOURNEY PLANNING'}</span><h2>{journeyDialogMode === 'create' ? '开始一段新旅程' : '继续规划这段旅程'}</h2><label>旅程名称<input required maxLength="80" value={journeyDraft.name} onChange={event => setJourneyDraft(draft => ({ ...draft, name: event.target.value }))} placeholder="例如：北海道冬日亲子自驾"/></label><label>目的地（可选）<input maxLength="120" value={journeyDraft.destinationLabel} onChange={event => setJourneyDraft(draft => ({ ...draft, destinationLabel: event.target.value }))} placeholder="例如：日本 · 北海道"/></label><label>出发时间（可选）<input type="datetime-local" value={journeyDraft.departureAt} onChange={event => setJourneyDraft(draft => ({ ...draft, departureAt: event.target.value }))}/></label>{journeyDialogMode === 'edit' && <><label>旅程阶段<select value={journeyDraft.status} onChange={event => setJourneyDraft(draft => ({ ...draft, status: event.target.value }))}><option value="planning">规划中</option><option value="preparing">准备中</option><option value="ready">准备完成</option><option value="ongoing">旅程中</option></select></label><div className="journey-progress-fields"><label>准备度 (%)<input type="number" min="0" max="100" step="1" value={journeyDraft.preparedness} onChange={event => setJourneyDraft(draft => ({ ...draft, preparedness: event.target.value }))}/></label><label>待确认事项<input type="number" min="0" step="1" value={journeyDraft.pendingItemCount} onChange={event => setJourneyDraft(draft => ({ ...draft, pendingItemCount: event.target.value }))}/></label></div></>}{journeyError && <p className="journey-create-error">{journeyError}</p>}<button className="button ink" disabled={journeySaving}>{journeySaving ? '正在保存…' : journeyDialogMode === 'create' ? '创建 Journey' : '保存规划'}</button></form></div>}
    {wishlistOpen && <div className="modal-backdrop wishlist-backdrop" onClick={() => setWishlistOpen(false)}>
      <aside className="wishlist-modal" onClick={e => e.stopPropagation()} aria-label="心愿单">
        <button className="close" onClick={() => setWishlistOpen(false)} aria-label="关闭心愿单"><X/></button>
        <header className="wishlist-head">
          <div>
            <span className="section-kicker">DREAM BOARD · WISHLIST</span>
            <h2>心愿目的地 <i>{wishlistDestinations.length}</i></h2>
            <p>所有目的地均可浏览；当季 ♡ 或目的地详情可加入心愿，再从这里开始准备。</p>
          </div>
          <b className="wishlist-count">{wishlistDestinations.length}</b>
        </header>
        <div className="wishlist-body">
          {!wishlistDestinations.length || !activeWish ? (
            <div className="wishlist-empty">
              <Sparkles size={22}/>
              <b>心愿单为空</b>
              <p>点当季精选 ♡，或在目的地详情加入心愿。</p>
              <button type="button" className="button ink" onClick={() => setWishlistOpen(false)}>关闭</button>
            </div>
          ) : (
            <>
              <article className="wishlist-feature">
                <div className="wishlist-feature-media">
                  <img src={activeWish.image} alt={activeWish.title}/>
                  <span className="wishlist-feature-badge">{getStatusForDestination(activeWish).label}</span>
                </div>
                <div className="wishlist-feature-copy">
                  <small>{activeWish.theme}</small>
                  <b>{activeWish.title}</b>
                  <em>{activeWish.location}</em>
                  <p>{activeWish.reason}</p>
                  <div className="wishlist-feature-meta">
                    <span>{activeWish.bestSeasonLabel}</span>
                    <span>适配度暂不可用</span>
                    <span>{getStatusForDestination(activeWish).label}</span>
                  </div>
                  <div className="wishlist-feature-actions">
                    <button type="button" className="button btn-enter" onClick={() => navigateToDestination(activeWish)}>查看详情</button>
                    <button type="button" className="button btn-unlock" onClick={() => openDestinationUnlock(activeWish, { fromWishlist: true })}>
                      <TicketCheck size={15}/> 开始准备
                    </button>
                    <button type="button" className="button btn-remove" onClick={() => toggleWishlist(activeWish)}>移出心愿</button>
                  </div>
                </div>
              </article>
              <div className="wishlist-rail">
                <div className="wishlist-nav">
                  <div className="wishlist-nav-btns">
                    <button type="button" disabled={wishlistDestinations.length < 2} onClick={() => setWishlistIndex(i => (i - 1 + wishlistDestinations.length) % wishlistDestinations.length)} aria-label="上一项">←</button>
                    <button type="button" disabled={wishlistDestinations.length < 2} onClick={() => setWishlistIndex(i => (i + 1) % wishlistDestinations.length)} aria-label="下一项">→</button>
                  </div>
                  <span>共 {wishlistDestinations.length} 处 · 待准备 {wishlistPreparationCount}</span>
                </div>
                <div className="wishlist-thumbs" role="list">
                  {wishlistDestinations.map((item, index) => (
                    <button type="button" role="listitem" key={item.id} className={`wishlist-thumb ${index === wishlistIndex ? 'is-active' : ''}`} onClick={() => setWishlistIndex(index)}>
                      <img src={item.image} alt=""/>
                      <span>
                        <b>{item.title.split(' · ')[0]}</b>
                        <small>{getStatusForDestination(item).label}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>}
    {unlockOpen && unlockTarget && unlockDestinationProfile && <div className="modal-backdrop" onClick={closeUnlockModal}><aside className="unlock-modal destination-unlock" onClick={e => e.stopPropagation()}>
      <button className="close" onClick={closeUnlockModal} aria-label={unlockFromWishlist ? '返回心愿单' : '关闭准备清单'}><X/></button><span className="section-kicker">PREPARATION CHECKLIST · VERIFIED SOURCES{unlockFromWishlist ? ' · 返回心愿单' : ''}</span>
      <div className="unlock-title"><div><h2>{unlockDestinationProfile.name}<br/><i>{unlockDestinationProfile.english}</i></h2><p>{unlockTarget.reason}。以下准备项只影响你的 Journey 准备度，不影响浏览目的地。</p></div><span>{unlockDestinationProfile.code}<br/><b>{Math.abs(unlockDestinationProfile.focus[0]).toFixed(0)}°{unlockDestinationProfile.focus[0] >= 0 ? 'N' : 'S'}</b></span></div>
      {profile ? <div className="unlock-origin"><span className="mini-passport" style={{background:profile.color,color:profile.accent}}>{profile.emblem}</span><p>旅行身份<b>{profile.country}</b></p><Plane size={16}/><p>目的地<b>{unlockDestinationProfile.name}</b></p></div> : <button className="unlock-origin missing" onClick={() => { setUnlockFromWishlist(false); setUnlockOpen(false); openProfileSettings(); }}><UserRound size={17}/><span>可选：设定旅行身份以辅助准备核验</span><ArrowUpRight size={15}/></button>}
      <div className="unlock-score"><b>{unlockProgress}<small>%</small></b><span>Journey 准备度</span><i><em style={{width:`${unlockProgress}%`}}/></i></div>
      <div className="unlock-list">{unlockTasks.map(task => <label className={unlockDraft[task.id] ? 'checked' : ''} key={task.id}><input type="checkbox" checked={Boolean(unlockDraft[task.id])} onChange={() => toggleUnlockTask(task.id)}/><span className="task-check">{unlockDraft[task.id] && <Check/>}</span><span className="task-copy"><b>{task.label}</b><small>{task.detail}</small><a href={task.sourceUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{task.sourceLabel} ↗</a></span><em>{unlockDraft[task.id] ? '已确认' : '待核验'}</em></label>)}</div>
      <div className="unlock-actions-row">
        <button type="button" className={`button wish-inline ${wishlist.includes(unlockTarget.id) ? 'is-on' : ''}`} onClick={() => toggleWishlist(unlockTarget)}>
          {wishlist.includes(unlockTarget.id) ? '♥ 已在心愿单' : '♡ 加入心愿单'}
        </button>
        {isDestinationPrepared(unlockTarget) && <button type="button" className="button ink" onClick={() => { markMastered(unlockTarget); setUnlockToast(`${unlockTarget.title} 已标记深度探索`); window.setTimeout(() => setUnlockToast(null), 2200); }}>标记深度探索</button>}
      </div>
      {unlockReady ? <button className="button unlock-region-button" onClick={previewPreparedJourney}><Plane size={16}/>完成准备并预览航线</button> : <button className="button ink unlock-save" disabled={unlockProgress === 0} onClick={saveUnlockProgress}><Save size={16}/>{unlockComplete ? '保存并确认全部准备' : '保存准备进度'}</button>}
      <small className="unlock-help">
        状态：{getStatusForDestination(unlockTarget).label}
        {unlockTarget.sourceLabel ? ` · 来源 ${unlockTarget.sourceLabel}` : ''}
        {unlockTarget.sourceUrl ? <> · <a href={unlockTarget.sourceUrl} target="_blank" rel="noreferrer">打开权威来源 ↗</a></> : null}
        ；核对日期 {unlockDestinationProfile.verifiedAt}。
        <button type="button" onClick={resetUnlockProgress}>重置清单</button>
      </small>
    </aside></div>}
  </main>
}
createRoot(document.getElementById('root')).render(<App/>);
