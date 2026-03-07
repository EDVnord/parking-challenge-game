import { useCallback } from 'react';
import { Car, GameState, CENTER_X, CENTER_Y } from './gameTypes';
import { spawnParticles } from './gameLogic';

// Круговая орбита снаружи exclusion zone
const ORBIT_R = 230;

// Оригинальная скорость орбиты — каждый кадр при 60fps добавлялось ~0.016–0.024 рад
// orbitSpeed хранится в рад/кадр при 60fps, умножаем на 60 чтобы получить рад/сек
const TARGET_FPS = 60;

export function useBotAI() {
  const botAI = useCallback((car: Car, state: GameState, dt: number) => {
    if (car.eliminated || car.parked) return;

    // Игрок в driving-фазе (до сигнала) — круговая орбита по часовой стрелке
    if (car.isPlayer && !state.signal) {
      const hpFactor = 0.3 + (car.hp / car.maxHp) * 0.7;
      const angularSpeed = car.orbitSpeed * TARGET_FPS * hpFactor;
      car.orbitAngle += angularSpeed * dt;
      car.x = CENTER_X + Math.cos(car.orbitAngle) * ORBIT_R;
      car.y = CENTER_Y + Math.sin(car.orbitAngle) * ORBIT_R;
      car.angle = car.orbitAngle + Math.PI;
      return;
    }

    if (car.isPlayer) return; // в signal-фазе игрок управляется вручную

    if (state.signal && !car.parked && car.targetSpot === null) {
      const freeSpots = state.spots
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => !s.occupied);

      if (freeSpots.length > 0) {
        const healthRatio = car.hp / car.maxHp;
        const hesitate = (1 - healthRatio) * 1.5;
        const isFinal = state.isFinalRound;
        const reactionThreshold = isFinal ? 8 - 0.2 : 8 - hesitate;
        if (state.signalTimer < reactionThreshold) {
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

      const hpFactor = 0.6 + (car.hp / car.maxHp) * 0.4;
      const finalBoost = state.isFinalRound ? 1.2 : 1.0;
      const speed = Math.min(car.maxSpeed * hpFactor * finalBoost, dist * 0.12);
      car.x += (dx / dist) * speed;
      car.y += (dy / dist) * speed;
      car.angle = Math.atan2(dx, -dy);
      return;
    }

    // Орбита бота — круговая, по часовой стрелке
    const hpFactor = 0.3 + (car.hp / car.maxHp) * 0.7;
    const angularSpeed = car.orbitSpeed * TARGET_FPS * hpFactor;
    car.orbitAngle += angularSpeed * dt;

    car.x = CENTER_X + Math.cos(car.orbitAngle) * ORBIT_R;
    car.y = CENTER_Y + Math.sin(car.orbitAngle) * ORBIT_R;
    car.angle = car.orbitAngle + Math.PI;

    if (Math.random() < 0.02) {
      state.driftMarks.push({
        x: car.x + (Math.random() - 0.5) * 10,
        y: car.y + (Math.random() - 0.5) * 10,
        angle: car.angle,
        opacity: 0.6,
      });
    }
  }, []);

  return botAI;
}