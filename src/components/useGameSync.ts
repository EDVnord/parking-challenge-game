import { useEffect, useRef, MutableRefObject } from 'react';
import { GameState, Upgrades, RoomState } from './gameTypes';
import { applyRoomState, spawnParticles } from './gameLogic';
import { playEliminatedSound } from './gameAudio';
import { CENTER_X, CENTER_Y } from './gameTypes';

interface UseGameSyncParams {
  stateRef: MutableRefObject<GameState>;
  upgrades: Upgrades;
  playerHp: number | undefined;
  localId: string;
  roomState: RoomState | null | undefined;
}

export function useGameSync({ stateRef, upgrades, playerHp, localId, roomState }: UseGameSyncParams) {
  useEffect(() => {
    const playerCar = stateRef.current.cars.find(c => c.isPlayer);
    if (playerCar) playerCar.playerId = localId;
  }, [localId, stateRef]);

  useEffect(() => {
    stateRef.current.playerBumper = upgrades.bumper;
    stateRef.current.playerAutoRepair = upgrades.autoRepair;
    stateRef.current.playerNitro = upgrades.nitro;
    stateRef.current.playerGps = upgrades.gps;
    stateRef.current.playerMagnet = upgrades.magnet;
    stateRef.current.playerTurbo = upgrades.turbo;
    stateRef.current.playerShield = upgrades.shield;
  }, [upgrades, stateRef]);

  useEffect(() => {
    if (playerHp === undefined) return;
    const playerCar = stateRef.current.cars.find(c => c.isPlayer);
    if (playerCar) playerCar.hp = playerHp;
  }, [playerHp, stateRef]);

  const prevPhaseRef = useRef<string>('');
  const prevRoundRef = useRef<number>(-1);

  useEffect(() => {
    if (!roomState) return;
    const state = stateRef.current;
    const prevPhase = prevPhaseRef.current;
    const prevRound = prevRoundRef.current;

    // Применяем серверное состояние
    applyRoomState(state, roomState, localId);

    // Эффекты при смене фазы
    const phaseChanged = roomState.phase !== prevPhase;
    const roundChanged = roomState.round !== prevRound;

    if (phaseChanged || roundChanged) {
      if (roomState.phase === 'roundEnd' && phaseChanged) {
        const eliminatedId = roomState.eliminatedThisRound;
        const eliminatedCar = eliminatedId
          ? state.cars.find(c => c.playerId === eliminatedId)
          : null;
        if (eliminatedCar) {
          state.eliminatedThisRound = eliminatedCar;
          spawnParticles(state, eliminatedCar.x, eliminatedCar.y, '#FF2D55', 20);
          state.shakeTimer = 0.5;
          if (eliminatedCar.isPlayer) playEliminatedSound();
        }
      }

      if (roomState.phase === 'driving' && prevPhase === 'roundEnd') {
        state.shieldUsed = false;
        state.eliminatedThisRound = null;
        // Сброс parked для всех (включая локального игрока)
        state.cars.forEach(car => {
          if (!car.eliminated) {
            car.parked = false;
            car.parkSpot = null;
            car.targetSpot = null;
            car.targetX = undefined;
            car.targetY = undefined;
          }
        });
      }

      prevPhaseRef.current = roomState.phase;
      prevRoundRef.current = roomState.round;
    }
  }, [roomState, localId, stateRef]);
}