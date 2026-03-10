import { useEffect, useRef } from 'react';
import { useState } from 'react';
import GameCanvas from '@/components/GameCanvas';
import { setAudioMuted } from '@/components/gameAudio';
import Icon from '@/components/ui/icon';
import { PlayerData, Screen, RoomState } from './parkingTypes';
import { t } from '@/i18n';
import { CoinIcon } from '@/components/ui/CoinIcon';

const MUTE_KEY = 'king_parking_muted';
export function useMute() {
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  const toggle = () => setMuted(prev => {
    const next = !prev;
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
    setAudioMuted(next);
    return next;
  });
  return { muted, toggle };
}

interface GameScreenProps {
  player: PlayerData;
  gameKey: number;
  gameRound: number;
  gameResult: { position: number; coinsEarned: number } | null;
  inGamePhase: 'playing' | 'roundEnd';
  keys: Set<string>;
  keysRef: React.MutableRefObject<Set<string>>;
  setScreen: (s: Screen) => void;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
  handleRoundEnd: (round: number, isPlayerEliminated: boolean, playerHp: number, playerMaxHp: number) => void;
  handleGameEnd: (position: number, roundsPlayed?: number, finalHp?: number) => void;
  notify: (msg: string) => void;
  roomState?: RoomState | null;
  localPlayerId?: string;
  onPlayerMove?: (state: { x: number; y: number; angle: number; speed: number; hp: number; orbitAngle: number; parked: boolean; parkSpot: number; eliminated: boolean }) => void;
  extraLifeOffer?: boolean;
  onUseExtraLife?: () => void;
  onDeclineExtraLife?: () => void;
}

