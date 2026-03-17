export type Screen = 'login' | 'menu' | 'game' | 'gameOver' | 'garage' | 'shop' | 'profile' | 'leaderboard' | 'friends' | 'achievements';

export const SAVE_KEY = 'king_parking_profile_v1';
export const SESSION_KEY = 'king_parking_session';
export const SESSION_TTL = 60 * 60 * 1000;
export const ANON_ID_KEY = 'king_parking_anon_id';

export function getOrCreateAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch { return `anon_${Date.now()}`; }
}

const _BASE = (import.meta.env['VITE_API_URL'] || 'https://ednord.ru/api').replace(/\/$/, '');
export const AUTH_URL = `${_BASE}/auth`;
export const LEADERBOARD_URL = `${_BASE}/leaderboard`;
export const ROOM_URL = `${_BASE}/room-manager`;
export const FRIENDS_URL = `${_BASE}/friends`;

// Тип одного игрока в комнате (с бэкенда)
export interface RoomPlayer {
  player_id: string;
  name: string;
  emoji: string;
  color: string;
  body_color: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  hp: number;
  max_hp: number;
  orbit_angle: number;
  orbit_radius: number;
  parked: boolean;
  park_spot: number;
  eliminated: boolean;
  is_bot: boolean;
  last_seen: number;
}

// Состояние комнаты
export interface RoomState {
  roomId: string;
  status: 'waiting' | 'playing' | 'finished';
  round: number;
  phase: string;
  timerEnd: number;
  serverNow?: number;
  spots: { x: number; y: number; occupied: boolean; car_id: string | null }[];
  players: RoomPlayer[];
  isFinal?: boolean;
}

declare global {
  interface Window {
    YaGames?: { init: () => Promise<YaSDK> };
    _yaSDK?: YaSDK;
  }
}

interface YaPayments {
  getCatalog: () => Promise<YaProduct[]>;
  purchase: (opts: { id: string }) => Promise<{ purchaseData: string; signature: string }>;
  getPurchases: () => Promise<{ productID: string; purchaseToken: string }[]>;
  consumePurchase: (token: string) => Promise<void>;
}

interface YaProduct {
  id: string;
  title: string;
  description: string;
  imageURI: string;
  price: string;
  priceValue: string;
  priceCurrencyCode: string;
  getPriceCurrencyImage: (size?: 'small' | 'medium' | 'svg') => string;
}

export interface GemPackInfo {
  id: string;
  price: string;
  priceValue: string;
  priceCurrencyCode: string;
  currencyImageUrl: string;
}

interface YaAdv {
  showFullscreenAdv: (opts: { callbacks: { onClose?: (wasShown: boolean) => void; onError?: (err: unknown) => void } }) => void;
  showRewardedVideo: (opts: { callbacks: { onRewarded?: () => void; onClose?: (wasShown: boolean) => void; onError?: (err: unknown) => void } }) => void;
}

interface YaSDK {
  getPlayer: (opts?: { scopes?: boolean }) => Promise<{ getUniqueID: () => string; getName: () => string; getPhoto: (size: string) => string }>;
  getPayments: (opts?: { signed?: boolean }) => Promise<YaPayments>;
  adv: YaAdv;
  features: {
    LoadingAPI?: { ready: () => void };
  };
  environment: {
    i18n: { lang: string };
    app: { id: string };
    payload?: string;
  };
}

let _ysdk: YaSDK | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function waitForYaGames(ms: number): Promise<void> {
  if (window.YaGames) return;
  return new Promise(resolve => {
    const deadline = Date.now() + ms;
    const check = () => {
      if (window.YaGames || Date.now() >= deadline) { resolve(); return; }
      setTimeout(check, 100);
    };
    check();
  });
}

export async function initYandexGames() {
  try {
    await waitForYaGames(5000);
    if (!window.YaGames) {
      console.log('[YaGames] window.YaGames not found');
      return;
    }
    console.log('[YaGames] calling YaGames.init()...');
    _ysdk = await window.YaGames.init();
    window._yaSDK = _ysdk;
    console.log('[YaGames] SDK initialized OK, env:', _ysdk?.environment?.app?.id);
  } catch (e) {
    console.log('[YaGames] init error:', e);
  }
}

