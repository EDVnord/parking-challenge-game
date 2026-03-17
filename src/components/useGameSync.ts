import { useEffect, MutableRefObject } from 'react';
import { GameState, Upgrades, RoomState } from './gameTypes';
import { applyRoomState } from './gameLogic';

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

  // Синхронизация с бэкендом: применяем roomState к локальному стейту
  useEffect(() => {
    if (!roomState) return;
    applyRoomState(stateRef.current, roomState, localId);
  }, [roomState, localId, stateRef]);
}