export function GameScreen({
  player, gameKey, gameRound, gameResult, inGamePhase,
  keys, keysRef, setScreen, setPlayer, handleRoundEnd, handleGameEnd, notify,
  roomState, localPlayerId, onPlayerMove,
  extraLifeOffer, onUseExtraLife, onDeclineExtraLife,
}: GameScreenProps) {
  const { muted, toggle: toggleMute } = useMute();
  const revivePlayerRef = useRef<(() => void) | null>(null);
  const handleReviveReady = useRef((fn: () => void) => { revivePlayerRef.current = fn; }).current;

  const handleUseExtraLife = () => {
    revivePlayerRef.current?.();
    onUseExtraLife?.();
  };

  const isMobileRef = useRef(typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  useEffect(() => {
    if (!isMobileRef.current) return;
    if (inGamePhase === 'playing' && !gameResult && !extraLifeOffer) {
      keysRef.current.add('ArrowUp');
    } else {
      keysRef.current.delete('ArrowUp');
    }
  }, [inGamePhase, gameResult, keysRef, extraLifeOffer]);

  const car = player.cars[player.selectedCar];
  const repairInfo = (() => {
    if (inGamePhase !== 'roundEnd' || gameResult || !car || car.hp >= car.maxHp) return null;
    const cost = Math.round(car.repairCost * (1 - car.hp / car.maxHp));
    const heal = Math.round(car.maxHp * 0.4);
    return { cost, heal, pct: Math.round((1 - car.hp / car.maxHp) * 100) };
  })();

  return (
    <div
      className="flex flex-col w-full overflow-hidden"
      style={{ height: '100dvh' }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="flex items-center justify-between px-2 py-1 shrink-0 gap-2">
        <button
          className="font-russo text-xs px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 active:bg-red-500/40 transition-all"
          onClick={() => setScreen('menu')}
        >{t('exit')}</button>
        <div className={`font-russo text-sm ${gameRound === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
          {gameRound === 0 ? t('training') : `${t('round')} ${gameRound}`}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className={`rounded-lg px-2 py-1 transition-all border ${muted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-white/10 border-white/20 text-white/60'}`}
            onClick={toggleMute}
          >
            <Icon name={muted ? 'VolumeX' : 'Volume2'} size={14} />
          </button>
          <div className="coin-badge text-xs py-1 px-2"><CoinIcon size={13} /> {player.coins.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <div style={{ aspectRatio: '4/3', height: '100%', maxHeight: '100%', maxWidth: '100%' }}>
          <GameCanvas
            key={gameKey}
            playerName={player.name}
            playerId={localPlayerId}
            playerHp={car?.hp}
            playerMaxHp={car?.maxHp}
            playerColor={car?.color}
            playerBodyColor={car?.bodyColor}
            playerEmoji={car?.emoji}
            playerMaxSpeed={car?.maxSpeed}
            upgrades={player.upgrades ?? { nitro: false, gps: false, bumper: false, autoRepair: false, magnet: false, turbo: false, shield: false }}
            onRoundEnd={handleRoundEnd}
            onGameEnd={handleGameEnd}
            keys={keys}
            keysRef={keysRef}
            roomState={roomState}
            onPlayerMove={onPlayerMove}
            extraLifeOffer={extraLifeOffer}
            onReviveReady={handleReviveReady}
          />
        </div>
      </div>

      {repairInfo && (
        <div className="shrink-0 flex justify-center px-2 py-1 animate-bounce-in">
          <button
            className="btn-green px-5 py-2 text-sm font-russo shadow-2xl"
            onClick={() => {
              if (player.coins >= repairInfo.cost) {
                setPlayer(prev => {
                  const newCars = prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: Math.min(c.maxHp, c.hp + repairInfo.heal) } : c);
                  return { ...prev, coins: prev.coins - repairInfo.cost, cars: newCars };
                });
                notify(`${t('notify_repair_hp')} +${repairInfo.heal}`);
              } else {
                notify(t('low_coins'));
              }
            }}
          >
            🔧 {repairInfo.pct}% — {repairInfo.cost} <CoinIcon size={13} />
          </button>
        </div>
      )}

      {extraLifeOffer && (
        <div className="shrink-0 flex flex-col items-center gap-2 px-4 py-2 animate-bounce-in">
          <div className="font-russo text-red-400 text-sm text-center">{t('eliminated')}</div>
          <div className="font-nunito text-white/60 text-xs text-center">{t('use_extra_life')} ({player.extraLives ?? 0} {t('pcs_suffix')})</div>
          <div className="flex gap-3">
            <button
              className="btn-yellow px-5 py-2 text-sm font-russo shadow-2xl animate-pulse"
              onClick={handleUseExtraLife}
            >{t('continue_btn')}</button>
            <button
              className="px-4 py-2 text-sm font-russo rounded-xl bg-white/10 text-white/50 hover:bg-white/20 transition-all"
              onClick={onDeclineExtraLife}
            >{t('decline_btn')}</button>
          </div>
        </div>
      )}

      <div className="md:hidden shrink-0 flex items-center justify-center gap-3 px-3 pb-2 pt-1 select-none">
        <button
          className="touch-none flex items-center justify-center rounded-2xl text-3xl font-bold text-white active:scale-95 transition-transform"
          style={{ width: 80, height: 72, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)' }}
          onTouchStart={e => { e.preventDefault(); keysRef.current.add('ArrowLeft'); }}
          onTouchEnd={e => { e.preventDefault(); keysRef.current.delete('ArrowLeft'); }}
          onTouchCancel={() => keysRef.current.delete('ArrowLeft')}
        >←</button>

        <button
          className="touch-none flex flex-col items-center justify-center rounded-2xl text-white active:scale-95 transition-transform gap-0.5"
          style={{ width: 68, height: 72, background: 'rgba(255,80,80,0.2)', border: '2px solid rgba(255,100,100,0.4)' }}
          onTouchStart={e => { e.preventDefault(); keysRef.current.add('ArrowDown'); keysRef.current.delete('ArrowUp'); }}
          onTouchEnd={e => { e.preventDefault(); keysRef.current.delete('ArrowDown'); keysRef.current.add('ArrowUp'); }}
          onTouchCancel={() => { keysRef.current.delete('ArrowDown'); keysRef.current.add('ArrowUp'); }}
        >
          <span style={{ fontSize: 22 }}>⬇</span>
          <span style={{ fontSize: 9, color: 'rgba(255,150,150,0.9)', fontWeight: 700 }}>{t('brake')}</span>
        </button>

        <button
          className="touch-none flex items-center justify-center rounded-2xl text-3xl font-bold text-white active:scale-95 transition-transform"
          style={{ width: 80, height: 72, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)' }}
          onTouchStart={e => { e.preventDefault(); keysRef.current.add('ArrowRight'); }}
          onTouchEnd={e => { e.preventDefault(); keysRef.current.delete('ArrowRight'); }}
          onTouchCancel={() => keysRef.current.delete('ArrowRight')}
        >→</button>

        {player.upgrades?.nitro && (
          <button
            className="touch-none flex flex-col items-center justify-center rounded-2xl text-white active:scale-95 transition-transform gap-0.5"
            style={{ width: 68, height: 72, background: 'rgba(255,200,0,0.2)', border: '2px solid rgba(255,200,0,0.4)' }}
            onTouchStart={e => { e.preventDefault(); keysRef.current.add('Shift'); }}
            onTouchEnd={e => { e.preventDefault(); keysRef.current.delete('Shift'); }}
            onTouchCancel={() => keysRef.current.delete('Shift')}
          >
            <span style={{ fontSize: 22 }}>⚡</span>
            <span style={{ fontSize: 9, color: 'rgba(255,210,0,0.9)', fontWeight: 700 }}>{t('nitro_btn')}</span>
          </button>
        )}
      </div>

      <p className="text-white/30 text-xs text-center font-nunito hidden md:block pb-1">
        {t('park_hint')}
      </p>
    </div>
  );
}
