import {
  Car, ParkingSpot, GameState, RoomPlayer, RoomState,
  CENTER_X, CENTER_Y,
  PARK_LEFT, PARK_RIGHT, PARK_TOP, PARK_BOTTOM,
  EXCL_LEFT, EXCL_RIGHT, EXCL_TOP, EXCL_BOTTOM, EXCL_RADIUS,
  EXCL_RX, EXCL_RY,
  CAR_COLORS, CAR_EMOJIS, CAR_NAMES,
} from './gameTypes';
import { playCollisionSound } from './gameAudio';

export function isInsideParkingZone(x: number, y: number): boolean {
  return x > PARK_LEFT && x < PARK_RIGHT && y > PARK_TOP && y < PARK_BOTTOM;
}

// Push car firmly outside the ellipse exclusion zone before signal
export function blockParkingZone(car: Car) {
  const dx = car.x - CENTER_X;
  const dy = car.y - CENTER_Y;
  // Ellipse check: (dx/RX)^2 + (dy/RY)^2 < 1
  const ellipseVal = (dx / EXCL_RX) ** 2 + (dy / EXCL_RY) ** 2;
  if (ellipseVal < 1 && (dx !== 0 || dy !== 0)) {
    // Push to ellipse boundary along the same direction
    const angle = Math.atan2(dy / EXCL_RY, dx / EXCL_RX);
    car.x = CENTER_X + Math.cos(angle) * (EXCL_RX + 2);
    car.y = CENTER_Y + Math.sin(angle) * (EXCL_RY + 2);
    car.speed = Math.abs(car.speed) * 0.4;
  }
}

// Resolve collisions between all non-eliminated cars.
// noDamage=true — только выталкивание (орбита, driving-фаза)
export function resolveAllCollisions(cars: Car[], state: GameState, noDamage = false) {
  const active = cars.filter(c => !c.eliminated && !c.parked);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = 30;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        // Выталкивание: одинаковое для всех
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        if (noDamage) continue; // на орбите — только расталкиваем, без урона

        // Урон только в signal-фазе (после команды ПАРКУЙСЯ)
        // Для ботов скорость движения к споту — их maxSpeed * коэффициент
        const aEffSpeed = a.isBot && a.targetSpot !== null
          ? a.maxSpeed * 0.7
          : Math.abs(a.speed);
        const bEffSpeed = b.isBot && b.targetSpot !== null
          ? b.maxSpeed * 0.7
          : Math.abs(b.speed);

        // Урон только при реальном столкновении (хотя бы одна машина движется)
        const impactSpeed = Math.max(aEffSpeed, bEffSpeed);
        if (impactSpeed < 0.8) continue;

        // Базовый урон: умеренный, масштабируется со скоростью
        const baseDmg = impactSpeed * 3.5;

        // Игрок — щит поглощает первый удар
        const shieldA = a.isPlayer && state.playerShield && !state.shieldUsed;
        const shieldB = b.isPlayer && state.playerShield && !state.shieldUsed;

        const aDmg = shieldA ? 0 : (a.isPlayer && state.playerBumper ? baseDmg * 0.5 : baseDmg);
        const bDmg = shieldB ? 0 : (b.isPlayer && state.playerBumper ? baseDmg * 0.5 : baseDmg);

        if (shieldA) state.shieldUsed = true;
        if (shieldB) state.shieldUsed = true;

        if (aDmg > 0) { a.hp = Math.max(0, a.hp - aDmg); a.blinkTimer = 0.4; }
        if (bDmg > 0) { b.hp = Math.max(0, b.hp - bDmg); b.blinkTimer = 0.4; }

        // Отдача скорости игрока
        if (a.isPlayer) a.speed *= 0.5;
        if (b.isPlayer) b.speed *= 0.5;

        // Визуальный эффект только при сильных ударах
        if (impactSpeed > 2.0) {
          spawnParticles(state, (a.x + b.x) / 2, (a.y + b.y) / 2, '#FF6B35', 8);
          state.shakeTimer = Math.max(state.shakeTimer, 0.2);
          // Звук удара — только если задет игрок
          if (a.isPlayer || b.isPlayer) playCollisionSound(impactSpeed / 4);
        } else if (impactSpeed > 1.2) {
          spawnParticles(state, (a.x + b.x) / 2, (a.y + b.y) / 2, '#FF9F0A', 4);
          if (a.isPlayer || b.isPlayer) playCollisionSound(impactSpeed / 6);
        }
      }
    }
  }
}

export function spawnParticles(
  state: GameState,
  x: number, y: number,
  color: string,
  count: number = 8
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 1,
      size: 3 + Math.random() * 5,
    });
  }
}

export function makeSpotsGrid(count: number): ParkingSpot[] {
  if (count === 1) {
    return [{ x: CENTER_X, y: CENTER_Y, occupied: false, carId: null, available: true }];
  }
  // При малом числе мест (<=6) располагаем по кругу — равные условия для всех
  if (count <= 6) {
    const spots: ParkingSpot[] = [];
    const radius = count === 2 ? 0 : Math.min(80, 50 + count * 8);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      spots.push({
        x: count === 2 ? CENTER_X + (i === 0 ? -70 : 70) : CENTER_X + Math.cos(angle) * radius,
        y: count === 2 ? CENTER_Y : CENTER_Y + Math.sin(angle) * radius,
        occupied: false, carId: null, available: true,
      });
    }
    return spots;
  }
  const spots: ParkingSpot[] = [];
  const SPOT_COLS = 5;
  const SPOT_ROW_GAP = 80;
  const SPOT_COL_GAP = 66;
  const GRID_W = (SPOT_COLS - 1) * SPOT_COL_GAP;
  const GRID_H = Math.ceil(count / SPOT_COLS) * SPOT_ROW_GAP - SPOT_ROW_GAP;
  for (let i = 0; i < count; i++) {
    const col = i % SPOT_COLS;
    const row = Math.floor(i / SPOT_COLS);
    spots.push({
      x: CENTER_X - GRID_W / 2 + col * SPOT_COL_GAP,
      y: CENTER_Y - GRID_H / 2 + row * SPOT_ROW_GAP,
      occupied: false,
      carId: null,
      available: true,
    });
  }
  return spots;
}

