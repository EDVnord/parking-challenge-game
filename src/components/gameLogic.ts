import {
  Car, ParkingSpot, GameState,
  CENTER_X, CENTER_Y,
  PARK_LEFT, PARK_RIGHT, PARK_TOP, PARK_BOTTOM,
  EXCL_LEFT, EXCL_RIGHT, EXCL_TOP, EXCL_BOTTOM,
  CAR_COLORS, CAR_EMOJIS, CAR_NAMES,
} from './gameTypes';

export function isInsideParkingZone(x: number, y: number): boolean {
  return x > PARK_LEFT && x < PARK_RIGHT && y > PARK_TOP && y < PARK_BOTTOM;
}

// Push car firmly outside the exclusion zone before signal
export function blockParkingZone(car: Car) {
  if (car.x > EXCL_LEFT && car.x < EXCL_RIGHT &&
      car.y > EXCL_TOP  && car.y < EXCL_BOTTOM) {
    const dLeft   = car.x - EXCL_LEFT;
    const dRight  = EXCL_RIGHT  - car.x;
    const dTop    = car.y - EXCL_TOP;
    const dBottom = EXCL_BOTTOM - car.y;
    const minD = Math.min(dLeft, dRight, dTop, dBottom);
    if      (minD === dLeft)   { car.x = EXCL_LEFT   - 2; car.speed = Math.abs(car.speed) * 0.5; }
    else if (minD === dRight)  { car.x = EXCL_RIGHT  + 2; car.speed = Math.abs(car.speed) * 0.5; }
    else if (minD === dTop)    { car.y = EXCL_TOP    - 2; car.speed = Math.abs(car.speed) * 0.5; }
    else                       { car.y = EXCL_BOTTOM + 2; car.speed = Math.abs(car.speed) * 0.5; }
  }
}

// Resolve collisions between all non-eliminated cars
export function resolveAllCollisions(cars: Car[], state: GameState) {
  const active = cars.filter(c => !c.eliminated && !c.parked);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = 26;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        // Push apart
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
        // Damage based on relative speed (bumper upgrade reduces player damage)
        const relSpeed = Math.abs(a.speed - b.speed);
        if (relSpeed > 0.5) {
          const dmg = relSpeed * 0.6;
          const aDmg = a.isPlayer && state.playerBumper ? dmg * 0.5 : dmg;
          const bDmg = b.isPlayer && state.playerBumper ? dmg * 0.5 : dmg;
          a.hp = Math.max(0, a.hp - aDmg);
          b.hp = Math.max(0, b.hp - bDmg);
          if (relSpeed > 1.5) {
            spawnParticles(state, (a.x + b.x) / 2, (a.y + b.y) / 2, '#FF6B35', 6);
            state.shakeTimer = Math.max(state.shakeTimer, 0.15);
          }
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

export function createInitialState(playerName: string): GameState {
  const totalCars = 10;
  const totalSpots = 10;

  // Spots packed tightly toward center so fewer spots = compact cluster
  const spots: ParkingSpot[] = [];
  const SPOT_COLS = 5;
  const SPOT_ROW_GAP = 80;
  const SPOT_COL_GAP = 66;
  const GRID_W = (SPOT_COLS - 1) * SPOT_COL_GAP;
  const GRID_H = 1 * SPOT_ROW_GAP;
  for (let i = 0; i < totalSpots; i++) {
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

  const cars: Car[] = [];
  for (let i = 0; i < totalCars; i++) {
    // Larger orbit radius, all cars go clockwise (positive orbitSpeed only)
    const orbitRadius = 270 + (i % 3) * 20;
    const orbitAngle = (i / totalCars) * Math.PI * 2;
    const color = CAR_COLORS[i];
    // Clockwise orbit tangent in canvas coords (y-down):
    // position = (cos θ, sin θ)·R, velocity direction = (-sin θ, cos θ)
    // Car moves as: dx = sin(angle), dy = -cos(angle)
    // To match: sin(a)=-sinθ, -cos(a)=cosθ  →  a = θ + π
    const startAngle = orbitAngle + Math.PI;
    cars.push({
      id: i,
      x: CENTER_X + Math.cos(orbitAngle) * orbitRadius,
      y: CENTER_Y + Math.sin(orbitAngle) * orbitRadius,
      angle: startAngle,
      speed: 0,
      maxSpeed: i === 0 ? 3.0 : 1.4 + Math.random() * 0.6,
      color: color.body,
      bodyColor: color.roof,
      hp: 100,
      maxHp: 100,
      isPlayer: i === 0,
      name: i === 0 ? playerName : CAR_NAMES[i],
      orbitRadius,
      orbitAngle,
      orbitSpeed: 0.013 + Math.random() * 0.005, // always positive = clockwise
      parked: false,
      parkSpot: null,
      targetSpot: null,
      eliminated: false,
      emoji: CAR_EMOJIS[i],
      blinkTimer: 0,
    });
  }

  return {
    phase: 'driving',
    round: 1,
    maxRounds: 9,
    spots,
    cars,
    signal: false,
    timer: 3 + Math.random() * 4,
    signalTimer: 0,
    roundEndTimer: 0,
    eliminatedThisRound: null,
    driftMarks: [],
    particles: [],
    shakeTimer: 0,
    playerBumper: false,
    playerAutoRepair: false,
  };
}
