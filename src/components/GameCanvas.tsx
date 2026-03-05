import { useRef } from 'react';
import { GameState, GameCanvasProps, CANVAS_W, CANVAS_H } from './gameTypes';
import { createInitialState } from './gameLogic';
import { useBotAI } from './useBotAI';
import { useGameSync } from './useGameSync';
import { useGameLoop } from './useGameLoop';

export default function GameCanvas({
  playerName, playerId, playerHp, playerMaxHp,
  playerColor, playerBodyColor, playerEmoji, playerMaxSpeed,
  upgrades, onRoundEnd, onGameEnd, keys, roomState, onPlayerMove,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState(playerName, playerHp, playerMaxHp, playerColor, playerBodyColor, playerEmoji, playerMaxSpeed));
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const moveThrottleRef = useRef<number>(0);
  const localId = playerId || 'local_player';

  const botAI = useBotAI();

  useGameSync({ stateRef, upgrades, playerHp, localId, roomState });

  useGameLoop({
    canvasRef, stateRef, animRef, timeRef, moveThrottleRef,
    playerName, upgrades, keys, onRoundEnd, onGameEnd, onPlayerMove, botAI,
  });

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="rounded-2xl border-2 border-white/20"
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
    />
  );
}
