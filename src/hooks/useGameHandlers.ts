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
  const [extraLifeOffer, setExtraLifeOffer] = useState(false);
  const resumeGameRef = useRef<(() => void) | null>(null);

  const handleRoundEnd = useCallback((round: number, isPlayerEliminated: boolean, playerHp: number, playerMaxHp: number) => {
    setGameRound(round);
    setInGamePhase('roundEnd');

    if (isPlayerEliminated) {
      // Читаем extraLives через functional update, чтобы избежать stale closure (особенно на iOS Safari)
      setPlayer(prev => {
        const lives = prev.extraLives ?? 0;
        const updatedCars = prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: Math.round(playerHp), maxHp: playerMaxHp } : c);

        if (lives > 0) {
          // Откладываем показ оффера чуть позже — после завершения этого render-цикла
          setTimeout(() => {
            setExtraLifeOffer(true);
            const timeout = setTimeout(() => {
              setExtraLifeOffer(false);
              resumeGameRef.current = null;
              setTimeout(() => setInGamePhase('playing'), 500);
            }, 8000);
            resumeGameRef.current = () => {
              clearTimeout(timeout);
              setExtraLifeOffer(false);
              resumeGameRef.current = null;
              setPlayer(prev2 => ({
                ...prev2,
                extraLives: Math.max(0, (prev2.extraLives ?? 0) - 1),
                cars: prev2.cars.map((c, i) => i === prev2.selectedCar ? { ...c, hp: Math.round(c.maxHp * 0.5) } : c),
              }));
              notify('❤️ Вторая жизнь! +50% HP — продолжай!');
              setTimeout(() => setInGamePhase('playing'), 300);
            };
          }, 0);
        } else {
          notify('❌ Тебя вышибли! Паркуйся быстрее!');
          setTimeout(() => setInGamePhase('playing'), 3000);
        }

        return { ...prev, cars: updatedCars };
      });
    } else {
      setPlayer(prev => ({
        ...prev,
        cars: prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: Math.round(playerHp), maxHp: playerMaxHp } : c),
      }));
      setTimeout(() => setInGamePhase('playing'), 3000);
    }
  }, [notify, setPlayer]);

  const useExtraLife = useCallback(() => {
    resumeGameRef.current?.();
  }, []);

  const declineExtraLife = useCallback(() => {
    setExtraLifeOffer(false);
    resumeGameRef.current = null;
    notify('❌ Тебя вышибли! Паркуйся быстрее!');
    setTimeout(() => setInGamePhase('playing'), 500);
  }, [notify]);

  const handleGameEnd = useCallback(async (position: number, roundsPlayed?: number, finalHp?: number) => {
    const friends = getFriends();
    const roomPlayerIds = roomStateRef.current?.players.map(p => p.player_id) ?? [];
    const friendBonus = friends.length > 0 && hasFriendInRoom(roomPlayerIds, friends);

    // Экономика: топ-1 ~400 монет, топ-5 ~100, топ-10 ~0-15
    // Бонус за раунды: +8 монет за каждый раунд выживания (с раунда 2)
    const rounds = roundsPlayed ?? 0;
    const roundBonus = Math.max(0, rounds - 1) * 8;
    // Места 1-6 получают монеты, 7-10 — почти ничего
    const positionCoins = position <= 6 ? (7 - position) * 55 + Math.floor(Math.random() * 40) : Math.floor(Math.random() * 15);
    const baseCoins = positionCoins + roundBonus;
    const baseXp = position <= 6 ? Math.max(10, (7 - position) * 30 + (position === 1 ? 80 : 0)) : Math.max(5, (11 - position) * 5);

    // Читаем буст-сессии из свежего состояния через snapshot (не из замыкания)
    const playerSnapshot = player;
    const coinBoostActive = (playerSnapshot.coinBoostSessions ?? 0) > 0;
    const coinsBeforeFriend = coinBoostActive ? baseCoins * 2 : baseCoins;
    const coinsEarned = friendBonus ? Math.round(coinsBeforeFriend * (1 + FRIEND_BONUS.coins)) : coinsBeforeFriend;

    const xpBoostActive = (playerSnapshot.xpBoostGames ?? 0) > 0;
    const xpBeforeFriend = xpBoostActive ? baseXp * 2 : baseXp;
    const xpEarned = friendBonus ? Math.round(xpBeforeFriend * (1 + FRIEND_BONUS.xp)) : xpBeforeFriend;

    if (roundBonus > 0) notify(`⏱ Бонус за ${rounds} раундов: +${roundBonus} 🪙`);
    if (coinBoostActive) notify(`💰 Буст x2! Монет: +${coinsEarned} 🪙`);
    if (xpBoostActive) notify(`⭐ Буст XP x2!`);
    if (friendBonus) notify(`👥 Бонус друга! +${Math.round(coinsBeforeFriend * FRIEND_BONUS.coins)} 🪙 +${Math.round(xpBeforeFriend * FRIEND_BONUS.xp)} XP`);

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
      const rounds2 = roundsPlayed ?? 0;

      const newQuests = baseQuests.map(q => {
        if (q.done) return q;
        let progress = q.progress;
        if (q.id === 'play3') progress = Math.min(q.goal, progress + 1);
        if (q.id === 'top5') {
          const threshold = q.label.includes('топ-3') ? 3 : q.label.includes('топ-4') ? 4 : 5;
          if (position <= threshold) progress = Math.min(q.goal, progress + 1);
        }
        if (q.id === 'survive') progress = Math.max(progress, Math.min(q.goal, rounds2));
        if (q.id === 'win' && position === 1) progress = Math.min(q.goal, progress + 1);
        if (q.id === 'play_long' && rounds2 >= 8) progress = Math.min(q.goal, progress + 1);
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
        if (q.id === 'w_survive8_3' && rounds2 >= 8) progress = Math.min(q.goal, progress + 1);
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
        coinBoostSessions: Math.max(0, (prev.coinBoostSessions ?? 0) - 1),
        xpBoostGames: Math.max(0, (prev.xpBoostGames ?? 0) - 1),
      };
    });
    if (shouldShowAd()) {
      await showInterstitialAd();
    }
    setScreen('gameOver');
  }, [notify, roomState, setPlayer, setScreen, player]);

  return {
    gameRound, setGameRound,
    gameKey, setGameKey,
    gameResult, setGameResult,
    inGamePhase, setInGamePhase,
    extraLifeOffer,
    useExtraLife,
    declineExtraLife,
    handleRoundEnd,
    handleGameEnd,
  };
}