export type Screen = 'login' | 'menu' | 'game' | 'gameOver' | 'garage' | 'shop' | 'profile' | 'leaderboard';

export const SAVE_KEY = 'king_parking_profile_v1';
export const SESSION_KEY = 'king_parking_session';
export const SESSION_TTL = 60 * 60 * 1000;

export const AUTH_URL = 'https://functions.poehali.dev/3b4361d7-46d0-476d-be12-f345c31447fc';
export const LEADERBOARD_URL = 'https://functions.poehali.dev/507d718a-32e2-4623-a6d8-1cf02d2af300';

declare global {
  interface Window { YaGames?: { init: () => Promise<unknown> }; }
}

export async function initYandexGames() {
  if (window.YaGames) {
    try { await window.YaGames.init(); } catch { /* not in YG env */ }
  }
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
  reward: { coins: number; gems?: number };
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
  loginStreak: number;
  lastLoginDate: string;
  dailyQuests: DailyQuest[];
  dailyQuestsDate: string;
}

export async function apiAuth(action: string, payload: Record<string, unknown>) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

export async function fetchLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const res = await fetch(LEADERBOARD_URL);
    const data = await res.json();
    return data.leaders || [];
  } catch { return []; }
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
  hp:    [100, 200, 350, 500, 750],
  armor: [150, 300, 500, 750, 1000],
  speed: [300, 600, 1000],
} as const;

export const UPGRADE_BONUS = {
  hp:    20,
  armor: 0.5,
  speed: 0.3,
} as const;

export const INITIAL_CARS: CarData[] = [
  { id: 0, name: 'Жигуль',      emoji: '🚗',  color: '#FF2D55', bodyColor: '#CC0033', rarity: 'common',    hp: 100, maxHp: 100, baseMaxHp: 100, speed: 3,   maxSpeed: 3,   baseMaxSpeed: 3,   armor: 1,   baseArmor: 1,   owned: true,  price: 0,    repairCost: 50,  hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 1, name: 'Такси',       emoji: '🚕',  color: '#FFD600', bodyColor: '#CC9900', rarity: 'common',    hp: 100, maxHp: 100, baseMaxHp: 100, speed: 3.2, maxSpeed: 3.2, baseMaxSpeed: 3.2, armor: 1,   baseArmor: 1,   owned: false, price: 500,  repairCost: 60,  hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 2, name: 'Внедорожник', emoji: '🚙',  color: '#34C759', bodyColor: '#248A3D', rarity: 'rare',      hp: 140, maxHp: 140, baseMaxHp: 140, speed: 2.8, maxSpeed: 2.8, baseMaxSpeed: 2.8, armor: 2,   baseArmor: 2,   owned: false, price: 1200, repairCost: 100, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 3, name: 'Болид',       emoji: '🏎️', color: '#FF6B35', bodyColor: '#CC4400', rarity: 'epic',      hp: 80,  maxHp: 80,  baseMaxHp: 80,  speed: 4.5, maxSpeed: 4.5, baseMaxSpeed: 4.5, armor: 0.5, baseArmor: 0.5, owned: false, price: 3000, repairCost: 200, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 4, name: 'Патруль',     emoji: '🚓',  color: '#007AFF', bodyColor: '#0055CC', rarity: 'rare',      hp: 130, maxHp: 130, baseMaxHp: 130, speed: 3.5, maxSpeed: 3.5, baseMaxSpeed: 3.5, armor: 1.5, baseArmor: 1.5, owned: false, price: 1500, repairCost: 120, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 5, name: 'Скорая',      emoji: '🚑',  color: '#FFFFFF', bodyColor: '#CCCCCC', rarity: 'rare',      hp: 150, maxHp: 150, baseMaxHp: 150, speed: 3.0, maxSpeed: 3.0, baseMaxSpeed: 3.0, armor: 1.5, baseArmor: 1.5, owned: false, price: 1800, repairCost: 130, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 6, name: 'Пожарка',     emoji: '🚒',  color: '#FF3B30', bodyColor: '#AA0000', rarity: 'epic',      hp: 200, maxHp: 200, baseMaxHp: 200, speed: 2.5, maxSpeed: 2.5, baseMaxSpeed: 2.5, armor: 3,   baseArmor: 3,   owned: false, price: 4000, repairCost: 250, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 7, name: 'Пикап',       emoji: '🛻',  color: '#5AC8FA', bodyColor: '#0088CC', rarity: 'common',    hp: 110, maxHp: 110, baseMaxHp: 110, speed: 3.1, maxSpeed: 3.1, baseMaxSpeed: 3.1, armor: 1.2, baseArmor: 1.2, owned: false, price: 800,  repairCost: 70,  hpLevel: 0, armorLevel: 0, speedLevel: 0 },
  { id: 8, name: 'Ракета',      emoji: '🚀',  color: '#AF52DE', bodyColor: '#7B2FA8', rarity: 'legendary', hp: 90,  maxHp: 90,  baseMaxHp: 90,  speed: 5.5, maxSpeed: 5.5, baseMaxSpeed: 5.5, armor: 0.3, baseArmor: 0.3, owned: false, price: 9999, repairCost: 500, hpLevel: 0, armorLevel: 0, speedLevel: 0 },
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

export const DAILY_STREAK_REWARDS: { coins: number; gems: number }[] = [
  { coins: 100, gems: 0 },
  { coins: 150, gems: 0 },
  { coins: 200, gems: 1 },
  { coins: 300, gems: 1 },
  { coins: 400, gems: 2 },
  { coins: 500, gems: 2 },
  { coins: 750, gems: 5 },
];

export function makeDailyQuests(): DailyQuest[] {
  return [
    { id: 'play3',   label: 'Сыграй 3 игры',          goal: 3, progress: 0, done: false, reward: { coins: 150 } },
    { id: 'top5',    label: 'Финишируй в топ-5',       goal: 1, progress: 0, done: false, reward: { coins: 200 } },
    { id: 'survive', label: 'Доживи до 5-го раунда',   goal: 1, progress: 0, done: false, reward: { coins: 250, gems: 1 } },
  ];
}

export function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export const DEFAULT_PLAYER: PlayerData = {
  name: '',
  emoji: '😎',
  password: '',
  coins: 1000,
  gems: 50,
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
};

export function loadProfile(): PlayerData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
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
    const mergedUpgrades = { ...DEFAULT_PLAYER.upgrades, ...(saved.upgrades ?? {}) };
    const today = todayDateStr();
    const dailyQuests = saved.dailyQuestsDate === today ? (saved.dailyQuests ?? makeDailyQuests()) : makeDailyQuests();
    return {
      ...saved,
      cars: mergedCars,
      upgrades: mergedUpgrades,
      loginStreak: saved.loginStreak ?? 0,
      lastLoginDate: saved.lastLoginDate ?? '',
      dailyQuests,
      dailyQuestsDate: saved.dailyQuestsDate === today ? today : '',
    };
  } catch {
    return null;
  }
}

export function profileToSavePayload(p: PlayerData) {
  return {
    emoji: p.emoji,
    coins: p.coins,
    gems: p.gems,
    xp: p.xp,
    wins: p.wins,
    gamesPlayed: p.gamesPlayed,
    bestPosition: p.bestPosition,
    selectedCar: p.selectedCar,
    ownedCars: p.cars.filter(c => c.owned).map(c => c.id),
    upgrades: p.upgrades,
  };
}

export function saveProfile(p: PlayerData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch { /* ignore */ }
}