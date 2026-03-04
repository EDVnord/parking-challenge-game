import { useState, useEffect, useRef, useCallback } from 'react';
import GameCanvas from '@/components/GameCanvas';

// ──────────────── TYPES ────────────────
type Screen = 'login' | 'menu' | 'game' | 'gameOver' | 'garage' | 'shop' | 'profile' | 'leaderboard';

const SAVE_KEY = 'king_parking_profile_v1';
const SESSION_KEY = 'king_parking_session';
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

const AUTH_URL = 'https://functions.poehali.dev/3b4361d7-46d0-476d-be12-f345c31447fc';
const LEADERBOARD_URL = 'https://functions.poehali.dev/507d718a-32e2-4623-a6d8-1cf02d2af300';

// Yandex Games SDK init
declare global {
  interface Window { YaGames?: { init: () => Promise<unknown> }; }
}

async function initYandexGames() {
  if (window.YaGames) {
    try { await window.YaGames.init(); } catch { /* not in YG env */ }
  }
}

function getSession(): { name: string; password: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { name, password, ts } = JSON.parse(raw);
    if (Date.now() - ts > SESSION_TTL) { localStorage.removeItem(SESSION_KEY); return null; }
    return { name, password };
  } catch { return null; }
}

function setSession(name: string, password: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name, password, ts: Date.now() }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

interface PlayerData {
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

// API helpers
async function apiAuth(action: string, payload: Record<string, unknown>) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

async function fetchLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const res = await fetch(LEADERBOARD_URL);
    const data = await res.json();
    return data.leaders || [];
  } catch { return []; }
}

interface LeaderEntry {
  rank: number;
  name: string;
  emoji: string;
  wins: number;
  xp: number;
  gamesPlayed: number;
}