export function notifyGameReady() {
  try {
    const sdk = _ysdk ?? window._yaSDK;
    if (sdk?.features?.LoadingAPI) {
      sdk.features.LoadingAPI.ready();
    }
  } catch { /* ignore */ }
}

export function getYaLang(): string {
  try {
    const sdk = _ysdk ?? window._yaSDK;
    return sdk?.environment?.i18n?.lang ?? 'ru';
  } catch { return 'ru'; }
}

export function showInterstitialAd(): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const sdk = _ysdk ?? window._yaSDK;
      if (!sdk?.adv) { resolve(false); return; }
      sdk.adv.showFullscreenAdv({
        callbacks: {
          onClose: () => resolve(true),
          onError: () => resolve(false),
        },
      });
    } catch { resolve(false); }
  });
}

export function showRewardedAd(): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const sdk = _ysdk ?? window._yaSDK;
      if (!sdk?.adv) { resolve(false); return; }
      sdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => resolve(true),
          onClose: (wasShown) => { if (!wasShown) resolve(false); },
          onError: () => resolve(false),
        },
      });
    } catch { resolve(false); }
  });
}

export function isYandexGamesEnv(): boolean {
  if (_ysdk ?? window._yaSDK) return true;
  try {
    const h = window.location.hostname;
    return h.includes('yandex.net') || h.includes('games.s3.yandex') || h.includes('yandex.ru') || window.YaGames !== undefined;
  } catch { return false; }
}

