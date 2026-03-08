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
  extraLifeOffer, onReviveReady,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState(playerName, playerHp, playerMaxHp, playerColor, playerBodyColor, playerEmoji, playerMaxSpeed));
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const moveThrottleRef = useRef<number>(0);
  const localId = playerId || 'local_player';
  const extraLifeOfferRef = useRef(false);

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

  // Синхронизируем extraLifeOfferRef с пропом (для игрового цикла)
  useEffect(() => {
    extraLifeOfferRef.current = extraLifeOffer ?? false;
  }, [extraLifeOffer]);

  // Регистрируем функцию оживления игрока в стейте игры
  useEffect(() => {
    if (!onReviveReady) return;
    onReviveReady(() => {
      const playerCar = stateRef.current.cars.find(c => c.isPlayer);
      if (playerCar) {
        playerCar.eliminated = false;
        stateRef.current.eliminatedThisRound = null;
        // Флаг для game loop — сразу переходить к следующему раунду, не вызывать onGameEnd
        stateRef.current.reviveAndContinue = true;
        // roundEndTimer = 0 — loop сразу обработает переход
        stateRef.current.roundEndTimer = 0;
      }
    });
  }, [onReviveReady]);

  const botAI = useBotAI();

  useGameSync({ stateRef, upgrades, playerHp, localId, roomState });

  useGameLoop({
    canvasRef, stateRef, animRef, timeRef, moveThrottleRef,
    playerName, upgrades, keys, keysRef, onRoundEnd, onGameEnd, onPlayerMove, botAI,
    aliveCollapsedRef, extraLifeOfferRef,
  });

  return (
    <div className="relative w-full" style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}>
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