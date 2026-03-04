import { useEffect, useRef, useCallback } from 'react';

interface Car {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  maxSpeed: number;
  color: string;
  bodyColor: string;
  hp: number;
  maxHp: number;
  isPlayer: boolean;
  name: string;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  parked: boolean;
  parkSpot: number | null;
  targetSpot: number | null;
  eliminated: boolean;
  emoji: string;
  blinkTimer: number;
}

interface ParkingSpot {
  x: number;
  y: number;
  occupied: boolean;
  carId: number | null;
  available: boolean;
}

interface GameState {
  phase: 'driving' | 'signal' | 'parking' | 'roundEnd';
  round: number;
  maxRounds: number;
  spots: ParkingSpot[];
  cars: Car[];
  signal: boolean;
  timer: number;
  signalTimer: number;
  roundEndTimer: number;
  eliminatedThisRound: Car | null;
  driftMarks: { x: number; y: number; angle: number; opacity: number }[];
  particles: { x: number; y: number; vx: number; vy: number; color: string; life: number; size: number }[];
  shakeTimer: number;
}

const CAR_COLORS = [
  { body: '#FF2D55', roof: '#CC0033' },
  { body: '#007AFF', roof: '#0055CC' },
  { body: '#34C759', roof: '#248A3D' },
  { body: '#FF6B35', roof: '#CC4400' },
  { body: '#AF52DE', roof: '#7B2FA8' },
  { body: '#5AC8FA', roof: '#0088CC' },
  { body: '#FFD600', roof: '#CC9900' },
  { body: '#FF3B30', roof: '#AA0000' },
  { body: '#30D158', roof: '#1A8833' },
  { body: '#FF9F0A', roof: '#CC6600' },
];

const CAR_EMOJIS = ['🚗','🚕','🚙','🏎️','🚓','🚑','🚒','🛻','🚐','🚌'];
const CAR_NAMES = ['Вася','Петя','Коля','Маша','Катя','Женя','Саша','Лёша','Дима','Игорь'];

const CANVAS_W = 800;
const CANVAS_H = 600;
const CENTER_X = CANVAS_W / 2;
const CENTER_Y = CANVAS_H / 2;
const PARKING_AREA_W = 360;
const PARKING_AREA_H = 200;
const SPOT_W = 32;
const SPOT_H = 54;

