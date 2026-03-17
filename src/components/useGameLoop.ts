import { useEffect, useRef, MutableRefObject } from 'react';
import { Car, GameState, Upgrades, CANVAS_W, CANVAS_H, CENTER_X, CENTER_Y } from './gameTypes';
import { makeSpotsGrid, spawnParticles, blockParkingZone, resolveAllCollisions } from './gameLogic';
import { drawAsphalt, drawParkingArea, drawCar, drawParticles, drawSignal, drawRoundEnd, drawWinner, drawHUD, drawGpsOverlay } from './gameRenderer';
import { playCollisionSound, playSignalSound, playParkSound, playEliminatedSound, playWinSound } from './gameAudio';

function randomRoundTimer(round: number, isFinal: boolean): number {
  if (round === 0) return 4 + Math.random() * 2;
  if (isFinal) return 10;
  return 5 + Math.random() * 7;
}

interface UseGameLoopParams {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  stateRef: MutableRefObject<GameState>;
  animRef: MutableRefObject<number>;
  timeRef: MutableRefObject<number>;
  moveThrottleRef: MutableRefObject<number>;
  playerName: string;
  upgrades: Upgrades;
  keys: Set<string>;
  keysRef: MutableRefObject<Set<string>>;
  onRoundEnd: (round: number, isPlayerEliminated: boolean, playerHp: number, playerMaxHp: number) => void;
  onGameEnd: (position: number, roundsPlayed?: number) => void;
  onPlayerMove?: (state: { x: number; y: number; angle: number; speed: number; hp: number; orbitAngle: number; parked: boolean; parkSpot: number; eliminated: boolean }) => void;
  botAI: (car: Car, state: GameState, dt: number) => void;
  aliveCollapsedRef?: MutableRefObject<boolean>;
  extraLifeOfferRef?: MutableRefObject<boolean>;
}

