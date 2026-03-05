export interface Car {
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

export interface ParkingSpot {
  x: number;
  y: number;
  occupied: boolean;
  carId: number | null;
  available: boolean;
}

export interface GameState {
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
  playerBumper: boolean;
  playerAutoRepair: boolean;
}

export interface Upgrades {
  nitro: boolean;
  gps: boolean;
  bumper: boolean;
  autoRepair: boolean;
  magnet: boolean;
  turbo: boolean;
  shield: boolean;
}

export interface GameCanvasProps {
  playerName: string;
  playerHp?: number;
  playerMaxHp?: number;
  playerColor?: string;
  playerBodyColor?: string;
  playerEmoji?: string;
  playerMaxSpeed?: number;
  upgrades: Upgrades;
  onRoundEnd: (round: number, isPlayerEliminated: boolean, playerHp: number, playerMaxHp: number) => void;
  onGameEnd: (position: number, roundsPlayed?: number) => void;
  keys: Set<string>;
}

// Canvas dimensions
export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const CENTER_X = CANVAS_W / 2;
export const CENTER_Y = CANVAS_H / 2;

// Parking area layout
export const PARKING_AREA_W = 360;
export const PARKING_AREA_H = 200;
export const SPOT_W = 32;
export const SPOT_H = 54;

// Parking zone visual bounds
export const PARK_LEFT   = CENTER_X - PARKING_AREA_W / 2 - 15;
export const PARK_RIGHT  = CENTER_X + PARKING_AREA_W / 2 + 15;
export const PARK_TOP    = CENTER_Y - PARKING_AREA_H / 2 - 15;
export const PARK_BOTTOM = CENTER_Y + PARKING_AREA_H / 2 + 15;

// Exclusion zone — cars must stay outside before signal
export const EXCL_PAD    = 80;
export const EXCL_LEFT   = PARK_LEFT   - EXCL_PAD;
export const EXCL_RIGHT  = PARK_RIGHT  + EXCL_PAD;
export const EXCL_TOP    = PARK_TOP    - EXCL_PAD;
export const EXCL_BOTTOM = PARK_BOTTOM + EXCL_PAD;

// Car appearance data
export const CAR_COLORS = [
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

export const CAR_EMOJIS = ['🚗','🚕','🚙','🏎️','🚓','🚑','🚒','🛻','🚐','🚌'];
export const CAR_NAMES  = ['Вася','Петя','Коля','Маша','Катя','Женя','Саша','Лёша','Дима','Игорь'];