export function createInitialState(playerName: string, playerHp?: number, playerMaxHp?: number, playerColor?: string, playerBodyColor?: string, playerEmoji?: string, playerMaxSpeed?: number): GameState {
  const totalCars = 10;
  // Round 0: everyone gets a spot (totalCars spots)
  const totalSpots = totalCars;

  const spots = makeSpotsGrid(totalSpots);

  const ORBIT_R = 230;

  const cars: Car[] = [];
  for (let i = 0; i < totalCars; i++) {
    const orbitAngle = (i / totalCars) * Math.PI * 2;
    const color = CAR_COLORS[i];
    const sx = CENTER_X + Math.cos(orbitAngle) * ORBIT_R;
    const sy = CENTER_Y + Math.sin(orbitAngle) * ORBIT_R;
    const startAngle = orbitAngle + Math.PI;
    cars.push({
      id: i,
      playerId: i === 0 ? 'local_player' : `bot_${i}`,
      x: sx,
      y: sy,
      angle: startAngle,
      speed: 0,
      maxSpeed: i === 0 ? (playerMaxSpeed ?? 3.0) : 2.0 + Math.random() * 1.0,
      color: i === 0 && playerColor ? playerColor : color.body,
      bodyColor: i === 0 && playerBodyColor ? playerBodyColor : color.roof,
      hp: i === 0 ? (playerHp ?? 100) : 100,
      maxHp: i === 0 ? (playerMaxHp ?? 100) : 100,
      isPlayer: i === 0,
      isBot: i !== 0,
      name: i === 0 ? playerName : CAR_NAMES[i],
      orbitRadius: ORBIT_R,
      orbitAngle,
      orbitSpeed: 0.016 + Math.random() * 0.008,
      parked: false,
      parkSpot: null,
      targetSpot: null,
      eliminated: false,
      emoji: i === 0 && playerEmoji ? playerEmoji : CAR_EMOJIS[i],
      blinkTimer: 0,
    });
  }

  return {
    phase: 'driving',
    round: 0,
    maxRounds: 9,
    spots,
    cars,
    signal: false,
    timer: 4 + Math.random() * 3,
    signalTimer: 0,
    roundEndTimer: 0,
    eliminatedThisRound: null,
    isFinalRound: false,
    winnerTimer: 0,
    driftMarks: [],
    particles: [],
    shakeTimer: 0,
    playerBumper: false,
    playerAutoRepair: false,
    playerNitro: false,
    playerGps: false,
    playerMagnet: false,
    playerTurbo: false,
    playerShield: false,
    shieldUsed: false,
  };
}

/**
 * Синхронизирует локальный GameState с данными комнаты с бэкенда.
 * Обновляет позиции удалённых игроков, сохраняет управление локальным.
 */
export function applyRoomState(state: GameState, room: RoomState, localPlayerId: string) {
  // Обновить спот-занятость
  state.spots = room.spots.map(s => ({
    x: s.x, y: s.y,
    occupied: s.occupied,
    carId: s.car_id !== null ? (s.car_id as unknown as number) : null,
    available: true,
  }));

  // Синхронизировать каждого игрока
  room.players.forEach((rp: RoomPlayer, idx: number) => {
    const existing = state.cars.find(c => c.playerId === rp.player_id);
    if (existing) {
      // Не перезаписывать позицию локального игрока — он управляет сам
      if (rp.player_id !== localPlayerId) {
        existing.x = rp.x;
        existing.y = rp.y;
        existing.angle = rp.angle;
        existing.speed = rp.speed;
        existing.orbitAngle = rp.orbit_angle;
        existing.parked = rp.parked;
        existing.parkSpot = rp.park_spot >= 0 ? rp.park_spot : null;
        existing.eliminated = rp.eliminated;
      }
      existing.hp = rp.hp;
      existing.maxHp = rp.max_hp;
    } else {
      // Новый игрок — добавляем в state
      const orbitRadius = 225;
      state.cars.push({
        id: state.cars.length,
        playerId: rp.player_id,
        x: rp.x, y: rp.y,
        angle: rp.angle, speed: rp.speed,
        maxSpeed: 2.5 + Math.random() * 0.5,
        color: rp.color, bodyColor: rp.body_color,
        hp: rp.hp, maxHp: rp.max_hp,
        isPlayer: rp.player_id === localPlayerId,
        isBot: rp.is_bot,
        name: rp.name,
        orbitRadius,
        orbitAngle: rp.orbit_angle,
        orbitSpeed: 0.016 + Math.random() * 0.008,
        parked: rp.parked,
        parkSpot: rp.park_spot >= 0 ? rp.park_spot : null,
        targetSpot: null,
        eliminated: rp.eliminated,
        emoji: rp.emoji,
        blinkTimer: 0,
      });
    }
  });

  // Обновить фазу/раунд
  state.round = room.round;
  if (room.phase === 'driving' && state.phase !== 'driving') {
    state.phase = 'driving';
    state.signal = false;
  }
  if (room.isFinal) state.isFinalRound = true;
}