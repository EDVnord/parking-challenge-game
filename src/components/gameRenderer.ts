import {
  Car, GameState, ParkingSpot,
  CANVAS_W, CANVAS_H, CENTER_X, CENTER_Y,
  SPOT_W, SPOT_H,
  PARK_LEFT, PARK_RIGHT, PARK_TOP, PARK_BOTTOM,
  EXCL_LEFT, EXCL_RIGHT, EXCL_TOP, EXCL_BOTTOM,
} from './gameTypes';

export function drawCar(ctx: CanvasRenderingContext2D, car: Car, time: number) {
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

  // Exclusion zone outer boundary (dashed red halo) when closed
  if (!signalActive) {
    ctx.strokeStyle = 'rgba(255,45,85,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.roundRect(EXCL_LEFT, EXCL_TOP, EXCL_RIGHT - EXCL_LEFT, EXCL_BOTTOM - EXCL_TOP, 24);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,45,85,0.55)';
    ctx.font = 'bold 11px Russo One, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚫 ВЪЕЗД ЗАКРЫТ', CENTER_X, PARK_TOP - 6);
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

export function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
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
  const activeSpots = state.spots.length;
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
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px Nunito, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('← → Повернуть   ↑ ↓ Газ/Тормоз', CANVAS_W - 15, CANVAS_H - 10);
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
