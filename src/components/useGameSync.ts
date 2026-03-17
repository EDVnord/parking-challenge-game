import { useEffect, useRef, MutableRefObject } from 'react';
import { GameState, Upgrades, RoomState } from './gameTypes';
import { applyRoomState, spawnParticles } from './gameLogic';
import { playSignalSound, playEliminatedSound, playWinSound } from './gameAudio';
import { CENTER_X, CENTER_Y } from './gameTypes';

interface UseGameSyncParams {
  stateRef: MutableRefObject<GameState>;
  upgrades: Upgrades;
  playerHp: number | undefined;
  localId: string;
  roomState: RoomState | null | undefined;
}

export function useGameSync({ stateRef, upgrades, playerHp, localId, roomState }: UseGameSyncParams) {
  // Назначить localId игроку в стейте
  useEffect(() => {
    const playerCar = stateRef.current.cars.find(c => c.isPlayer);
    if (playerCar) playerCar.playerId = localId;
  }, [localId, stateRef]);

  // Sync upgrades into state
  useEffect(() => {
    stateRef.current.playerBumper = upgrades.bumper;
    stateRef.current.playerAutoRepair = upgrades.autoRepair;
    stateRef.current.playerNitro = upgrades.nitro;
    stateRef.current.playerGps = upgrades.gps;
    stateRef.current.playerMagnet = upgrades.magnet;
    stateRef.current.playerTurbo = upgrades.turbo;
    stateRef.current.playerShield = upgrades.shield;
  }, [upgrades, stateRef]);

  // Sync player HP from outside (after manual repair button)
  useEffect(() => {
    if (playerHp === undefined) return;
    const playerCar = stateRef.current.cars.find(c => c.isPlayer);
    if (playerCar) playerCar.hp = playerHp;
  }, [playerHp, stateRef]);

  const prevPhaseRef = useRef<string>('');
  const prevRoundRef = useRef<number>(-1);

  // Синхронизация с бэкендом: применяем roomState к локальному стейту
  useEffect(() => {
    if (!roomState) return;
    const state = stateRef.current;
    const prevPhase = prevPhaseRef.current;
    const prevRound = prevRoundRef.current;

    applyRoomState(state, roomState, localId);

    // Реакция на смену фазы — звуки и эффекты
    if (roomState.phase !== prevPhase) {
      if (roomState.phase === 'signal') {
        playSignalSound();
      } else if (roomState.phase === 'roundEnd') {
        // Найти выбывшего — тот кто был активен и теперь eliminated
        const eliminated = state.cars.find(c => c.eliminated && !c.isBot && c.playerId !== localId);
        const playerEliminated = state.cars.find(c => c.isPlayer && c.eliminated);
        if (playerEliminated) {
          playEliminatedSound();
          spawnParticles(state, playerEliminated.x, playerEliminated.y, '#FF2D55', 20);
          state.shakeTimer = 0.5;
          state.eliminatedThisRound = playerEliminated;
        } else if (eliminated) {
          spawnParticles(state, eliminated.x, eliminated.y, '#FF2D55', 20);
          state.shakeTimer = 0.5;
          state.eliminatedThisRound = eliminated;
        }
        void playerEliminated;
      } else if (roomState.phase === 'winner') {
        playWinSound();
        state.winnerTimer = 5;
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            const p = state.cars.find(c => c.isPlayer);
            if (p) spawnParticles(state, p.x, p.y, '#FFD600', 25);
            spawnParticles(state, CENTER_X + (Math.random()-0.5)*300, CENTER_Y + (Math.random()-0.5)*200,
              ['#FF6B35','#AF52DE','#34C759','#FF2D55','#5AC8FA'][Math.floor(Math.random()*5)], 18);
          }, i * 300);
        }
      } else if (roomState.phase === 'driving' && prevPhase === 'roundEnd') {
        // Новый раунд — сбрасываем шилд
        state.shieldUsed = false;
        state.eliminatedThisRound = null;
        state.signal = false;
      }
      prevPhaseRef.current = roomState.phase;
    }

    if (roomState.round !== prevRound) {
      prevRoundRef.current = roomState.round;
    }
  }, [roomState, localId, stateRef]);
}