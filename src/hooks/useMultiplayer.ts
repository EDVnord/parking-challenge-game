import { useState, useRef, useCallback, useEffect } from 'react';
import { PlayerData, RoomState, roomApi } from '@/pages/parkingTypes';
import { getFriends } from '@/components/FriendsPanel';

const LOBBY_WAIT_MS = 15000;
const JOIN_TIMEOUT_MS = 4000;

interface UseMultiplayerOptions {
  player: PlayerData;
  localPlayerId: string;
  onStartGame: (room: RoomState | null) => void;
}

export function useMultiplayer({ player, localPlayerId, onStartGame }: UseMultiplayerOptions) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isLobby, setIsLobby] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lobbyTimersRef = useRef<{ offline?: ReturnType<typeof setTimeout>; force?: ReturnType<typeof setTimeout> }>({});
  const startGamePollingRef = useRef<(roomId: string) => void>(() => {});
  const onStartGameRef = useRef(onStartGame);
  useEffect(() => { onStartGameRef.current = onStartGame; }, [onStartGame]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const clearLobbyTimers = useCallback(() => {
    if (lobbyTimersRef.current.offline) { clearTimeout(lobbyTimersRef.current.offline); lobbyTimersRef.current.offline = undefined; }
    if (lobbyTimersRef.current.force) { clearTimeout(lobbyTimersRef.current.force); lobbyTimersRef.current.force = undefined; }
  }, []);

  const startGamePolling = useCallback((roomId: string) => {
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
  useEffect(() => () => stopPolling(), [stopPolling]);

  const cancelLobby = useCallback(() => {
    stopPolling();
    clearLobbyTimers();
    setIsLobby(false);
    setRoomState(null);
  }, [stopPolling, clearLobbyTimers]);

  const finishLobby = useCallback((room: RoomState | null, roomId?: string) => {
    clearLobbyTimers();
    stopPolling();
    setRoomState(room);
    setIsLobby(false);
    onStartGameRef.current(room);
    if (roomId) startGamePollingRef.current(roomId);
  }, [clearLobbyTimers, stopPolling]);

  const joinLobby = useCallback(async (pid: string, displayName: string) => {
    const car = player.cars[player.selectedCar];

    const offlineRoom: RoomState = {
      roomId: `offline_${Date.now()}`,
      status: 'waiting', round: 0, phase: 'driving',
      timerEnd: Date.now() + LOBBY_WAIT_MS,
      players: [{
        player_id: pid, name: displayName, emoji: player.emoji,
        color: car?.color ?? '#FF2D55', body_color: car?.bodyColor ?? '#CC0033',
        max_hp: car?.maxHp ?? 100, x: 0, y: 0, angle: 0, speed: 0,
        orbit_angle: 0, orbit_radius: 290, parked: false, park_spot: -1,
        eliminated: false, is_bot: false, hp: car?.maxHp ?? 100, last_seen: Date.now(),
      }],
      spots: [],
    };
    setRoomState(offlineRoom);
    setIsLobby(true);
    stopPolling();
    clearLobbyTimers();

    lobbyTimersRef.current.offline = setTimeout(() => finishLobby(null), LOBBY_WAIT_MS);

    try {
      const myFriendCodes = getFriends().map(f => f.code);
      const data = await Promise.race([
        roomApi('join', {
          playerId: pid, name: displayName, emoji: player.emoji,
          color: car?.color ?? '#FF2D55', bodyColor: car?.bodyColor ?? '#CC0033',
          maxHp: car?.maxHp ?? 100, friendCodes: myFriendCodes,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), JOIN_TIMEOUT_MS)),
      ]);

      if (data.error) throw new Error(data.error);

      if (data.status === 'playing') {
        finishLobby(data as RoomState, data.roomId);
        return;
      }

      setRoomState(data as RoomState);
      const lobbyRoomId = data.roomId;
      const lobbyTimerEnd = data.timerEnd as number;

      lobbyTimersRef.current.force = setTimeout(async () => {
        try {
          const st = await roomApi('join', {
            playerId: pid, name: displayName, emoji: player.emoji,
            color: car?.color ?? '#FF2D55', bodyColor: car?.bodyColor ?? '#CC0033',
            maxHp: car?.maxHp ?? 100, forceStart: true,
          });
          finishLobby(st.status === 'playing' ? st as RoomState : null, lobbyRoomId);
        } catch { finishLobby(null); }
      }, Math.max(0, lobbyTimerEnd - Date.now()) + 500);

      pollRef.current = setInterval(async () => {
        try {
          const st = await roomApi('state', { roomId: lobbyRoomId });
          setRoomState(st as RoomState);
          if (st.status === 'playing') finishLobby(st as RoomState, lobbyRoomId);
        } catch { /* ignore */ }
      }, 800);

    } catch { /* офлайн-таймер уже запущен */ }
  }, [player, stopPolling, clearLobbyTimers, finishLobby]);

  const handlePlayerMove = useCallback((mv: {
    x: number; y: number; angle: number; speed: number;
    hp: number; orbitAngle: number; parked: boolean; parkSpot: number; eliminated: boolean;
  }) => {
    if (!roomState?.roomId || !localPlayerId || roomState.roomId.startsWith('offline_')) return;
    roomApi('move', { roomId: roomState.roomId, playerId: localPlayerId, ...mv }).catch(() => {});
  }, [roomState, localPlayerId]);

  return { roomState, setRoomState, isLobby, joinLobby, cancelLobby, handlePlayerMove };
}
