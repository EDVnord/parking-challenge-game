import { useState, useCallback, useRef, useEffect } from 'react';
import { PlayerData, RoomState, makeDailyQuests, todayDateStr, levelFromXp } from '@/pages/parkingTypes';
import { getFriends, hasFriendInRoom, FRIEND_BONUS } from '@/components/FriendsPanel';

interface UseGameHandlersOptions {
  player: PlayerData;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
  roomState: RoomState | null;
  setScreen: (s: string) => void;
  notify: (msg: string) => void;
}

export function useGameHandlers({ player, setPlayer, roomState, setScreen, notify }: UseGameHandlersOptions) {
  const roomStateRef = useRef(roomState);
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);
  const [gameRound, setGameRound] = useState(1);
  const [gameKey, setGameKey] = useState(0);
  const [gameResult, setGameResult] = useState<{ position: number; coinsEarned: number } | null>(null);
  const [inGamePhase, setInGamePhase] = useState<'playing' | 'roundEnd'>('playing');

  const handleRoundEnd = useCallback((round: number, isPlayerEliminated: boolean, playerHp: number, playerMaxHp: number) => {
    setGameRound(round);
    setInGamePhase('roundEnd');
    if (isPlayerEliminated) notify('❌ Тебя вышибли! Паркуйся быстрее!');
    setPlayer(prev => ({
      ...prev,
      cars: prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: Math.round(playerHp), maxHp: playerMaxHp } : c),
    }));
    setTimeout(() => setInGamePhase('playing'), 3000);
  }, [notify, setPlayer]);

  const handleGameEnd = useCallback((position: number, roundsPlayed?: number) => {
    const friends = getFriends();
    const roomPlayerIds = roomStateRef.current?.players.map(p => p.player_id) ?? [];
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
        if (done && !q.done) newCompletedLabels.push(`🎯 ${q.label} — готово! Забери награду`);
        return { ...q, progress, done };
      });
      newCompletedLabels.forEach((msg, i) => setTimeout(() => notify(msg), i * 2000));
      return {
        ...prev,
        coins: prev.coins + coinsEarned,
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
  }, [notify, roomState, setPlayer, setScreen]);

  return {
    gameRound, setGameRound,
    gameKey, setGameKey,
    gameResult, setGameResult,
    inGamePhase, setInGamePhase,
    handleRoundEnd,
    handleGameEnd,
  };
}