export async function getYaCatalog(): Promise<GemPackInfo[]> {
  let sdk = _ysdk ?? window._yaSDK;
  // Если SDK упал при init — пробуем ещё раз напрямую
  if (!sdk && window.YaGames) {
    try {
      sdk = await window.YaGames.init();
      _ysdk = sdk;
      window._yaSDK = sdk;
    } catch { /* ignore */ }
  }
  if (!sdk) return [];
  try {
    const payments = await sdk.getPayments({ signed: false });
    const products = await payments.getCatalog();
    return products.map(p => {
      let currencyImageUrl = '';
      try {
        if (typeof p.getPriceCurrencyImage === 'function') {
          const raw = p.getPriceCurrencyImage('small') || p.getPriceCurrencyImage('medium') || p.getPriceCurrencyImage('svg') || '';
          currencyImageUrl = raw.startsWith('//') ? `https:${raw}` : raw;
        }
      } catch { /* ignore */ }
      return {
        id: p.id,
        price: p.price,
        priceValue: p.priceValue,
        priceCurrencyCode: p.priceCurrencyCode,
        currencyImageUrl,
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    _catalogError = msg;
    return [];
  }
}

let _catalogError = '';
export function getCatalogError(): string { return _catalogError; }

export async function buyGems(productId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const sdk = _ysdk ?? window._yaSDK;
    if (!sdk) return { ok: false, error: 'no_sdk' };
    const payments = await sdk.getPayments({ signed: true });
    const purchase = await payments.purchase({ id: productId });
    if (purchase?.purchaseToken) {
      await payments.consumePurchase(purchase.purchaseToken);
      const gems = GEM_PACK_MAP[productId];
      if (gems) appendGemLog(productId, gems);
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('cancel') || msg.includes('close')) return { ok: false, error: 'cancelled' };
    return { ok: false, error: msg };
  }
}

// ID товара → количество кристаллов
const GEM_PACK_MAP: Record<string, number> = {
  gems_100: 100,
  gems_300: 350,
  gems_700: 850,
  gems_1500: 2000,
};

const GEM_LOG_KEY = 'parking_gem_purchases_v1';

export interface GemPurchaseEntry {
  productId: string;
  gems: number;
  date: string; // ISO date string
}

export function getGemPurchaseLog(): GemPurchaseEntry[] {
  try { return JSON.parse(localStorage.getItem(GEM_LOG_KEY) ?? '[]'); } catch { return []; }
}

function appendGemLog(productId: string, gems: number) {
  const log = getGemPurchaseLog();
  log.unshift({ productId, gems, date: new Date().toISOString() });
  localStorage.setItem(GEM_LOG_KEY, JSON.stringify(log.slice(0, 50)));
}

export async function restoreGemPurchases(): Promise<{ restored: number; count: number }> {
  try {
    const sdk = _ysdk ?? window._yaSDK;
    if (!sdk) return { restored: 0, count: 0 };
    const payments = await sdk.getPayments({ signed: true });
    const purchases = await payments.getPurchases();
    let totalGems = 0;
    for (const p of purchases) {
      const gems = GEM_PACK_MAP[p.productID];
      if (gems) {
        totalGems += gems;
        try {
          await payments.consumePurchase(p.purchaseToken);
          appendGemLog(p.productID, gems);
        } catch { /* already consumed */ }
      }
    }
    return { restored: totalGems, count: purchases.length };
  } catch {
    return { restored: 0, count: 0 };
  }
}

export async function requestYaAuth(): Promise<void> {
  try {
    const sdk = _ysdk ?? window._yaSDK;
    if (!sdk?.auth) return;
    await sdk.auth.openAuthDialog();
  } catch (e) {
    console.log('[YaGames] openAuthDialog error:', e);
  }
}

export async function saveYaPlayerData(data: Record<string, unknown>): Promise<void> {
  try {
    const sdk = _ysdk ?? window._yaSDK;
    if (!sdk) return;
    const p = await sdk.getPlayer({ scopes: false });
    if (!p?.setData) return;
    await p.setData(data, true);
  } catch (e) {
    console.log('[YaGames] setData error:', e);
  }
}

export async function loadYaPlayerData(): Promise<Record<string, unknown> | null> {
  try {
    const sdk = _ysdk ?? window._yaSDK;
    if (!sdk) return null;
    const p = await sdk.getPlayer({ scopes: false });
    if (!p?.getData) return null;
    const data = await p.getData();
    return data ?? null;
  } catch (e) {
    console.log('[YaGames] getData error:', e);
    return null;
  }
}

export async function getYaPlayer(): Promise<{ id: string; name: string; isAuthorized: boolean } | null> {
  try {
    const sdk = _ysdk ?? window._yaSDK;
    if (!sdk) {
      console.log('[YaGames] getYaPlayer: no SDK');
      return null;
    }
    let p;
    try {
      // scopes:false — сначала получаем без запроса прав
      p = await sdk.getPlayer({ scopes: false });
    } catch (e) {
      console.log('[YaGames] getPlayer() error:', e);
      return null;
    }
    const uid = p.getUniqueID();
    const name = p.getName() || '';
    const mode = p.getMode ? p.getMode() : 'unknown';
    const isAuthorized = !!uid && mode !== 'lite';
    console.log('[YaGames] getPlayer result: uid=', uid, 'name=', name, 'mode=', mode, 'isAuthorized=', isAuthorized);

    // Если не авторизован — возвращаем lite-профиль, диалог покажем после загрузки
    if (!isAuthorized) {
      if (uid) return { id: `ya_${uid}`, name, isAuthorized: false };
      return null;
    }

    if (!uid) return null;
    return { id: `ya_${uid}`, name, isAuthorized };
  } catch (e) {
    console.log('[YaGames] getYaPlayer error:', e);
    return null;
  }
}

export async function roomApi(action: string, payload: Record<string, unknown>): Promise<RoomState & Record<string, unknown>> {
  const res = await fetch(ROOM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(`server_error_${res.status}`);
  return res.json();
}

export function getSession(): { name: string; password: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { name, password, ts } = JSON.parse(raw);
    if (Date.now() - ts > SESSION_TTL) { localStorage.removeItem(SESSION_KEY); return null; }
    return { name, password };
  } catch { return null; }
}

export function setSession(name: string, password: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name, password, ts: Date.now() }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export interface DailyQuest {
  id: string;
  label: string;
  goal: number;
  progress: number;
  done: boolean;
  claimed: boolean;
  reward: { coins: number; gems?: number };
}

export interface WeeklyQuest {
  id: string;
  label: string;
  goal: number;
  progress: number;
  done: boolean;
  claimed: boolean;
  reward: { coins: number; gems: number };
}

export interface PlayerData {
  name: string;
  emoji: string;
  password: string;
  coins: number;
  gems: number;
  xp: number;
  level: number;
  wins: number;
  gamesPlayed: number;
  bestPosition: number;
  cars: CarData[];
  selectedCar: number;
  upgrades: {
    nitro: boolean;
    gps: boolean;
    bumper: boolean;
    autoRepair: boolean;
    magnet: boolean;
    turbo: boolean;
    shield: boolean;
  };
  upgradeExpiry?: {
    nitro?: number;
    gps?: number;
    bumper?: number;
    autoRepair?: number;
    magnet?: number;
    turbo?: number;
    shield?: number;
  };
  loginStreak: number;
  lastLoginDate: string;
  dailyQuests: DailyQuest[];
  dailyQuestsDate: string;
  weeklyQuests: WeeklyQuest[];
  weeklyQuestsDate: string;
  nicknameChanges?: number;
  coinBoostSessions?: number;
  extraLives?: number;
  xpBoostGames?: number;
}

export async function apiAuth(action: string, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

const LB_CACHE_KEY = 'parking_lb_cache';
const LB_CACHE_TTL = 60 * 1000; // 1 минута

export interface LeaderboardResult {
  leaders: LeaderEntry[];
  myRank?: number | null;
}

export async function fetchLeaderboard(playerName?: string): Promise<LeaderboardResult> {
  try {
    const cacheKey = LB_CACHE_KEY + (playerName ? `_${playerName}` : '');
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < LB_CACHE_TTL) return data;
    }
    const url = playerName ? `${LEADERBOARD_URL}?name=${encodeURIComponent(playerName)}` : LEADERBOARD_URL;
    const res = await fetch(url);
    const json = await res.json();
    const result: LeaderboardResult = { leaders: json.leaders || [], myRank: json.myRank ?? null };
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: result }));
    return result;
  } catch { return { leaders: [] }; }
}

