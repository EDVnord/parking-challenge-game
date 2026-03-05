import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Screen, PlayerData, LeaderEntry,
  DEFAULT_PLAYER, INITIAL_CARS,
  loadProfile, saveProfile, profileToSavePayload,
  getSession, setSession,
  apiAuth, fetchLeaderboard,
  levelFromXp, initYandexGames,
  DAILY_STREAK_REWARDS, makeDailyQuests, todayDateStr,
} from './parkingTypes';
import LoginScreen from './LoginScreen';
import { MenuScreen, GameScreen, GameOverScreen } from './GameScreens';
import { GarageScreen, ShopScreen, ProfileScreen, LeaderboardScreen } from './PlayerScreens';
import DailyBonusModal from '@/components/DailyBonusModal';

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
  const keysRef = useRef<Set<string>>(new Set());
  const [dailyBonus, setDailyBonus] = useState<{ streak: number; coins: number; gems: number } | null>(null);

  // Init YaGames SDK on mount
  useEffect(() => { initYandexGames(); }, []);

  // Load online leaderboard when entering leaderboard screen
  useEffect(() => {
    if (screen === 'leaderboard') {
      fetchLeaderboard().then(leaders => { if (leaders.length > 0) setOnlineLeaders(leaders); });
    }
  }, [screen]);

  // Detect returning player on mount + auto-login if session active (runs after checkDailyBonus is defined)
  const autoLoginDone = useRef(false);

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

  const checkDailyBonus = useCallback((p: PlayerData): PlayerData => {
    const today = todayDateStr();
    if (p.lastLoginDate === today) return p;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = p.lastLoginDate === yesterday ? Math.min((p.loginStreak ?? 0) + 1, 7) : 1;
    const rewardIdx = newStreak - 1;
    const reward = DAILY_STREAK_REWARDS[rewardIdx] ?? DAILY_STREAK_REWARDS[0];

    const refreshQuests = p.dailyQuestsDate !== today;
    const updated: PlayerData = {
      ...p,
      coins: p.coins + reward.coins,
      gems: p.gems + reward.gems,
      loginStreak: newStreak,
      lastLoginDate: today,
      dailyQuests: refreshQuests ? makeDailyQuests() : p.dailyQuests,
      dailyQuestsDate: today,
    };

    setDailyBonus({ streak: newStreak, coins: reward.coins, gems: reward.gems });
    return updated;
  }, []);

  // Detect returning player on mount + auto-login if session active
  useEffect(() => {
    if (autoLoginDone.current) return;
    autoLoginDone.current = true;
    const saved = loadProfile();
    if (saved && saved.name) {
      setIsReturningPlayer(true);
      const session = getSession();
      if (session && session.name === saved.name) {
        const withBonus = checkDailyBonus(saved);
        setPlayer(withBonus);
        saveProfile(withBonus);
        setScreen('menu');
      } else {
        setPlayer(saved);
      }
    }
  }, [checkDailyBonus]);

  const handleRoundEnd = useCallback((round: number, isPlayerEliminated: boolean, playerHp: number, playerMaxHp: number) => {
    setGameRound(round);
    setInGamePhase('roundEnd');
    if (isPlayerEliminated) notify('❌ Тебя вышибли! Паркуйся быстрее!');
    setPlayer(prev => ({
      ...prev,
      cars: prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: Math.round(playerHp), maxHp: playerMaxHp } : c),
    }));
    setTimeout(() => setInGamePhase('playing'), 3000);
  }, []);

  const handleGameEnd = useCallback((position: number, roundsPlayed?: number) => {
    const coinsEarned = Math.max(0, (11 - position) * 50 + Math.floor(Math.random() * 100));
    const xpEarned = Math.max(0, (11 - position) * 30);
    setGameResult({ position, coinsEarned });
    setPlayer(prev => {
      const today = todayDateStr();
      const baseQuests = prev.dailyQuestsDate === today ? prev.dailyQuests : makeDailyQuests(today);
      let bonusCoins = 0;
      let bonusGems = 0;
      const newQuests = baseQuests.map(q => {
        if (q.done) return q;
        let progress = q.progress;
        if (q.id === 'play3') progress = Math.min(q.goal, progress + 1);
        if (q.id === 'top5' && position <= (q.label.includes('топ-3') ? 3 : 5)) progress = Math.min(q.goal, progress + 1);
        if (q.id === 'survive') progress = Math.max(progress, Math.min(q.goal, roundsPlayed ?? 0));
        const done = progress >= q.goal;
        if (done && !q.done) {
          bonusCoins += q.reward.coins;
          bonusGems += q.reward.gems ?? 0;
        }
        return { ...q, progress, done };
      });
      return {
        ...prev,
        coins: prev.coins + coinsEarned + bonusCoins,
        gems: prev.gems + bonusGems,
        xp: prev.xp + xpEarned,
        level: levelFromXp(prev.xp + xpEarned),
        wins: position === 1 ? prev.wins + 1 : prev.wins,
        gamesPlayed: prev.gamesPlayed + 1,
        bestPosition: prev.bestPosition === 99 ? position : Math.min(prev.bestPosition, position),
        dailyQuests: newQuests,
        dailyQuestsDate: today,
      };
    });
    setScreen('gameOver');
  }, []);

  const handlePlay = () => {
    setGameKey(k => k + 1);
    setGameRound(1);
    setInGamePhase('playing');
    setGameResult(null);
    setScreen('game');
  };

  return (
    <div className="relative min-h-screen">
      {dailyBonus && (
        <DailyBonusModal
          streak={dailyBonus.streak}
          coinsEarned={dailyBonus.coins}
          gemsEarned={dailyBonus.gems}
          onClose={() => setDailyBonus(null)}
        />
      )}

      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce-in pointer-events-none">
          <div className="bg-gray-900 border-2 border-yellow-500/40 rounded-2xl px-6 py-3 font-russo text-white text-sm shadow-2xl whitespace-nowrap">
            {notification}
          </div>
        </div>
      )}

      {screen === 'login' && (
        <LoginScreen
          onLogin={async (name, password) => {
            const data = await apiAuth('login', { name, password });
            if (data.error) return data.error;
            const sp = data.profile;
            const today = todayDateStr();
            const base: PlayerData = {
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
              loginStreak: sp.loginStreak ?? 0,
              lastLoginDate: sp.lastLoginDate ?? '',
              dailyQuests: sp.dailyQuestsDate === today ? (sp.dailyQuests ?? makeDailyQuests()) : makeDailyQuests(),
              dailyQuestsDate: sp.dailyQuestsDate === today ? today : '',
            };
            const withBonus = checkDailyBonus(base);
            setPlayer(withBonus);
            saveProfile(withBonus);
            setIsReturningPlayer(true);
            setSession(name, password);
            setScreen('menu');
            return null;
          }}
          onRegister={async (name, emoji, password) => {
            const data = await apiAuth('register', { name, emoji, password });
            if (data.error) return data.error;
            const base: PlayerData = { ...DEFAULT_PLAYER, name, emoji, password };
            const withBonus = checkDailyBonus(base);
            setPlayer(withBonus);
            saveProfile(withBonus);
            setIsReturningPlayer(true);
            setSession(name, password);
            setScreen('menu');
            return null;
          }}
        />
      )}

      {screen === 'menu' && (
        <MenuScreen player={player} setScreen={setScreen} onPlay={handlePlay} onQuestClaim={(questId) => {
          setPlayer(prev => {
            const today = todayDateStr();
            return {
              ...prev,
              dailyQuests: (prev.dailyQuests ?? []).map(q =>
                q.id === questId && q.done ? { ...q, done: true } : q
              ),
              dailyQuestsDate: today,
            };
          });
        }} />
      )}

      {screen === 'game' && (
        <GameScreen
          player={player}
          gameKey={gameKey}
          gameRound={gameRound}
          gameResult={gameResult}
          inGamePhase={inGamePhase}
          keys={keys}
          keysRef={keysRef}
          setScreen={setScreen}
          setPlayer={setPlayer}
          handleRoundEnd={handleRoundEnd}
          handleGameEnd={handleGameEnd}
          notify={notify}
        />
      )}

      {screen === 'gameOver' && (
        <GameOverScreen
          gameResult={gameResult}
          onRestart={handlePlay}
          onMenu={() => setScreen('menu')}
        />
      )}

      {screen === 'garage' && (
        <GarageScreen player={player} setScreen={setScreen} setPlayer={setPlayer} notify={notify} />
      )}

      {screen === 'shop' && (
        <ShopScreen player={player} setScreen={setScreen} setPlayer={setPlayer} notify={notify} />
      )}

      {screen === 'profile' && (
        <ProfileScreen player={player} setScreen={setScreen} setPlayer={setPlayer} notify={notify} />
      )}

      {screen === 'leaderboard' && (
        <LeaderboardScreen player={player} onlineLeaders={onlineLeaders} setScreen={setScreen} />
      )}
    </div>
  );
}