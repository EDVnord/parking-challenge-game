// Синтетические звуковые эффекты через Web Audio API
// Без внешних файлов — всё генерируется программно

export const MUTE_KEY = 'king_parking_muted';

let _ctx: AudioContext | null = null;
let _masterGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new AudioContext();
      _masterGain = _ctx.createGain();
      _masterGain.gain.value = isMuted() ? 0 : 1;
      _masterGain.connect(_ctx.destination);
    } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function getMaster(): GainNode | null {
  getCtx();
  return _masterGain;
}

export function isMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === '1';
}

// Вызывается при нажатии кнопки mute — мгновенно глушит/восстанавливает звук
export function setAudioMuted(muted: boolean) {
  if (_masterGain) {
    _masterGain.gain.value = muted ? 0 : 1;
  }
}

// --- Удар при столкновении ---
export function playCollisionSound(intensity: number = 1) {
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || !master) return;

  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 28) * Math.min(1, intensity * 0.8);
  }

  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;

  src.buffer = buf;
  gain.gain.value = 0.35;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start();
}

// --- Сигнал ПАРКУЙСЯ! (пронзительный гудок) ---
export function playSignalSound() {
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || !master) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(660, now + 0.12);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
  gain.gain.setValueAtTime(0.18, now + 0.18);
  gain.gain.linearRampToValueAtTime(0, now + 0.28);

  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.3);
}

// --- Парковка (приятный мелодичный звук) ---
export function playParkSound() {
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || !master) return;

  const now = ctx.currentTime;
  const freqs = [523, 659, 784]; // C5 E5 G5

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + i * 0.08;

    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + 0.22);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}

// --- Выбывание (низкий грустный звук) ---
export function playEliminatedSound() {
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || !master) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(80, now + 0.5);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.55);

  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.6);
}

// --- Победа (фанфары) ---
export function playWinSound() {
  const ctx = getCtx();
  const master = getMaster();
  if (!ctx || !master) return;

  const now = ctx.currentTime;
  const melody = [523, 659, 784, 1047];
  const durations = [0.12, 0.12, 0.12, 0.35];
  let t = now;

  melody.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + durations[i]);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + durations[i] + 0.05);
    t += durations[i];
  });
}
