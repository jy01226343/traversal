import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Camera, Check, Compass, Globe2, MapPinned, Menu, MoveRight, Plane, Play, Plus, Route, Save, Share2, Sparkles, TicketCheck, UserRound, X } from 'lucide-react';
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
import { isCountryFreeAccess, resolveTravelAccess } from './data/travel-access';
import { destinationFromRegion, regionKeyFromWishId, resolveWishlistItem } from './data/wishlist-destinations';
import { GLOBE_LAYERS, buildDestinationBeacons, filterBeaconsByLayers } from './data/beacons';
import { AttractionExplorerPanel, resolveAttractions, selectAttractions } from './features/attraction-explorer';
import { syncLiveWeather } from './lib/weather-sync';

const photos = [
  { name: '雪国的第一束光', place: '留寿都 · 42.861° N', image: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=600&q=85', className: 'photo-a' },
  { name: '湖边的午餐', place: '洞爷湖 · 42.604° N', image: 'https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=600&q=85', className: 'photo-b' },
  { name: '小樽的蓝调时刻', place: '小樽 · 43.190° N', image: 'https://images.unsplash.com/photo-1516406742981-0f59b3d66c6c?auto=format&fit=crop&w=600&q=85', className: 'photo-c' }
];

function App() {
  const [selected, setSelected] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [menu, setMenu] = useState(false);
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileStage, setProfileStage] = useState('form');
  const [profileDraft, setProfileDraft] = useState(profile?.code || 'CHN');
  const [unlockDraft, setUnlockDraft] = useState({});
  const [unlockSaved, setUnlockSaved] = useState({});
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [pendingUnlockNavigation, setPendingUnlockNavigation] = useState(null);
  const [unlockedRegions, setUnlockedRegions] = useState(() => {
    const defaults = ['JPN:hokkaido', 'JPN:kinki', 'CHN:northwest'];
    try { return [...new Set([...defaults, ...JSON.parse(localStorage.getItem('atlas-unlocked-regions') || '[]')])]; } catch { return defaults; }
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
  const syncWeather = React.useCallback(async () => {
    setWeather(w => ({ ...w, loading: true, error: null }));
    try {
      const res = await syncLiveWeather();
      setWeather({ loading: false, result: res, error: res.ok ? null : res.message });
    } catch (e) {
      setWeather({ loading: false, result: null, error: e?.message || '同步失败' });
    }
  }, []);
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
  const [selectedAttractionId, setSelectedAttractionId] = useState(null);
  const [attractionMapView, setAttractionMapView] = useState({ zoom: 7.4 });
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
    if (mapLevel === 'world') {
      setWorldHandoff(name);
      window.clearTimeout(handoffTimer.current);
      handoffTimer.current = window.setTimeout(() => {
        setMapLevel('continent');
        setWorldHandoff(null);
      }, 1480);
    } else {
      setMapLevel('continent');
    }
  };
  const selectCountry = picked => {
    const known = findCountry(picked.code);
    setActiveCountry(known || { ...picked, score: 84, tagline: '从地球上发现的目的地', season: '待探索', visited: false });
    setActiveRegion(null);
    setSelectedAttractionId(null);
    setMapLevel('country');
  };
  const selectRegion = region => {
    setActiveRegion(region);
    setSelectedAttractionId(null);
    setAttractionCategory('全部');
    setAttractionMapView({ zoom: 7.4 });
    setMapLevel('region');
  };
  const goBackMap = () => {
    if (mapLevel === 'region') {
      setSelectedAttractionId(null);
      setActiveRegion(null);
      setMapLevel('country');
    } else if (mapLevel === 'country') {
      setActiveCountry(null);
      setMapLevel('continent');
    } else {
      setMapLevel('world');
    }
  };
  // Bug 1 fix: when user zooms out from region to below country threshold,
  // exit back to country level (restore sectors + region hotlist)
  const exitToCountry = () => {
    setSelectedAttractionId(null);
    setActiveRegion(null);
    setMapLevel('country');
  };
  // Bug 3: when user zooms out from attraction detail, clear selection so
  // the list returns to attraction explorer panel (not detail view)
  const exitToRegionList = () => {
    setSelectedAttractionId(null);
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
  const getAccessForDestination = destination => resolveTravelAccess({
    destinationCountryCode: destination.countryCode,
    destinationKey: getDestinationKey(destination),
    passportCode,
    unlockedKeys: unlockedRegions,
  });
  /** 已点亮 / 本国 / 免签 → 无需解锁窗，可直接进入地图 */
  const isDestinationUnlocked = destination => getAccessForDestination(destination).free;
  const getStatusForDestination = destination => resolveDestinationStatus({
    destination,
    unlockedKeys: unlockedRegions,
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
    setUnlockToast(next.includes(id) ? `${destinationOrCard.title || id} 已加入心愿单` : `${destinationOrCard.title || id} 已移出心愿单`);
    window.setTimeout(() => setUnlockToast(null), 2200);
  };
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
    const access = getAccessForDestination(destination);
    if (access.free) {
      navigateToDestination(destination);
      if (access.tier === 'domestic' || access.tier === 'visa_free') {
        setUnlockToast(`${destination.title} · ${access.label}，已直达地图`);
        window.setTimeout(() => setUnlockToast(null), 2400);
      }
      return;
    }
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
  /** 已开放 → 进地图；未开放 → 先入心愿单，解锁只在心愿看板里进行 */
  const handleSeasonalDestination = card => {
    const destination = resolveWishDestination(card.id) || SEASONAL_RECOMMENDATIONS.find(item => item.id === card.id);
    if (!destination) return;
    if (isDestinationUnlocked(destination)) {
      navigateToDestination(destination);
      return;
    }
    if (!wishlist.includes(destination.id)) {
      toggleWishlist(destination);
      setUnlockToast(`${destination.title} 已加入心愿单 · 打开心愿看板可解锁`);
      window.setTimeout(() => setUnlockToast(null), 2600);
      return;
    }
    setUnlockToast('请在心愿看板中点击「开始解锁」');
    window.setTimeout(() => setUnlockToast(null), 2200);
    setWishlistOpen(true);
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
    return {
      id: item.id,
      imgUrl: item.image,
      title: item.title,
      location: item.location,
      kicker: `${item.grade} · ${item.theme}`,
      summary: item.reason,
      score: item.score,
      grade: item.grade,
      status: fanStatusFromMeta(meta),
      statusLabel: meta.label,
      sourceLabel: item.sourceLabel,
      wished: wishlist.includes(item.id),
    };
  };
  const seasonalFanCards = React.useMemo(
    () => seasonalRecommendations.map(toFanCard),
    [seasonalRecommendations, unlockedRegions, wishlist, mastered, passportCode],
  );
  const wishlistDestinations = React.useMemo(
    () => wishlist.map(id => resolveWishDestination(id)).filter(Boolean),
    [wishlist, unlockedRegions, passportCode],
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
      setUnlockToast('心愿单为空 · 点当季 ♡ 或地图未解锁节点收藏');
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
  const activeWishUnlocked = activeWish ? isDestinationUnlocked(activeWish) : false;
  const wishlistLockedCount = wishlistDestinations.filter(item => !isDestinationUnlocked(item)).length;
  const globeBeacons = React.useMemo(() => {
    const all = buildDestinationBeacons({
      seasonalIds: seasonalRecommendations.map(item => item.id),
      unlockedKeys: unlockedRegions,
      wishlistIds: wishlist,
      masteredIds: mastered,
      resolveStatus: getStatusForDestination,
    });
    return filterBeaconsByLayers(all, globeLayers);
  }, [seasonalRecommendations, unlockedRegions, wishlist, mastered, globeLayers, passportCode]);
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
  const launchUnlockedRegion = () => {
    if (!profile || !unlockTarget || !unlockDestinationProfile) {
      setUnlockOpen(false);
      openProfileSettings();
      return;
    }
    const destinationKey = getDestinationKey(unlockTarget);
    const nextUnlocked = [...new Set([...unlockedRegions, destinationKey])];
    setUnlockedRegions(nextUnlocked);
    localStorage.setItem('atlas-unlocked-regions', JSON.stringify(nextUnlocked));
    window.clearTimeout(handoffTimer.current);
    setWorldHandoff(null);
    setUnlockOpen(false);
    setUnlockFromWishlist(false);
    setWishlistOpen(false);
    setActiveCountry(null);
    setActiveRegion(null);
    setContinent(unlockTarget.continent);
    setMapLevel('world');
    setPendingUnlockNavigation(unlockTarget);
    setRouteFlight({
      id: Date.now(),
      from: { name: profile.country, focus: profile.focus },
      to: { name: unlockDestinationProfile.name, focus: unlockDestinationProfile.focus },
    });
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
  const isRegionUnlocked = (countryItem, regionItem) => (
    regionItem.visited
    || unlockedRegions.includes(`${countryItem.code}:${regionItem.id}`)
    || isCountryFreeAccess(countryItem.code, passportCode)
  );
  const getCountryProgress = countryItem => {
    const countryRegions = getRegionsForCountry(countryItem);
    const unlocked = countryRegions.filter(regionItem => isRegionUnlocked(countryItem, regionItem)).length;
    return { unlocked, total: countryRegions.length, percent: countryRegions.length ? Math.round(unlocked / countryRegions.length * 100) : 0 };
  };
  const getContinentProgress = continentName => {
    const countryItems = COUNTRIES_BY_CONTINENT[continentName] || [];
    const totals = countryItems.map(getCountryProgress);
    const unlocked = totals.reduce((sum, item) => sum + item.unlocked, 0);
    const total = totals.reduce((sum, item) => sum + item.total, 0);
    return { unlocked, total, percent: total ? Math.round(unlocked / total * 100) : 0 };
  };
  const countryProgress = getCountryProgress(homeCountry);
  const continentProgress = getContinentProgress(homeContinent);
  const worldProgress = Object.keys(COUNTRIES_BY_CONTINENT).map(getContinentProgress).reduce((result, item) => ({ unlocked: result.unlocked + item.unlocked, total: result.total + item.total }), { unlocked: 0, total: 0 });
  worldProgress.percent = worldProgress.total ? Math.round(worldProgress.unlocked / worldProgress.total * 100) : 0;
  const continentNames = { '亚洲': 'ASIA', '欧洲': 'EUROPE', '大洋洲': 'OCEANIA', '北美': 'NORTH AMERICA', '南美': 'SOUTH AMERICA', '非洲': 'AFRICA' };
  const countryRows = getRegionsForCountry(homeCountry).map(regionItem => ({ label: regionItem.name, value: isRegionUnlocked(homeCountry, regionItem) ? '已点亮' : '待探索', unlocked: isRegionUnlocked(homeCountry, regionItem) }));
  const continentRows = [...(COUNTRIES_BY_CONTINENT[homeContinent] || [])]
    .sort((a, b) => Number(b.code === homeCountry.code) - Number(a.code === homeCountry.code) || b.score - a.score)
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
  const rankedAttractions = React.useMemo(() => selectAttractions(regionAttractions, { zoom: attractionMapView.zoom, bbox: attractionMapView.bounds, category: attractionCategory, preference: attractionPreference, limit: 10 }), [regionAttractions, attractionMapView, attractionCategory, attractionPreference]);
  const nichePreferenceUseful = React.useMemo(() => {
    const base = { zoom: attractionMapView.zoom, bbox: attractionMapView.bounds, category: attractionCategory, limit: 10 };
    const popular = selectAttractions(regionAttractions, { ...base, preference: 'popular' });
    const niche = selectAttractions(regionAttractions, { ...base, preference: 'niche' });
    if (!niche.length) return false;
    // Hide tab when niche list is empty of unique value vs popular (same ids + same order, and no alternative slots)
    const sameOrder = niche.length === popular.length && niche.every((item, index) => item.id === popular[index]?.id);
    if (sameOrder) return false;
    const popularMustIds = new Set(popular.filter(item => item.selection_kind === 'must').map(item => item.id));
    const nicheHasOutsideMust = niche.some(item => !popularMustIds.has(item.id));
    const popularHasAlt = popular.some(item => item.selection_kind === 'alternative');
    return nicheHasOutsideMust || popularHasAlt;
  }, [regionAttractions, attractionMapView, attractionCategory]);
  React.useEffect(() => {
    if (!nichePreferenceUseful && attractionPreference === 'niche') setAttractionPreference('popular');
  }, [nichePreferenceUseful, attractionPreference]);
  const selectedAttraction = rankedAttractions.find(item => item.id === selectedAttractionId) || null;
  const clearAttractionSelection = () => {
    setSelectedAttractionId(null);
    setAttractionMapView({ zoom: 7.4 });
  };
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
    return list.map(item => ({ ...item, visited: isRegionUnlocked(activeCountry, item) }));
  }, [activeCountry?.code, unlockedRegions, passportCode]);
  const mapBackLabel = mapLevel === 'region' ? `返回 ${activeCountry?.name}` : mapLevel === 'country' ? `返回 ${continent}` : '返回世界地球';
  return <main>
    <nav className="nav">
      <a className="logo" href="#top"><span>OUR</span> ATLAS<i /></a>
      <div className="navlinks">
        <a className="active" href="#top">探索世界</a><a href="#journey">旅行档案</a><a href="#stories">记忆链</a><a href="#guide">攻略手册</a>
      </div>
      <div className="navright"><button className="search" aria-label="探索"><Compass size={18}/></button>{profile ? <div className="passport-identity" style={{'--passport-mini': profile.color, '--passport-accent': profile.accent}}><span>{profile.emblem}<i>P</i></span><b>{profile.nationality}</b><button onClick={openProfileSettings}>更改</button></div> : <button className="character-setup" onClick={openProfileSettings}><UserRound size={15}/>角色设定</button>}<button className="new-trip" disabled title="V1.0 实现：自适应首页 Journey Focus 落地后启用"><Plus size={16}/> 新建旅程</button><button className="mobile-menu" onClick={() => setMenu(true)}><Menu /></button></div>
    </nav>
    {menu && <div className="menu-overlay"><button onClick={() => setMenu(false)}><X/></button><a href="#journey">旅行档案</a><a href="#stories">时光拾遗</a><a href="#guide">攻略手册</a><a href="#gear">装备库</a></div>}

    <section className={`world-hero ${mapLevel !== 'world' ? 'regional-mode' : ''} ${mapLevel === 'country' || mapLevel === 'region' ? 'country-mode' : ''} ${mapLevel === 'region' ? 'region-mode' : ''} ${worldHandoff ? 'world-handoff' : ''} ${routeFlight ? 'route-flight-mode' : ''}`} id="top">
      <div className="world-noise"/>
      <div className="world-topline"><span><i/> LIVE EARTH · {liveDate}</span><button type="button" className="weather-sync" onClick={syncWeather} disabled={weather.loading} title={weather.result ? `来源：${weather.result.source === 'live' ? 'Open-Meteo 实时' : '气候档案'} · ${weather.result.stationCount} 站` : '点击同步最新天气'}>{weather.loading ? '同步中…' : weather.result ? `${weather.result.message}` : weather.error ? `天气同步失败 · ${weather.error}` : '点击同步天气'}</button><span>{seasonalRecommendations.length} 个当季目的地正在等待你</span></div>
      <div className="world-ribbon">{orderedContinentNames.map(name => { const info = continents[name]; return <button data-continent={name} disabled={Boolean(worldHandoff || routeFlight)} onClick={() => selectContinent(name)} className={`${continent === name && mapLevel !== 'world' ? 'ribbon-active' : ''} ${name === homeContinentName ? 'ribbon-home' : ''}`} key={name}><b>{name}</b><span><em>推荐 {info[0]}</em><em>已探索 {info[1]}</em></span><small>{info[2]}</small></button>; })}</div>
      {mapLevel === 'world' && !worldHandoff && !routeFlight && <aside className="globe-layer-dock" aria-label="地球图层">
        <span>LAYERS · 图层</span>
        {GLOBE_LAYERS.map(layer => <button type="button" key={layer.id} className={globeLayers.includes(layer.id) ? 'active' : ''} onClick={() => toggleGlobeLayer(layer.id)}><b>{layer.label}</b><small>{layer.hint}</small></button>)}
      </aside>}
      <div className="world-title"><p>FAMILY ATLAS / WORLD EXPLORATION ENGINE</p><h1>世界仍然很大，<br/><i>而我们的故事刚刚开始。</i></h1></div>
      {mapLevel !== 'world' && <div className="map-breadcrumb"><button onClick={() => { setSelectedAttractionId(null); setActiveCountry(null); setActiveRegion(null); setMapLevel('world'); }}>世界</button><i>/</i><button className={mapLevel === 'continent' ? 'current' : ''} onClick={() => { setSelectedAttractionId(null); setActiveCountry(null); setActiveRegion(null); setMapLevel('continent'); }}>{continent}</button>{activeCountry && <><i>/</i><button className={mapLevel === 'country' ? 'current' : ''} onClick={() => { setSelectedAttractionId(null); setActiveRegion(null); setMapLevel('country'); }}>{activeCountry.name}</button></>}{selectedAttraction ? <><i>/</i><b>{selectedAttraction.name}</b></> : activeRegion && <><i>/</i><b>{activeRegion.name}</b></>}</div>}
      <div className={`globe-stage ${mapLevel !== 'world' ? 'flat-stage' : ''}`} aria-label={mapLevel === 'world' ? 'Interactive 3D world globe' : 'Interactive satellite map'}>
        {mapLevel === 'world' ? <><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="globe-shadow"/><GlobeWeather continent={continent} level="world" routeFlight={routeFlight} onRouteFlightComplete={finishRouteFlight} beacons={globeBeacons} onBeaconSelect={handleBeaconSelect}/><div className="globe-label north">N<br/><span>◦</span></div><div className="globe-label south">S<br/><span>◦</span></div></> : <FlatAtlasMap continent={continent} level={mapLevel} country={activeCountry} region={activeRegion} regions={rankedRegions} attractions={rankedAttractions} selectedAttraction={selectedAttraction} wishedRegionKeys={wishedRegionKeys} onCountrySelect={selectCountry} onRegionSelect={selectRegion} onRegionWish={handleMapRegionWish} onAttractionSelect={item => setSelectedAttractionId(item.id)} onMapViewChange={view => mapLevel === 'region' && setAttractionMapView(view)} onExitToCountry={exitToCountry} onExitToRegionList={exitToRegionList}/>} 
        {worldHandoff && <div className="world-map-handoff"><i/><span>ORBITAL HANDOFF</span><b>{worldHandoff}</b><small>3D 地球 → 区域卷轴地图</small></div>}
      </div>
      {mapLevel !== 'world' && <aside className="map-level-panel"><span>YOU ARE EXPLORING</span><div className="level-path"><small>{selectedAttraction ? `${selectedAttraction.category_l1} · ${selectedAttraction.category_l2}` : continent}</small><b>{selectedAttraction?.name || activeRegion?.name || activeCountry?.name || '国家地图'}</b><em>{selectedAttraction ? '已锁定真实 WGS-84 坐标，周边锚点仍可继续点击' : mapLevel === 'region' ? '景点锚点与精选列表双向联动' : mapLevel === 'country' ? '省州边界与地区热榜' : '国界与国家旅游热榜'}</em></div>{activeRegion && !selectedAttraction && <div className="level-resources">{activeRegion.resources.map(item => <i key={item.type}>{item.type}<b>{item.score}</b></i>)}</div>}</aside>}
      {mapLevel === 'continent' && <aside className="country-ranking">
        <button className="ranking-back" onClick={goBackMap}><span>←</span><b>{mapBackLabel}</b><small>BACK</small></button>
        <div className="ranking-head"><span>TRAVEL HOT LIST</span><b>{continent}旅行热榜</b><small>{mapLevel === 'country' ? `正在查看 ${activeCountry?.name || ''}` : '选择国家继续俯冲探索'}</small></div>
        <div className="ranking-list">{rankedCountries.map((countryItem, index) => <button data-country={countryItem.code} className={`${activeCountry?.code === countryItem.code ? 'selected' : ''} ${countryItem.code === homeCountryCode ? 'home-origin' : ''}`} onClick={() => selectCountry(countryItem)} key={countryItem.code}><em>{String(index + 1).padStart(2, '0')}</em><span><b>{countryItem.name}{countryItem.code === homeCountryCode ? <i className="home-tag">起点</i> : null}</b><small>{countryItem.tagline}</small></span><strong>{countryItem.score}</strong></button>)}</div>
        <div className="ranking-foot"><i/><span>也可直接点击地球上的国家</span></div>
      </aside>}
      {mapLevel === 'country' && <aside className="country-ranking region-ranking">
        <button className="ranking-back" onClick={goBackMap}><span>←</span><b>{mapBackLabel}</b><small>BACK</small></button>
        <div className="ranking-head"><span>AREA RESOURCE INDEX</span><b>{activeCountry?.name}地区热榜</b><small>热度、足迹与户外资源综合排序</small></div>
        <div className="region-list">{rankedRegions.map((regionItem, index) => <button data-region={regionItem.id} className={`${regionItem.visited ? 'visited' : 'unvisited'} ${activeRegion?.id === regionItem.id ? 'selected' : ''}`} onClick={() => selectRegion(regionItem)} key={regionItem.id}><em>{String(index + 1).padStart(2, '0')}</em><span className="region-copy"><b>{regionItem.name}</b><small>{regionItem.summary}</small><span className="resource-tags">{regionItem.resources.map(resource => <i key={resource.type}>{resource.type}<strong>{resource.score}</strong></i>)}</span></span><strong className="region-heat">{regionItem.heat}</strong><span className="footprint-state">{regionItem.visited ? '● 已点亮' : '○ 无足迹'}</span></button>)}</div>
        <div className="ranking-foot"><i/><span>无足迹地区已在地球与列表中压暗</span></div>
      </aside>}
      {mapLevel === 'region' && activeRegion && <AttractionExplorerPanel items={rankedAttractions} total={regionAttractions.length} zoom={attractionMapView.zoom} preference={attractionPreference} category={attractionCategory} selectedId={selectedAttractionId} showNicheToggle={nichePreferenceUseful} onPreferenceChange={value => { setSelectedAttractionId(null); setAttractionPreference(value); }} onCategoryChange={value => { setSelectedAttractionId(null); setAttractionCategory(value); }} onSelect={item => setSelectedAttractionId(item.id)} onClearSelection={clearAttractionSelection} onBack={goBackMap} backLabel={`返回 ${activeCountry?.name || continent}地区`}/>} 
      <aside className="world-progress" data-progress-scope={progressScope}>
        <div className="progress-head"><span><small>{progressData.eyebrow}</small><strong>{progressData.title}解锁进程</strong></span><b>{progressData.percent}<small>%</small></b></div>
        {!profile && <button className="progress-origin" onClick={openProfileSettings}><UserRound size={12}/><span>暂以中国为起点 · 设定国籍</span></button>}
        <div className="progress-line"><i style={{width:`${progressData.percent}%`}}/></div>
        <p className="progress-caption"><b>{progressData.unlocked}</b> / {progressData.total} 个地区已点亮</p>
        <div className="progress-list">{progressData.rows.slice(0, 4).map(item => <p key={item.label}><span>{item.label}</span><b className={item.unlocked ? 'is-unlocked' : ''}>{item.value}</b></p>)}</div>
        <button className="progress-next" onClick={cycleProgressScope}><span>{progressData.next}</span><ArrowUpRight size={14}/></button>
      </aside>
      {mapLevel === 'world' && !worldHandoff && !routeFlight && <aside className="seasonal-recommendations" aria-label="当季旅行推荐">
        <header><div><span>SEASONAL PLANNER · {MONTH_NAMES[calendarNow.getMonth()]} · {seasonContinent}</span><b>{TRAVEL_SEASONS.find(item => item.id === selectedSeason)?.label}旅行首推 · {seasonalFanCards.length} 条</b></div><small>数据源：各国官方旅游局 / 文旅部门公开指南（非 OTA）</small></header>
        <div className="seasonal-filter-dock"><nav className="season-switch" aria-label="切换旅行季节">{TRAVEL_SEASONS.map(item => <button className={selectedSeason === item.id ? 'active' : ''} onClick={() => setSelectedSeason(item.id)} key={item.id}>{item.label}</button>)}</nav><nav className="continent-switch" aria-label="筛选大洲">{SEASON_CONTINENTS.map(item => <button className={seasonContinent === item ? 'active' : ''} onClick={() => setSeasonContinent(item)} key={item}>{item}</button>)}</nav></div>
        <CardFanCarousel cards={seasonalFanCards} onCardSelect={handleSeasonalDestination} onWishToggle={handleWishToggle}/>
      </aside>}
      <div className="world-dock">
        <a className="active"><Globe2 size={17}/>探索</a>
        <button type="button" onClick={openWishlistBoard} aria-label={`心愿单 ${wishlist.length} 项，待解锁 ${wishlistLockedCount}`}>
          <Sparkles size={17}/>心愿 <i>{wishlist.length || '0'}</i>
          {wishlistLockedCount > 0 && <em className="dock-unlock-dot" title={`${wishlistLockedCount} 个待解锁`}>{wishlistLockedCount}</em>}
        </button>
        <a href="#journey"><MapPinned size={17}/>足迹</a>
      </div>
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
    {wishlistOpen && <div className="modal-backdrop wishlist-backdrop" onClick={() => setWishlistOpen(false)}>
      <aside className="wishlist-modal" onClick={e => e.stopPropagation()} aria-label="心愿单">
        <button className="close" onClick={() => setWishlistOpen(false)} aria-label="关闭心愿单"><X/></button>
        <header className="wishlist-head">
          <div>
            <span className="section-kicker">DREAM BOARD · WISHLIST</span>
            <h2>心愿目的地 <i>{wishlistDestinations.length}</i></h2>
            <p>已开放可进地图 · 未解锁点「开始解锁」· 当季 ♡ / 地图节点可收藏</p>
          </div>
          <b className="wishlist-count">{wishlistDestinations.length}</b>
        </header>
        <div className="wishlist-body">
          {!wishlistDestinations.length || !activeWish ? (
            <div className="wishlist-empty">
              <Sparkles size={22}/>
              <b>心愿单为空</b>
              <p>点当季推荐 ♡，或在国家地图点击未解锁节点加入心愿。</p>
              <button type="button" className="button ink" onClick={() => setWishlistOpen(false)}>关闭</button>
            </div>
          ) : (
            <>
              <article className="wishlist-feature">
                <div className="wishlist-feature-media">
                  <img src={activeWish.image} alt={activeWish.title}/>
                  <span className="wishlist-feature-badge">{activeWishUnlocked ? getStatusForDestination(activeWish).label : '待解锁 · 心愿'}</span>
                </div>
                <div className="wishlist-feature-copy">
                  <small>{activeWish.grade} · {activeWish.theme}</small>
                  <b>{activeWish.title}</b>
                  <em>{activeWish.location}</em>
                  <p>{activeWish.reason}</p>
                  <div className="wishlist-feature-meta">
                    <span>{activeWish.bestSeasonLabel}</span>
                    <span>适配 {activeWish.score}</span>
                    <span>{getStatusForDestination(activeWish).label}</span>
                  </div>
                  <div className="wishlist-feature-actions">
                    {activeWishUnlocked ? (
                      <button type="button" className="button btn-enter" onClick={() => navigateToDestination(activeWish)}>进入地图</button>
                    ) : (
                      <button type="button" className="button btn-unlock" onClick={() => openDestinationUnlock(activeWish, { fromWishlist: true })}>
                        <TicketCheck size={15}/> 开始解锁
                      </button>
                    )}
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
                  <span>{String(wishlistIndex + 1).padStart(2, '0')} / {String(wishlistDestinations.length).padStart(2, '0')} · 待解锁 {wishlistLockedCount}</span>
                </div>
                <div className="wishlist-thumbs" role="list">
                  {wishlistDestinations.map((item, index) => (
                    <button type="button" role="listitem" key={item.id} className={`wishlist-thumb ${index === wishlistIndex ? 'is-active' : ''}`} onClick={() => setWishlistIndex(index)}>
                      <img src={item.image} alt=""/>
                      <span>
                        <b>{item.title.split(' · ')[0]}</b>
                        <small>{isDestinationUnlocked(item) ? '可进入' : '待解锁'}</small>
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
      <button className="close" onClick={closeUnlockModal} aria-label={unlockFromWishlist ? '返回心愿单' : '关闭解锁'}><X/></button><span className="section-kicker">REGION UNLOCK · VERIFIED SOURCES{unlockFromWishlist ? ' · 返回心愿单' : ''}</span>
      <div className="unlock-title"><div><h2>{unlockDestinationProfile.name}<br/><i>{unlockDestinationProfile.english}</i></h2><p>{unlockTarget.reason}。完成以下真实准备项后，这个地区会写入你的地图。</p></div><span>{unlockDestinationProfile.code}<br/><b>{Math.abs(unlockDestinationProfile.focus[0]).toFixed(0)}°{unlockDestinationProfile.focus[0] >= 0 ? 'N' : 'S'}</b></span></div>
      {profile ? <div className="unlock-origin"><span className="mini-passport" style={{background:profile.color,color:profile.accent}}>{profile.emblem}</span><p>航线起点<b>{profile.country}</b></p><Plane size={16}/><p>目的地<b>{unlockDestinationProfile.name}</b></p></div> : <button className="unlock-origin missing" onClick={() => { setUnlockFromWishlist(false); setUnlockOpen(false); openProfileSettings(); }}><UserRound size={17}/><span>先完成角色国籍设定，才能确定解锁航线</span><ArrowUpRight size={15}/></button>}
      <div className="unlock-score"><b>{unlockProgress}<small>%</small></b><span>地区解锁准备度</span><i><em style={{width:`${unlockProgress}%`}}/></i></div>
      <div className="unlock-list">{unlockTasks.map(task => <label className={unlockDraft[task.id] ? 'checked' : ''} key={task.id}><input type="checkbox" checked={Boolean(unlockDraft[task.id])} onChange={() => toggleUnlockTask(task.id)}/><span className="task-check">{unlockDraft[task.id] && <Check/>}</span><span className="task-copy"><b>{task.label}</b><small>{task.detail}</small><a href={task.sourceUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{task.sourceLabel} ↗</a></span><em>{unlockDraft[task.id] ? '已确认' : '待核验'}</em></label>)}</div>
      <div className="unlock-actions-row">
        <button type="button" className={`button wish-inline ${wishlist.includes(unlockTarget.id) ? 'is-on' : ''}`} onClick={() => toggleWishlist(unlockTarget)}>
          {wishlist.includes(unlockTarget.id) ? '♥ 已在心愿单' : '♡ 加入心愿单'}
        </button>
        {isDestinationUnlocked(unlockTarget) && <button type="button" className="button ink" onClick={() => { markMastered(unlockTarget); setUnlockToast(`${unlockTarget.title} 已标记深度探索`); window.setTimeout(() => setUnlockToast(null), 2200); }}>标记深度探索</button>}
      </div>
      {unlockReady ? <button className="button unlock-region-button" onClick={launchUnlockedRegion}><Plane size={16}/>解锁{unlockDestinationProfile.name}并播放航线</button> : <button className="button ink unlock-save" disabled={unlockProgress === 0} onClick={saveUnlockProgress}><Save size={16}/>{unlockComplete ? '保存并验证全部准备' : '保存准备进度'}</button>}
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
