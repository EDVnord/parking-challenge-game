import { useRef, useState, useEffect } from 'react';
import { GameState, GameCanvasProps, CANVAS_W, CANVAS_H } from './gameTypes';
import { createInitialState } from './gameLogic';
import { useBotAI } from './useBotAI';
import { useGameSync } from './useGameSync';
import { useGameLoop } from './useGameLoop';

export default function GameCanvas({
  playerName, playerId, playerHp, playerMaxHp,
  playerColor, playerBodyColor, playerEmoji, playerMaxSpeed,
  upgrades, onRoundEnd, onGameEnd, keys, keysRef, roomState, onPlayerMove,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState(playerName, playerHp, playerMaxHp, playerColor, playerBodyColor, playerEmoji, playerMaxSpeed));
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const moveThrottleRef = useRef<number>(0);
  const localId = playerId || 'local_player';

  const [aliveCollapsed, setAliveCollapsed] = useState(true);
  const aliveCollapsedRef = useRef(true);
  const [aliveCount, setAliveCount] = useState(10);

  const handleToggleAlive = () => {
    const next = !aliveCollapsed;
    aliveCollapsedRef.current = next;
    setAliveCollapsed(next);
  };

  // Обновляем счётчик живых раз в секунду
  useEffect(() => {
    const id = setInterval(() => {
      const count = stateRef.current.cars.filter(c => !c.eliminated).length;
      setAliveCount(count);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const botAI = useBotAI();

  useGameSync({ stateRef, upgrades, playerHp, localId, roomState });

  useGameLoop({
    canvasRef, stateRef, animRef, timeRef, moveThrottleRef,
    playerName, upgrades, keys, keysRef, onRoundEnd, onGameEnd, onPlayerMove, botAI,
    aliveCollapsedRef,
  });

  return (
    <div className="relative w-full h-full" style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}`, maxHeight: '100%' }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-2xl border-2 border-white/20 w-full h-full"
        style={{ display: 'block' }}
        onContextMenu={e => e.preventDefault()}
      />
      {/* Кнопка-тоггл для списка ЖИВЫЕ */}
      <button
        onClick={handleToggleAlive}
        className="absolute top-[1.5%] right-[1.5%] font-russo bg-black/50 border border-yellow-400/30 text-yellow-300 hover:bg-black/70 transition-all rounded-lg px-2 py-1 leading-none"
        style={{ fontSize: 'clamp(9px, 1.3vw, 12px)' }}
      >
        👥 {aliveCount} {aliveCollapsed ? '▼' : '▲'}
      </button>
    </div>
  );
}