interface CarData {
  id: number;
  name: string;
  emoji: string;
  color: string;
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

const INITIAL_CARS: CarData[] = [
  { id: 0, name: 'Жигуль', emoji: '🚗', color: '#FF2D55', rarity: 'common', hp: 100, maxHp: 100, speed: 3, maxSpeed: 3, armor: 1, owned: true, price: 0, repairCost: 50 },
  { id: 1, name: 'Такси', emoji: '🚕', color: '#FFD600', rarity: 'common', hp: 100, maxHp: 100, speed: 3.2, maxSpeed: 3.2, armor: 1, owned: false, price: 500, repairCost: 60 },
  { id: 2, name: 'Внедорожник', emoji: '🚙', color: '#34C759', rarity: 'rare', hp: 140, maxHp: 140, speed: 2.8, maxSpeed: 2.8, armor: 2, owned: false, price: 1200, repairCost: 100 },
  { id: 3, name: 'Болид', emoji: '🏎️', color: '#FF6B35', rarity: 'epic', hp: 80, maxHp: 80, speed: 4.5, maxSpeed: 4.5, armor: 0.5, owned: false, price: 3000, repairCost: 200 },
  { id: 4, name: 'Патруль', emoji: '🚓', color: '#007AFF', rarity: 'rare', hp: 130, maxHp: 130, speed: 3.5, maxSpeed: 3.5, armor: 1.5, owned: false, price: 1500, repairCost: 120 },
  { id: 5, name: 'Скорая', emoji: '🚑', color: '#FFFFFF', rarity: 'rare', hp: 150, maxHp: 150, speed: 3.0, maxSpeed: 3.0, armor: 1.5, owned: false, price: 1800, repairCost: 130 },
  { id: 6, name: 'Пожарка', emoji: '🚒', color: '#FF3B30', rarity: 'epic', hp: 200, maxHp: 200, speed: 2.5, maxSpeed: 2.5, armor: 3, owned: false, price: 4000, repairCost: 250 },
  { id: 7, name: 'Пикап', emoji: '🛻', color: '#5AC8FA', rarity: 'common', hp: 110, maxHp: 110, speed: 3.1, maxSpeed: 3.1, armor: 1.2, owned: false, price: 800, repairCost: 70 },
  { id: 8, name: 'Ракета', emoji: '🚀', color: '#AF52DE', rarity: 'legendary', hp: 90, maxHp: 90, speed: 5.5, maxSpeed: 5.5, armor: 0.3, owned: false, price: 9999, repairCost: 500 },
];


const PLAYER_EMOJIS = ['😎', '🤠', '😤', '🥷', '👨‍🚀', '🧑‍🎤', '🥸', '😈'];

const RARITIES = {
  common: { label: 'Обычный', color: 'text-white/60', border: 'border-white/20', bg: 'bg-white/5' },
  rare: { label: 'Редкий', color: 'text-blue-400', border: 'border-blue-500/50', bg: 'bg-blue-500/10' },
  epic: { label: 'Эпик', color: 'text-purple-400', border: 'border-purple-500/50', bg: 'bg-purple-500/10' },
  legendary: { label: 'Легенда', color: 'text-yellow-400', border: 'border-yellow-500/50', bg: 'bg-yellow-500/10' },
};

function xpForLevel(level: number) { return level * 300; }
function levelFromXp(xp: number) {
  let l = 1; let remaining = xp;
  while (remaining >= xpForLevel(l)) { remaining -= xpForLevel(l); l++; }
  return l;
}

function loadProfile(): PlayerData | null {
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

function profileToSavePayload(p: PlayerData) {
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

function saveProfile(p: PlayerData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch { /* ignore */ }
}

const DEFAULT_PLAYER: PlayerData = {
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

// ──────────────── PROFILE CARD COMPONENT ────────────────
function ProfileCard({ player, xpInLevel, xpNeeded, onEmojiChange, onNameChange }: {
  player: PlayerData;
  xpInLevel: number;
  xpNeeded: number;
  onEmojiChange: (em: string) => void;
  onNameChange: (name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(player.name);
  const [nameError, setNameError] = useState('');

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError('Имя не может быть пустым'); return; }
    if (trimmed.length < 2) { setNameError('Минимум 2 символа'); return; }
    if (trimmed.length > 16) { setNameError('Максимум 16 символов'); return; }
    onNameChange(trimmed);
    setEditingName(false);
    setNameError('');
  };

  return (
    <div className="card-game-solid p-6 flex flex-col items-center gap-4">
      <div className="relative">
        <div className="text-7xl animate-float">{player.emoji}</div>
        <div className="absolute -bottom-1 -right-2 bg-yellow-400 text-gray-900 font-russo text-xs rounded-full w-7 h-7 flex items-center justify-center">{player.level}</div>
      </div>

      {/* Name (editable) */}
      {editingName ? (
        <div className="w-full flex flex-col items-center gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={e => { setNameInput(e.target.value); setNameError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
            maxLength={16}
            autoFocus
            className="w-full bg-white/10 border-2 border-yellow-400/60 rounded-2xl px-4 py-2 font-russo text-white text-lg outline-none text-center"
          />
          {nameError && <div className="text-red-400 text-xs font-nunito">{nameError}</div>}
          <div className="flex gap-2">
            <button className="btn-green text-sm py-1.5 px-4" onClick={saveName}>✓ Сохранить</button>
            <button className="btn-game bg-white/10 text-white border-b-white/20 text-sm py-1.5 px-4" onClick={() => { setEditingName(false); setNameInput(player.name); }}>Отмена</button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <button
            className="group flex items-center gap-2 font-russo text-2xl text-white hover:text-yellow-400 transition-colors"
            onClick={() => { setNameInput(player.name); setEditingName(true); }}>
            {player.name}
            <span className="text-white/20 group-hover:text-yellow-400/60 text-base transition-colors">✏️</span>
          </button>
          <div className="text-white/30 text-sm font-nunito">Уровень {player.level}</div>
        </div>
      )}

      <div className="w-full">
        <div className="flex justify-between text-xs font-nunito font-bold mb-1">
          <span className="text-white/30">Опыт</span>
          <span className="text-yellow-400">{xpInLevel} / {xpNeeded} XP</span>
        </div>
        <div className="damage-bar h-3">
          <div className="hp-bar bg-yellow-400" style={{ width: `${(xpInLevel / xpNeeded) * 100}%` }} />
        </div>
      </div>

      <div>
        <div className="text-white/30 text-xs font-nunito mb-2 text-center">Аватар:</div>
        <div className="flex gap-2 flex-wrap justify-center">
          {PLAYER_EMOJIS.map(em => (
            <button key={em} onClick={() => onEmojiChange(em)}
              className={`text-2xl p-1.5 rounded-xl transition-all ${player.emoji === em ? 'bg-yellow-400/30 scale-110' : 'hover:bg-white/10'}`}>
              {em}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────── LOGIN SCREEN COMPONENT ────────────────
function LoginScreen({ onLogin, onRegister }: {
  onLogin: (name: string, password: string) => Promise<string | null>;
  onRegister: (name: string, emoji: string, password: string) => Promise<string | null>;
}) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [inputName, setInputName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('😎');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchTab = (t: 'login' | 'register') => {
    setTab(t); setError(''); setPassword(''); setPasswordConfirm('');
  };

  const handleLogin = async () => {
    const name = inputName.trim();
    if (!name) { setError('Введи ник'); return; }
    if (!password) { setError('Введи пароль'); return; }
    setLoading(true); setError('');
    const err = await onLogin(name, password);
    setLoading(false);
    if (err) setError(err);
  };

  const handleRegister = async () => {
    const name = inputName.trim();
    if (!name || name.length < 2) { setError('Имя минимум 2 символа'); return; }
    if (name.length > 16) { setError('Имя максимум 16 символов'); return; }
    if (password.length < 4) { setError('Пароль минимум 4 символа'); return; }
    if (password !== passwordConfirm) { setError('Пароли не совпадают'); return; }
    setLoading(true); setError('');
    const err = await onRegister(name, selectedEmoji, password);
    setLoading(false);
    if (err) setError(err);
  };

  const inputCls = "w-full bg-white/10 border-2 border-white/20 focus:border-yellow-400/60 rounded-2xl px-4 py-3 font-nunito text-white text-base outline-none transition-all placeholder:text-white/20";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[{ em: '🚗', cls: 'top-8 left-8', d: '0s' }, { em: '🏎️', cls: 'top-16 right-12', d: '1.2s' },
          { em: '🚕', cls: 'bottom-16 left-16', d: '2s' }, { em: '🚙', cls: 'bottom-12 right-10', d: '0.6s' }]
          .map((item, i) => <div key={i} className={`absolute text-5xl animate-float ${item.cls}`} style={{ animationDelay: item.d }}>{item.em}</div>)}
        <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-sm animate-fade-in">
        <div className="text-center">
          <div className="text-7xl mb-2 animate-bounce-in">👑</div>
          <h1 className="font-russo text-4xl text-yellow-400 leading-none" style={{ textShadow: '0 0 30px rgba(255,214,0,0.6)' }}>КОРОЛЬ</h1>
          <h1 className="font-russo text-4xl text-yellow-400 leading-none" style={{ textShadow: '0 0 30px rgba(255,214,0,0.6)' }}>ПАРКОВКИ</h1>
          <p className="text-white/30 text-xs font-nunito font-bold tracking-widest uppercase mt-1">Захвати место — стань королём!</p>
        </div>

        {/* Tabs */}
        <div className="flex w-full gap-1 bg-white/5 rounded-2xl p-1">
          <button
            className={`flex-1 py-2.5 rounded-xl font-russo text-sm transition-all ${tab === 'login' ? 'bg-yellow-400 text-gray-900' : 'text-white/50 hover:text-white'}`}
            onClick={() => switchTab('login')}>
            Войти
          </button>
          <button
            className={`flex-1 py-2.5 rounded-xl font-russo text-sm transition-all ${tab === 'register' ? 'bg-yellow-400 text-gray-900' : 'text-white/50 hover:text-white'}`}
            onClick={() => switchTab('register')}>
            Регистрация
          </button>
        </div>

        <div className="card-game-solid p-6 flex flex-col gap-4 w-full">
          {/* ── LOGIN ── */}
          {tab === 'login' && (<>
            <input type="text" value={inputName}
              onChange={e => { setInputName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Твой ник"
              maxLength={16}
              autoFocus
              className={inputCls}
            />
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Пароль"
                className={inputCls}
              />
              <button onClick={() => setShowPwd(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 text-sm">
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
            {error && <div className="text-red-400 text-xs font-nunito text-center">{error}</div>}
            <button className="btn-yellow w-full text-lg py-3" onClick={handleLogin} disabled={loading}>
              {loading ? '⏳ Входим...' : '▶ Войти'}
            </button>
          </>)}

          {/* ── REGISTER ── */}
          {tab === 'register' && (<>
            <div>
              <div className="text-white/40 text-xs font-nunito mb-2 text-center uppercase tracking-wider">Аватар</div>
              <div className="flex gap-2 flex-wrap justify-center">
                {PLAYER_EMOJIS.map(em => (
                  <button key={em} onClick={() => setSelectedEmoji(em)}
                    className={`text-2xl p-1.5 rounded-xl transition-all ${selectedEmoji === em ? 'bg-yellow-400/30 scale-110 border-2 border-yellow-400/50' : 'hover:bg-white/10 border-2 border-transparent'}`}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <input type="text" value={inputName}
              onChange={e => { setInputName(e.target.value); setError(''); }}
              placeholder="Придумай ник (2–16 символов)"
              maxLength={16}
              autoFocus
              className={inputCls}
            />
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Придумай пароль (мин. 4 символа)"
                className={inputCls}
              />
              <button onClick={() => setShowPwd(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 text-sm">
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
            <input type={showPwd ? 'text' : 'password'} value={passwordConfirm}
              onChange={e => { setPasswordConfirm(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              placeholder="Повтори пароль"
              className={inputCls}
            />
            {error && <div className="text-red-400 text-xs font-nunito text-center">{error}</div>}
            <button className="btn-yellow w-full text-lg py-3" onClick={handleRegister} disabled={loading}>
              {loading ? '⏳ Создаём...' : '🚀 Создать и войти'}
            </button>
          </>)}
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  const [screen, setScreen] = useState<Screen>('login');
  const [player, setPlayer] = useState<PlayerData>(() => loadProfile() ?? DEFAULT_PLAYER);
  const [isReturningPlayer, setIsReturningPlayer] = useState(false);
  const [gameRound, setGameRound] = useState(1);
  const [gameKey, setGameKey] = useState(0);
  const [gameResult, setGameResult] = useState<{ position: number; coinsEarned: number } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [onlineLeaders, setOnlineLeaders] = useState<LeaderEntry[]>([]);
  const [inGamePhase, setInGamePhase] = useState<'playing' | 'roundEnd'>('playing');
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const keysRef = useRef<Set<string>>(new Set());

  // Init YaGames SDK on mount + load online player count
  useEffect(() => {
    initYandexGames();
    apiAuth('count', {}).then(data => { if (data.count != null) setOnlineCount(data.count); }).catch(() => {});
  }, []);

  // Load online leaderboard when entering leaderboard screen
  useEffect(() => {
    if (screen === 'leaderboard') {
      fetchLeaderboard().then(leaders => { if (leaders.length > 0) setOnlineLeaders(leaders); });
    }
  }, [screen]);

  // Detect returning player on mount + auto-login if session active
  useEffect(() => {
    const saved = loadProfile();
    if (saved && saved.name) {
      setPlayer(saved);
      setIsReturningPlayer(true);
      const session = getSession();
      if (session && session.name === saved.name) {
        setScreen('menu');
      }
    }
  }, []);

  // Autosave locally + sync to server on every player change (except on login screen)
  useEffect(() => {
    if (player.name && screen !== 'login') {
      saveProfile(player);
      if (player.password) {
        apiAuth('save', { name: player.name, password: player.password, profile: profileToSavePayload(player) }).catch(() => {});
      }
    }
  }, [player, screen]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const nk = new Set(keysRef.current); nk.add(e.key); keysRef.current = nk; setKeys(new Set(nk));
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const nk = new Set(keysRef.current); nk.delete(e.key); keysRef.current = nk; setKeys(new Set(nk));
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRoundEnd = useCallback((round: number, isPlayerEliminated: boolean, playerHp: number, playerMaxHp: number) => {
    setGameRound(round);
    setInGamePhase('roundEnd');
    if (isPlayerEliminated) notify('❌ Тебя вышибли! Паркуйся быстрее!');
    // Sync HP from canvas to player cars state
    setPlayer(prev => ({
      ...prev,
      cars: prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: Math.round(playerHp), maxHp: playerMaxHp } : c),
    }));
    setTimeout(() => setInGamePhase('playing'), 3000);
  }, []);

  const handleGameEnd = useCallback((position: number) => {
    const coinsEarned = Math.max(0, (11 - position) * 50 + Math.floor(Math.random() * 100));
    const xpEarned = Math.max(0, (11 - position) * 30);
    setGameResult({ position, coinsEarned });
    setPlayer(prev => ({
      ...prev,
      coins: prev.coins + coinsEarned,
      xp: prev.xp + xpEarned,
      level: levelFromXp(prev.xp + xpEarned),
      wins: position === 1 ? prev.wins + 1 : prev.wins,
      gamesPlayed: prev.gamesPlayed + 1,
      bestPosition: prev.bestPosition === 99 ? position : Math.min(prev.bestPosition, position),
    }));
    setScreen('gameOver');
  }, []);

  // ── LOGIN ──
  const renderLogin = () => (
    <LoginScreen
      onLogin={async (name, password) => {
        const data = await apiAuth('login', { name, password });
        if (data.error) return data.error;
        const sp = data.profile;
        const merged: PlayerData = {
          ...DEFAULT_PLAYER,
          name: sp.name ?? name,
          emoji: sp.emoji ?? '😎',
          password,
          coins: sp.coins ?? 1000,
          gems: sp.gems ?? 50,
          xp: sp.xp ?? 0,
          wins: sp.wins ?? 0,
          gamesPlayed: sp.gamesPlayed ?? 0,
          bestPosition: sp.bestPosition ?? 99,
          selectedCar: sp.selectedCar ?? 0,
          level: levelFromXp(sp.xp ?? 0),
          cars: INITIAL_CARS.map(c => ({ ...c, owned: (sp.ownedCars ?? [0]).includes(c.id) })),
          upgrades: { ...DEFAULT_PLAYER.upgrades, ...(sp.upgrades ?? {}) },
        };
        setPlayer(merged);
        saveProfile(merged);
        setIsReturningPlayer(true);
        setSession(name, password);
        setScreen('menu');
        return null;
      }}
      onRegister={async (name, emoji, password) => {
        const data = await apiAuth('register', { name, emoji, password });
        if (data.error) return data.error;
        const updated: PlayerData = { ...DEFAULT_PLAYER, name, emoji, password };
        setPlayer(updated);
        saveProfile(updated);
        setIsReturningPlayer(true);
        setSession(name, password);
        setScreen('menu');
        return null;
      }}
    />
  );

  // ── MENU ──
  const renderMenu = () => (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { em: '🚗', t: 'top-10 left-10', d: '0s' }, { em: '🏎️', t: 'top-20 right-16', d: '1s' },
          { em: '🚕', t: 'bottom-20 left-20', d: '2s' }, { em: '🚙', t: 'bottom-16 right-12', d: '0.5s' },
        ].map((item, i) => (
          <div key={i} className={`absolute text-5xl animate-float ${item.t}`} style={{ animationDelay: item.d }}>{item.em}</div>
        ))}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-sm">
        <div className="text-center animate-fade-in">
          <div className="text-7xl mb-2 animate-bounce-in">👑</div>
          <h1 className="font-russo text-4xl text-yellow-400 leading-none" style={{ textShadow: '0 0 30px rgba(255,214,0,0.6)' }}>КОРОЛЬ ПАРКОВКИ</h1>
          <p className="font-nunito text-white/40 text-xs mt-2 font-bold tracking-widest uppercase">Захвати место — стань королём!</p>
          {onlineCount != null && (
            <div className="flex items-center gap-1.5 mt-1 justify-center">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-nunito text-green-400/80 text-xs">{onlineCount.toLocaleString()} игроков зарегистрировано</span>
            </div>
          )}
        </div>

        <button className="card-game p-3 flex items-center gap-3 w-full animate-fade-in hover:border-yellow-400/30 transition-all" onClick={() => setScreen('login')}>
          <span className="text-3xl">{player.emoji}</span>
          <div className="flex-1 text-left">
            <div className="font-russo text-white text-sm">{player.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="coin-badge text-xs">🪙 {player.coins.toLocaleString()}</span>
              <span className="gem-badge text-xs">💎 {player.gems}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="font-russo text-yellow-400 text-lg">Lv.{player.level}</div>
            <div className="text-white/20 text-xs font-nunito">сменить ↗</div>
          </div>
        </button>

        <div className="flex flex-col gap-3 w-full">
          <button className="btn-yellow w-full text-xl py-5 animate-fade-in" onClick={() => { setGameKey(k => k + 1); setGameRound(1); setInGamePhase('playing'); setScreen('game'); }}>
            🚀 ИГРАТЬ
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-blue animate-fade-in" onClick={() => setScreen('garage')}>🔧 Гараж</button>
            <button className="btn-purple animate-fade-in" onClick={() => setScreen('shop')}>🛒 Магазин</button>
            <button className="btn-orange animate-fade-in" onClick={() => setScreen('profile')}>👤 Профиль</button>
            <button className="btn-green animate-fade-in" onClick={() => setScreen('leaderboard')}>🏆 Топ игроков</button>
          </div>
        </div>

        <p className="text-white/20 text-xs font-nunito">v0.1.0 — Ранний доступ</p>
      </div>
    </div>
  );

  // ── GAME ──
  const renderGame = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
      <div className="flex items-center justify-between w-full max-w-3xl">
        <button className="btn-red text-sm py-2 px-4" onClick={() => setScreen('menu')}>← Выйти</button>
        <div className="font-russo text-yellow-400 text-lg">Раунд {gameRound}</div>
        <div className="coin-badge">🪙 {player.coins.toLocaleString()}</div>
      </div>

      <div className="w-full max-w-3xl relative">
        <GameCanvas
          key={gameKey}
          playerName={player.name}
          playerHp={player.cars[player.selectedCar]?.hp}
          playerMaxHp={player.cars[player.selectedCar]?.maxHp}
          upgrades={player.upgrades ?? { nitro: false, gps: false, bumper: false, autoRepair: false, magnet: false, turbo: false, shield: false }}
          onRoundEnd={handleRoundEnd}
          onGameEnd={handleGameEnd}
          keys={keys}
        />
        {/* Repair button overlay during round end */}
        {inGamePhase === 'roundEnd' && !gameResult && (() => {
          const car = player.cars[player.selectedCar];
          if (!car || car.hp >= car.maxHp) return null;
          const repairCost = Math.round(car.repairCost * (1 - car.hp / car.maxHp));
          const healAmt = Math.round(car.maxHp * 0.4);
          return (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 animate-bounce-in">
              <button
                className="btn-green px-6 py-3 text-base font-russo shadow-2xl"
                onClick={() => {
                  if (player.coins >= repairCost) {
                    setPlayer(prev => {
                      const newCars = prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: Math.min(c.maxHp, c.hp + healAmt) } : c);
                      return { ...prev, coins: prev.coins - repairCost, cars: newCars };
                    });
                    notify(`🔧 Машина подлатана! +${healAmt} HP`);
                  } else {
                    notify('❌ Недостаточно монет!');
                  }
                }}
              >
                🔧 Починить {Math.round((1 - car.hp / car.maxHp) * 100)}% — {repairCost} 🪙
              </button>
            </div>
          );
        })()}
      </div>

      {/* Mobile controls */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        <div />
        <button className="btn-game bg-white/20 text-white border-b-white/10 h-14 text-2xl"
          onTouchStart={() => { keysRef.current.add('ArrowUp'); setKeys(new Set(keysRef.current)); }}
          onTouchEnd={() => { keysRef.current.delete('ArrowUp'); setKeys(new Set(keysRef.current)); }}>↑</button>
        <div />
        <button className="btn-game bg-white/20 text-white border-b-white/10 h-14 text-2xl"
          onTouchStart={() => { keysRef.current.add('ArrowLeft'); setKeys(new Set(keysRef.current)); }}
          onTouchEnd={() => { keysRef.current.delete('ArrowLeft'); setKeys(new Set(keysRef.current)); }}>←</button>
        <button className="btn-game bg-white/20 text-white border-b-white/10 h-14 text-2xl"
          onTouchStart={() => { keysRef.current.add('ArrowDown'); setKeys(new Set(keysRef.current)); }}
          onTouchEnd={() => { keysRef.current.delete('ArrowDown'); setKeys(new Set(keysRef.current)); }}>↓</button>
        <button className="btn-game bg-white/20 text-white border-b-white/10 h-14 text-2xl"
          onTouchStart={() => { keysRef.current.add('ArrowRight'); setKeys(new Set(keysRef.current)); }}
          onTouchEnd={() => { keysRef.current.delete('ArrowRight'); setKeys(new Set(keysRef.current)); }}>→</button>
      </div>

      <p className="text-white/30 text-xs text-center font-nunito hidden md:block">
        Стрелки — движение · При сигнале «ПАРКУЙСЯ!» — займи свободное место 🅿️ · Можно таранить соперников!
      </p>
    </div>
  );

  // ── GAME OVER ──
  const renderGameOver = () => {
    if (!gameResult) return null;
    const { position, coinsEarned } = gameResult;
    const isWin = position === 1;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card-game-solid p-8 flex flex-col items-center gap-5 w-full max-w-sm animate-bounce-in">
          <div className="text-7xl">{isWin ? '🏆' : position <= 3 ? '🥈' : '😅'}</div>
          <div className="text-center">
            <div className={`font-russo text-4xl ${isWin ? 'text-yellow-400' : 'text-white'}`} style={isWin ? { textShadow: '0 0 20px rgba(255,214,0,0.7)' } : {}}>
              {isWin ? 'ПОБЕДА!' : position <= 3 ? 'ПРИЗЁР!' : `МЕСТО #${position}`}
            </div>
            <div className="text-white/40 font-nunito text-sm mt-1">
              {isWin ? 'Ты лучший парковщик города!' : position <= 5 ? 'Неплохо, тренируйся!' : 'Паркуйся быстрее!'}
            </div>
          </div>
          <div className="w-full space-y-2">
            <div className="flex justify-between items-center bg-white/5 rounded-2xl p-3">
              <span className="text-white/50 font-nunito text-sm">Место</span>
              <span className="font-russo text-white">#{position}</span>
            </div>
            <div className="flex justify-between items-center bg-yellow-500/10 rounded-2xl p-3">
              <span className="text-white/50 font-nunito text-sm">Монеты</span>
              <span className="font-russo text-yellow-400">+{coinsEarned} 🪙</span>
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <button className="btn-yellow flex-1" onClick={() => { setGameKey(k => k + 1); setGameRound(1); setInGamePhase('playing'); setScreen('game'); }}>🔄 Ещё раз</button>
            <button className="btn-blue flex-1" onClick={() => setScreen('menu')}>🏠 Меню</button>
          </div>
        </div>
      </div>
    );
  };

  // ── GARAGE ──
  const renderGarage = () => {
    const sel = player.cars[player.selectedCar];
    return (
      <div className="min-h-screen flex flex-col px-4 py-6 gap-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
          <h2 className="font-russo text-2xl text-yellow-400">🔧 Гараж</h2>
          <div className="ml-auto coin-badge">🪙 {player.coins.toLocaleString()}</div>
        </div>

        {/* Selected car */}
        <div className={`card-game-solid p-6 flex flex-col items-center gap-4 border-2 ${RARITIES[sel.rarity].border}`}>
          <div className="text-6xl animate-float">{sel.emoji}</div>
          <div className="text-center">
            <div className={`font-russo text-xl ${RARITIES[sel.rarity].color}`}>{sel.name}</div>
            <div className={`text-xs font-nunito font-bold uppercase tracking-wider mt-1 ${RARITIES[sel.rarity].color}`}>{RARITIES[sel.rarity].label}</div>
          </div>
          <div className="w-full space-y-2">
            {[
              { label: '❤️ Прочность', val: sel.hp, max: sel.maxHp, color: '#34C759' },
              { label: '⚡ Скорость', val: sel.speed, max: 6, color: '#FF6B35' },
              { label: '🛡️ Броня', val: sel.armor, max: 4, color: '#007AFF' },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between text-xs font-nunito font-bold mb-1">
                  <span className="text-white/50">{s.label}</span>
                  <span className="text-white">{s.max === 6 ? s.val.toFixed(1) : `${s.val}/${s.max}`}</span>
                </div>
                <div className="damage-bar">
                  <div className="hp-bar" style={{ width: `${(s.val / s.max) * 100}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </div>
          {sel.hp < sel.maxHp ? (
            <button className="btn-green w-full"
              onClick={() => {
                if (player.coins >= sel.repairCost) {
                  setPlayer(prev => ({ ...prev, coins: prev.coins - sel.repairCost, cars: prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: c.maxHp } : c) }));
                  notify('✅ Машина отремонтирована!');
                } else notify('❌ Недостаточно монет!');
              }}>
              🔨 Починить — {sel.repairCost} 🪙
            </button>
          ) : (
            <div className="text-green-400 font-russo text-sm">✅ Машина в идеальном состоянии</div>
          )}
        </div>

        <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">Коллекция</h3>
        <div className="grid grid-cols-3 gap-3">
          {player.cars.map((car, idx) => {
            const r = RARITIES[car.rarity];
            const isSel = idx === player.selectedCar;
            return (
              <button key={car.id}
                onClick={() => {
                  if (car.owned) { setPlayer(prev => ({ ...prev, selectedCar: idx })); }
                  else if (player.coins >= car.price) {
                    setPlayer(prev => ({ ...prev, coins: prev.coins - car.price, cars: prev.cars.map((c, i) => i === idx ? { ...c, owned: true } : c), selectedCar: idx }));
                    notify(`🎉 Куплен ${car.name}!`);
                  } else notify('❌ Недостаточно монет!');
                }}
                className={`${r.bg} border-2 ${isSel ? r.border : 'border-white/10'} rounded-2xl p-3 flex flex-col items-center gap-1 transition-all hover:scale-105 ${isSel ? 'scale-105' : ''}`}>
                <div className="text-3xl">{car.emoji}</div>
                <div className={`font-russo text-xs ${r.color}`}>{car.name}</div>
                {!car.owned && <div className="text-yellow-400 font-russo text-xs">🪙 {car.price.toLocaleString()}</div>}
                {car.owned && isSel && <div className="text-green-400 text-xs font-bold">✓</div>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── SHOP ──
  const renderShop = () => {
    const gemPacks = [
      { gems: 100, price: '79₽', popular: false },
      { gems: 300, price: '199₽', bonus: '+50 бонус', popular: true },
      { gems: 700, price: '399₽', bonus: '+150 бонус', popular: false },
      { gems: 1500, price: '799₽', bonus: '+500 бонус', popular: false },
    ];
    const coinPacks = [
      { coins: 1000, gems: 10 }, { coins: 3000, gems: 25 },
      { coins: 7000, gems: 50 }, { coins: 20000, gems: 120 },
    ];
    const upgrades: { name: string; desc: string; price: number; icon: string; key: keyof typeof player.upgrades; tag?: string }[] = [
      { name: 'Нитро-ускорение', desc: 'Зажми Space при сигнале — рывок +40% скорости', price: 150, icon: '⚡', key: 'nitro' },
      { name: 'GPS-радар', desc: 'Золотая стрелка к ближайшему свободному месту', price: 200, icon: '📡', key: 'gps' },
      { name: 'Усиленный бампер', desc: '-30% урона при столкновениях', price: 250, icon: '🛡️', key: 'bumper' },
      { name: 'Авто-ремонт', desc: 'Восстанавливает +15 HP после каждого раунда', price: 300, icon: '🔧', key: 'autoRepair' },
      { name: 'Магнит парковки', desc: 'Автоматически притягивает к месту в радиусе 50px', price: 400, icon: '🧲', key: 'magnet', tag: 'НОВИНКА' },
      { name: 'Турбо-старт', desc: 'После сигнала мгновенный разгон x2 на 2 сек', price: 350, icon: '🚀', key: 'turbo', tag: 'НОВИНКА' },
      { name: 'Силовое поле', desc: 'Первый удар за раунд — без урона', price: 500, icon: '🔵', key: 'shield', tag: 'ХИТ' },
    ];

    return (
      <div className="min-h-screen flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
          <h2 className="font-russo text-2xl text-yellow-400">🛒 Магазин</h2>
        </div>
        <div className="flex gap-3">
          <div className="coin-badge flex-1 justify-center py-2 text-sm">🪙 {player.coins.toLocaleString()}</div>
          <div className="gem-badge flex-1 justify-center py-2 text-sm">💎 {player.gems}</div>
        </div>

        {/* Gems */}
        <div>
          <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider mb-3">💎 Кристаллы (реальные деньги)</h3>
          <div className="grid grid-cols-2 gap-3">
            {gemPacks.map((pack, i) => (
              <button key={i} onClick={() => notify('💳 Оплата скоро будет доступна!')}
                className={`card-game-solid p-4 flex flex-col items-center gap-2 border-2 hover:scale-105 transition-all ${pack.popular ? 'border-yellow-500/60' : 'border-white/10'}`}>
                {pack.popular && <div className="bg-yellow-400 text-gray-900 font-russo text-xs px-2 py-0.5 rounded-full -mt-7 mb-1">ХИТ</div>}
                <div className="text-3xl">💎</div>
                <div className="font-russo text-white text-lg">{pack.gems}</div>
                {'bonus' in pack && pack.bonus && <div className="text-green-400 text-xs font-bold">{pack.bonus}</div>}
                <div className="btn-yellow text-sm py-1.5 px-4 w-full text-center rounded-xl">{pack.price}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Coins */}
        <div>
          <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider mb-3">🪙 Монеты за кристаллы</h3>
          <div className="grid grid-cols-2 gap-3">
            {coinPacks.map((pack, i) => (
              <button key={i} onClick={() => {
                if (player.gems >= pack.gems) {
                  setPlayer(prev => ({ ...prev, gems: prev.gems - pack.gems, coins: prev.coins + pack.coins }));
                  notify(`✅ Получено ${pack.coins.toLocaleString()} монет!`);
                } else notify('❌ Недостаточно кристаллов!');
              }}
                className="card-game p-3 flex flex-col items-center gap-1 border border-white/10 hover:border-yellow-500/40 transition-all rounded-2xl">
                <div className="font-russo text-yellow-400">{pack.coins.toLocaleString()} 🪙</div>
                <div className="text-white/30 text-xs">за {pack.gems} 💎</div>
              </button>
            ))}
          </div>
        </div>

        {/* Upgrades */}
        <div>
          <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider mb-3">⚡ Улучшения машины</h3>
          <div className="space-y-2">
            {upgrades.map((upg, i) => {
              const owned = player.upgrades[upg.key];
              return (
                <div key={i} className={`card-game p-4 flex items-center gap-3 relative overflow-hidden ${owned ? 'border border-green-500/30 bg-green-500/5' : ''}`}>
                  {upg.tag && !owned && (
                    <div className="absolute top-1 right-1 bg-orange-500 text-white font-russo text-[9px] px-1.5 py-0.5 rounded-full">{upg.tag}</div>
                  )}
                  <div className="text-3xl">{upg.icon}</div>
                  <div className="flex-1">
                    <div className="font-russo text-white text-sm">{upg.name}</div>
                    <div className="text-white/30 text-xs font-nunito">{upg.desc}</div>
                  </div>
                  {owned ? (
                    <div className="text-green-400 font-russo text-sm">✅ Куплено</div>
                  ) : (
                    <button className="btn-orange text-sm py-2 px-3"
                      onClick={() => {
                        if (player.coins >= upg.price) {
                          setPlayer(prev => ({
                            ...prev,
                            coins: prev.coins - upg.price,
                            upgrades: { ...prev.upgrades, [upg.key]: true },
                          }));
                          notify(`✅ ${upg.name} куплено!`);
                        } else notify('❌ Недостаточно монет!');
                      }}>
                      {upg.price} 🪙
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── PROFILE ──
  const renderProfile = () => {
    const xpInLevel = player.xp % xpForLevel(player.level);
    const xpNeeded = xpForLevel(player.level);
    const achievements = [
      { emoji: '🎮', title: 'Первая игра', desc: 'Сыграй 1 игру', done: player.gamesPlayed >= 1 },
      { emoji: '🏆', title: 'Первая победа', desc: 'Выиграй 1 игру', done: player.wins >= 1 },
      { emoji: '🚗', title: 'Коллекционер', desc: 'Купи 3 машины', done: player.cars.filter(c => c.owned).length >= 3 },
      { emoji: '💰', title: 'Богач', desc: 'Накопи 5000 монет', done: player.coins >= 5000 },
      { emoji: '⚡', title: 'Стремительный', desc: 'Займи место первым', done: false },
      { emoji: '💀', title: 'Выживший', desc: 'Дойди до финального раунда', done: false },
    ];

    return (
      <div className="min-h-screen flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
          <h2 className="font-russo text-2xl text-yellow-400">👤 Профиль</h2>
        </div>

        <ProfileCard
          player={player}
          xpInLevel={xpInLevel}
          xpNeeded={xpNeeded}
          onEmojiChange={em => setPlayer(prev => ({ ...prev, emoji: em }))}
          onNameChange={name => { setPlayer(prev => ({ ...prev, name })); notify('✅ Имя изменено!'); }}
        />

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🎮', val: player.gamesPlayed, label: 'Игр сыграно' },
            { icon: '🏆', val: player.wins, label: 'Побед' },
            { icon: '🥇', val: player.bestPosition === 99 ? '—' : `#${player.bestPosition}`, label: 'Лучшее место' },
            { icon: '🪙', val: player.coins.toLocaleString(), label: 'Монет' },
          ].map(s => (
            <div key={s.label} className="card-game p-4 flex flex-col gap-1">
              <div className="text-2xl">{s.icon}</div>
              <div className="font-russo text-white text-lg">{s.val}</div>
              <div className="text-white/30 text-xs font-nunito">{s.label}</div>
            </div>
          ))}
        </div>

        <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">🏅 Достижения</h3>
        <div className="space-y-2">
          {achievements.map((ach, i) => (
            <div key={i} className={`card-game p-4 flex items-center gap-4 ${!ach.done ? 'opacity-40' : ''}`}>
              <div className="text-3xl">{ach.emoji}</div>
              <div className="flex-1">
                <div className={`font-russo text-sm ${ach.done ? 'text-yellow-400' : 'text-white/60'}`}>{ach.title}</div>
                <div className="text-white/30 text-xs font-nunito">{ach.desc}</div>
              </div>
              {ach.done && <div className="text-green-400 text-xl">✅</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── LEADERBOARD ──
  const renderLeaderboard = () => {
    const fullList = onlineLeaders.length > 0 ? onlineLeaders : [
      { rank: 1, name: player.name || 'Ты', emoji: player.emoji, wins: player.wins, xp: player.xp, gamesPlayed: player.gamesPlayed }
    ];
    const rankColors = ['#FFD600', '#C0C0C0', '#CD7F32'];
    const medals = ['🥇', '🥈', '🥉'];

    return (
      <div className="min-h-screen flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
          <h2 className="font-russo text-2xl text-yellow-400">🏆 Топ игроков</h2>
        </div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-4 py-4">
          {([fullList[1], fullList[0], fullList[2]] as typeof fullList).filter(Boolean).map((p, podiumIdx) => {
            const podiumRanks = [2, 1, 3];
            const heights = [80, 110, 60];
            const rank = podiumRanks[podiumIdx];
            return (
              <div key={p.rank} className="flex flex-col items-center gap-2">
                <div className="text-3xl">{p.emoji}</div>
                <div className="font-russo text-xs text-white text-center max-w-16 truncate">{p.name}</div>
                <div className="w-20 rounded-t-xl flex items-start justify-center pt-2"
                  style={{ height: `${heights[podiumIdx]}px`, background: `${rankColors[rank - 1]}22`, border: `2px solid ${rankColors[rank - 1]}55` }}>
                  <span className="font-russo text-2xl" style={{ color: rankColors[rank - 1] }}>#{rank}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          {fullList.map(entry => {
            const isMe = entry.name === player.name;
            return (
              <div key={entry.rank} className={`card-game p-4 flex items-center gap-4 ${isMe ? 'border border-yellow-500/40 bg-yellow-500/5' : ''}`}>
                <div className="font-russo text-xl w-8 text-center" style={{ color: entry.rank <= 3 ? rankColors[entry.rank - 1] : 'rgba(255,255,255,0.3)' }}>
                  {entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`}
                </div>
                <div className="text-2xl">{entry.emoji}</div>
                <div className="flex-1">
                  <div className={`font-russo text-sm ${isMe ? 'text-yellow-400' : 'text-white'}`}>{entry.name}{isMe && ' (Ты)'}</div>
                  <div className="text-white/30 text-xs font-nunito">{entry.xp.toLocaleString()} XP</div>
                </div>
                <div className="text-right">
                  <div className="font-russo text-yellow-400">{entry.wins}</div>
                  <div className="text-white/30 text-xs font-nunito">побед</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen">
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce-in pointer-events-none">
          <div className="bg-gray-900 border-2 border-yellow-500/40 rounded-2xl px-6 py-3 font-russo text-white text-sm shadow-2xl whitespace-nowrap">
            {notification}
          </div>
        </div>
      )}

      {screen === 'login' && renderLogin()}
      {screen === 'menu' && renderMenu()}
      {screen === 'game' && renderGame()}
      {screen === 'gameOver' && renderGameOver()}
      {screen === 'garage' && renderGarage()}
      {screen === 'shop' && renderShop()}
      {screen === 'profile' && renderProfile()}
      {screen === 'leaderboard' && renderLeaderboard()}
    </div>
  );
}