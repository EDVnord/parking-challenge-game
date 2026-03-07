import { useState, useCallback, useRef, useEffect } from 'react';
import { PlayerData, RoomState, makeDailyQuests, makeWeeklyQuests, todayDateStr, weeklyDateStr, levelFromXp, LEVEL_REWARDS, showInterstitialAd, isYandexGamesEnv } from '@/pages/parkingTypes';
import { getFriends, hasFriendInRoom, FRIEND_BONUS } from '@/components/FriendsPanel';

// Показывать рекламу каждые N игр
const AD_EVERY_N_GAMES = 3;
const AD_COUNTER_KEY = 'parking_ad_counter';
function shouldShowAd(): boolean {
  if (!isYandexGamesEnv()) return false;
  const count = parseInt(localStorage.getItem(AD_COUNTER_KEY) ?? '0', 10) + 1;
  localStorage.setItem(AD_COUNTER_KEY, String(count));
  return count % AD_EVERY_N_GAMES === 0;
}

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

  const handleGameEnd = useCallback(async (position: number, roundsPlayed?: number, finalHp?: number) => {
    const friends = getFriends();
    const roomPlayerIds = roomStateRef.current?.players.map(p => p.player_id) ?? [];
    const friendBonus = friends.length > 0 && hasFriendInRoom(roomPlayerIds, friends);

    // Экономика: топ-1 ~200-250 монет, топ-10 ~20 монет
    const baseCoins = Math.max(10, (11 - position) * 20 + Math.floor(Math.random() * 50));
    const baseXp = Math.max(10, (11 - position) * 20 + (position === 1 ? 50 : 0));
    const coinsEarned = friendBonus ? Math.round(baseCoins * (1 + FRIEND_BONUS.coins)) : baseCoins;
    const xpEarned = friendBonus ? Math.round(baseXp * (1 + FRIEND_BONUS.xp)) : baseXp;

    if (friendBonus) notify(`👥 Бонус друга! +${Math.round(baseCoins * FRIEND_BONUS.coins)} 🪙 +${Math.round(baseXp * FRIEND_BONUS.xp)} XP`);

    setGameResult({ position, coinsEarned });
    // Сохраняем финальный hp машины — он не восстанавливается автоматически между играми
    if (finalHp !== undefined && finalHp >= 0) {
      setPlayer(prev => ({
        ...prev,
        cars: prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: Math.round(finalHp) } : c),
      }));
    }
    setPlayer(prev => {
      const today = todayDateStr();
      const thisWeek = weeklyDateStr();
      const baseQuests = prev.dailyQuestsDate === today ? prev.dailyQuests : makeDailyQuests(today);
      const baseWeekly = prev.weeklyQuestsDate === thisWeek ? (prev.weeklyQuests ?? []) : makeWeeklyQuests(thisWeek);
      const newCompletedLabels: string[] = [];
      const rounds = roundsPlayed ?? 0;

      const newQuests = baseQuests.map(q => {
        if (q.done) return q;
        let progress = q.progress;
        if (q.id === 'play3') progress = Math.min(q.goal, progress + 1);
        if (q.id === 'top5') {
          const threshold = q.label.includes('топ-3') ? 3 : q.label.includes('топ-4') ? 4 : 5;
          if (position <= threshold) progress = Math.min(q.goal, progress + 1);
        }
        if (q.id === 'survive') progress = Math.max(progress, Math.min(q.goal, rounds));
        if (q.id === 'win' && position === 1) progress = Math.min(q.goal, progress + 1);
        if (q.id === 'play_long' && rounds >= 8) progress = Math.min(q.goal, progress + 1);
        if (q.id === 'top1_streak') {
          if (position <= 2) progress = Math.min(q.goal, progress + 1);
          else progress = 0;
        }
        const done = progress >= q.goal;
        if (done && !q.done) newCompletedLabels.push(`🎯 ${q.label} — готово! Забери награду`);
        return { ...q, progress, done };
      });

      const allDailyDone = newQuests.every(q => q.done || q.claimed);
      const newWeekly = baseWeekly.map(q => {
        if (q.done) return q;
        let progress = q.progress;
        if (q.id === 'w_play15' || q.id === 'w_play25') progress = Math.min(q.goal, progress + 1);
        if ((q.id === 'w_win5' || q.id === 'w_win10') && position === 1) progress = Math.min(q.goal, progress + 1);
        if (q.id === 'w_top3_10' && position <= 3) progress = Math.min(q.goal, progress + 1);
        if (q.id === 'w_survive8_3' && rounds >= 8) progress = Math.min(q.goal, progress + 1);
        if (q.id === 'w_daily7' && allDailyDone) progress = Math.min(q.goal, progress + 1);
        if (q.id === 'w_streak7') progress = Math.min(q.goal, prev.loginStreak + 1);
        const done = progress >= q.goal;
        if (done && !q.done) newCompletedLabels.push(`🏆 ${q.label} — недельное готово! Забери награду`);
        return { ...q, progress, done };
      });

      const newLevel = levelFromXp(prev.xp + xpEarned);
      let levelBonusCoins = 0;
      let levelBonusGems = 0;
      if (newLevel > prev.level) {
        // Начисляем награды за каждый достигнутый уровень по таблице
        for (let lvl = prev.level + 1; lvl <= newLevel; lvl++) {
          const reward = LEVEL_REWARDS.find(r => r.level === lvl);
          if (reward) {
            levelBonusCoins += reward.coins;
            levelBonusGems += reward.gems ?? 0;
          } else {
            // Уровень без записи в таблице — стандартная награда
            levelBonusCoins += 100 + lvl * 10;
          }
        }
        const gemStr = levelBonusGems > 0 ? ` +${levelBonusGems}💎` : '';
        const bonusEntry = LEVEL_REWARDS.find(r => r.level === newLevel);
        const bonusText = bonusEntry?.bonus ? ` ${bonusEntry.bonus}` : '';
        setTimeout(() => notify(`🆙 Уровень ${newLevel}! +${levelBonusCoins}🪙${gemStr}${bonusText}`), 500);
      }

      newCompletedLabels.forEach((msg, i) => setTimeout(() => notify(msg), (i + (newLevel > prev.level ? 1 : 0)) * 2000));
      return {
        ...prev,
        coins: prev.coins + coinsEarned + levelBonusCoins,
        gems: prev.gems + levelBonusGems,
        xp: prev.xp + xpEarned,
        level: newLevel,
        wins: position === 1 ? prev.wins + 1 : prev.wins,
        gamesPlayed: prev.gamesPlayed + 1,
        bestPosition: prev.bestPosition === 99 ? position : Math.min(prev.bestPosition, position),
        dailyQuests: newQuests,
        dailyQuestsDate: today,
        weeklyQuests: newWeekly,
        weeklyQuestsDate: thisWeek,
      };
    });
    if (shouldShowAd()) {
      await showInterstitialAd();
    }
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