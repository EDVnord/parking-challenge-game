import { useCallback } from 'react';
import { Car, GameState, CENTER_X, CENTER_Y } from './gameTypes';
import { spawnParticles } from './gameLogic';

// Оригинальная скорость орбиты — каждый кадр при 60fps добавлялось ~0.016–0.024 рад
// orbitSpeed хранится в рад/кадр при 60fps, умножаем на 60 чтобы получить рад/сек
const TARGET_FPS = 60;

export function useBotAI() {
  const botAI = useCallback((car: Car, state: GameState, dt: number) => {
    if (car.isPlayer || car.eliminated || car.parked) return;

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

    // Орбита: orbitSpeed — рад/кадр при 60fps, умножаем на TARGET_FPS*dt для FPS-независимости
    const hpFactor = 0.5 + (car.hp / car.maxHp) * 0.5;
    const angularSpeed = car.orbitSpeed * TARGET_FPS * hpFactor; // рад/сек
    car.orbitAngle += angularSpeed * dt;

    // Держим радиус орбиты в пределах трека (280–320), не даём уйти за края
    const minR = 260;
    const maxR = 330;
    car.orbitRadius = Math.max(minR, Math.min(maxR, car.orbitRadius));

    car.x = CENTER_X + Math.cos(car.orbitAngle) * car.orbitRadius;
    car.y = CENTER_Y + Math.sin(car.orbitAngle) * car.orbitRadius;
    // Направление машины — по касательной к окружности (против часовой = orbitAngle + PI/2)
    car.angle = car.orbitAngle + Math.PI / 2;

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