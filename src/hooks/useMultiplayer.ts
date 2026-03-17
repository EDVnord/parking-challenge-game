import { useState, useRef, useCallback, useEffect } from 'react';
import { PlayerData, RoomState, roomApi, ROOM_URL } from '@/pages/parkingTypes';
import { getFriends } from '@/components/FriendsPanel';

const LOBBY_WAIT_MS = 15000;
const JOIN_TIMEOUT_MS = 5000;
const POLL_INTERVAL_LOBBY = 1000;
const POLL_INTERVAL_GAME = 300;

interface UseMultiplayerOptions {
  player: PlayerData;
  localPlayerId: string;
  onStartGame: (room: RoomState | null) => void;
}

export function useMultiplayer({ player, localPlayerId, onStartGame }: UseMultiplayerOptions) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isLobby, setIsLobby] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
  const onStartGameRef = useRef(onStartGame);
  useEffect(() => { onStartGameRef.current = onStartGame; }, [onStartGame]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const clearOfflineTimer = useCallback(() => {
    if (offlineTimerRef.current) { clearTimeout(offlineTimerRef.current); offlineTimerRef.current = null; }
  }, []);

  const startGame = useCallback((room: RoomState | null, roomId?: string) => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    clearOfflineTimer();
    stopPolling();
    setIsLobby(false);
    setRoomState(room);
    onStartGameRef.current(room);

    if (roomId) {
      roomIdRef.current = roomId;
      pollRef.current = setInterval(async () => {
        try {
          const st = await roomApi('state', { roomId });
          setRoomState(st as RoomState);
          if (st.status === 'finished') stopPolling();
        } catch { /* ignore */ }
      }, POLL_INTERVAL_GAME);
    }
  }, [clearOfflineTimer, stopPolling]);

  const cancelLobby = useCallback(() => {
    stopPolling();
    clearOfflineTimer();
    isPlayingRef.current = false;
    roomIdRef.current = null;
    setIsLobby(false);
    setRoomState(null);
  }, [stopPolling, clearOfflineTimer]);

  const joinLobby = useCallback(async (pid: string, displayName: string) => {
    stopPolling();
    clearOfflineTimer();
    isPlayingRef.current = false;

    const car = player.cars[player.selectedCar];

    const offlineRoom: RoomState = {
      roomId: `offline_${Date.now()}`,
      status: 'waiting', round: 0, phase: 'driving',
      timerEnd: Date.now() + LOBBY_WAIT_MS,
      players: [{
        player_id: pid, name: displayName, emoji: player.emoji,
        color: car?.color ?? '#FF2D55', body_color: car?.bodyColor ?? '#CC0033',
        max_hp: car?.maxHp ?? 100, x: 0, y: 0, angle: 0, speed: 0,
        orbit_angle: 0, orbit_radius: 230, parked: false, park_spot: -1,
        eliminated: false, is_bot: false, hp: car?.maxHp ?? 100, last_seen: Date.now(),
      }],
      spots: [],
    };
    setRoomState(offlineRoom);
    setIsLobby(true);

    offlineTimerRef.current = setTimeout(() => {
      if (!isPlayingRef.current) startGame(null);
    }, LOBBY_WAIT_MS);

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

      const lobbyRoomId = data.roomId as string;
      roomIdRef.current = lobbyRoomId;

      if (data.status === 'playing') {
        startGame(data as RoomState, lobbyRoomId);
        return;
      }

      setRoomState(data as RoomState);

      pollRef.current = setInterval(async () => {
        if (isPlayingRef.current) { stopPolling(); return; }
        try {
          const st = await roomApi('state', { roomId: lobbyRoomId });
          setRoomState(st as RoomState);
          if (st.status === 'playing') {
            startGame(st as RoomState, lobbyRoomId);
          }
        } catch { /* ignore */ }
      }, POLL_INTERVAL_LOBBY);

    } catch {
      /* офлайн-таймер уже запущен */
    }
  }, [player, stopPolling, clearOfflineTimer, startGame]);

  const handlePlayerMove = useCallback((mv: {
    x: number; y: number; angle: number; speed: number;
    hp: number; orbitAngle: number; parked: boolean; parkSpot: number; eliminated: boolean;
  }) => {
    const roomId = roomIdRef.current;
    if (!roomId || !localPlayerId || roomId.startsWith('offline_')) return;
    roomApi('move', { roomId, playerId: localPlayerId, ...mv }).catch(() => {});
  }, [localPlayerId]);

  const roomStateRef = useRef(roomState);
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);

  useEffect(() => {
    const sendLeave = () => {
      const roomId = roomIdRef.current;
      if (!roomId || !localPlayerId || roomId.startsWith('offline_')) return;
      const body = JSON.stringify({ action: 'leave', roomId, playerId: localPlayerId });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ROOM_URL, new Blob([body], { type: 'application/json' }));
      } else {
        roomApi('leave', { roomId, playerId: localPlayerId }).catch(() => {});
      }
    };

    const onVisibility = () => { if (document.visibilityState === 'hidden') sendLeave(); };
    window.addEventListener('beforeunload', sendLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', sendLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [localPlayerId]);

  return { roomState, setRoomState, isLobby, joinLobby, cancelLobby, handlePlayerMove };
}
