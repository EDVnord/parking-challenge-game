import { useState, useEffect, useRef } from 'react';
import GameCanvas from '@/components/GameCanvas';
import { setAudioMuted } from '@/components/gameAudio';
import Icon from '@/components/ui/icon';
import { PlayerData, Screen, DailyQuest, WeeklyQuest, RoomState, todayDateStr, weeklyDateStr, xpForLevel, showInterstitialAd, showRewardedAd, isYandexGamesEnv } from './parkingTypes';
import { t } from '@/i18n';
import { PrivacyPolicyModal } from './LoginScreen';
import { CoinIcon, GemIcon } from '@/components/ui/CoinIcon';

const MUTE_KEY = 'king_parking_muted';
function useMute() {
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  const toggle = () => setMuted(prev => {
    const next = !prev;
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
    setAudioMuted(next);
    return next;
  });
  return { muted, toggle };
}

// ──────────────── MENU ────────────────
interface MenuScreenProps {
  player: PlayerData;
  setScreen: (s: Screen) => void;
  onPlay: () => void;
  onQuestClaim?: (questId: string) => void;
  onWeeklyQuestClaim?: (questId: string) => void;
}

export function MenuScreen({ player, setScreen, onPlay, onQuestClaim, onWeeklyQuestClaim }: MenuScreenProps) {
  const today = todayDateStr();
  const thisWeek = weeklyDateStr();
  const [questTab, setQuestTab] = useState<'daily' | 'weekly'>('daily');
  const [showPrivacy, setShowPrivacy] = useState(false);

  const quests: DailyQuest[] = player.dailyQuestsDate === today ? (player.dailyQuests ?? []) : [];
  const weeklyQuests: WeeklyQuest[] = player.weeklyQuestsDate === thisWeek ? (player.weeklyQuests ?? []) : [];
  const hasClaimableDaily = quests.some(q => q.progress >= q.goal && !q.claimed);
  const hasClaimableWeekly = weeklyQuests.some(q => q.progress >= q.goal && !q.claimed);
  const streak = player.loginStreak ?? 0;

  const xpIntoLevel = (() => {
    let rem = player.xp;
    let l = 1;
    while (rem >= xpForLevel(l)) { rem -= xpForLevel(l); l++; }
    return { current: rem, needed: xpForLevel(l) };
  })();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { em: '🚗', t: 'top-10 left-10', d: '0s' }, { em: '🏎️', t: 'top-20 right-16', d: '1s' },
          { em: '🚕', t: 'bottom-20 left-20', d: '2s' }, { em: '🚙', t: 'bottom-16 right-12', d: '0.5s' },
        ].map((item, i) => (
          <div key={i} className={`absolute text-5xl animate-float ${item.t}`} style={{ animationDelay: item.d }}>{item.em}</div>
        ))}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-sm py-6">
        <div className="text-center animate-fade-in">
          <div className="text-7xl mb-2 animate-bounce-in">👑</div>
          <h1 className="font-russo text-4xl text-yellow-400 leading-none" style={{ textShadow: '0 0 30px rgba(255,214,0,0.6)' }}>{t('title')}</h1>

        </div>

        <button className="card-game p-3 flex items-center gap-3 w-full animate-fade-in hover:border-yellow-400/30 transition-all" onClick={() => setScreen('profile')}>
          <span className="text-3xl">{player.emoji}</span>
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-russo text-white text-sm">{player.name}</div>
              <div className="font-russo text-yellow-400 text-sm">Lv.{player.level}</div>
              {streak > 0 && <div className="text-orange-400 text-xs font-nunito">🔥 {streak}</div>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="coin-badge text-xs"><CoinIcon size={13} /> {player.coins.toLocaleString()}</span>
              <span className="gem-badge text-xs"><GemIcon size={13} /> {player.gems}</span>
            </div>
            <div className="mt-1.5">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (xpIntoLevel.current / xpIntoLevel.needed) * 100)}%` }}
                />
              </div>
              <div className="text-white/30 text-[10px] font-nunito mt-0.5">{xpIntoLevel.current} / {xpIntoLevel.needed} XP</div>
            </div>
          </div>
        </button>

        {(quests.length > 0 || weeklyQuests.length > 0) && (
          <div className="card-game w-full p-3 animate-fade-in">
            <div className="flex items-center gap-1 mb-2.5">
              <button
                onClick={() => setQuestTab('daily')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-russo transition-all ${questTab === 'daily' ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 'text-white/40 hover:text-white/60'}`}
              >
                {t('daily_quests')}
                {hasClaimableDaily && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />}
              </button>
              <button
                onClick={() => setQuestTab('weekly')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-russo transition-all ${questTab === 'weekly' ? 'bg-purple-400/20 text-purple-300 border border-purple-400/30' : 'text-white/40 hover:text-white/60'}`}
              >
                {t('weekly_quests')}
                {hasClaimableWeekly && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />}
              </button>
            </div>

            {questTab === 'daily' && (
              <div className="flex flex-col gap-1.5">
                {quests.map(q => {
                  const pct = Math.min(100, (q.progress / q.goal) * 100);
                  const canClaim = q.progress >= q.goal && !q.claimed;
                  return (
                    <div key={q.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${q.claimed ? 'bg-green-500/10 border border-green-500/20 opacity-60' : canClaim ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-white/5'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`font-nunito text-xs ${q.claimed ? 'text-green-400' : canClaim ? 'text-yellow-300' : 'text-white/70'}`}>{q.label}</span>
                          <span className="ml-auto font-nunito text-white/40 text-xs whitespace-nowrap">{q.progress}/{q.goal}</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {q.claimed ? (
                        <div className="shrink-0 text-green-400 text-xs">✅</div>
                      ) : canClaim ? (
                        <button className="shrink-0 bg-yellow-400 text-gray-900 font-russo text-xs px-2 py-1 rounded-lg hover:bg-yellow-300 transition-all whitespace-nowrap" onClick={() => onQuestClaim?.(q.id)}>
                          {t('claim')}
                        </button>
                      ) : (
                        <div className="shrink-0 text-xs font-nunito text-yellow-400/60 whitespace-nowrap flex items-center gap-0.5">+{q.reward.coins}<CoinIcon size={12} />{q.reward.gems ? <>{' '}+{q.reward.gems}<GemIcon size={12} /></> : ''}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {questTab === 'weekly' && (
              <div className="flex flex-col gap-1.5">
                {weeklyQuests.length === 0 && (
                  <div className="text-white/30 text-xs font-nunito text-center py-2">{t('weekly_quests_start')}</div>
                )}
                {weeklyQuests.map(q => {
                  const pct = Math.min(100, (q.progress / q.goal) * 100);
                  const canClaim = q.progress >= q.goal && !q.claimed;
                  return (
                    <div key={q.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${q.claimed ? 'bg-green-500/10 border border-green-500/20 opacity-60' : canClaim ? 'bg-purple-400/10 border border-purple-400/30' : 'bg-white/5'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`font-nunito text-xs ${q.claimed ? 'text-green-400' : canClaim ? 'text-purple-300' : 'text-white/70'}`}>{q.label}</span>
                          <span className="ml-auto font-nunito text-white/40 text-xs whitespace-nowrap">{q.progress}/{q.goal}</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-purple-300 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-purple-400/60 text-[10px] font-nunito mt-0.5 flex items-center gap-0.5">+{q.reward.coins}<CoinIcon size={12} /> +{q.reward.gems}<GemIcon size={12} /></div>
                      </div>
                      {q.claimed ? (
                        <div className="shrink-0 text-green-400 text-xs">✅</div>
                      ) : canClaim ? (
                        <button className="shrink-0 bg-purple-500 text-white font-russo text-xs px-2 py-1 rounded-lg hover:bg-purple-400 transition-all whitespace-nowrap" onClick={() => onWeeklyQuestClaim?.(q.id)}>
                          {t('claim')}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 w-full">
          <button className="btn-yellow w-full text-xl py-5 animate-fade-in" onClick={onPlay}>
            {t('play')}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-blue animate-fade-in" onClick={() => setScreen('garage')}>{t('garage')}</button>
            <button className="btn-purple animate-fade-in" onClick={() => setScreen('shop')}>{t('shop')}</button>
            <button className="btn-orange animate-fade-in" onClick={() => setScreen('profile')}>{t('profile')}</button>
            <button className="btn-green animate-fade-in" onClick={() => setScreen('leaderboard')}>{t('leaderboard')}</button>
            <button className="col-span-2 animate-fade-in card-game py-2.5 flex items-center justify-center gap-2 hover:border-yellow-400/30 transition-all" onClick={() => setScreen('friends')}>
              <span className="font-russo text-white/70 text-sm">{t('friends')}</span>
              <span className="text-white/30 text-xs ml-1">{t('friends_bonus')}</span>
            </button>
          </div>

        </div>

        <button
          className="text-white/20 text-xs font-nunito hover:text-white/40 transition-colors"
          onClick={() => setShowPrivacy(true)}
        >
          {t('privacy_policy')} · v1.0
        </button>
      </div>
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}

// ──────────────── GAME ────────────────
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
  // Ref на функцию оживления игрока в game state (заполняется из GameCanvas)
  const revivePlayerRef = useRef<(() => void) | null>(null);
  const handleReviveReady = useRef((fn: () => void) => { revivePlayerRef.current = fn; }).current;

  const handleUseExtraLife = () => {
    // Сначала оживляем игрока в игровом state, потом уменьшаем extraLives и продолжаем
    revivePlayerRef.current?.();
    onUseExtraLife?.();
  };

  // Автогаз на мобиле — держим ArrowUp когда идёт игра
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
      {/* Топ-бар — минимальная высота */}
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

      {/* Canvas — строго 4:3, ограничен по высоте */}
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

      {/* Ремонт (межраундовая пауза) */}
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

      {/* Оффер второй жизни */}
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

      {/* Управление — только мобиль (автогаз, повороты + тормоз) */}
      <div className="md:hidden shrink-0 flex items-center justify-center gap-3 px-3 pb-2 pt-1 select-none">
        {/* Поворот влево */}
        <button
          className="touch-none flex items-center justify-center rounded-2xl text-3xl font-bold text-white active:scale-95 transition-transform"
          style={{ width: 80, height: 72, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)' }}
          onTouchStart={e => { e.preventDefault(); keysRef.current.add('ArrowLeft'); }}
          onTouchEnd={e => { e.preventDefault(); keysRef.current.delete('ArrowLeft'); }}
          onTouchCancel={() => keysRef.current.delete('ArrowLeft')}
        >←</button>

        {/* Тормоз (центр) */}
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

        {/* Поворот вправо */}
        <button
          className="touch-none flex items-center justify-center rounded-2xl text-3xl font-bold text-white active:scale-95 transition-transform"
          style={{ width: 80, height: 72, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)' }}
          onTouchStart={e => { e.preventDefault(); keysRef.current.add('ArrowRight'); }}
          onTouchEnd={e => { e.preventDefault(); keysRef.current.delete('ArrowRight'); }}
          onTouchCancel={() => keysRef.current.delete('ArrowRight')}
        >→</button>

        {/* Нитро */}
        {player.upgrades?.nitro && (
          <button
            className="touch-none rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
            style={{ width: 68, height: 72, background: 'rgba(255,180,0,0.2)', border: '2px solid rgba(255,200,0,0.5)' }}
            onTouchStart={e => { e.preventDefault(); keysRef.current.add(' '); }}
            onTouchEnd={e => { e.preventDefault(); keysRef.current.delete(' '); }}
            onTouchCancel={() => keysRef.current.delete(' ')}
          >
            <span style={{ fontSize: 24 }}>⚡</span>
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

// ──────────────── GAME OVER ────────────────
interface GameOverScreenProps {
  gameResult: { position: number; coinsEarned: number } | null;
  player: PlayerData;
  onRestart: () => void;
  onMenu: () => void;
  onRewardCoins?: (amount: number) => void;
}

export function GameOverScreen({ gameResult, player, onRestart, onMenu, onRewardCoins }: GameOverScreenProps) {
  const position = gameResult?.position ?? 0;
  const coinsEarned = gameResult?.coinsEarned ?? 0;
  const isWin = position === 1;
  const inYa = isYandexGamesEnv();
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardUsed, setRewardUsed] = useState(false);

  // Межстраничная реклама при завершении (не при победе)
  useEffect(() => {
    if (gameResult && !isWin) {
      showInterstitialAd();
    }
  }, [gameResult, isWin]);

  if (!gameResult) return null;

  const coinBoost = (player.coinBoostSessions ?? 0) > 0;
  const xpBoost = (player.xpBoostGames ?? 0) > 0;
  const extraLives = player.extraLives ?? 0;

  const handleRewardedAd = async () => {
    if (rewardLoading || rewardUsed) return;
    setRewardLoading(true);
    const rewarded = await showRewardedAd();
    setRewardLoading(false);
    if (rewarded) {
      setRewardUsed(true);
      onRewardCoins?.(100);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card-game-solid p-8 flex flex-col items-center gap-5 w-full max-w-sm animate-bounce-in">
        <div className="text-7xl">{isWin ? '🏆' : position <= 3 ? '🥈' : '😅'}</div>
        <div className="text-center">
          <div className={`font-russo text-4xl ${isWin ? 'text-yellow-400' : 'text-white'}`} style={isWin ? { textShadow: '0 0 20px rgba(255,214,0,0.7)' } : {}}>
            {isWin ? t('victory') : position <= 3 ? t('prize') : `#${position}`}
          </div>
          <div className="text-white/40 font-nunito text-sm mt-1">
            {isWin ? t('win_desc') : position <= 5 ? t('not_bad') : t('park_faster')}
          </div>
        </div>
        <div className="w-full space-y-2">
          <div className="flex justify-between items-center bg-white/5 rounded-2xl p-3">
            <span className="text-white/50 font-nunito text-sm">{t('place')}</span>
            <span className="font-russo text-white">#{position}</span>
          </div>
          <div className="flex justify-between items-center bg-yellow-500/10 rounded-2xl p-3">
            <span className="text-white/50 font-nunito text-sm">{t('coins')}</span>
            <span className="font-russo text-yellow-400">+{coinsEarned} <CoinIcon size={14} /></span>
          </div>
        </div>

        {/* Реклама за вознаграждение */}
        {inYa && !isWin && !rewardUsed && (
          <button
            className="w-full bg-green-500/15 border border-green-500/40 hover:bg-green-500/25 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            onClick={handleRewardedAd}
            disabled={rewardLoading}
          >
            <span className="font-russo text-green-400 text-sm">
              {rewardLoading ? t('rewarded_loading') : t('rewarded_btn')}
            </span>
          </button>
        )}
        {rewardUsed && (
          <div className="w-full bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-2 text-center">
            <span className="font-russo text-green-400 text-sm">{t('rewarded_ok')}</span>
          </div>
        )}

        {/* Активные расходники */}
        {(coinBoost || xpBoost || extraLives > 0) && (
          <div className="w-full bg-white/5 rounded-2xl p-3 flex flex-col gap-1.5">
            <div className="text-white/40 font-nunito text-xs text-center mb-0.5">{t('active_boosts')}</div>
            {coinBoost && (
              <div className="flex items-center justify-between">
                <span className="font-nunito text-xs text-yellow-300">{t('coin_boost_label')}</span>
                <span className="font-russo text-xs text-yellow-400">{player.coinBoostSessions} {t('games_suffix')}</span>
              </div>
            )}
            {xpBoost && (
              <div className="flex items-center justify-between">
                <span className="font-nunito text-xs text-purple-300">{t('xp_boost_label')}</span>
                <span className="font-russo text-xs text-purple-400">{player.xpBoostGames} {t('games_suffix')}</span>
              </div>
            )}
            {extraLives > 0 && (
              <div className="flex items-center justify-between">
                <span className="font-nunito text-xs text-red-300">{t('extra_lives_label')}</span>
                <span className="font-russo text-xs text-red-400">{extraLives} {t('pcs_suffix')}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3 w-full">
          <button className="btn-yellow flex-1" onClick={onRestart}>{t('play_again')}</button>
          <button className="btn-blue flex-1" onClick={onMenu}>{t('menu')}</button>
        </div>
      </div>
    </div>
  );
}