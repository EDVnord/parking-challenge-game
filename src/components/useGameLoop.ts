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
    let winSoundPlayed = false;
    let playerParkedSoundPlayed = false;

    const loop = (timestamp: number) => {
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
      state.cars.forEach(car => { if (car.blinkTimer > 0) car.blinkTimer = Math.max(0, car.blinkTimer - dt); });
      if (state.driftMarks.length > 200) state.driftMarks.splice(0, 50);

      if (state.shakeTimer > 0) state.shakeTimer -= dt;

      if (state.phase === 'driving') {
        state.timer -= dt;

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

        if (state.timer <= 0 && !state.signal) {
          state.signal = true;
          state.phase = 'signal';
          state.signalTimer = 8;
          signalSoundPlayed = false;
          playerParkedSoundPlayed = false;
        }
      } else if (state.phase === 'signal') {
        state.signalTimer -= dt;

        // Звук сигнала один раз при входе в фазу
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

        const activeCars = state.cars.filter(c => !c.eliminated);
        const parkedCount = activeCars.filter(c => c.parked).length;
        const availableSpots = state.spots.length;

        if (parkedCount >= availableSpots || state.signalTimer <= 0) {
          const unparked = activeCars.filter(c => !c.parked);

          if (state.round === 0) {
            state.eliminatedThisRound = null;
            const playerCar0 = state.cars.find(c => c.isPlayer);
            onRoundEndRef.current(state.round, false, playerCar0?.hp ?? 100, playerCar0?.maxHp ?? 100);
          } else if (unparked.length > 0) {
            const playerUnparked = unparked.find(c => c.isPlayer);
            const eliminated = playerUnparked
              ? playerUnparked
              : unparked.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];

            eliminated.eliminated = true;
            state.eliminatedThisRound = eliminated;
            spawnParticles(state, eliminated.x, eliminated.y, '#FF2D55', 20);
            state.shakeTimer = 0.5;
            if (eliminated.isPlayer) playEliminatedSound();

            const playerCar = state.cars.find(c => c.isPlayer);
            onRoundEndRef.current(state.round, eliminated.isPlayer, playerCar?.hp ?? 100, playerCar?.maxHp ?? 100);
          } else {
            state.eliminatedThisRound = null;
            const playerCar2 = state.cars.find(c => c.isPlayer);
            onRoundEndRef.current(state.round, false, playerCar2?.hp ?? 100, playerCar2?.maxHp ?? 100);
          }

          // Проверяем — если после выбывания осталась 1 машина (победитель) — сразу winner
          const activeCarsAfter = state.cars.filter(c => !c.eliminated);
          const playerAliveAfter = activeCarsAfter.some(c => c.isPlayer);

          if (!playerAliveAfter) {
            // Игрок выбыл — показываем roundEnd чтобы увидел результат
            state.phase = 'roundEnd';
            state.roundEndTimer = 3;
          } else if (activeCarsAfter.length <= 1 || state.round >= state.maxRounds) {
            // Победа! Сразу переходим к winner без roundEnd-оверлея
            state.phase = 'winner';
            state.winnerTimer = 5;
            state.eliminatedThisRound = null;
            if (!winSoundPlayed) { winSoundPlayed = true; playWinSound(); }
            for (let i = 0; i < 8; i++) {
              setTimeout(() => {
                const p = state.cars.find(c => c.isPlayer);
                if (p) spawnParticles(state, p.x, p.y, '#FFD600', 25);
                spawnParticles(state, CENTER_X + (Math.random()-0.5)*300, CENTER_Y + (Math.random()-0.5)*200,
                  ['#FF6B35','#AF52DE','#34C759','#FF2D55','#5AC8FA'][Math.floor(Math.random()*5)], 18);
              }, i * 300);
            }
          } else {
            state.phase = 'roundEnd';
            state.roundEndTimer = 3;
          }
        }
      } else if (state.phase === 'roundEnd') {
        // Пауза таймера пока показан оффер второй жизни
        if (!extraLifeOfferRef?.current) {
          state.roundEndTimer -= dt;
        }

        if (state.roundEndTimer <= 0) {
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

          if (activeCars.length <= 1 || state.round >= state.maxRounds) {
            state.phase = 'winner';
            state.winnerTimer = 5;
            if (!winSoundPlayed) { winSoundPlayed = true; playWinSound(); }
            for (let i = 0; i < 8; i++) {
              setTimeout(() => {
                const player = state.cars.find(c => c.isPlayer);
                if (player) spawnParticles(state, player.x, player.y, '#FFD600', 25);
                spawnParticles(state, CENTER_X + (Math.random()-0.5)*300, CENTER_Y + (Math.random()-0.5)*200,
                  ['#FF6B35','#AF52DE','#34C759','#FF2D55','#5AC8FA'][Math.floor(Math.random()*5)], 18);
              }, i * 300);
            }
            return;
          }

          state.round++;
          state.signal = false;
          state.phase = 'driving';
          state.shieldUsed = false; // щит восстанавливается каждый раунд

          const nextActiveCars = state.cars.filter(c => !c.eliminated);
          state.isFinalRound = nextActiveCars.length === 2;
          state.timer = randomRoundTimer(state.round, state.isFinalRound);

          // Количество мест = (активных машин - 1), но не меньше 1
          const spotsCount = Math.max(1, nextActiveCars.length - 1);
          state.spots.splice(0, state.spots.length, ...makeSpotsGrid(spotsCount));
          state.spots.forEach(s => { s.carId = null; });

          // Восстановление HP между раундами
          state.cars.filter(c => !c.eliminated).forEach(car => {
            if (car.isBot) {
              // Боты восстанавливают до 80% HP чтобы оставаться конкурентоспособными
              const minHp = car.maxHp * 0.8;
              if (car.hp < minHp) {
                car.hp = minHp;
                spawnParticles(state, car.x, car.y, '#34C759', 5);
              }
            }
          });
          if (state.playerAutoRepair) {
            const playerCar = state.cars.find(c => c.isPlayer);
            if (playerCar) {
              playerCar.hp = Math.min(playerCar.maxHp, playerCar.hp + 15);
              spawnParticles(state, playerCar.x, playerCar.y, '#34C759', 8);
            }
          }

          const ORBIT_R = 230;
          const activeAtReset = state.cars.filter(c => !c.eliminated);
          activeAtReset.forEach((car, idx) => {
            car.parked = false;
            car.parkSpot = null;
            car.targetSpot = null;
            car.speed = 0;
            const orbitAngle = (idx / activeAtReset.length) * Math.PI * 2;
            car.orbitAngle = orbitAngle;
            car.x = CENTER_X + Math.cos(orbitAngle) * ORBIT_R;
            car.y = CENTER_Y + Math.sin(orbitAngle) * ORBIT_R;
            car.angle = orbitAngle + Math.PI;
          });

          state.spots.forEach(s => {
            s.occupied = false;
            s.carId = null;
            s.available = true;
          });

          state.eliminatedThisRound = null;
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

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animRef.current);
      } else {
        timeRef.current = performance.now();
        animRef.current = requestAnimationFrame(loop);
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