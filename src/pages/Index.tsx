import { useState, useEffect, useRef, useCallback } from 'react';
import { Screen, LeaderboardResult, RoomState, fetchLeaderboard, todayDateStr, weeklyDateStr } from './parkingTypes';
import { MenuScreen, GameScreen, GameOverScreen } from './GameScreens';
import { GarageScreen, ShopScreen, ProfileScreen, LeaderboardScreen, FriendsScreen } from './PlayerScreens';
import DailyBonusModal from '@/components/DailyBonusModal';
import LobbyScreen from '@/components/LobbyScreen';
import NicknameSetup from '@/components/NicknameSetup';
import { useNotify } from '@/hooks/useNotify';
import AchievementToast from '@/components/AchievementToast';
import { usePlayerAuth } from '@/hooks/usePlayerAuth';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useGameHandlers } from '@/hooks/useGameHandlers';

export default function Index() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const keysRef = useRef<Set<string>>(new Set());
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResult>({ leaders: [] });

  const { notification, notify } = useNotify();

  const {
    player, setPlayer,
    localPlayerId,
    isLoading,
    needNickname, setNeedNickname,
    dailyBonus, setDailyBonus,
    resolvePlayer,
  } = usePlayerAuth(notify);

  // Хранит roomState для передачи в gameHandlers (хуки вызываются независимо)
  const roomStateRef = useRef<RoomState | null>(null);

  const {
    gameRound, setGameRound,
    gameKey, setGameKey,
    gameResult, setGameResult,
    inGamePhase, setInGamePhase,
    handleRoundEnd,
    handleGameEnd,
  } = useGameHandlers({
    player, setPlayer,
    roomState: roomStateRef.current,
    setScreen, notify,
  });

  const handleStartGame = useCallback((room: RoomState | null) => {
    roomStateRef.current = room;
    setGameResult(null);
    setGameRound(0);
    setInGamePhase('playing');
    setGameKey(k => k + 1);
    setScreen('game');
  }, [setGameResult, setGameRound, setInGamePhase, setGameKey]);

  const {
    roomState, isLobby,
    joinLobby, cancelLobby,
    handlePlayerMove,
  } = useMultiplayer({
    player, localPlayerId,
    onStartGame: handleStartGame,
  });

  // Синхронизируем ref с актуальным roomState для gameHandlers
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);

  // Клавиатура
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

  // Лидерборд
  useEffect(() => {
    if (screen === 'leaderboard') {
      fetchLeaderboard(player.name).then(result => {
        if (result.leaders.length > 0) setLeaderboardData(result);
      });
    }
  }, [screen, player.name]);

  const handlePlay = useCallback(async () => {
    const resolved = await resolvePlayer();
    if (!resolved) return;
    await joinLobby(resolved.pid, resolved.displayName);
  }, [resolvePlayer, joinLobby]);

  const handleQuestClaim = useCallback((questId: string) => {
    setPlayer(prev => {
      const today = todayDateStr();
      const quest = (prev.dailyQuests ?? []).find(q => q.id === questId);
      if (!quest || quest.claimed || quest.progress < quest.goal) return prev;
      notify(`✅ ${quest.label} +${quest.reward.coins}🪙${quest.reward.gems ? ` +${quest.reward.gems}💎` : ''}`);
      return {
        ...prev,
        coins: prev.coins + quest.reward.coins,
        gems: prev.gems + (quest.reward.gems ?? 0),
        dailyQuests: prev.dailyQuests.map(q => q.id === questId ? { ...q, claimed: true } : q),
        dailyQuestsDate: today,
      };
    });
  }, [notify, setPlayer]);

  const handleWeeklyQuestClaim = useCallback((questId: string) => {
    setPlayer(prev => {
      const thisWeek = weeklyDateStr();
      const quest = (prev.weeklyQuests ?? []).find(q => q.id === questId);
      if (!quest || quest.claimed || quest.progress < quest.goal) return prev;
      notify(`🏆 ${quest.label} +${quest.reward.coins}🪙 +${quest.reward.gems}💎`);
      return {
        ...prev,
        coins: prev.coins + quest.reward.coins,
        gems: prev.gems + quest.reward.gems,
        weeklyQuests: prev.weeklyQuests.map(q => q.id === questId ? { ...q, claimed: true } : q),
        weeklyQuestsDate: thisWeek,
      };
    });
  }, [notify, setPlayer]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <div className="text-6xl mb-4">👑</div>
          <div className="text-white font-russo text-xl mb-2">Король парковки</div>
          <div className="text-gray-400 text-sm">Загрузка...</div>
          <div className="mt-4 w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
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

      <AchievementToast player={player} />

      {notification && (
        <div className="fixed top-4 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="bg-gray-900 border-2 border-yellow-500/40 rounded-2xl px-6 py-3 font-russo text-white text-sm shadow-2xl whitespace-nowrap animate-fade-in">
            {notification}
          </div>
        </div>
      )}

      {isLobby && roomState && (
        <LobbyScreen room={roomState} localPlayerId={localPlayerId} onCancel={cancelLobby} />
      )}

      {screen === 'menu' && (
        <MenuScreen player={player} setScreen={setScreen} onPlay={handlePlay} onQuestClaim={handleQuestClaim} onWeeklyQuestClaim={handleWeeklyQuestClaim} />
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
        <GameOverScreen gameResult={gameResult} onRestart={handlePlay} onMenu={() => setScreen('menu')} />
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
        <LeaderboardScreen player={player} leaderboardData={leaderboardData} setScreen={setScreen} />
      )}

      {screen === 'friends' && (
        <FriendsScreen player={player} localPlayerId={localPlayerId} setScreen={setScreen} notify={notify} />
      )}

    </div>
  );
}