export function useGameLoop({
  canvasRef, stateRef, animRef, timeRef, moveThrottleRef,
  playerName, upgrades, keys, keysRef, onRoundEnd, onGameEnd, onPlayerMove, botAI, aliveCollapsedRef,
  extraLifeOfferRef,
}: UseGameLoopParams) {
  // Ref-обёртки для стабильных замыканий в RAF
  const onRoundEndRef = useRef(onRoundEnd);
  const onGameEndRef = useRef(onGameEnd);
  const onPlayerMoveRef = useRef(onPlayerMove);
  const upgradesRef = useRef(upgrades);

  useEffect(() => { onRoundEndRef.current = onRoundEnd; }, [onRoundEnd]);
  useEffect(() => { onGameEndRef.current = onGameEnd; }, [onGameEnd]);
  useEffect(() => { onPlayerMoveRef.current = onPlayerMove; }, [onPlayerMove]);
  useEffect(() => { upgradesRef.current = upgrades; }, [upgrades]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    state.playerBumper = upgrades.bumper;
    state.playerAutoRepair = upgrades.autoRepair;
    state.playerNitro = upgrades.nitro;
    state.playerGps = upgrades.gps;
    state.playerMagnet = upgrades.magnet;
    state.playerTurbo = upgrades.turbo;
    state.playerShield = upgrades.shield;

    // Звуковые флаги — чтобы не воспроизводить одно и то же несколько раз
    let signalSoundPlayed = false;
    let playerParkedSoundPlayed = false;
    const soundState = { lastSignalRound: -1 };

    // Абсолютные метки окончания таймеров (в секундах performance.now())
    let timerEndAt = performance.now() / 1000 + state.timer;
    let signalTimerEndAt = performance.now() / 1000;
    let roundEndTimerEndAt = performance.now() / 1000;

    const loop = (timestamp: number) => {
      const realNow = performance.now() / 1000;
      const dt = Math.min((timestamp - timeRef.current) / 1000, 0.05);
      timeRef.current = timestamp;
      const time = timestamp / 1000;

      const currentUpgrades = upgradesRef.current;
      const currentKeys = keysRef.current;

      // === UPDATE ===

      state.particles = state.particles.filter(p => p.life > 0);
      state.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.03;
      });

      state.driftMarks = state.driftMarks.filter(d => d.opacity > 0);
      state.driftMarks.forEach(d => { d.opacity -= 0.002; });

      // Декремент blinkTimer (мигание HP при уроне)
      // Интерполяция позиций удалённых игроков каждый кадр (плавное движение)
      state.cars.forEach(car => {
        if (car.blinkTimer > 0) car.blinkTimer = Math.max(0, car.blinkTimer - dt);
        if (!car.isPlayer && car.targetX !== undefined && car.targetY !== undefined) {
          const lerpSpeed = 1 - Math.pow(0.01, dt);
          car.x += (car.targetX - car.x) * lerpSpeed;
          car.y += (car.targetY - car.y) * lerpSpeed;
          if (car.targetAngle !== undefined) {
            // Интерполяция угла по кратчайшему пути (через ±π)
            let da = car.targetAngle - car.angle;
            if (da > Math.PI) da -= 2 * Math.PI;
            if (da < -Math.PI) da += 2 * Math.PI;
            car.angle += da * lerpSpeed;
          }
        }
      });
      if (state.driftMarks.length > 200) state.driftMarks.splice(0, 50);

      if (state.shakeTimer > 0) state.shakeTimer -= dt;

      // Синхронизируем таймер с сервером — только для нужной фазы
      if (state.serverTimerEndMs && state.serverNowMs && state.serverReceivedAt) {
        const serverRemainingMs = state.serverTimerEndMs - state.serverNowMs;
        const elapsedSinceReceive = Date.now() - state.serverReceivedAt;
        const adjustedMs = serverRemainingMs - elapsedSinceReceive;
        const newEndAt = realNow + Math.max(0, adjustedMs) / 1000;
        const phase = state.serverPhaseForTimer;
        if (phase === 'driving') timerEndAt = newEndAt;
        else if (phase === 'signal') signalTimerEndAt = newEndAt;
        else if (phase === 'roundEnd') roundEndTimerEndAt = newEndAt;
        else { timerEndAt = newEndAt; signalTimerEndAt = newEndAt; roundEndTimerEndAt = newEndAt; }
        state.serverTimerEndMs = undefined;
        state.serverNowMs = undefined;
        state.serverReceivedAt = undefined;
        state.serverPhaseForTimer = undefined;
      }

      if (state.phase === 'driving') {
        state.timer = Math.max(0, timerEndAt - realNow);

        // В фазе driving все едут по орбите сквозь друг друга — без столкновений
        state.cars.forEach(car => botAI(car, state, dt));

        if (onPlayerMoveRef.current && time - moveThrottleRef.current > 0.2) {
          moveThrottleRef.current = time;
          const drivingPlayer = state.cars.find(c => c.isPlayer);
          if (drivingPlayer) {
            onPlayerMoveRef.current({
              x: drivingPlayer.x, y: drivingPlayer.y, angle: drivingPlayer.angle,
              speed: drivingPlayer.speed, hp: drivingPlayer.hp,
              orbitAngle: drivingPlayer.orbitAngle,
              parked: drivingPlayer.parked, parkSpot: drivingPlayer.parkSpot ?? -1,
              eliminated: drivingPlayer.eliminated,
            });
          }
        }
      } else if (state.phase === 'signal') {
        state.signalTimer = Math.max(0, signalTimerEndAt - realNow);

        // Звук сигнала один раз при входе в фазу (сбрасываем флаг на каждый раунд)
        if (soundState.lastSignalRound !== state.round) {
          soundState.lastSignalRound = state.round;
          signalSoundPlayed = false;
          playerParkedSoundPlayed = false;
        }
        if (!signalSoundPlayed) {
          signalSoundPlayed = true;
          playSignalSound();
        }

        state.cars.forEach(car => botAI(car, state, dt));

        const player = state.cars.find(c => c.isPlayer && !c.eliminated);
        if (player && !player.parked) {
          const hpFactor = 0.3 + (player.hp / player.maxHp) * 0.7;
          const dtNorm = dt * 60;
          const turnSpeed = (0.045 + (player.hp / player.maxHp) * 0.02) * dtNorm;
          if (currentKeys.has('ArrowLeft')) player.angle -= turnSpeed;
          if (currentKeys.has('ArrowRight')) player.angle += turnSpeed;
          const nitroBoost = (currentUpgrades.nitro && currentKeys.has(' ')) ? 1.4 : 1;
          if (currentKeys.has('ArrowUp')) {
            player.speed = Math.min(player.speed + 0.18 * nitroBoost * dtNorm, player.maxSpeed * hpFactor * nitroBoost);
          } else if (currentKeys.has('ArrowDown')) {
            player.speed = Math.max(player.speed - 0.2 * dtNorm, -1);
          } else {
            player.speed *= Math.pow(0.95, dtNorm);
          }
          if (currentUpgrades.nitro && currentKeys.has(' ') && currentKeys.has('ArrowUp') && Math.random() < 0.4) {
            spawnParticles(state, player.x, player.y, '#FFD600', 3);
          }
          player.x += Math.sin(player.angle) * player.speed * dtNorm;
          player.y -= Math.cos(player.angle) * player.speed * dtNorm;
          player.x = Math.max(20, Math.min(CANVAS_W - 20, player.x));
          player.y = Math.max(20, Math.min(CANVAS_H - 20, player.y));

          if (!player.parked) {
            const freeSpots = state.spots
              .map((s, i) => ({ s, i }))
              .filter(({ s }) => !s.occupied);
            for (const { s, i } of freeSpots) {
              const snapRadius = currentUpgrades.magnet ? 55 : 25;
              if (Math.hypot(s.x - player.x, s.y - player.y) < snapRadius) {
                if (currentUpgrades.magnet && Math.hypot(s.x - player.x, s.y - player.y) > 25) {
                  player.x += (s.x - player.x) * 0.25;
                  player.y += (s.y - player.y) * 0.25;
                } else {
                  player.x = s.x; player.y = s.y;
                  player.parked = true; player.parkSpot = i; player.speed = 0;
                  s.occupied = true; s.carId = player.id;
                  spawnParticles(state, player.x, player.y, '#FFD600', 15);
                  if (!playerParkedSoundPlayed) { playerParkedSoundPlayed = true; playParkSound(); }
                  break;
                }
              }
            }
          }
        }

        resolveAllCollisions(state.cars, state);

        if (onPlayerMoveRef.current && time - moveThrottleRef.current > 0.2) {
          moveThrottleRef.current = time;
          const playerCar = state.cars.find(c => c.isPlayer);
          if (playerCar) {
            onPlayerMoveRef.current({
              x: playerCar.x, y: playerCar.y, angle: playerCar.angle,
              speed: playerCar.speed, hp: playerCar.hp,
              orbitAngle: playerCar.orbitAngle,
              parked: playerCar.parked, parkSpot: playerCar.parkSpot ?? -1,
              eliminated: playerCar.eliminated,
            });
          }
        }

      } else if (state.phase === 'roundEnd') {
        state.roundEndTimer = Math.max(0, roundEndTimerEndAt - realNow);

        if (state.roundEndTimer <= 0 && !extraLifeOfferRef?.current) {
          const activeCars = state.cars.filter(c => !c.eliminated);
          const playerStillAlive = activeCars.some(c => c.isPlayer);
          const wasRevived = state.reviveAndContinue;
          state.reviveAndContinue = false;

          if (!playerStillAlive && !wasRevived) {
            const totalCars = state.cars.length;
            const eliminatedBefore = state.cars.filter(c => c.eliminated && !c.isPlayer).length;
            const position = totalCars - eliminatedBefore;
            const playerCar = state.cars.find(c => c.isPlayer);
            onGameEndRef.current(position, state.round, playerCar?.hp ?? 0);
            return;
          }
        }
      } else if (state.phase === 'winner') {
        state.winnerTimer -= dt;

        if (Math.random() < 0.15) {
          spawnParticles(state, CENTER_X + (Math.random()-0.5)*300, CENTER_Y + (Math.random()-0.5)*200,
            ['#FFD600','#FF6B35','#AF52DE','#34C759','#FF2D55'][Math.floor(Math.random()*5)], 8);
        }

        if (state.winnerTimer <= 0) {
          const playerCar = state.cars.find(c => c.isPlayer);
          onGameEndRef.current(1, state.round, playerCar?.hp ?? 0);
          return;
        }
      }

      // === DRAW ===
      ctx.save();

      if (state.shakeTimer > 0) {
        const shake = state.shakeTimer * 6;
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      drawAsphalt(ctx, state.driftMarks);
      drawParkingArea(ctx, state.spots, state.signal);

      if (currentUpgrades.gps && state.signal) {
        drawGpsOverlay(ctx, state, time);
      }

      const sortedCars = [...state.cars].sort((a, b) => a.y - b.y);
      sortedCars.forEach(car => drawCar(ctx, car, time));

      drawParticles(ctx, state.particles);

      if (state.signal && state.phase === 'signal') {
        drawSignal(ctx, time);
      }
      if (state.phase === 'roundEnd') {
        drawRoundEnd(ctx, state.eliminatedThisRound, state.round);
      }
      if (state.phase === 'winner') {
        drawWinner(ctx, state.cars.find(c => c.isPlayer) ?? null, time);
      }

      drawHUD(ctx, state, time, aliveCollapsedRef ? aliveCollapsedRef.current : true, upgradesRef.current);

      ctx.restore();

      animRef.current = requestAnimationFrame(loop);
    };

    timeRef.current = performance.now();
    animRef.current = requestAnimationFrame(loop);

    let hiddenAt = 0;
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = performance.now() / 1000;
      } else {
        // Сдвигаем абсолютные метки таймеров на время паузы
        const pausedFor = performance.now() / 1000 - hiddenAt;
        if (hiddenAt > 0 && pausedFor > 0) {
          timerEndAt += pausedFor;
          if (signalTimerEndAt > 0) signalTimerEndAt += pausedFor;
          if (roundEndTimerEndAt > 0) roundEndTimerEndAt += pausedFor;
        }
        timeRef.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName, botAI]);
}