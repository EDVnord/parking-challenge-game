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
  speed: number;
  maxSpeed: number;
  armor: number;
  owned: boolean;
  price: number;
  repairCost: number;
}

export const INITIAL_CARS: CarData[] = [
  { id: 0, name: 'Жигуль',      emoji: '🚗',  color: '#FF2D55', bodyColor: '#CC0033', rarity: 'common',    hp: 100, maxHp: 100, speed: 3,   maxSpeed: 3,   armor: 1,   owned: true,  price: 0,    repairCost: 50 },
  { id: 1, name: 'Такси',       emoji: '🚕',  color: '#FFD600', bodyColor: '#CC9900', rarity: 'common',    hp: 100, maxHp: 100, speed: 3.2, maxSpeed: 3.2, armor: 1,   owned: false, price: 500,  repairCost: 60 },
  { id: 2, name: 'Внедорожник', emoji: '🚙',  color: '#34C759', bodyColor: '#248A3D', rarity: 'rare',      hp: 140, maxHp: 140, speed: 2.8, maxSpeed: 2.8, armor: 2,   owned: false, price: 1200, repairCost: 100 },
  { id: 3, name: 'Болид',       emoji: '🏎️', color: '#FF6B35', bodyColor: '#CC4400', rarity: 'epic',      hp: 80,  maxHp: 80,  speed: 4.5, maxSpeed: 4.5, armor: 0.5, owned: false, price: 3000, repairCost: 200 },
  { id: 4, name: 'Патруль',     emoji: '🚓',  color: '#007AFF', bodyColor: '#0055CC', rarity: 'rare',      hp: 130, maxHp: 130, speed: 3.5, maxSpeed: 3.5, armor: 1.5, owned: false, price: 1500, repairCost: 120 },
  { id: 5, name: 'Скорая',      emoji: '🚑',  color: '#FFFFFF', bodyColor: '#CCCCCC', rarity: 'rare',      hp: 150, maxHp: 150, speed: 3.0, maxSpeed: 3.0, armor: 1.5, owned: false, price: 1800, repairCost: 130 },
  { id: 6, name: 'Пожарка',     emoji: '🚒',  color: '#FF3B30', bodyColor: '#AA0000', rarity: 'epic',      hp: 200, maxHp: 200, speed: 2.5, maxSpeed: 2.5, armor: 3,   owned: false, price: 4000, repairCost: 250 },
  { id: 7, name: 'Пикап',       emoji: '🛻',  color: '#5AC8FA', bodyColor: '#0088CC', rarity: 'common',    hp: 110, maxHp: 110, speed: 3.1, maxSpeed: 3.1, armor: 1.2, owned: false, price: 800,  repairCost: 70 },
  { id: 8, name: 'Ракета',      emoji: '🚀',  color: '#AF52DE', bodyColor: '#7B2FA8', rarity: 'legendary', hp: 90,  maxHp: 90,  speed: 5.5, maxSpeed: 5.5, armor: 0.3, owned: false, price: 9999, repairCost: 500 },
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
};

export function loadProfile(): PlayerData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as PlayerData;
    const mergedCars = INITIAL_CARS.map(ic => {
      const saved_car = saved.cars?.find(c => c.id === ic.id);
      return saved_car ? { ...ic, owned: saved_car.owned, hp: saved_car.hp } : ic;
    });
    const mergedUpgrades = { ...DEFAULT_PLAYER.upgrades, ...(saved.upgrades ?? {}) };
    return { ...saved, cars: mergedCars, upgrades: mergedUpgrades };
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
