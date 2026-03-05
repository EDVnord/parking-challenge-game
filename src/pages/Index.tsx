import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Screen, PlayerData, LeaderEntry, RoomState,
  DEFAULT_PLAYER,
  loadProfile, saveProfile, profileToSavePayload,
  apiAuth, fetchLeaderboard, roomApi, getYaPlayer,
  initYandexGames, levelFromXp, getOrCreateAnonId,
  DAILY_STREAK_REWARDS, makeDailyQuests, todayDateStr,
} from './parkingTypes';
import { MenuScreen, GameScreen, GameOverScreen } from './GameScreens';
import { GarageScreen, ShopScreen, ProfileScreen, LeaderboardScreen } from './PlayerScreens';
import DailyBonusModal from '@/components/DailyBonusModal';
import LobbyScreen from '@/components/LobbyScreen';
import NicknameSetup, { getSavedNick } from '@/components/NicknameSetup';
import { getFriends, hasFriendInRoom, FRIEND_BONUS } from '@/components/FriendsPanel';

export default function Index() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [isLoading, setIsLoading] = useState(true);
  const [player, setPlayer] = useState<PlayerData>(() => loadProfile() ?? DEFAULT_PLAYER);

  const [gameRound, setGameRound] = useState(1);
  const [gameKey, setGameKey] = useState(0);
  const [gameResult, setGameResult] = useState<{ position: number; coinsEarned: number } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [onlineLeaders, setOnlineLeaders] = useState<LeaderEntry[]>([]);
  const [inGamePhase, setInGamePhase] = useState<'playing' | 'roundEnd'>('playing');
  const keysRef = useRef<Set<string>>(new Set());
  const [dailyBonus, setDailyBonus] = useState<{ streak: number; coins: number; gems: number } | null>(null);

  // Мультиплеер
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string>('');
  const [isLobby, setIsLobby] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [needNickname, setNeedNickname] = useState(false);

  // YaGames SDK инициализируется в doAutoLogin

  // Load online leaderboard when entering leaderboard screen
  useEffect(() => {
    if (screen === 'leaderboard') {
      fetchLeaderboard().then(leaders => { if (leaders.length > 0) setOnlineLeaders(leaders); });
    }
  }, [screen]);

  // Detect returning player on mount + auto-login if session active (runs after checkDailyBonus is defined)
  const autoLoginDone = useRef(false);

  // Autosave locally + sync to server on every player change
  useEffect(() => {
    if (!player.name) return;
    saveProfile(player);
    if (player.password) {
      // Зарегистрированный игрок с паролем
      apiAuth('save', { name: player.name, password: player.password, profile: profileToSavePayload(player) }).catch(() => {});
    } else if (localPlayerId.startsWith('ya_')) {
      // Яндекс-игрок
      apiAuth('save_ya', { yaId: localPlayerId, profile: profileToSavePayload(player) }).catch(() => {});
    } else if (player.name && player.name !== 'Игрок') {
      // Любой игрок с именем — сохраняем анонимно для лидерборда (стабильный ID из localStorage)
      apiAuth('save_anon', { playerId: getOrCreateAnonId(), profile: profileToSavePayload(player) }).catch(() => {});
    }
  }, [player, screen, localPlayerId]);

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

  const notify = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

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

  // Автовход через Яндекс ID или локальный профиль
  useEffect(() => {
    if (autoLoginDone.current) return;
    autoLoginDone.current = true;

    // Гарантированный сброс загрузки через 5 секунд (защита от зависания SDK)
    const fallbackTimer = setTimeout(() => setIsLoading(false), 5000);

    const doAutoLogin = async () => {
      try {
        await initYandexGames();
        const ya = await getYaPlayer();

        const saved = loadProfile();
        let base: PlayerData;

        if (ya) {
          // Яндекс авторизован — берём сохранённый профиль или создаём новый
          if (saved && saved.name) {
            base = saved;
          } else {
            const yaName = ya.name && ya.name.length >= 2 && ya.name.length <= 16
              ? ya.name
              : 'Игрок';
            base = { ...DEFAULT_PLAYER, name: yaName };
          }
          setLocalPlayerId(ya.id);
        } else if (saved && saved.name) {
          // Нет Яндекс SDK — используем локальный профиль
          base = saved;
        } else {
          // Совсем новый пользователь без Яндекса
          base = { ...DEFAULT_PLAYER, name: 'Игрок' };
          setNeedNickname(true);
        }

        const withBonus = checkDailyBonus(base);
        setPlayer(withBonus);
        saveProfile(withBonus);

      } catch {
        const saved = loadProfile();
        if (saved && saved.name) {
          const withBonus = checkDailyBonus(saved);
          setPlayer(withBonus);
          saveProfile(withBonus);
        }
      } finally {
        clearTimeout(fallbackTimer);
        setIsLoading(false);
      }
    };

    doAutoLogin();
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
    const friends = getFriends();
    const roomPlayerIds = roomState?.players.map(p => p.player_id) ?? [];
    const friendBonus = friends.length > 0 && hasFriendInRoom(roomPlayerIds, friends);

    const baseCoins = Math.max(0, (11 - position) * 50 + Math.floor(Math.random() * 100));
    const baseXp = Math.max(0, (11 - position) * 30);
    const coinsEarned = friendBonus ? Math.round(baseCoins * (1 + FRIEND_BONUS.coins)) : baseCoins;
    const xpEarned = friendBonus ? Math.round(baseXp * (1 + FRIEND_BONUS.xp)) : baseXp;

    if (friendBonus) notify(`👥 Бонус друга! +${Math.round(baseCoins * FRIEND_BONUS.coins)} 🪙 +${Math.round(baseXp * FRIEND_BONUS.xp)} XP`);

    setGameResult({ position, coinsEarned });
    setPlayer(prev => {
      const today = todayDateStr();
      const baseQuests = prev.dailyQuestsDate === today ? prev.dailyQuests : makeDailyQuests(today);
      const newCompletedLabels: string[] = [];
      const newQuests = baseQuests.map(q => {
        if (q.done) return q;
        let progress = q.progress;
        if (q.id === 'play3') progress = Math.min(q.goal, progress + 1);
        if (q.id === 'top5' && position <= (q.label.includes('топ-3') ? 3 : 5)) progress = Math.min(q.goal, progress + 1);
        if (q.id === 'survive') progress = Math.max(progress, Math.min(q.goal, roundsPlayed ?? 0));
        const done = progress >= q.goal;
        if (done && !q.done) {
          newCompletedLabels.push(`🎯 ${q.label} — готово! Забери награду`);
        }
        return { ...q, progress, done };
      });
      if (newCompletedLabels.length > 0) {
        newCompletedLabels.forEach((msg, i) => {
          setTimeout(() => notify(msg), i * 2000);
        });
      }
      return {
        ...prev,
        coins: prev.coins + coinsEarned,
        gems: prev.gems,
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
  }, [notify, roomState]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startGamePollingRef = useRef<(roomId: string, pid: string) => void>(() => {});

  const startGamePolling = useCallback((roomId: string, _pid: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const st = await roomApi('state', { roomId });
        setRoomState(st as RoomState);
        if (st.status === 'finished') stopPolling();
      } catch { /* ignore */ }
    }, 300);
  }, [stopPolling]);

  useEffect(() => { startGamePollingRef.current = startGamePolling; }, [startGamePolling]);

  const handlePlay = useCallback(async () => {
    setGameResult(null);
    setGameRound(0);
    setInGamePhase('playing');

    // Попробовать войти через Яндекс ID
    let pid = localPlayerId;
    let displayName = player.name;

    // Проверяем сохранённый ник из localStorage
    const savedNick = getSavedNick();
    if (savedNick) {
      displayName = savedNick.name;
      // Обновим эмодзи игрока если он там другой
      if (savedNick.emoji !== player.emoji) {
        setPlayer(prev => ({ ...prev, emoji: savedNick.emoji }));
      }
    }

    if (!pid) {
      const ya = await getYaPlayer();
      if (ya) {
        pid = ya.id;
        // Яндекс-имя может быть пустым или длинным — просим ник (если нет сохранённого)
        if (!savedNick && (!ya.name || ya.name.length > 16 || ya.name.length < 2)) {
          setLocalPlayerId(pid);
          setNeedNickname(true);
          return;
        }
        if (!savedNick) displayName = ya.name;
      } else {
        pid = `user_${player.name}`;
      }
      setLocalPlayerId(pid);
    }

    // Если имя ещё не задано (новый игрок без сохранённого ника)
    if (!displayName || displayName.length < 2) {
      setNeedNickname(true);
      return;
    }

    const car = player.cars[player.selectedCar];
    const currentPid = pid;
    const LOBBY_WAIT_MS = 15000;

    // Сразу показываем лобби с временным roomState (offline-режим)
    const offlineRoom: RoomState = {
      roomId: `offline_${Date.now()}`,
      status: 'waiting',
      round: 0,
      phase: 'driving',
      timerEnd: Date.now() + LOBBY_WAIT_MS,
      players: [{
        player_id: currentPid,
        name: displayName,
        emoji: player.emoji,
        color: car?.color ?? '#FF2D55',
        body_color: car?.bodyColor ?? '#CC0033',
        max_hp: car?.maxHp ?? 100,
        x: 0, y: 0, angle: 0, speed: 0, orbit_angle: 0, orbit_radius: 290,
        parked: false, park_spot: -1, eliminated: false, is_bot: false,
        hp: car?.maxHp ?? 100,
        last_seen: Date.now(),
      }],
      spots: [],
    };
    setRoomState(offlineRoom);
    setIsLobby(true);
    stopPolling();

    const startOfflineGame = () => {
      setIsLobby(false);
      setRoomState(null);
      setGameKey(k => k + 1);
      setScreen('game');
    };

    const startOnlineGame = (st: RoomState, roomId: string) => {
      setRoomState(st);
      setIsLobby(false);
      setGameKey(k => k + 1);
      setScreen('game');
      stopPolling();
      startGamePollingRef.current(roomId, currentPid);
    };

    // Пробуем подключиться к онлайн-комнате в фоне
    const offlineTimer = setTimeout(startOfflineGame, LOBBY_WAIT_MS);

    try {
      const joinPromise = roomApi('join', {
        playerId: pid,
        name: displayName,
        emoji: player.emoji,
        color: car?.color ?? '#FF2D55',
        bodyColor: car?.bodyColor ?? '#CC0033',
        maxHp: car?.maxHp ?? 100,
      });
      // Таймаут 4 сек — если CSP или сеть блокирует, остаёмся в оффлайн-лобби
      const data = await Promise.race([
        joinPromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
      ]);

      if (data.error) throw new Error(data.error);

      if (data.status === 'playing') {
        // Комната уже стартовала — сразу в игру
        clearTimeout(offlineTimer);
        startOnlineGame(data as RoomState, data.roomId);
        return;
      }

      // Онлайн-комната в режиме ожидания — обновляем roomState
      setRoomState(data as RoomState);
      const lobbyRoomId = data.roomId;
      const lobbyTimerEnd = data.timerEnd as number;

      // Клиентский таймер: принудительный старт с ботами
      const forceTimer = setTimeout(async () => {
        try {
          const st = await roomApi('join', {
            playerId: currentPid,
            name: displayName,
            emoji: player.emoji,
            color: player.cars[player.selectedCar]?.color ?? '#FF2D55',
            bodyColor: player.cars[player.selectedCar]?.bodyColor ?? '#CC0033',
            maxHp: player.cars[player.selectedCar]?.maxHp ?? 100,
            forceStart: true,
          });
          if (st.status === 'playing') {
            clearTimeout(offlineTimer);
            startOnlineGame(st as RoomState, lobbyRoomId);
          }
        } catch { startOfflineGame(); }
      }, Math.max(0, lobbyTimerEnd - Date.now()) + 500);

      pollRef.current = setInterval(async () => {
        try {
          const st = await roomApi('state', { roomId: lobbyRoomId });
          setRoomState(st as RoomState);
          if (st.status === 'playing') {
            clearTimeout(forceTimer);
            clearTimeout(offlineTimer);
            startOnlineGame(st as RoomState, lobbyRoomId);
          }
        } catch { /* ignore */ }
      }, 800);

    } catch {
      // Сервер недоступен — лобби уже показано, ждём таймер и запустим офлайн
    }
  }, [player, localPlayerId, stopPolling, notify]);

  // Отправка позиции игрока на сервер
  const handlePlayerMove = useCallback((mv: {
    x: number; y: number; angle: number; speed: number;
    hp: number; orbitAngle: number; parked: boolean; parkSpot: number; eliminated: boolean;
  }) => {
    if (!roomState?.roomId || !localPlayerId) return;
    roomApi('move', { roomId: roomState.roomId, playerId: localPlayerId, ...mv }).catch(() => {});
  }, [roomState, localPlayerId]);

  // Очистка при размонтировании
  useEffect(() => () => stopPolling(), [stopPolling]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <div className="text-6xl mb-4">👑</div>
          <div className="text-white font-russo text-xl mb-2">Король парковки</div>
          <div className="text-gray-400 text-sm">Загрузка...</div>
          <div className="mt-4 w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {needNickname && (
        <NicknameSetup
          onDone={(name, emoji) => {
            setPlayer(prev => ({ ...prev, name, emoji }));
            setNeedNickname(false);
            // После выбора ника сразу идём в комнату
            setTimeout(() => handlePlay(), 100);
          }}
        />
      )}

      {dailyBonus && (
        <DailyBonusModal
          streak={dailyBonus.streak}
          coinsEarned={dailyBonus.coins}
          gemsEarned={dailyBonus.gems}
          onClose={() => setDailyBonus(null)}
        />
      )}

      {notification && (
        <div className="fixed top-4 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="bg-gray-900 border-2 border-yellow-500/40 rounded-2xl px-6 py-3 font-russo text-white text-sm shadow-2xl whitespace-nowrap animate-fade-in">
            {notification}
          </div>
        </div>
      )}

      {screen === 'menu' && (
        <MenuScreen player={player} setScreen={setScreen} onPlay={handlePlay} onQuestClaim={(questId) => {
          setPlayer(prev => {
            const today = todayDateStr();
            const quest = (prev.dailyQuests ?? []).find(q => q.id === questId);
            if (!quest || quest.claimed || quest.progress < quest.goal) return prev;
            notify(`✅ ${quest.label} +${quest.reward.coins}🪙${quest.reward.gems ? ` +${quest.reward.gems}💎` : ''}`);
            return {
              ...prev,
              coins: prev.coins + quest.reward.coins,
              gems: prev.gems + (quest.reward.gems ?? 0),
              dailyQuests: prev.dailyQuests.map(q =>
                q.id === questId ? { ...q, claimed: true } : q
              ),
              dailyQuestsDate: today,
            };
          });
        }} />
      )}

      {isLobby && roomState && (
        <LobbyScreen
          room={roomState}
          localPlayerId={localPlayerId}
          onCancel={() => { stopPolling(); setIsLobby(false); setRoomState(null); }}
        />
      )}

      {screen === 'game' && !isLobby && (
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
          roomState={roomState}
          localPlayerId={localPlayerId}
          onPlayerMove={handlePlayerMove}
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