import { useEffect, useRef, useCallback } from 'react';
import { Car, GameState, GameCanvasProps, CANVAS_W, CANVAS_H, CENTER_X, CENTER_Y, EXCL_LEFT, EXCL_RIGHT, EXCL_TOP, EXCL_BOTTOM } from './gameTypes';
import { createInitialState, makeSpotsGrid, applyRoomState, spawnParticles, blockParkingZone, resolveAllCollisions } from './gameLogic';
import { drawAsphalt, drawParkingArea, drawCar, drawParticles, drawSignal, drawRoundEnd, drawWinner, drawHUD, drawGpsOverlay } from './gameRenderer';

function randomRoundTimer(round: number): number {
  if (round === 0) return 4 + Math.random() * 3;
  return 1 + Math.random() * 11;
}

export default function GameCanvas({ playerName, playerId, playerHp, playerMaxHp, playerColor, playerBodyColor, playerEmoji, playerMaxSpeed, upgrades, onRoundEnd, onGameEnd, keys, roomState, onPlayerMove }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState(playerName, playerHp, playerMaxHp, playerColor, playerBodyColor, playerEmoji, playerMaxSpeed));
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const moveThrottleRef = useRef<number>(0);
  const localId = playerId || 'local_player';

  // Назначить localId игроку в стейте
  useEffect(() => {
    const playerCar = stateRef.current.cars.find(c => c.isPlayer);
    if (playerCar) playerCar.playerId = localId;
  }, [localId]);

  const botAI = useCallback((car: Car, state: GameState, _dt: number) => {
    if (car.isPlayer || car.eliminated || car.parked) return;

    if (state.signal && !car.parked && car.targetSpot === null) {
      const freeSpots = state.spots
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => !s.occupied);

      if (freeSpots.length > 0) {
        // Faster reaction: hesitate only briefly based on health
        const healthRatio = car.hp / car.maxHp;
        const hesitate = (1 - healthRatio) * 1.5; // max 1.5s delay for damaged bots
        const isFinal = state.isFinalRound;
        const reactionThreshold = isFinal ? 8 - 0.2 : 8 - hesitate; // almost instant in final
        if (state.signalTimer < reactionThreshold) {
          // Pick nearest spot, but sometimes pick random to create chaos
          const pickRandom = Math.random() < 0.25;
          const target = pickRandom
            ? freeSpots[Math.floor(Math.random() * freeSpots.length)]
            : [...freeSpots].sort((a, b) => Math.hypot(a.s.x - car.x, a.s.y - car.y) - Math.hypot(b.s.x - car.x, b.s.y - car.y))[0];
          if (target) car.targetSpot = target.i;
        }
      }
    }

    if (car.targetSpot !== null) {
      const spot = state.spots[car.targetSpot];
      if (!spot || spot.occupied) {
        car.targetSpot = null;
        return;
      }
      const dx = spot.x - car.x;
      const dy = spot.y - car.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 12) {
        // Snap to spot
        car.x = spot.x;
        car.y = spot.y;
        car.parked = true;
        car.parkSpot = car.targetSpot;
        car.targetSpot = null;
        car.speed = 0;
        spot.occupied = true;
        spot.carId = car.id;
        spawnParticles(state, car.x, car.y, '#34C759', 10);
        return;
      }

      // Move directly toward spot — faster, more aggressive
      const hpFactor = 0.6 + (car.hp / car.maxHp) * 0.4;
      const finalBoost = state.isFinalRound ? 1.2 : 1.0;
      const speed = Math.min(car.maxSpeed * hpFactor * finalBoost, dist * 0.12);
      car.x += (dx / dist) * speed;
      car.y += (dy / dist) * speed;
      car.angle = Math.atan2(dx, -dy);
      return;
    }

    // Normal orbit — radius shrinks as fewer spots remain
    const spotsLeft = state.spots.length;
    const totalSpotsAtStart = 10;
    const orbitShrink = 1 - (1 - spotsLeft / totalSpotsAtStart) * 0.45;
    const effectiveRadius = car.orbitRadius * orbitShrink;
    car.orbitAngle += car.orbitSpeed * (0.5 + (car.hp / car.maxHp) * 0.5);
    car.x = CENTER_X + Math.cos(car.orbitAngle) * effectiveRadius;
    car.y = CENTER_Y + Math.sin(car.orbitAngle) * effectiveRadius;
    car.angle = car.orbitAngle + Math.PI;

    // Drift marks
    if (Math.random() < 0.02) {
      state.driftMarks.push({
        x: car.x + (Math.random() - 0.5) * 10,
        y: car.y + (Math.random() - 0.5) * 10,
        angle: car.angle,
        opacity: 0.6,
      });
    }
  }, []);

  // Sync upgrades into state
  useEffect(() => {
    stateRef.current.playerBumper = upgrades.bumper;
    stateRef.current.playerAutoRepair = upgrades.autoRepair;
  }, [upgrades]);

  // Sync player HP from outside (after manual repair button)
  useEffect(() => {
    if (playerHp === undefined) return;
    const playerCar = stateRef.current.cars.find(c => c.isPlayer);
    if (playerCar) playerCar.hp = playerHp;
  }, [playerHp]);

  // Синхронизация с бэкендом: применяем roomState к локальному стейту
  useEffect(() => {
    if (!roomState) return;
    applyRoomState(stateRef.current, roomState, localId);
  }, [roomState, localId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    state.playerBumper = upgrades.bumper;
    state.playerAutoRepair = upgrades.autoRepair;

    const loop = (timestamp: number) => {
      const dt = Math.min((timestamp - timeRef.current) / 1000, 0.05);
      timeRef.current = timestamp;
      const time = timestamp / 1000;

      // === UPDATE ===

      // Particles
      state.particles = state.particles.filter(p => p.life > 0);
      state.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.03;
      });

      // Drift marks fade
      state.driftMarks = state.driftMarks.filter(d => d.opacity > 0);
      state.driftMarks.forEach(d => { d.opacity -= 0.002; });
      if (state.driftMarks.length > 200) state.driftMarks.splice(0, 50);

      if (state.shakeTimer > 0) state.shakeTimer -= dt;

      // Phase logic
      if (state.phase === 'driving') {
        state.timer -= dt;

        // Player control
        const player = state.cars.find(c => c.isPlayer && !c.eliminated);
        if (player && !player.parked) {
          // HP directly affects max speed: 30% HP = 55% speed, 100% HP = 100% speed
          const hpFactor = 0.3 + (player.hp / player.maxHp) * 0.7;
          const turnSpeed = 0.045 + (player.hp / player.maxHp) * 0.02;
          if (keys.has('ArrowLeft')) player.angle -= turnSpeed;
          if (keys.has('ArrowRight')) player.angle += turnSpeed;

          // Clockwise orbit tangent angle at player position
          const orbitTangent = Math.atan2(player.x - CENTER_X, -(player.y - CENTER_Y)) + Math.PI;
          const angleDiff = Math.abs(((player.angle - orbitTangent) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
          const againstOrbit = angleDiff > Math.PI / 2;

          if (keys.has('ArrowUp')) {
            const capSpeed = againstOrbit ? player.maxSpeed * hpFactor * 0.35 : player.maxSpeed * hpFactor;
            player.speed = Math.min(player.speed + 0.15, capSpeed);
          } else if (keys.has('ArrowDown')) {
            player.speed = Math.max(player.speed - 0.2, -1);
          } else {
            player.speed *= 0.96;
          }

          // Force minimum movement during driving phase
          if (!state.signal) {
            const nearExcl =
              player.x > EXCL_LEFT - 40 && player.x < EXCL_RIGHT + 40 &&
              player.y > EXCL_TOP  - 40 && player.y < EXCL_BOTTOM + 40;
            const minSpeed = nearExcl ? 1.5 * hpFactor : 0.7 * hpFactor;
            if (player.speed < minSpeed) player.speed = minSpeed;
          }

          player.x += Math.sin(player.angle) * player.speed;
          player.y -= Math.cos(player.angle) * player.speed;

          // Drift marks for player
          if (Math.abs(player.speed) > 1.5 && (keys.has('ArrowLeft') || keys.has('ArrowRight'))) {
            state.driftMarks.push({ x: player.x, y: player.y, angle: player.angle, opacity: 0.8 });
          }

          // Keep in bounds
          player.x = Math.max(20, Math.min(CANVAS_W - 20, player.x));
          player.y = Math.max(20, Math.min(CANVAS_H - 20, player.y));

          // Block parking zone during driving phase
          if (!state.signal) {
            blockParkingZone(player);
          }

          // Park on signal
          if (state.signal && !player.parked) {
            const freeSpots = state.spots
              .map((s, i) => ({ s, i }))
              .filter(({ s }) => !s.occupied);

            for (const { s, i } of freeSpots) {
              const dist = Math.hypot(s.x - player.x, s.y - player.y);
              if (dist < 25) {
                player.x = s.x;
                player.y = s.y;
                player.parked = true;
                player.parkSpot = i;
                player.speed = 0;
                s.occupied = true;
                s.carId = player.id;
                spawnParticles(state, player.x, player.y, '#FFD600', 15);
                break;
              }
            }
          }
        }

        // Bots
        state.cars.forEach(car => botAI(car, state, dt));

        // Block parking zone for all cars during driving phase
        state.cars.forEach(car => {
          if (!car.eliminated && !car.parked && !state.signal) {
            blockParkingZone(car);
          }
        });

        // Collisions between all cars
        resolveAllCollisions(state.cars, state);

        // Отправляем позицию игрока во время езды (не чаще раза в 200мс)
        if (onPlayerMove && time - moveThrottleRef.current > 0.2) {
          moveThrottleRef.current = time;
          const drivingPlayer = state.cars.find(c => c.isPlayer);
          if (drivingPlayer) {
            onPlayerMove({
              x: drivingPlayer.x, y: drivingPlayer.y, angle: drivingPlayer.angle,
              speed: drivingPlayer.speed, hp: drivingPlayer.hp,
              orbitAngle: drivingPlayer.orbitAngle,
              parked: drivingPlayer.parked, parkSpot: drivingPlayer.parkSpot ?? -1,
              eliminated: drivingPlayer.eliminated,
            });
          }
        }

        // Signal trigger
        if (state.timer <= 0 && !state.signal) {
          state.signal = true;
          state.phase = 'signal';
          state.signalTimer = 8;
        }
      } else if (state.phase === 'signal') {
        state.signalTimer -= dt;

        // Bots continue
        state.cars.forEach(car => botAI(car, state, dt));

        // Player can still drive during signal phase
        const player = state.cars.find(c => c.isPlayer && !c.eliminated);
        if (player && !player.parked) {
          const hpFactor = 0.3 + (player.hp / player.maxHp) * 0.7;
          const turnSpeed = 0.045 + (player.hp / player.maxHp) * 0.02;
          if (keys.has('ArrowLeft')) player.angle -= turnSpeed;
          if (keys.has('ArrowRight')) player.angle += turnSpeed;
          // Nitro works in signal phase — Space key
          const nitroBoost = (upgrades.nitro && keys.has(' ')) ? 1.4 : 1;
          const orbitTangentS = Math.atan2(player.x - CENTER_X, -(player.y - CENTER_Y)) + Math.PI;
          const angleDiffS = Math.abs(((player.angle - orbitTangentS) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
          const againstOrbitS = angleDiffS > Math.PI / 2;
          if (keys.has('ArrowUp')) {
            const capSpeedS = againstOrbitS ? player.maxSpeed * hpFactor * 0.35 : player.maxSpeed * hpFactor * nitroBoost;
            player.speed = Math.min(player.speed + 0.18 * nitroBoost, capSpeedS);
          } else if (keys.has('ArrowDown')) player.speed = Math.max(player.speed - 0.2, -1);
          else player.speed *= 0.95;
          // Nitro particles
          if (upgrades.nitro && keys.has(' ') && keys.has('ArrowUp') && Math.random() < 0.4) {
            spawnParticles(state, player.x, player.y, '#FFD600', 3);
          }
          player.x += Math.sin(player.angle) * player.speed;
          player.y -= Math.cos(player.angle) * player.speed;
          player.x = Math.max(20, Math.min(CANVAS_W - 20, player.x));
          player.y = Math.max(20, Math.min(CANVAS_H - 20, player.y));

          if (!player.parked) {
            const freeSpots = state.spots
              .map((s, i) => ({ s, i }))
              .filter(({ s }) => !s.occupied);
            for (const { s, i } of freeSpots) {
              // Magnet upgrade: extended snap radius
              const snapRadius = upgrades.magnet ? 55 : 25;
              if (Math.hypot(s.x - player.x, s.y - player.y) < snapRadius) {
                // Magnet: smoothly pull toward spot
                if (upgrades.magnet && Math.hypot(s.x - player.x, s.y - player.y) > 25) {
                  player.x += (s.x - player.x) * 0.25;
                  player.y += (s.y - player.y) * 0.25;
                } else {
                  player.x = s.x; player.y = s.y;
                  player.parked = true; player.parkSpot = i; player.speed = 0;
                  s.occupied = true; s.carId = player.id;
                  spawnParticles(state, player.x, player.y, '#FFD600', 15);
                  break;
                }
              }
            }
          }
        }

        // Collisions during signal phase too
        resolveAllCollisions(state.cars, state);

        // Отправляем позицию игрока на сервер (не чаще раза в 200мс)
        if (onPlayerMove && time - moveThrottleRef.current > 0.2) {
          moveThrottleRef.current = time;
          const playerCar = state.cars.find(c => c.isPlayer);
          if (playerCar) {
            onPlayerMove({
              x: playerCar.x, y: playerCar.y, angle: playerCar.angle,
              speed: playerCar.speed, hp: playerCar.hp,
              orbitAngle: playerCar.orbitAngle,
              parked: playerCar.parked, parkSpot: playerCar.parkSpot ?? -1,
              eliminated: playerCar.eliminated,
            });
          }
        }

        // Check if all active cars resolved
        const activeCars = state.cars.filter(c => !c.eliminated);
        const parkedCount = activeCars.filter(c => c.parked).length;
        const availableSpots = state.spots.length;

        if (parkedCount >= availableSpots || state.signalTimer <= 0) {
          const unparked = activeCars.filter(c => !c.parked);

          // Round 0 is a practice round — no elimination
          if (state.round === 0) {
            state.eliminatedThisRound = null;
            const playerCar0 = state.cars.find(c => c.isPlayer);
            onRoundEnd(state.round, false, playerCar0?.hp ?? 100, playerCar0?.maxHp ?? 100);
          } else if (unparked.length > 0) {
            // Player is always eliminated if not parked
            const playerUnparked = unparked.find(c => c.isPlayer);
            const eliminated = playerUnparked
              ? playerUnparked
              : unparked.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];

            eliminated.eliminated = true;
            state.eliminatedThisRound = eliminated;
            spawnParticles(state, eliminated.x, eliminated.y, '#FF2D55', 20);
            state.shakeTimer = 0.5;

            const playerCar = state.cars.find(c => c.isPlayer);
            onRoundEnd(state.round, eliminated.isPlayer, playerCar?.hp ?? 100, playerCar?.maxHp ?? 100);
          } else {
            state.eliminatedThisRound = null;
            const playerCar2 = state.cars.find(c => c.isPlayer);
            onRoundEnd(state.round, false, playerCar2?.hp ?? 100, playerCar2?.maxHp ?? 100);
          }

          state.phase = 'roundEnd';
          state.roundEndTimer = 3;
        }
      } else if (state.phase === 'roundEnd') {
        state.roundEndTimer -= dt;

        if (state.roundEndTimer <= 0) {
          // Check game over
          const activeCars = state.cars.filter(c => !c.eliminated);
          const playerStillAlive = activeCars.some(c => c.isPlayer);

          // Player was eliminated — calculate their final position
          if (!playerStillAlive) {
            const totalCars = state.cars.length;
            const eliminatedBefore = state.cars.filter(c => c.eliminated && !c.isPlayer).length;
            const position = totalCars - eliminatedBefore;
            onGameEnd(position, state.round);
            return;
          }

          if (activeCars.length <= 1 || state.round >= state.maxRounds) {
            // Show winner effect before calling onGameEnd
            state.phase = 'winner';
            state.winnerTimer = 3;
            for (let i = 0; i < 5; i++) {
              setTimeout(() => {
                const player = state.cars.find(c => c.isPlayer);
                if (player) spawnParticles(state, player.x, player.y, '#FFD600', 20);
                spawnParticles(state, CENTER_X + (Math.random()-0.5)*200, CENTER_Y + (Math.random()-0.5)*150, '#FF6B35', 15);
                spawnParticles(state, CENTER_X + (Math.random()-0.5)*200, CENTER_Y + (Math.random()-0.5)*150, '#AF52DE', 15);
              }, i * 400);
            }
            return;
          }

          // Next round setup
          state.round++;
          state.signal = false;
          state.phase = 'driving';
          state.timer = randomRoundTimer(state.round);

          // Determine if this is the final round (2 cars left → 1 spot)
          const nextActiveCars = state.cars.filter(c => !c.eliminated);
          state.isFinalRound = nextActiveCars.length === 2;

          if (state.round === 1) {
            // After round 0: remove 2 spots (go from 10 spots to 9 active cars need 9 spots → remove 1)
            // Actually remove exactly 1 spot so there's 9 spots for 9 remaining cars would be fine,
            // but we need 9 cars, 9 spots still no elimination — so remove 1 more giving 9 cars, 9-1=9? No.
            // Round 0 ends: 10 cars, 10 spots, no elim. Round 1: still 10 cars, need 9 spots → remove 1
            const availableIdxs = state.spots.map((s, i) => ({ s, i })).filter(({ s }) => s.available).map(({ i }) => i);
            if (availableIdxs.length > 0) {
              const removeIdx = availableIdxs[Math.floor(Math.random() * availableIdxs.length)];
              state.spots.splice(removeIdx, 1);
            }
          } else if (state.isFinalRound) {
            // Final round: exactly 1 spot for 2 cars
            state.spots.splice(0, state.spots.length, ...makeSpotsGrid(1));
          } else {
            // Normal: remove one spot
            const availableIdxs = state.spots.map((s, i) => ({ s, i })).filter(({ s }) => s.available).map(({ i }) => i);
            if (availableIdxs.length > 0) {
              const removeIdx = availableIdxs[Math.floor(Math.random() * availableIdxs.length)];
              state.spots.splice(removeIdx, 1);
            }
          }
          state.spots.forEach(s => { s.carId = null; });

          // Auto-repair upgrade: heal player +15 HP between rounds
          if (state.playerAutoRepair) {
            const playerCar = state.cars.find(c => c.isPlayer);
            if (playerCar) {
              playerCar.hp = Math.min(playerCar.maxHp, playerCar.hp + 15);
              spawnParticles(state, playerCar.x, playerCar.y, '#34C759', 8);
            }
          }

          // Reset all cars for new round
          const activeAtReset = state.cars.filter(c => !c.eliminated);
          activeAtReset.forEach((car, idx) => {
            car.parked = false;
            car.parkSpot = null;
            car.targetSpot = null;
            car.speed = car.isPlayer ? 1 : 0;
            const orbitAngle = (idx / activeAtReset.length) * Math.PI * 2;
            car.orbitAngle = orbitAngle;
            car.x = CENTER_X + Math.cos(orbitAngle) * car.orbitRadius;
            car.y = CENTER_Y + Math.sin(orbitAngle) * car.orbitRadius;
            car.angle = orbitAngle + Math.PI;
          });

          // Reset spots occupied status
          state.spots.forEach(s => {
            s.occupied = false;
            s.carId = null;
            s.available = true;
          });

          state.eliminatedThisRound = null;
        }
      } else if (state.phase === 'winner') {
        state.winnerTimer -= dt;

        // Keep spawning particles
        if (Math.random() < 0.15) {
          spawnParticles(state, CENTER_X + (Math.random()-0.5)*300, CENTER_Y + (Math.random()-0.5)*200,
            ['#FFD600','#FF6B35','#AF52DE','#34C759','#FF2D55'][Math.floor(Math.random()*5)], 8);
        }

        if (state.winnerTimer <= 0) {
          onGameEnd(1, state.round);
          return;
        }
      }

      // === DRAW ===
      ctx.save();

      // Screen shake
      if (state.shakeTimer > 0) {
        const shake = state.shakeTimer * 6;
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      drawAsphalt(ctx, state.driftMarks);
      drawParkingArea(ctx, state.spots, state.signal);

      // GPS upgrade: highlight nearest free spot when signal is active
      if (upgrades.gps && state.signal) {
        drawGpsOverlay(ctx, state, time);
      }

      // Cars (sorted by y for pseudo-3d)
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

      drawHUD(ctx, state, time);

      ctx.restore();

      animRef.current = requestAnimationFrame(loop);
    };

    timeRef.current = performance.now();
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [playerName, botAI, keys, onRoundEnd, onGameEnd]);

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