function createInitialState(playerName: string): GameState {
  const totalCars = 10;
  const totalSpots = 10;

  const spots: ParkingSpot[] = [];
  for (let i = 0; i < totalSpots; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    spots.push({
      x: CENTER_X - PARKING_AREA_W / 2 + 36 + col * 72,
      y: CENTER_Y - PARKING_AREA_H / 2 + 20 + row * 90,
      occupied: false,
      carId: null,
      available: true,
    });
  }

  const cars: Car[] = [];
  for (let i = 0; i < totalCars; i++) {
    const orbitRadius = 240 + (i % 3) * 20;
    const orbitAngle = (i / totalCars) * Math.PI * 2;
    const color = CAR_COLORS[i];
    cars.push({
      id: i,
      x: CENTER_X + Math.cos(orbitAngle) * orbitRadius,
      y: CENTER_Y + Math.sin(orbitAngle) * orbitRadius,
      angle: orbitAngle + Math.PI / 2,
      speed: 0,
      maxSpeed: 2.5 + Math.random() * 1.0,
      color: color.body,
      bodyColor: color.roof,
      hp: 100,
      maxHp: 100,
      isPlayer: i === 0,
      name: i === 0 ? playerName : CAR_NAMES[i],
      orbitRadius,
      orbitAngle,
      orbitSpeed: (0.012 + Math.random() * 0.006) * (Math.random() > 0.5 ? 1 : -1),
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
  };
}

function spawnParticles(
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

function drawCar(ctx: CanvasRenderingContext2D, car: Car, time: number) {
  if (car.eliminated) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  const healthRatio = car.hp / car.maxHp;
  const carW = 20;
  const carH = 34;

  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 4, carW * 0.8, carH * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body
  ctx.beginPath();
  ctx.roundRect(-carW / 2, -carH / 2, carW, carH, 6);
  ctx.fillStyle = car.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Roof
  ctx.beginPath();
  ctx.roundRect(-carW / 2 + 3, -carH / 2 + 7, carW - 6, carH - 16, 4);
  ctx.fillStyle = car.bodyColor;
  ctx.fill();

  // Windshield
  ctx.beginPath();
  ctx.roundRect(-carW / 2 + 3, -carH / 2 + 7, carW - 6, 12, 3);
  ctx.fillStyle = 'rgba(150,220,255,0.7)';
  ctx.fill();

  // Wheels
  const wheelPositions = [
    { x: -carW / 2 - 2, y: -carH / 2 + 8 },
    { x: carW / 2 + 2, y: -carH / 2 + 8 },
    { x: -carW / 2 - 2, y: carH / 2 - 10 },
    { x: carW / 2 + 2, y: carH / 2 - 10 },
  ];
  wheelPositions.forEach(w => {
    ctx.beginPath();
    ctx.roundRect(w.x - 3, w.y - 7, 6, 13, 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w.x, w.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#888';
    ctx.fill();
  });

  // Headlights
  ctx.beginPath();
  ctx.roundRect(-carW / 2 + 2, -carH / 2, 5, 4, 1);
  ctx.fillStyle = '#FFEE88';
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(carW / 2 - 7, -carH / 2, 5, 4, 1);
  ctx.fillStyle = '#FFEE88';
  ctx.fill();

  // Damage cracks
  if (healthRatio < 0.6) {
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.lineTo(3, 2);
    ctx.lineTo(-1, 8);
    ctx.stroke();
  }
  if (healthRatio < 0.3) {
    ctx.strokeStyle = 'rgba(255,50,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(-4, 0);
    ctx.lineTo(4, 6);
    ctx.stroke();
    // Smoke
    if (Math.sin(time * 10 + car.id) > 0.5) {
      ctx.beginPath();
      ctx.arc(0, -carH / 2 - 5 + Math.sin(time * 5 + car.id) * 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,150,150,0.5)';
      ctx.fill();
    }
  }

  // Player indicator
  if (car.isPlayer) {
    ctx.beginPath();
    ctx.arc(0, -carH / 2 - 10, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD600';
    ctx.fill();
    ctx.strokeStyle = '#AA8800';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Blinking star for player
    if (Math.sin(time * 4) > 0) {
      ctx.fillStyle = 'rgba(255,214,0,0.6)';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, -carH / 2 - 18);
    }
  }

  // HP bar
  const barW = carW + 4;
  const barH2 = 4;
  const barX = -barW / 2;
  const barY = carH / 2 + 4;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH2, 2);
  ctx.fill();
  const hpColor = healthRatio > 0.6 ? '#34C759' : healthRatio > 0.3 ? '#FF9F0A' : '#FF2D55';
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * healthRatio, barH2, 2);
  ctx.fill();

  ctx.restore();
}

function drawParkingArea(ctx: CanvasRenderingContext2D, spots: ParkingSpot[]) {
  // Parking area background
  ctx.save();
  ctx.fillStyle = '#252535';
  ctx.strokeStyle = '#FFD600';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.roundRect(
    CENTER_X - PARKING_AREA_W / 2 - 15,
    CENTER_Y - PARKING_AREA_H / 2 - 15,
    PARKING_AREA_W + 30,
    PARKING_AREA_H + 30,
    16
  );
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Spots
  spots.forEach((spot, i) => {
    ctx.save();
    ctx.translate(spot.x, spot.y);

    if (!spot.available) {
      ctx.fillStyle = 'rgba(255,45,85,0.15)';
      ctx.strokeStyle = 'rgba(255,45,85,0.4)';
    } else if (spot.occupied) {
      ctx.fillStyle = 'rgba(255,214,0,0.15)';
      ctx.strokeStyle = 'rgba(255,214,0,0.5)';
    } else {
      ctx.fillStyle = 'rgba(52,199,89,0.15)';
      ctx.strokeStyle = 'rgba(52,199,89,0.7)';
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-SPOT_W / 2, -SPOT_H / 2, SPOT_W, SPOT_H, 4);
    ctx.fill();
    ctx.stroke();

    // Spot number
    ctx.fillStyle = spot.occupied || !spot.available ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 10px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`P${i + 1}`, 0, SPOT_H / 2 + 12);

    ctx.restore();
  });
}

function drawAsphalt(ctx: CanvasRenderingContext2D, driftMarks: GameState['driftMarks']) {
  // Main asphalt
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Texture dots
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let x = 0; x < CANVAS_W; x += 20) {
    for (let y = 0; y < CANVAS_H; y += 20) {
      ctx.fillRect(x + Math.sin(x * y) * 3, y + Math.cos(x + y) * 3, 2, 2);
    }
  }

  // Circuit lines (oval track)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 60;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(CENTER_X, CENTER_Y, 255, 180, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,214,0,0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([15, 10]);
  ctx.beginPath();
  ctx.ellipse(CENTER_X, CENTER_Y, 255, 180, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Drift marks
  driftMarks.forEach(mark => {
    ctx.save();
    ctx.translate(mark.x, mark.y);
    ctx.rotate(mark.angle);
    ctx.fillStyle = `rgba(30,10,0,${mark.opacity * 0.4})`;
    ctx.beginPath();
    ctx.roundRect(-2, -15, 4, 30, 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: GameState['particles']) {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0, p.size * p.life), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawSignal(ctx: CanvasRenderingContext2D, time: number) {
  // Big flashing SIGNAL
  const alpha = 0.7 + Math.sin(time * 20) * 0.3;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Background flash
  ctx.fillStyle = 'rgba(255,214,0,0.15)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Text
  ctx.fillStyle = '#FFD600';
  ctx.font = 'bold 72px Russo One, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#FFD600';
  ctx.shadowBlur = 30;
  ctx.fillText('ПАРКУЙСЯ!', CENTER_X, CENTER_Y - CANVAS_H / 3);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawRoundEnd(ctx: CanvasRenderingContext2D, eliminated: Car | null, round: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (eliminated) {
    ctx.fillStyle = '#FF2D55';
    ctx.font = 'bold 42px Russo One, sans-serif';
    ctx.shadowColor = '#FF2D55';
    ctx.shadowBlur = 20;
    ctx.fillText(`${eliminated.emoji} ${eliminated.name} вылетает!`, CENTER_X, CENTER_Y - 30);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '20px Nunito, sans-serif';
    ctx.fillText(`Раунд ${round - 1} завершён`, CENTER_X, CENTER_Y + 20);
  }

  ctx.restore();
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const player = state.cars.find(c => c.isPlayer);
  if (!player) return;

  // Round info
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 160, 70, 12);
  ctx.fill();

  ctx.fillStyle = '#FFD600';
  ctx.font = 'bold 14px Russo One, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`РАУНД ${state.round} / ${state.maxRounds}`, 20, 32);

  const activeCars = state.cars.filter(c => !c.eliminated).length;
  const activeSpots = state.spots.filter(s => s.available).length;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px Nunito, sans-serif';
  ctx.fillText(`🚗 Машин: ${activeCars}`, 20, 52);
  ctx.fillText(`🅿️ Мест: ${activeSpots}`, 20, 68);
  ctx.restore();

  // Timer (during driving phase)
  if (state.phase === 'driving') {
    ctx.save();
    const seconds = Math.ceil(state.timer);
    const pulse = seconds <= 2 ? 0.8 + Math.sin(time * 10) * 0.2 : 1;
    ctx.translate(CENTER_X, 35);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = seconds <= 2 ? '#FF2D55' : '#FFD600';
    ctx.font = 'bold 22px Russo One, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${seconds}с`, 0, 0);
    ctx.restore();
  }

  // Player info bottom
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(10, CANVAS_H - 80, 200, 70, 12);
  ctx.fill();

  ctx.fillStyle = '#FFD600';
  ctx.font = 'bold 13px Russo One, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${player.emoji} ${player.name}`, 20, CANVAS_H - 58);

  const hpRatio = player.hp / player.maxHp;
  const hpColor = hpRatio > 0.6 ? '#34C759' : hpRatio > 0.3 ? '#FF9F0A' : '#FF2D55';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.roundRect(20, CANVAS_H - 46, 170, 10, 5);
  ctx.fill();
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  ctx.roundRect(20, CANVAS_H - 46, 170 * hpRatio, 10, 5);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px Nunito, sans-serif';
  ctx.fillText(`❤️ ${Math.round(player.hp)} / ${player.maxHp}`, 20, CANVAS_H - 22);

  if (player.parked) {
    ctx.fillStyle = '#34C759';
    ctx.font = 'bold 11px Russo One, sans-serif';
    ctx.fillText('✅ ПРИПАРКОВАН!', 20, CANVAS_H - 8);
  }
  ctx.restore();

  // Controls hint
  if (state.phase === 'driving' && !state.signal) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px Nunito, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('← → Повернуть   ↑ ↓ Газ/Тормоз', CANVAS_W - 15, CANVAS_H - 10);
    ctx.restore();
  }
}

interface Props {
  playerName: string;
  onRoundEnd: (round: number, isPlayerEliminated: boolean) => void;
  onGameEnd: (position: number) => void;
  keys: Set<string>;
}

export default function GameCanvas({ playerName, onRoundEnd, onGameEnd, keys }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState(playerName));
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const botAI = useCallback((car: Car, state: GameState, dt: number) => {
    if (car.isPlayer || car.eliminated || car.parked) return;

    if (state.signal && !car.parked && car.targetSpot === null) {
      const freeSpots = state.spots
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.available && !s.occupied);

      if (freeSpots.length > 0) {
        const healthRatio = car.hp / car.maxHp;
        const hesitate = Math.random() > healthRatio * 0.9;
        if (!hesitate) {
          const nearest = freeSpots.sort((a, b) => {
            const da = Math.hypot(a.s.x - car.x, a.s.y - car.y);
            const db = Math.hypot(b.s.x - car.x, b.s.y - car.y);
            return da - db;
          })[0];
          car.targetSpot = nearest.i;
        }
      }
    }

    if (car.targetSpot !== null) {
      const spot = state.spots[car.targetSpot];
      if (!spot.available || spot.occupied) {
        car.targetSpot = null;
        return;
      }
      const dx = spot.x - car.x;
      const dy = spot.y - car.y;
      const dist = Math.hypot(dx, dy);
      const targetAngle = Math.atan2(dy, dx) - Math.PI / 2;
      let angleDiff = targetAngle - car.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      car.angle += angleDiff * 0.12;

      const hpFactor = 0.5 + (car.hp / car.maxHp) * 0.5;
      car.speed = Math.min(car.maxSpeed * hpFactor, dist * 0.15);
      car.x += Math.sin(car.angle) * car.speed;
      car.y -= Math.cos(car.angle) * car.speed;

      if (dist < 15 && !spot.occupied) {
        car.x = spot.x;
        car.y = spot.y;
        car.parked = true;
        car.parkSpot = car.targetSpot;
        car.targetSpot = null;
        car.speed = 0;
        spot.occupied = true;
        spot.carId = car.id;
        spawnParticles(state, car.x, car.y, '#34C759', 10);
      }
      return;
    }

    // Normal orbit
    car.orbitAngle += car.orbitSpeed * (0.5 + (car.hp / car.maxHp) * 0.5);
    car.x = CENTER_X + Math.cos(car.orbitAngle) * car.orbitRadius;
    car.y = CENTER_Y + Math.sin(car.orbitAngle) * car.orbitRadius;
    car.angle = car.orbitAngle + Math.PI / 2 * Math.sign(car.orbitSpeed);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;

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
          const hpFactor = 0.4 + (player.hp / player.maxHp) * 0.6;
          if (keys.has('ArrowLeft')) player.angle -= 0.05;
          if (keys.has('ArrowRight')) player.angle += 0.05;
          if (keys.has('ArrowUp')) {
            player.speed = Math.min(player.speed + 0.15, player.maxSpeed * hpFactor);
          } else if (keys.has('ArrowDown')) {
            player.speed = Math.max(player.speed - 0.2, -1);
          } else {
            player.speed *= 0.96;
          }

          const prevX = player.x;
          const prevY = player.y;
          player.x += Math.sin(player.angle) * player.speed;
          player.y -= Math.cos(player.angle) * player.speed;

          // Drift marks for player
          if (Math.abs(player.speed) > 1.5 && (keys.has('ArrowLeft') || keys.has('ArrowRight'))) {
            state.driftMarks.push({ x: player.x, y: player.y, angle: player.angle, opacity: 0.8 });
          }

          // Keep in bounds (loose)
          player.x = Math.max(20, Math.min(CANVAS_W - 20, player.x));
          player.y = Math.max(20, Math.min(CANVAS_H - 20, player.y));

          // Car collisions
          state.cars.forEach(other => {
            if (other.id === player.id || other.eliminated) return;
            const dist = Math.hypot(other.x - player.x, other.y - player.y);
            if (dist < 28) {
              const dmg = Math.abs(player.speed) * 8 + 5;
              player.hp = Math.max(0, player.hp - dmg * 0.5);
              other.hp = Math.max(0, other.hp - dmg * 0.5);
              state.shakeTimer = 0.3;
              spawnParticles(state, (player.x + other.x) / 2, (player.y + other.y) / 2, '#FF6B35', 12);

              const pushAngle = Math.atan2(other.y - player.y, other.x - player.x);
              other.x += Math.cos(pushAngle) * 10;
              other.y += Math.sin(pushAngle) * 10;
              player.x -= Math.cos(pushAngle) * 10;
              player.y -= Math.sin(pushAngle) * 10;
            }
          });

          // Park in signal
          if (state.signal && !player.parked) {
            const freeSpots = state.spots
              .map((s, i) => ({ s, i }))
              .filter(({ s }) => s.available && !s.occupied);

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

        // Player can still drive
        const player = state.cars.find(c => c.isPlayer && !c.eliminated);
        if (player && !player.parked) {
          const hpFactor = 0.4 + (player.hp / player.maxHp) * 0.6;
          if (keys.has('ArrowLeft')) player.angle -= 0.05;
          if (keys.has('ArrowRight')) player.angle += 0.05;
          if (keys.has('ArrowUp')) player.speed = Math.min(player.speed + 0.15, player.maxSpeed * hpFactor);
          else if (keys.has('ArrowDown')) player.speed = Math.max(player.speed - 0.2, -1);
          else player.speed *= 0.95;
          player.x += Math.sin(player.angle) * player.speed;
          player.y -= Math.cos(player.angle) * player.speed;
          player.x = Math.max(20, Math.min(CANVAS_W - 20, player.x));
          player.y = Math.max(20, Math.min(CANVAS_H - 20, player.y));

          if (!player.parked) {
            const freeSpots = state.spots
              .map((s, i) => ({ s, i }))
              .filter(({ s }) => s.available && !s.occupied);
            for (const { s, i } of freeSpots) {
              if (Math.hypot(s.x - player.x, s.y - player.y) < 25) {
                player.x = s.x; player.y = s.y;
                player.parked = true; player.parkSpot = i; player.speed = 0;
                s.occupied = true; s.carId = player.id;
                spawnParticles(state, player.x, player.y, '#FFD600', 15);
                break;
              }
            }
          }
        }

        // Check if all active cars resolved
        const activeCars = state.cars.filter(c => !c.eliminated);
        const parkedCount = activeCars.filter(c => c.parked).length;
        const availableSpots = state.spots.filter(s => s.available).length;

        if (parkedCount >= availableSpots || state.signalTimer <= 0) {
          // Find who didn't park
          const unparked = activeCars.filter(c => !c.parked);
          if (unparked.length > 0) {
            const eliminated = unparked.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
            eliminated.eliminated = true;
            state.eliminatedThisRound = eliminated;
            spawnParticles(state, eliminated.x, eliminated.y, '#FF2D55', 20);
            state.shakeTimer = 0.5;

            const playerEliminated = eliminated.isPlayer;
            onRoundEnd(state.round, playerEliminated);
          } else {
            state.eliminatedThisRound = null;
          }

          state.phase = 'roundEnd';
          state.roundEndTimer = 3;
        }
      } else if (state.phase === 'roundEnd') {
        state.roundEndTimer -= dt;

        if (state.roundEndTimer <= 0) {
          // Check game over
          const activeCars = state.cars.filter(c => !c.eliminated);
          if (activeCars.length <= 1 || state.round >= state.maxRounds) {
            const winner = activeCars[0];
            if (winner) {
              const position = winner.isPlayer ? 1 : activeCars.findIndex(c => c.isPlayer) + 1;
              onGameEnd(position);
            }
            return;
          }

          // Next round setup
          state.round++;
          state.signal = false;
          state.phase = 'driving';
          state.timer = 3 + Math.random() * 4;

          // Remove one spot
          const availableSpots = state.spots.filter((s, i) => s.available);
          if (availableSpots.length > 0) {
            const removeIdx = state.spots.findIndex(s => s.available);
            state.spots[removeIdx].available = false;
          }

          // Reset all cars for new round
          state.cars.forEach((car, idx) => {
            if (car.eliminated) return;
            car.parked = false;
            car.parkSpot = null;
            car.targetSpot = null;
            car.speed = 0;
            const orbitAngle = (idx / state.cars.filter(c => !c.eliminated).length) * Math.PI * 2;
            car.orbitAngle = orbitAngle;
            car.x = CENTER_X + Math.cos(orbitAngle) * car.orbitRadius;
            car.y = CENTER_Y + Math.sin(orbitAngle) * car.orbitRadius;
            car.angle = orbitAngle + Math.PI / 2;
          });

          // Reset spots occupied status
          state.spots.forEach(s => {
            s.occupied = false;
            s.carId = null;
          });

          state.eliminatedThisRound = null;
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
      drawParkingArea(ctx, state.spots);

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