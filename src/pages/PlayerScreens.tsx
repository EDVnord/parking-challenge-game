import { PlayerData, LeaderEntry, Screen, RARITIES, xpForLevel, UPGRADE_COSTS, UPGRADE_BONUS } from './parkingTypes';
import { ProfileCard } from './LoginScreen';

// ──────────────── GARAGE ────────────────
interface GarageScreenProps {
  player: PlayerData;
  setScreen: (s: Screen) => void;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
  notify: (msg: string) => void;
}

export function GarageScreen({ player, setScreen, setPlayer, notify }: GarageScreenProps) {
  const sel = player.cars[player.selectedCar];
  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
        <h2 className="font-russo text-2xl text-yellow-400">🔧 Гараж</h2>
        <div className="ml-auto flex gap-2">
          <div className="coin-badge">🪙 {player.coins.toLocaleString()}</div>
          <div className="gem-badge">💎 {player.gems}</div>
        </div>
      </div>

      <div className={`card-game-solid p-6 flex flex-col items-center gap-4 border-2 ${RARITIES[sel.rarity].border}`}>
        <div className="text-6xl animate-float">{sel.emoji}</div>
        <div className="text-center">
          <div className={`font-russo text-xl ${RARITIES[sel.rarity].color}`}>{sel.name}</div>
          <div className={`text-xs font-nunito font-bold uppercase tracking-wider mt-1 ${RARITIES[sel.rarity].color}`}>{RARITIES[sel.rarity].label}</div>
        </div>

        {/* Прочность */}
        <div className="w-full">
          <div className="flex justify-between text-xs font-nunito font-bold mb-1">
            <span className="text-white/50">❤️ Прочность</span>
            <span className="text-white">{sel.hp} / {sel.maxHp} <span className="text-white/30">(Lv.{sel.hpLevel})</span></span>
          </div>
          <div className="damage-bar mb-2">
            <div className="hp-bar" style={{ width: `${(sel.hp / sel.maxHp) * 100}%`, backgroundColor: '#34C759' }} />
          </div>
          {sel.hpLevel < UPGRADE_COSTS.hp.length ? (
            <button className="w-full bg-green-500/15 border border-green-500/40 hover:bg-green-500/25 rounded-xl px-3 py-2 flex items-center justify-between transition-all"
              onClick={() => {
                const cost = UPGRADE_COSTS.hp[sel.hpLevel];
                if (player.coins >= cost) {
                  setPlayer(prev => ({ ...prev, coins: prev.coins - cost, cars: prev.cars.map((c, i) => {
                    if (i !== prev.selectedCar) return c;
                    const newLevel = c.hpLevel + 1;
                    const newMaxHp = c.baseMaxHp + newLevel * UPGRADE_BONUS.hp;
                    return { ...c, hpLevel: newLevel, maxHp: newMaxHp, hp: Math.min(c.hp, newMaxHp) };
                  }) }));
                  notify(`✅ Прочность улучшена! +${UPGRADE_BONUS.hp} HP`);
                } else notify('❌ Недостаточно монет!');
              }}>
              <span className="font-russo text-green-400 text-xs">⬆ +{UPGRADE_BONUS.hp} HP</span>
              <span className="font-russo text-yellow-400 text-xs">{UPGRADE_COSTS.hp[sel.hpLevel]} 🪙</span>
            </button>
          ) : (
            <div className="text-center text-green-400 text-xs font-russo">✅ Макс. прочность</div>
          )}
        </div>

        {/* Броня */}
        <div className="w-full">
          <div className="flex justify-between text-xs font-nunito font-bold mb-1">
            <span className="text-white/50">🛡️ Броня</span>
            <span className="text-white">{sel.armor.toFixed(1)} <span className="text-white/30">(Lv.{sel.armorLevel})</span></span>
          </div>
          <div className="damage-bar mb-2">
            <div className="hp-bar" style={{ width: `${(sel.armor / 6) * 100}%`, backgroundColor: '#007AFF' }} />
          </div>
          {sel.armorLevel < UPGRADE_COSTS.armor.length ? (
            <button className="w-full bg-blue-500/15 border border-blue-500/40 hover:bg-blue-500/25 rounded-xl px-3 py-2 flex items-center justify-between transition-all"
              onClick={() => {
                const cost = UPGRADE_COSTS.armor[sel.armorLevel];
                if (player.coins >= cost) {
                  setPlayer(prev => ({ ...prev, coins: prev.coins - cost, cars: prev.cars.map((c, i) => {
                    if (i !== prev.selectedCar) return c;
                    const newLevel = c.armorLevel + 1;
                    const newArmor = parseFloat((c.baseArmor + newLevel * UPGRADE_BONUS.armor).toFixed(1));
                    return { ...c, armorLevel: newLevel, armor: newArmor };
                  }) }));
                  notify(`✅ Броня улучшена! +${UPGRADE_BONUS.armor}`);
                } else notify('❌ Недостаточно монет!');
              }}>
              <span className="font-russo text-blue-400 text-xs">⬆ +{UPGRADE_BONUS.armor} брони</span>
              <span className="font-russo text-yellow-400 text-xs">{UPGRADE_COSTS.armor[sel.armorLevel]} 🪙</span>
            </button>
          ) : (
            <div className="text-center text-blue-400 text-xs font-russo">✅ Макс. броня</div>
          )}
        </div>

        {/* Скорость */}
        <div className="w-full">
          <div className="flex justify-between text-xs font-nunito font-bold mb-1">
            <span className="text-white/50">⚡ Скорость</span>
            <span className="text-white">{sel.maxSpeed.toFixed(1)} <span className="text-white/30">(Lv.{sel.speedLevel})</span></span>
          </div>
          <div className="damage-bar mb-2">
            <div className="hp-bar" style={{ width: `${(sel.maxSpeed / 7) * 100}%`, backgroundColor: '#FF6B35' }} />
          </div>
          {sel.speedLevel < UPGRADE_COSTS.speed.length ? (
            <button className="w-full bg-orange-500/15 border border-orange-500/40 hover:bg-orange-500/25 rounded-xl px-3 py-2 flex items-center justify-between transition-all"
              onClick={() => {
                const cost = UPGRADE_COSTS.speed[sel.speedLevel];
                if (player.coins >= cost) {
                  setPlayer(prev => ({ ...prev, coins: prev.coins - cost, cars: prev.cars.map((c, i) => {
                    if (i !== prev.selectedCar) return c;
                    const newLevel = c.speedLevel + 1;
                    const newMaxSpeed = parseFloat((c.baseMaxSpeed + newLevel * UPGRADE_BONUS.speed).toFixed(2));
                    return { ...c, speedLevel: newLevel, maxSpeed: newMaxSpeed, speed: newMaxSpeed };
                  }) }));
                  notify(`✅ Скорость улучшена! +${UPGRADE_BONUS.speed}`);
                } else notify('❌ Недостаточно монет!');
              }}>
              <span className="font-russo text-orange-400 text-xs">⬆ +{UPGRADE_BONUS.speed} скорости</span>
              <span className="font-russo text-yellow-400 text-xs">{UPGRADE_COSTS.speed[sel.speedLevel]} 🪙</span>
            </button>
          ) : (
            <div className="text-center text-orange-400 text-xs font-russo">✅ Макс. скорость</div>
          )}
        </div>

        {/* Ремонт */}
        {sel.hp < sel.maxHp ? (
          <button className="btn-green w-full"
            onClick={() => {
              if (player.coins >= sel.repairCost) {
                setPlayer(prev => ({ ...prev, coins: prev.coins - sel.repairCost, cars: prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: c.maxHp } : c) }));
                notify('✅ Машина отремонтирована!');
              } else notify('❌ Недостаточно монет!');
            }}>
            🔨 Починить — {sel.repairCost} 🪙
          </button>
        ) : (
          <div className="text-green-400 font-russo text-sm">✅ Машина в идеальном состоянии</div>
        )}
      </div>

      <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">Коллекция</h3>
      <div className="grid grid-cols-3 gap-3">
        {player.cars.map((car, idx) => {
          const r = RARITIES[car.rarity];
          const isSel = idx === player.selectedCar;
          return (
            <button key={car.id}
              onClick={() => {
                if (car.owned) { setPlayer(prev => ({ ...prev, selectedCar: idx })); }
                else if (player.coins >= car.price) {
                  setPlayer(prev => ({ ...prev, coins: prev.coins - car.price, cars: prev.cars.map((c, i) => i === idx ? { ...c, owned: true } : c), selectedCar: idx }));
                  notify(`🎉 Куплен ${car.name}!`);
                } else notify('❌ Недостаточно монет!');
              }}
              className={`${r.bg} border-2 ${isSel ? r.border : 'border-white/10'} rounded-2xl p-3 flex flex-col items-center gap-1 transition-all hover:scale-105 ${isSel ? 'scale-105' : ''}`}>
              <div className="text-3xl">{car.emoji}</div>
              <div className={`font-russo text-xs ${r.color}`}>{car.name}</div>
              {!car.owned && <div className="text-yellow-400 font-russo text-xs">🪙 {car.price.toLocaleString()}</div>}
              {car.owned && isSel && <div className="text-green-400 text-xs font-bold">✓</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────── SHOP ────────────────
interface ShopScreenProps {
  player: PlayerData;
  setScreen: (s: Screen) => void;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
  notify: (msg: string) => void;
}

export function ShopScreen({ player, setScreen, setPlayer, notify }: ShopScreenProps) {
  const gemPacks = [
    { gems: 100, price: '79₽', popular: false },
    { gems: 300, price: '199₽', bonus: '+50 бонус', popular: true },
    { gems: 700, price: '399₽', bonus: '+150 бонус', popular: false },
    { gems: 1500, price: '799₽', bonus: '+500 бонус', popular: false },
  ];
  const coinPacks = [
    { coins: 1000, gems: 10 }, { coins: 3000, gems: 25 },
    { coins: 7000, gems: 50 }, { coins: 20000, gems: 120 },
  ];
  const upgrades: { name: string; desc: string; price: number; icon: string; key: keyof typeof player.upgrades; tag?: string }[] = [
    { name: 'Нитро-ускорение', desc: 'Зажми Space при сигнале — рывок +40% скорости', price: 150, icon: '⚡', key: 'nitro' },
    { name: 'GPS-радар', desc: 'Золотая стрелка к ближайшему свободному месту', price: 200, icon: '📡', key: 'gps' },
    { name: 'Усиленный бампер', desc: '-30% урона при столкновениях', price: 250, icon: '🛡️', key: 'bumper' },
    { name: 'Авто-ремонт', desc: 'Восстанавливает +15 HP после каждого раунда', price: 300, icon: '🔧', key: 'autoRepair' },
    { name: 'Магнит парковки', desc: 'Автоматически притягивает к месту в радиусе 50px', price: 400, icon: '🧲', key: 'magnet', tag: 'НОВИНКА' },
    { name: 'Турбо-старт', desc: 'После сигнала мгновенный разгон x2 на 2 сек', price: 350, icon: '🚀', key: 'turbo', tag: 'НОВИНКА' },
    { name: 'Силовое поле', desc: 'Первый удар за раунд — без урона', price: 500, icon: '🔵', key: 'shield', tag: 'ХИТ' },
  ];

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
        <h2 className="font-russo text-2xl text-yellow-400">🛒 Магазин</h2>
      </div>
      <div className="flex gap-3">
        <div className="coin-badge flex-1 justify-center py-2 text-sm">🪙 {player.coins.toLocaleString()}</div>
        <div className="gem-badge flex-1 justify-center py-2 text-sm">💎 {player.gems}</div>
      </div>

      <div>
        <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider mb-3">💎 Кристаллы (реальные деньги)</h3>
        <div className="grid grid-cols-2 gap-3">
          {gemPacks.map((pack, i) => (
            <button key={i} onClick={() => notify('💳 Оплата скоро будет доступна!')}
              className={`card-game-solid p-4 flex flex-col items-center gap-2 border-2 hover:scale-105 transition-all ${pack.popular ? 'border-yellow-500/60' : 'border-white/10'}`}>
              {pack.popular && <div className="bg-yellow-400 text-gray-900 font-russo text-xs px-2 py-0.5 rounded-full -mt-7 mb-1">ХИТ</div>}
              <div className="text-3xl">💎</div>
              <div className="font-russo text-white text-lg">{pack.gems}</div>
              {'bonus' in pack && pack.bonus && <div className="text-green-400 text-xs font-bold">{pack.bonus}</div>}
              <div className="btn-yellow text-sm py-1.5 px-4 w-full text-center rounded-xl">{pack.price}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider mb-3">🪙 Монеты за кристаллы</h3>
        <div className="grid grid-cols-2 gap-3">
          {coinPacks.map((pack, i) => (
            <button key={i} onClick={() => {
              if (player.gems >= pack.gems) {
                setPlayer(prev => ({ ...prev, gems: prev.gems - pack.gems, coins: prev.coins + pack.coins }));
                notify(`✅ Получено ${pack.coins.toLocaleString()} монет!`);
              } else notify('❌ Недостаточно кристаллов!');
            }}
              className="card-game p-3 flex flex-col items-center gap-1 border border-white/10 hover:border-yellow-500/40 transition-all rounded-2xl">
              <div className="font-russo text-yellow-400">{pack.coins.toLocaleString()} 🪙</div>
              <div className="text-white/30 text-xs">за {pack.gems} 💎</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider mb-3">⚡ Улучшения машины</h3>
        <div className="space-y-2">
          {upgrades.map((upg, i) => {
            const owned = player.upgrades[upg.key];
            return (
              <div key={i} className={`card-game p-4 flex items-center gap-3 relative overflow-hidden ${owned ? 'border border-green-500/30 bg-green-500/5' : ''}`}>
                {upg.tag && !owned && (
                  <div className="absolute top-1 right-1 bg-orange-500 text-white font-russo text-[9px] px-1.5 py-0.5 rounded-full">{upg.tag}</div>
                )}
                <div className="text-3xl">{upg.icon}</div>
                <div className="flex-1">
                  <div className="font-russo text-white text-sm">{upg.name}</div>
                  <div className="text-white/30 text-xs font-nunito">{upg.desc}</div>
                </div>
                {owned ? (
                  <div className="text-green-400 font-russo text-sm">✅ Куплено</div>
                ) : (
                  <button className="btn-orange text-sm py-2 px-3"
                    onClick={() => {
                      if (player.coins >= upg.price) {
                        setPlayer(prev => ({
                          ...prev,
                          coins: prev.coins - upg.price,
                          upgrades: { ...prev.upgrades, [upg.key]: true },
                        }));
                        notify(`✅ ${upg.name} куплено!`);
                      } else notify('❌ Недостаточно монет!');
                    }}>
                    {upg.price} 🪙
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ──────────────── PROFILE ────────────────
interface ProfileScreenProps {
  player: PlayerData;
  setScreen: (s: Screen) => void;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
  notify: (msg: string) => void;
}

export function ProfileScreen({ player, setScreen, setPlayer, notify }: ProfileScreenProps) {
  const xpInLevel = player.xp % xpForLevel(player.level);
  const xpNeeded = xpForLevel(player.level);
  const achievements = [
    { emoji: '🎮', title: 'Первая игра', desc: 'Сыграй 1 игру', done: player.gamesPlayed >= 1 },
    { emoji: '🏆', title: 'Первая победа', desc: 'Выиграй 1 игру', done: player.wins >= 1 },
    { emoji: '🚗', title: 'Коллекционер', desc: 'Купи 3 машины', done: player.cars.filter(c => c.owned).length >= 3 },
    { emoji: '💰', title: 'Богач', desc: 'Накопи 5000 монет', done: player.coins >= 5000 },
    { emoji: '⚡', title: 'Стремительный', desc: 'Займи место первым', done: false },
    { emoji: '💀', title: 'Выживший', desc: 'Дойди до финального раунда', done: false },
  ];

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
        <h2 className="font-russo text-2xl text-yellow-400">👤 Профиль</h2>
      </div>

      <ProfileCard
        player={player}
        xpInLevel={xpInLevel}
        xpNeeded={xpNeeded}
        onEmojiChange={em => setPlayer(prev => ({ ...prev, emoji: em }))}
        onNameChange={name => { setPlayer(prev => ({ ...prev, name, nicknameChanges: (prev.nicknameChanges ?? 0) + 1 })); notify('✅ Имя изменено!'); }}
      />

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: '🎮', val: player.gamesPlayed, label: 'Игр сыграно' },
          { icon: '🏆', val: player.wins, label: 'Побед' },
          { icon: '🥇', val: player.bestPosition === 99 ? '—' : `#${player.bestPosition}`, label: 'Лучшее место' },
          { icon: '🪙', val: player.coins.toLocaleString(), label: 'Монет' },
        ].map(s => (
          <div key={s.label} className="card-game p-4 flex flex-col gap-1">
            <div className="text-2xl">{s.icon}</div>
            <div className="font-russo text-white text-lg">{s.val}</div>
            <div className="text-white/30 text-xs font-nunito">{s.label}</div>
          </div>
        ))}
      </div>

      <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">🏅 Достижения</h3>
      <div className="space-y-2">
        {achievements.map((ach, i) => (
          <div key={i} className={`card-game p-4 flex items-center gap-4 ${!ach.done ? 'opacity-40' : ''}`}>
            <div className="text-3xl">{ach.emoji}</div>
            <div className="flex-1">
              <div className={`font-russo text-sm ${ach.done ? 'text-yellow-400' : 'text-white/60'}`}>{ach.title}</div>
              <div className="text-white/30 text-xs font-nunito">{ach.desc}</div>
            </div>
            {ach.done && <div className="text-green-400 text-xl">✅</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────── LEADERBOARD ────────────────
interface LeaderboardScreenProps {
  player: PlayerData;
  onlineLeaders: LeaderEntry[];
  setScreen: (s: Screen) => void;
}

export function LeaderboardScreen({ player, onlineLeaders, setScreen }: LeaderboardScreenProps) {
  const fullList = onlineLeaders.length > 0 ? onlineLeaders : [
    { rank: 1, name: player.name || 'Ты', emoji: player.emoji, wins: player.wins, xp: player.xp, gamesPlayed: player.gamesPlayed }
  ];
  const rankColors = ['#FFD600', '#C0C0C0', '#CD7F32'];
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
        <h2 className="font-russo text-2xl text-yellow-400">🏆 Топ игроков</h2>
      </div>

      <div className="flex items-end justify-center gap-4 py-4">
        {([fullList[1], fullList[0], fullList[2]] as typeof fullList).filter(Boolean).map((p, podiumIdx) => {
          const podiumRanks = [2, 1, 3];
          const heights = [80, 110, 60];
          const rank = podiumRanks[podiumIdx];
          return (
            <div key={p.rank} className="flex flex-col items-center gap-2">
              <div className="text-3xl">{p.emoji}</div>
              <div className="font-russo text-xs text-white text-center max-w-16 truncate">{p.name}</div>
              <div className="w-20 rounded-t-xl flex items-start justify-center pt-2"
                style={{ height: `${heights[podiumIdx]}px`, background: `${rankColors[rank - 1]}22`, border: `2px solid ${rankColors[rank - 1]}55` }}>
                <span className="font-russo text-2xl" style={{ color: rankColors[rank - 1] }}>#{rank}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {fullList.map(entry => {
          const isMe = entry.name === player.name;
          return (
            <div key={entry.rank} className={`card-game p-4 flex items-center gap-4 ${isMe ? 'border border-yellow-500/40 bg-yellow-500/5' : ''}`}>
              <div className="font-russo text-xl w-8 text-center" style={{ color: entry.rank <= 3 ? rankColors[entry.rank - 1] : 'rgba(255,255,255,0.3)' }}>
                {entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`}
              </div>
              <div className="text-2xl">{entry.emoji}</div>
              <div className="flex-1">
                <div className={`font-russo text-sm ${isMe ? 'text-yellow-400' : 'text-white'}`}>{entry.name}{isMe && ' (Ты)'}</div>
                <div className="text-white/30 text-xs font-nunito">{entry.xp.toLocaleString()} XP</div>
              </div>
              <div className="text-right">
                <div className="font-russo text-yellow-400">{entry.wins}</div>
                <div className="text-white/30 text-xs font-nunito">побед</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}