export interface LeaderEntry {
  rank: number;
  name: string;
  emoji: string;
  wins: number;
  xp: number;
  gamesPlayed: number;
}

export interface CarData {
  id: number;
  name: string;
  emoji: string;
  color: string;
  bodyColor: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  hp: number;
  maxHp: number;
  baseMaxHp: number;
  speed: number;
  maxSpeed: number;
  baseMaxSpeed: number;
  armor: number;
  baseArmor: number;
  owned: boolean;
  price: number;
  repairCost: number;
  hpLevel: number;
  armorLevel: number;
  speedLevel: number;
}

export const UPGRADE_COSTS = {
  hp:    [300, 600, 1000, 1500, 2500],
  armor: [400, 800, 1500, 2500, 4000],
  speed: [800, 1800, 3500],
} as const;

export const UPGRADE_BONUS = {
  hp:    20,
  armor: 0.5,
  speed: 0.3,
} as const;

export const INITIAL_CARS: CarData[] = [
  { id: 0, name: 'Жигуль',      emoji: '🚗',  color: '#FF2D55', bodyColor: '#CC0033', rarity: 'common',    hp: 100, maxHp: 100, baseMaxHp: 100, speed: 3,   maxSpeed: 3,   baseMaxSpeed: 3,   armor: 1,   baseArmor: 1,   owned: true,  price: 0,    repairCost: 50,  hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 1, name: 'Такси',       emoji: '🚕',  color: '#FFD600', bodyColor: '#CC9900', rarity: 'common',    hp: 100, maxHp: 100, baseMaxHp: 100, speed: 3.2, maxSpeed: 3.2, baseMaxSpeed: 3.2, armor: 1,   baseArmor: 1,   owned: false, price: 400,  repairCost: 60,  hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 2, name: 'Внедорожник', emoji: '🚙',  color: '#34C759', bodyColor: '#248A3D', rarity: 'rare',      hp: 140, maxHp: 140, baseMaxHp: 140, speed: 2.8, maxSpeed: 2.8, baseMaxSpeed: 2.8, armor: 2,   baseArmor: 2,   owned: false, price: 900,  repairCost: 100, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 3, name: 'Болид',       emoji: '🏎️', color: '#FF6B35', bodyColor: '#CC4400', rarity: 'epic',      hp: 80,  maxHp: 80,  baseMaxHp: 80,  speed: 4.5, maxSpeed: 4.5, baseMaxSpeed: 4.5, armor: 0.5, baseArmor: 0.5, owned: false, price: 2500, repairCost: 200, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 4, name: 'Патруль',     emoji: '🚓',  color: '#007AFF', bodyColor: '#0055CC', rarity: 'rare',      hp: 130, maxHp: 130, baseMaxHp: 130, speed: 3.5, maxSpeed: 3.5, baseMaxSpeed: 3.5, armor: 1.5, baseArmor: 1.5, owned: false, price: 1200, repairCost: 120, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 5, name: 'Скорая',      emoji: '🚑',  color: '#FFFFFF', bodyColor: '#CCCCCC', rarity: 'rare',      hp: 150, maxHp: 150, baseMaxHp: 150, speed: 3.0, maxSpeed: 3.0, baseMaxSpeed: 3.0, armor: 1.5, baseArmor: 1.5, owned: false, price: 1500, repairCost: 130, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 6, name: 'Пожарка',     emoji: '🚒',  color: '#FF3B30', bodyColor: '#AA0000', rarity: 'epic',      hp: 200, maxHp: 200, baseMaxHp: 200, speed: 2.5, maxSpeed: 2.5, baseMaxSpeed: 2.5, armor: 3,   baseArmor: 3,   owned: false, price: 3500, repairCost: 250, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 7, name: 'Пикап',       emoji: '🛻',  color: '#5AC8FA', bodyColor: '#0088CC', rarity: 'common',    hp: 110, maxHp: 110, baseMaxHp: 110, speed: 3.1, maxSpeed: 3.1, baseMaxSpeed: 3.1, armor: 1.2, baseArmor: 1.2, owned: false, price: 700,  repairCost: 70,  hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 8, name: 'Ракета',      emoji: '🚀',  color: '#AF52DE', bodyColor: '#7B2FA8', rarity: 'legendary', hp: 90,  maxHp: 90,  baseMaxHp: 90,  speed: 5.5, maxSpeed: 5.5, baseMaxSpeed: 5.5, armor: 0.3, baseArmor: 0.3, owned: false, price: 8000, repairCost: 500, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
];

export const PLAYER_EMOJIS = ['😎', '🤠', '😤', '🥷', '👨‍🚀', '🧑‍🎤', '🥸', '😈'];

export const RARITIES = {
  common:    { label: 'Обычный', color: 'text-white/60',    border: 'border-white/20',        bg: 'bg-white/5' },
  rare:      { label: 'Редкий',  color: 'text-blue-400',    border: 'border-blue-500/50',     bg: 'bg-blue-500/10' },
  epic:      { label: 'Эпик',    color: 'text-purple-400',  border: 'border-purple-500/50',   bg: 'bg-purple-500/10' },
  legendary: { label: 'Легенда', color: 'text-yellow-400',  border: 'border-yellow-500/50',   bg: 'bg-yellow-500/10' },
};

export function xpForLevel(level: number) { return level * 300; }
export function levelFromXp(xp: number) {
  let l = 1; let remaining = xp;
  while (remaining >= xpForLevel(l)) { remaining -= xpForLevel(l); l++; }
  return l;
}

export interface LevelReward {
  level: number;
  coins: number;
  gems?: number;
  bonusKey?: string;
}

export const LEVEL_REWARDS: LevelReward[] = [
  { level: 1,  coins: 200 },
  { level: 2,  coins: 250 },
  { level: 3,  coins: 300 },
  { level: 4,  coins: 350 },
  { level: 5,  coins: 500,  gems: 5,  bonusKey: 'lvl_bonus_5' },
  { level: 6,  coins: 400 },
  { level: 7,  coins: 450 },
  { level: 8,  coins: 500 },
  { level: 9,  coins: 550 },
  { level: 10, coins: 800,  gems: 10, bonusKey: 'lvl_bonus_10' },
  { level: 12, coins: 600 },
  { level: 15, coins: 1000, gems: 15, bonusKey: 'lvl_bonus_15' },
  { level: 20, coins: 1500, gems: 20, bonusKey: 'lvl_bonus_20' },
  { level: 25, coins: 2000, gems: 25, bonusKey: 'lvl_bonus_25' },
  { level: 30, coins: 3000, gems: 30, bonusKey: 'lvl_bonus_30' },
];

export const DAILY_STREAK_REWARDS: { coins: number; gems: number }[] = [
  { coins: 100, gems: 0 },
  { coins: 150, gems: 0 },
  { coins: 200, gems: 1 },
  { coins: 300, gems: 1 },
  { coins: 400, gems: 2 },
  { coins: 500, gems: 2 },
  { coins: 750, gems: 5 },
];

export function makeDailyQuests(dateStr?: string, tFn?: (key: string) => string): DailyQuest[] {
  const tr = tFn ?? ((k: string) => k);
  const d = new Date(dateStr ?? todayDateStr());
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

  function rng(s: number) {
    const x = Math.sin(s) * 99317;
    return x - Math.floor(x);
  }

  const playGoals = [2, 3, 3, 4, 4, 5];
  const topNOptions = [3, 3, 4, 5, 5];
  const surviveOptions = [4, 5, 5, 6, 7];
  const winOptions = [1, 2, 2, 3];

  const playGoal = playGoals[Math.floor(rng(seed + 1) * playGoals.length)];
  const topN = topNOptions[Math.floor(rng(seed + 2) * topNOptions.length)];
  const surviveRound = surviveOptions[Math.floor(rng(seed + 3) * surviveOptions.length)];
  const winGoal = winOptions[Math.floor(rng(seed + 4) * winOptions.length)];

  const allQuests: DailyQuest[] = [
    {
      id: 'play3',
      label: `${tr('quest_play')} ${playGoal} ${playGoal === 1 ? tr('quest_games_1') : playGoal < 5 ? tr('quest_games_2_4') : tr('quest_games_5')}`,
      goal: playGoal, progress: 0, done: false, claimed: false,
      reward: { coins: 80 + playGoal * 40 },
    },
    {
      id: 'top5',
      label: `${tr('quest_top')}-${topN}`,
      goal: 1, progress: 0, done: false, claimed: false,
      reward: { coins: topN <= 3 ? 350 : 200, gems: topN <= 3 ? 1 : 0 },
    },
    {
      id: 'survive',
      label: `${tr('quest_survive')} ${surviveRound}${tr('quest_survive2')}`,
      goal: surviveRound, progress: 0, done: false, claimed: false,
      reward: { coins: surviveRound >= 6 ? 380 : 240, gems: surviveRound >= 6 ? 1 : 0 },
    },
    {
      id: 'win',
      label: `${tr('quest_win')} ${winGoal === 1 ? tr('quest_win_once') : winGoal + ' ' + tr('quest_win_times')}`,
      goal: winGoal, progress: 0, done: false, claimed: false,
      reward: { coins: 200 + winGoal * 100, gems: winGoal >= 2 ? 1 : 0 },
    },
    {
      id: 'play_long',
      label: tr('quest_no_elim'),
      goal: 1, progress: 0, done: false, claimed: false,
      reward: { coins: 450, gems: 1 },
    },
    {
      id: 'top1_streak',
      label: tr('quest_top2_twice'),
      goal: 2, progress: 0, done: false, claimed: false,
      reward: { coins: 500, gems: 2 },
    },
  ];

  const pick1 = Math.floor(rng(seed + 10) * 3);
  const pick2 = 3 + Math.floor(rng(seed + 20) * 3);

  const questPool = [allQuests[pick1], allQuests[pick2]];
  const remaining = allQuests.filter((_, i) => i !== pick1 && i !== pick2);
  const pick3idx = Math.floor(rng(seed + 30) * remaining.length);
  questPool.push(remaining[pick3idx]);

  return questPool;
}

export function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export function weeklyDateStr() {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function makeWeeklyQuests(weekStr?: string, tFn?: (key: string) => string): WeeklyQuest[] {
  const tr = tFn ?? ((k: string) => k);
  const w = weekStr ?? weeklyDateStr();
  const parts = w.split('-').map(Number);
  const seed = parts[0] * 10000 + parts[1] * 100 + parts[2];

  function rng(s: number) {
    const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const allWeekly: WeeklyQuest[] = [
    {
      id: 'w_play15',
      label: tr('wquest_play15'),
      goal: 15, progress: 0, done: false, claimed: false,
      reward: { coins: 800, gems: 3 },
    },
    {
      id: 'w_play25',
      label: tr('wquest_play25'),
      goal: 25, progress: 0, done: false, claimed: false,
      reward: { coins: 1500, gems: 5 },
    },
    {
      id: 'w_win5',
      label: tr('wquest_win5'),
      goal: 5, progress: 0, done: false, claimed: false,
      reward: { coins: 1000, gems: 4 },
    },
    {
      id: 'w_win10',
      label: tr('wquest_win10'),
      goal: 10, progress: 0, done: false, claimed: false,
      reward: { coins: 2000, gems: 8 },
    },
    {
      id: 'w_top3_10',
      label: tr('wquest_top3'),
      goal: 10, progress: 0, done: false, claimed: false,
      reward: { coins: 1200, gems: 5 },
    },
    {
      id: 'w_survive8_3',
      label: tr('wquest_survive8'),
      goal: 3, progress: 0, done: false, claimed: false,
      reward: { coins: 900, gems: 4 },
    },
    {
      id: 'w_daily7',
      label: tr('wquest_daily7'),
      goal: 3, progress: 0, done: false, claimed: false,
      reward: { coins: 1500, gems: 7 },
    },
    {
      id: 'w_streak7',
      label: tr('wquest_streak7'),
      goal: 7, progress: 0, done: false, claimed: false,
      reward: { coins: 1000, gems: 10 },
    },
  ];

  const idx1 = Math.floor(rng(seed + 1) * 2);
  const idx2 = 2 + Math.floor(rng(seed + 2) * 2);
  const idx3 = 4 + Math.floor(rng(seed + 3) * 4);

  return [allWeekly[idx1], allWeekly[idx2], allWeekly[idx3]];
}

export const DEFAULT_PLAYER: PlayerData = {
  name: '',
  emoji: '😎',
  password: '',
  coins: 300,
  gems: 10,
  xp: 0,
  level: 1,
  wins: 0,
  gamesPlayed: 0,
  bestPosition: 99,
  cars: INITIAL_CARS,
  selectedCar: 0,
  upgrades: { nitro: false, gps: false, bumper: false, autoRepair: false, magnet: false, turbo: false, shield: false },
  loginStreak: 0,
  lastLoginDate: '',
  dailyQuests: makeDailyQuests(),
  dailyQuestsDate: '',
  weeklyQuests: makeWeeklyQuests(),
  weeklyQuestsDate: '',
};

export function getProfileKey(yaId?: string): string {
  return yaId ? `${SAVE_KEY}_ya_${yaId}` : SAVE_KEY;
}

export function loadProfile(yaId?: string): PlayerData | null {
  try {
    const raw = localStorage.getItem(getProfileKey(yaId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as PlayerData;
    const mergedCars = INITIAL_CARS.map(ic => {
      const saved_car = saved.cars?.find(c => c.id === ic.id);
      if (!saved_car) return ic;
      const hpLevel = saved_car.hpLevel ?? 0;
      const armorLevel = saved_car.armorLevel ?? 0;
      const speedLevel = saved_car.speedLevel ?? 0;
      const maxHp = ic.baseMaxHp + hpLevel * UPGRADE_BONUS.hp;
      const armor = ic.baseArmor + armorLevel * UPGRADE_BONUS.armor;
      const maxSpeed = ic.baseMaxSpeed + speedLevel * UPGRADE_BONUS.speed;
      return { ...ic, owned: saved_car.owned, hp: Math.min(saved_car.hp, maxHp), maxHp, armor, maxSpeed, speed: maxSpeed, hpLevel, armorLevel, speedLevel };
    });
    // Сбрасываем апгрейды у которых истёк срок или нет expiry-записи
    const rawUpgrades = { ...DEFAULT_PLAYER.upgrades, ...(saved.upgrades ?? {}) };
    const expiry = saved.upgradeExpiry ?? {};
    const now = Date.now();
    const mergedUpgrades = Object.fromEntries(
      (Object.keys(rawUpgrades) as (keyof typeof rawUpgrades)[]).map(key => {
        const active = rawUpgrades[key];
        if (!active) return [key, false];
        const exp = expiry[key];
        // Если апгрейд активен но нет expiry или время вышло — сбрасываем
        if (!exp || exp < now) return [key, false];
        return [key, true];
      })
    ) as typeof rawUpgrades;
    const today = todayDateStr();
    const thisWeek = weeklyDateStr();
    const dailyQuests = saved.dailyQuestsDate === today ? (saved.dailyQuests ?? makeDailyQuests()) : makeDailyQuests();
    const weeklyQuests = saved.weeklyQuestsDate === thisWeek ? (saved.weeklyQuests ?? makeWeeklyQuests()) : makeWeeklyQuests();
    return {
      ...saved,
      cars: mergedCars,
      upgrades: mergedUpgrades,
      loginStreak: saved.loginStreak ?? 0,
      lastLoginDate: saved.lastLoginDate ?? '',
      dailyQuests,
      dailyQuestsDate: saved.dailyQuestsDate === today ? today : '',
      weeklyQuests,
      weeklyQuestsDate: saved.weeklyQuestsDate === thisWeek ? thisWeek : '',
    };
  } catch {
    return null;
  }
}

export function profileToSavePayload(p: PlayerData) {
  return {
    name: p.name,
    emoji: p.emoji,
    coins: p.coins,
    gems: p.gems,
    xp: p.xp,
    level: p.level ?? 1,
    wins: p.wins,
    gamesPlayed: p.gamesPlayed,
    bestPosition: p.bestPosition,
    selectedCar: p.selectedCar,
    ownedCars: p.cars.filter(c => c.owned).map(c => c.id),
    upgrades: p.upgrades,
    upgradeExpiry: p.upgradeExpiry ?? {},
    cars: p.cars,
    extraLives: p.extraLives ?? 0,
    coinBoostSessions: p.coinBoostSessions ?? 0,
    xpBoostGames: p.xpBoostGames ?? 0,
    loginStreak: p.loginStreak ?? 0,
    lastLoginDate: p.lastLoginDate ?? '',
    dailyQuests: p.dailyQuests ?? [],
    dailyQuestsDate: p.dailyQuestsDate ?? '',
    weeklyQuests: p.weeklyQuests ?? [],
    weeklyQuestsDate: p.weeklyQuestsDate ?? '',
    nicknameChanges: p.nicknameChanges ?? 0,
  };
}

export function saveProfile(p: PlayerData, yaId?: string) {
  try {
    localStorage.setItem(getProfileKey(yaId), JSON.stringify(p));
  } catch { /* ignore */ }
}