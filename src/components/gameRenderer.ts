import {
  Car, GameState, ParkingSpot,
  CANVAS_W, CANVAS_H, CENTER_X, CENTER_Y,
  SPOT_W, SPOT_H,
  PARK_LEFT, PARK_RIGHT, PARK_TOP, PARK_BOTTOM,
  EXCL_LEFT, EXCL_RIGHT, EXCL_TOP, EXCL_BOTTOM, EXCL_RADIUS,
  EXCL_RX, EXCL_RY,
} from './gameTypes';

export function drawCar(ctx: CanvasRenderingContext2D, car: Car, time: number) {
  if (car.eliminated) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  const healthRatio = car.hp / car.maxHp;
  const carW = 20;
  const carH = 34;

  // Player glow (pulsing halo — drawn before car body so it's behind)
  if (car.isPlayer) {
    const pulse = 0.55 + 0.45 * Math.sin(time * 3.5);
    const glowRadius = 28 + 6 * pulse;
    const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, glowRadius);
    grad.addColorStop(0, `rgba(255,214,0,${0.28 * pulse})`);
    grad.addColorStop(1, 'rgba(255,214,0,0)');
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

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

  // (player arrow drawn after restore, below)

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

  // Player arrow indicator — drawn in world space (never rotates)
  if (car.isPlayer) {
    const bounce = Math.sin(time * 4) * 2.5;
    const ax = car.x;
    const ay = car.y - 46 + bounce;
    const aw = 10;
    const ah = 8;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#FFD600';
    ctx.strokeStyle = '#AA7700';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay + ah);
    ctx.lineTo(ax - aw, ay);
    ctx.lineTo(ax - aw / 2.5, ay);
    ctx.lineTo(ax - aw / 2.5, ay - ah * 0.8);
    ctx.lineTo(ax + aw / 2.5, ay - ah * 0.8);
    ctx.lineTo(ax + aw / 2.5, ay);
    ctx.lineTo(ax + aw, ay);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Nickname — drawn AFTER restore so it never rotates with the car
  const nick = car.name.length > 9 ? car.name.slice(0, 8) + '…' : car.name;
  const nickColor = car.isPlayer ? '#FFD600' : (car.isBot ? 'rgba(255,255,255,0.45)' : '#7DDFFF');
  ctx.save();
  ctx.font = `bold ${car.isPlayer ? 12 : 9}px Nunito, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = nickColor;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 6;
  ctx.fillText(nick, car.x, car.y - 58 + Math.sin(time * 4) * 2.5);
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawParkingArea(ctx: CanvasRenderingContext2D, spots: ParkingSpot[], signalActive: boolean) {
  // Parking area background
  ctx.save();
  ctx.fillStyle = '#252535';
  // Border: red stripes when closed, yellow dashed when open
  if (!signalActive) {
    ctx.strokeStyle = 'rgba(255,45,85,0.8)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 6]);
  } else {
    ctx.strokeStyle = '#FFD600';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
  }
  ctx.beginPath();
  ctx.roundRect(PARK_LEFT, PARK_TOP, PARK_RIGHT - PARK_LEFT, PARK_BOTTOM - PARK_TOP, 16);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  // Exclusion zone outer boundary — ellipse dashed halo when closed
  if (!signalActive) {
    ctx.strokeStyle = 'rgba(255,45,85,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.ellipse(CENTER_X, CENTER_Y, EXCL_RX, EXCL_RY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,45,85,0.55)';
    ctx.font = 'bold 11px Russo One, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚫 ВЪЕЗД ЗАКРЫТ', CENTER_X, CENTER_Y - EXCL_RY - 6);
  }

  ctx.restore();

  // Spots
  spots.forEach((spot, i) => {
    ctx.save();
    ctx.translate(spot.x, spot.y);

    if (spot.occupied) {
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
    ctx.fillStyle = spot.occupied ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 10px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`P${i + 1}`, 0, SPOT_H / 2 + 12);

    ctx.restore();
  });
}

export function drawAsphalt(ctx: CanvasRenderingContext2D, driftMarks: GameState['driftMarks']) {
  // Wet dark asphalt base
  ctx.fillStyle = '#141420';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Wet reflection — radial gradient puddles
  ctx.save();
  const puddles = [
    { x: 180, y: 120, rx: 160, ry: 70 },
    { x: 620, y: 480, rx: 140, ry: 60 },
    { x: 650, y: 140, rx: 120, ry: 55 },
    { x: 130, y: 450, rx: 130, ry: 65 },
    { x: 400, y: 520, rx: 180, ry: 40 },
  ];
  puddles.forEach(p => {
    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx);
    grd.addColorStop(0, 'rgba(80,100,160,0.18)');
    grd.addColorStop(0.6, 'rgba(50,70,120,0.09)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // Subtle asphalt grain — tiny scattered dots
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < 600; i++) {
    const gx = (i * 137.508) % CANVAS_W;
    const gy = (i * 93.271) % CANVAS_H;
    ctx.fillRect(gx, gy, 1, 1);
  }
  ctx.restore();

  // Wet sheen lines — horizontal light streaks
  ctx.save();
  for (let y = 30; y < CANVAS_H; y += 55) {
    const alpha = 0.02 + Math.sin(y * 0.15) * 0.01;
    ctx.fillStyle = `rgba(100,130,200,${alpha})`;
    ctx.fillRect(0, y, CANVAS_W, 1.5);
  }
  ctx.restore();

  // Drift / tyre marks
  driftMarks.forEach(mark => {
    ctx.save();
    ctx.translate(mark.x, mark.y);
    ctx.rotate(mark.angle);
    // Two tyre tracks side by side
    ctx.fillStyle = `rgba(10,5,0,${mark.opacity * 0.55})`;
    ctx.beginPath();
    ctx.roundRect(-5, -18, 3, 36, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(2, -18, 3, 36, 1);
    ctx.fill();
    ctx.restore();
  });
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: GameState['particles']) {
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

export function drawSignal(ctx: CanvasRenderingContext2D, time: number) {
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

export function drawRoundEnd(ctx: CanvasRenderingContext2D, eliminated: Car | null, round: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (round === 0 && !eliminated) {
    ctx.fillStyle = '#34C759';
    ctx.font = 'bold 38px Russo One, sans-serif';
    ctx.shadowColor = '#34C759';
    ctx.shadowBlur = 20;
    ctx.fillText('🏁 ТРЕНИРОВКА ЗАВЕРШЕНА!', CENTER_X, CENTER_Y - 30);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '20px Nunito, sans-serif';
    ctx.fillText('Теперь начинается настоящий бой', CENTER_X, CENTER_Y + 20);
  } else if (eliminated) {
    ctx.fillStyle = '#FF2D55';
    ctx.font = 'bold 42px Russo One, sans-serif';
    ctx.shadowColor = '#FF2D55';
    ctx.shadowBlur = 20;
    ctx.fillText(`${eliminated.emoji} ${eliminated.name} вылетает!`, CENTER_X, CENTER_Y - 30);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '20px Nunito, sans-serif';
    ctx.fillText(`Раунд ${round} завершён`, CENTER_X, CENTER_Y + 20);
  }

  ctx.restore();
}

export function drawWinner(ctx: CanvasRenderingContext2D, player: Car | null, time: number) {
  ctx.save();

  // Тёмный фон с градиентом
  const grad = ctx.createRadialGradient(CENTER_X, CENTER_Y, 0, CENTER_X, CENTER_Y, 420);
  grad.addColorStop(0, 'rgba(30,20,0,0.92)');
  grad.addColorStop(1, 'rgba(0,0,0,0.97)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Лучи света из центра
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + time * 0.3;
    const rayGrad = ctx.createLinearGradient(CENTER_X, CENTER_Y, CENTER_X + Math.cos(angle) * 380, CENTER_Y + Math.sin(angle) * 380);
    rayGrad.addColorStop(0, 'rgba(255,214,0,0.10)');
    rayGrad.addColorStop(1, 'rgba(255,214,0,0)');
    ctx.beginPath();
    ctx.moveTo(CENTER_X, CENTER_Y);
    ctx.lineTo(CENTER_X + Math.cos(angle - 0.06) * 380, CENTER_Y + Math.sin(angle - 0.06) * 380);
    ctx.lineTo(CENTER_X + Math.cos(angle + 0.06) * 380, CENTER_Y + Math.sin(angle + 0.06) * 380);
    ctx.closePath();
    ctx.fillStyle = rayGrad;
    ctx.fill();
  }

  // Пульсирующая корона
  const crownScale = 1 + Math.sin(time * 5) * 0.12;
  const crownY = CENTER_Y - 110 + Math.sin(time * 2) * 6;
  ctx.save();
  ctx.translate(CENTER_X, crownY);
  ctx.scale(crownScale, crownScale);
  ctx.font = '90px Arial';
  ctx.fillText('👑', 0, 0);
  ctx.restore();

  // Заголовок ПОБЕДА!
  const titleScale = 1 + Math.sin(time * 4 + 1) * 0.04;
  ctx.save();
  ctx.translate(CENTER_X, CENTER_Y - 15);
  ctx.scale(titleScale, titleScale);
  ctx.fillStyle = '#FFD600';
  ctx.font = 'bold 62px Russo One, sans-serif';
  ctx.shadowColor = '#FFD600';
  ctx.shadowBlur = 60;
  ctx.fillText('ПОБЕДА!', 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Имя победителя
  if (player) {
    // Подложка
    ctx.fillStyle = 'rgba(255,214,0,0.12)';
    ctx.beginPath();
    ctx.roundRect(CENTER_X - 220, CENTER_Y + 35, 440, 50, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Russo One, sans-serif';
    ctx.shadowColor = '#FFD600';
    ctx.shadowBlur = 15;
    ctx.fillText(`${player.emoji}  ${player.name}`, CENTER_X, CENTER_Y + 60);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,214,0,0.7)';
    ctx.font = '16px Nunito, sans-serif';
    ctx.fillText('КОРОЛЬ ПАРКОВКИ', CENTER_X, CENTER_Y + 90);
  }

  // Вращающиеся звёзды
  const starColors = ['#FFD600','#FF6B35','#AF52DE','#34C759','#FF2D55','#5AC8FA'];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + time * 1.2;
    const r = 155 + Math.sin(time * 2.5 + i) * 22;
    const sx = CENTER_X + Math.cos(angle) * r;
    const sy = CENTER_Y - 15 + Math.sin(angle) * r * 0.55;
    const starScale = 0.8 + Math.sin(time * 3 + i * 1.3) * 0.3;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(starScale, starScale);
    ctx.fillStyle = starColors[i % starColors.length];
    ctx.font = '20px Arial';
    ctx.fillText('⭐', 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

export function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const player = state.cars.find(c => c.isPlayer);
  if (!player) return;

  // Round info
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 160, 70, 12);
  ctx.fill();

  ctx.fillStyle = state.round === 0 ? '#34C759' : state.isFinalRound ? '#FF6B35' : '#FFD600';
  ctx.font = 'bold 14px Russo One, sans-serif';
  ctx.textAlign = 'left';
  const roundLabel = state.round === 0 ? 'ТРЕНИРОВКА' : state.isFinalRound ? '🏆 ФИНАЛ!' : `РАУНД ${state.round} / ${state.maxRounds}`;
  ctx.fillText(roundLabel, 20, 32);

  const activeCars = state.cars.filter(c => !c.eliminated).length;
  const activeSpots = state.spots.length;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px Nunito, sans-serif';
  ctx.fillText(`🚗 Машин: ${activeCars}`, 20, 52);
  ctx.fillText(`🅿️ Мест: ${activeSpots}`, 20, 68);
  ctx.restore();

  // Список живых игроков справа
  const aliveCars = state.cars.filter(c => !c.eliminated);
  const listW = 150;
  const listH = Math.min(aliveCars.length, 10) * 18 + 24;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(CANVAS_W - listW - 10, 10, listW, listH, 10);
  ctx.fill();
  ctx.fillStyle = '#FFD600';
  ctx.font = 'bold 11px Russo One, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ЖИВЫЕ', CANVAS_W - listW, 24);
  aliveCars.slice(0, 10).forEach((c, i) => {
    const yy = 40 + i * 18;
    const isMe = c.isPlayer;
    ctx.fillStyle = isMe ? '#FFD600' : c.isBot ? 'rgba(255,255,255,0.4)' : '#7DDFFF';
    ctx.font = `${isMe ? 'bold ' : ''}10px Nunito, sans-serif`;
    const hpPct = Math.round(c.hp / c.maxHp * 100);
    ctx.fillText(`${c.emoji} ${c.name.slice(0,8)} ${hpPct}%`, CANVAS_W - listW, yy);
  });
  ctx.restore();

  // Timer (during driving phase)
  if (state.phase === 'driving') {
    ctx.save();
    const seconds = Math.ceil(state.timer);
    const pulse = seconds <= 2 ? 0.8 + Math.sin(time * 10) * 0.2 : 1;
    ctx.translate(CENTER_X, 35);
    ctx.scale(pulse, pulse);
    const isUrgent = seconds <= 2;
    ctx.fillStyle = state.round === 0 ? '#34C759' : state.isFinalRound ? (isUrgent ? '#FF2D55' : '#FF6B35') : (isUrgent ? '#FF2D55' : '#FFD600');
    ctx.font = 'bold 22px Russo One, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.round === 0 ? `🟢 ${seconds}с` : state.isFinalRound ? `⚡ ${seconds}с` : `⏱ ${seconds}с`, 0, 0);
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

  // Active upgrades icons
  const activeUpgrades = [];
  if (state.playerBumper) activeUpgrades.push('🛡️');
  if (state.playerAutoRepair) activeUpgrades.push('🔧');
  if (activeUpgrades.length > 0) {
    ctx.save();
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    activeUpgrades.forEach((icon, i) => {
      ctx.fillText(icon, 200 + i * 28, CANVAS_H - 22);
    });
    ctx.restore();
  }

  // Controls hint
  if (state.signal && state.phase === 'signal' && !player.parked) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px Nunito, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('← → ↑ ↓ движение  |  Space = нитро', CANVAS_W - 15, CANVAS_H - 10);
    ctx.restore();
  } else if (state.phase === 'driving') {
    // Пульсирующая подсказка "Жди сигнала"
    const pulse = 0.55 + Math.sin(time * 2.5) * 0.25;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#FFD600';
    ctx.font = 'bold 13px Russo One, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FFD600';
    ctx.shadowBlur = 10;
    ctx.fillText('⏳ Жди сигнала — машина едет сама, урон не наносится', CENTER_X, CANVAS_H - 12);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

export function drawGpsOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number
) {
  const player = state.cars.find(c => c.isPlayer && !c.eliminated && !c.parked);
  if (!player) return;
  const freeSpots = state.spots.filter(s => !s.occupied);
  if (freeSpots.length === 0) return;

  const nearest = freeSpots.reduce((best, s) =>
    Math.hypot(s.x - player.x, s.y - player.y) < Math.hypot(best.x - player.x, best.y - player.y) ? s : best
  );

  ctx.save();
  ctx.strokeStyle = '#FFD600';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(nearest.x, nearest.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#FFD600';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5 + Math.sin(time * 8) * 0.3;
  ctx.beginPath();
  ctx.arc(nearest.x, nearest.y, 22 + Math.sin(time * 6) * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}