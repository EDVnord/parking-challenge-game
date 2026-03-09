import React, { useState, useEffect } from 'react';
import { PlayerData, Screen, GemPackInfo, buyGems, isYandexGamesEnv, restoreGemPurchases, getYaCatalog } from './parkingTypes';
import { CoinIcon, GemIcon } from '@/components/ui/CoinIcon';
import { t } from '@/i18n';

interface ShopScreenProps {
  player: PlayerData;
  setScreen: (s: Screen) => void;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
  notify: (msg: string) => void;
}

type ShopTab = 'upgrades' | 'consumables' | 'coins' | 'gems';

const UPGRADE_DURATION_MS = 24 * 60 * 60 * 1000;

function formatTimer(msLeft: number): string {
  if (msLeft <= 0) return '00:00:00';
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  const s = Math.floor((msLeft % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ShopScreen({ player, setScreen, setPlayer, notify }: ShopScreenProps) {
  const [tab, setTab] = useState<ShopTab>('upgrades');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const expiry = player.upgradeExpiry ?? {};
    const upgrades = player.upgrades;
    let changed = false;
    const newUpgrades = { ...upgrades };
    const newExpiry = { ...expiry };

    (Object.keys(expiry) as (keyof typeof expiry)[]).forEach(key => {
      const exp = expiry[key];
      if (exp && exp < now && newUpgrades[key]) {
        newUpgrades[key] = false;
        delete newExpiry[key];
        changed = true;
      }
    });

    if (changed) {
      setPlayer(prev => ({ ...prev, upgrades: newUpgrades, upgradeExpiry: newExpiry }));
    }
  }, [now, player.upgradeExpiry, player.upgrades, setPlayer]);

  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const inYa = isYandexGamesEnv();
  const [sdkCatalog, setSdkCatalog] = useState<Record<string, GemPackInfo>>({});

  useEffect(() => {
    if (!inYa) return;
    getYaCatalog().then(catalog => {
      const map: Record<string, GemPackInfo> = {};
      catalog.forEach(p => { map[p.id] = p; });
      setSdkCatalog(map);
    }).catch(() => {});
  }, [inYa]);

  const handleRestore = async () => {
    if (!inYa) { notify(t('restore_ya_only')); return; }
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await restoreGemPurchases();
      if (result.restored > 0) {
        setPlayer(prev => ({ ...prev, gems: prev.gems + result.restored }));
        notify(`${t('notify_restored')} ${result.restored} 💎!`);
      } else {
        notify(t('notify_no_pending'));
      }
    } finally {
      setRestoring(false);
    }
  };

  // productId должен совпадать с ID продукта в кабинете разработчика Яндекс Игр
  const gemPacks: { id: string; gems: number; price: string; currencyImg?: string; bonus?: string; popular?: boolean }[] = [
    { id: 'gems_100',  gems: 100,  price: sdkCatalog['gems_100']?.price  ?? '—', currencyImg: sdkCatalog['gems_100']?.currencyImageUrl },
    { id: 'gems_300',  gems: 300,  price: sdkCatalog['gems_300']?.price  ?? '—', currencyImg: sdkCatalog['gems_300']?.currencyImageUrl, bonus: `+50 ${t('bonus_label')}`,  popular: true },
    { id: 'gems_700',  gems: 700,  price: sdkCatalog['gems_700']?.price  ?? '—', currencyImg: sdkCatalog['gems_700']?.currencyImageUrl, bonus: `+150 ${t('bonus_label')}` },
    { id: 'gems_1500', gems: 1500, price: sdkCatalog['gems_1500']?.price ?? '—', currencyImg: sdkCatalog['gems_1500']?.currencyImageUrl, bonus: `+500 ${t('bonus_label')}` },
  ];

  const handleBuyGems = async (pack: typeof gemPacks[0]) => {
    if (!inYa) { notify(t('buy_ya_only')); return; }
    if (buyingId) return;
    setBuyingId(pack.id);
    try {
      const result = await buyGems(pack.id);
      if (result.ok) {
        setPlayer(prev => ({ ...prev, gems: prev.gems + pack.gems }));
        notify(`${t('notify_gems_recv')} ${pack.gems} 💎!`);
      } else if (result.error !== 'cancelled') {
        notify(t('payment_error'));
      }
    } finally {
      setBuyingId(null);
    }
  };

  const coinPacks = [
    { coins: 300,  gems: 10  },
    { coins: 800,  gems: 25  },
    { coins: 2000, gems: 60  },
    { coins: 5000, gems: 150 },
  ];

  const upgrades: { name: string; desc: string; price: number; icon: string; key: keyof typeof player.upgrades; tag?: string }[] = [
    { name: t('upg_nitro'),      desc: t('upg_nitro_desc'),      price: 500,  icon: '⚡', key: 'nitro' },
    { name: t('upg_gps'),        desc: t('upg_gps_desc'),        price: 600,  icon: '📡', key: 'gps' },
    { name: t('upg_bumper'),     desc: t('upg_bumper_desc'),     price: 900,  icon: '🛡️', key: 'bumper' },
    { name: t('upg_autorepair'), desc: t('upg_autorepair_desc'), price: 1000, icon: '🔧', key: 'autoRepair' },
    { name: t('upg_magnet'),     desc: t('upg_magnet_desc'),     price: 1200, icon: '🧲', key: 'magnet', tag: t('tag_hit') },
    { name: t('upg_turbo'),      desc: t('upg_turbo_desc'),      price: 1200, icon: '🚀', key: 'turbo' },
    { name: t('upg_shield'),     desc: t('upg_shield_desc'),     price: 1800, icon: '🔵', key: 'shield', tag: t('tag_top') },
  ];

  const handleBuyUpgrade = (upg: typeof upgrades[0]) => {
    if (player.coins < upg.price) { notify(t('not_enough_coins')); return; }
    const expiresAt = Date.now() + UPGRADE_DURATION_MS;
    setPlayer(prev => ({
      ...prev,
      coins: prev.coins - upg.price,
      upgrades: { ...prev.upgrades, [upg.key]: true },
      upgradeExpiry: { ...(prev.upgradeExpiry ?? {}), [upg.key]: expiresAt },
    }));
    notify(`✅ ${upg.name} ${t('notify_upg_bought')}`);
  };

  const consumables: { id: string; name: string; desc: string; icon: string; price: number; action: () => void }[] = [
    {
      id: 'repair_small',
      name: t('cons_repair_s'),
      desc: t('cons_repair_s_desc'),
      icon: '🔧',
      price: 150,
      action: () => {
        const car = player.cars[player.selectedCar];
        if (!car) return;
        if (car.hp >= car.maxHp) { notify(t('car_full_health')); return; }
        setPlayer(prev => {
          const cars = prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: Math.min(c.maxHp, c.hp + 30) } : c);
          return { ...prev, coins: prev.coins - 150, cars };
        });
        notify(t('notify_repair_s'));
      },
    },
    {
      id: 'repair_full',
      name: t('cons_repair_xl'),
      desc: t('cons_repair_xl_desc'),
      icon: '🛠️',
      price: 500,
      action: () => {
        const car = player.cars[player.selectedCar];
        if (!car) return;
        if (car.hp >= car.maxHp) { notify(t('car_full_health')); return; }
        setPlayer(prev => {
          const cars = prev.cars.map((c, i) => i === prev.selectedCar ? { ...c, hp: c.maxHp } : c);
          return { ...prev, coins: prev.coins - 500, cars };
        });
        notify(t('notify_repair_xl'));
      },
    },
    {
      id: 'coin_boost',
      name: t('cons_coinboost'),
      desc: t('cons_coinboost_desc'),
      icon: '💰',
      price: 800,
      action: () => {
        const current = player.coinBoostSessions ?? 0;
        setPlayer(prev => ({ ...prev, coins: prev.coins - 800, coinBoostSessions: (prev.coinBoostSessions ?? 0) + 3 }));
        notify(`${t('notify_coinboost')} (${current + 3} ${t('games_suffix')})`);
      },
    },
    {
      id: 'extra_life',
      name: t('cons_extralife'),
      desc: t('cons_extralife_desc'),
      icon: '❤️',
      price: 1200,
      action: () => {
        if ((player.extraLives ?? 0) >= 3) { notify(t('max_lives')); return; }
        setPlayer(prev => ({ ...prev, coins: prev.coins - 1200, extraLives: (prev.extraLives ?? 0) + 1 }));
        notify(t('notify_extralife'));
      },
    },
    {
      id: 'xp_boost',
      name: t('cons_xpboost'),
      desc: t('cons_xpboost_desc'),
      icon: '⭐',
      price: 600,
      action: () => {
        setPlayer(prev => ({ ...prev, coins: prev.coins - 600, xpBoostGames: (prev.xpBoostGames ?? 0) + 5 }));
        notify(t('notify_xpboost'));
      },
    },
  ];

  const tabs: { id: ShopTab; label: string; icon: React.ReactNode }[] = [
    { id: 'upgrades',    label: t('tab_upgrades'),    icon: '⚡' },
    { id: 'consumables', label: t('tab_consumables'), icon: '🛒' },
    { id: 'coins',       label: t('tab_coins'),       icon: <CoinIcon size={16} /> },
    { id: 'gems',        label: t('tab_gems'),        icon: <GemIcon size={16} /> },
  ];

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
        <h2 className="font-russo text-2xl text-yellow-400">{t('shop_title')}</h2>
      </div>

      <div className="flex gap-3">
        <div className="coin-badge flex-1 justify-center py-2 text-sm"><CoinIcon size={14} /> {player.coins.toLocaleString()}</div>
        <div className="gem-badge flex-1 justify-center py-2 text-sm"><GemIcon size={14} /> {player.gems}</div>
      </div>

      <div className="flex gap-1 bg-white/5 rounded-2xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-russo text-sm transition-all ${
              tab === t.id
                ? 'bg-yellow-400 text-gray-900'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span className="flex items-center">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'upgrades' && (
        <div className="space-y-2">
          <p className="text-white/30 text-xs font-nunito text-center">{t('upgrade_duration')}</p>
          {upgrades.map((upg, i) => {
            const owned = player.upgrades[upg.key];
            const expiry = player.upgradeExpiry?.[upg.key];
            const msLeft = expiry ? expiry - now : 0;
            const isActive = owned && msLeft > 0;

            return (
              <div key={i} className={`card-game p-4 flex items-center gap-3 relative overflow-hidden ${isActive ? 'border border-green-500/40 bg-green-500/5' : ''}`}>
                {upg.tag && !isActive && (
                  <div className="absolute top-1 right-1 bg-orange-500 text-white font-russo text-[9px] px-1.5 py-0.5 rounded-full">{upg.tag}</div>
                )}
                <div className="text-3xl">{upg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-russo text-white text-sm">{upg.name}</div>
                  <div className="text-white/30 text-xs font-nunito">{upg.desc}</div>
                  {isActive && (
                    <div className="text-green-400 text-xs font-nunito font-bold mt-0.5">
                      ⏱ {formatTimer(msLeft)}
                    </div>
                  )}
                </div>
                {isActive ? (
                  <div className="text-green-400 font-russo text-sm shrink-0">✅</div>
                ) : (
                  <button
                    className="btn-orange text-sm py-2 px-3 shrink-0"
                    onClick={() => handleBuyUpgrade(upg)}
                  >
                    {upg.price} <CoinIcon size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'consumables' && (
        <div className="space-y-2">
          <p className="text-white/30 text-xs font-nunito text-center">{t('consumables_note')}</p>
          {consumables.map((item) => {
            const canAfford = player.coins >= item.price;
            return (
              <div key={item.id} className="card-game p-4 flex items-center gap-3">
                <div className="text-3xl">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-russo text-white text-sm">{item.name}</div>
                  <div className="text-white/30 text-xs font-nunito">{item.desc}</div>
                </div>
                <button
                  className={`text-sm py-2 px-3 shrink-0 rounded-xl font-russo transition-all ${canAfford ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300 active:scale-95' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
                  onClick={() => { if (!canAfford) { notify(t('not_enough_coins')); return; } item.action(); }}
                >
                  {item.price.toLocaleString()} <CoinIcon size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'coins' && (
        <div className="grid grid-cols-2 gap-3">
          {coinPacks.map((pack, i) => (
            <button
              key={i}
              onClick={() => {
                if (player.gems >= pack.gems) {
                  setPlayer(prev => ({ ...prev, gems: prev.gems - pack.gems, coins: prev.coins + pack.coins }));
                  notify(`${t('notify_gems_recv')} ${pack.coins.toLocaleString()} ${t('coins_received')}!`);
                } else {
                  notify(t('not_enough_gems'));
                }
              }}
              className="card-game p-4 flex flex-col items-center gap-2 border border-white/10 hover:border-yellow-500/40 transition-all rounded-2xl"
            >
              <CoinIcon size={32} />
              <div className="font-russo text-yellow-400 text-lg">{pack.coins.toLocaleString()}</div>
              <div className="text-white/30 text-xs flex items-center gap-1">за {pack.gems} <GemIcon size={12} /></div>
              <div className="bg-purple-500/20 border border-purple-500/30 text-purple-300 font-russo text-sm py-1.5 px-4 w-full text-center rounded-xl flex items-center justify-center gap-1">
                {pack.gems} <GemIcon size={13} />
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'gems' && (
        <div className="flex flex-col gap-3">
          {!inYa && (
            <div className="card-game p-3 text-center text-white/40 text-xs font-nunito border border-yellow-400/10">
              {t('gems_ya_only')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {gemPacks.map((pack) => {
              const isLoading = buyingId === pack.id;
              return (
                <button
                  key={pack.id}
                  onClick={() => handleBuyGems(pack)}
                  disabled={!!buyingId}
                  className={`card-game-solid p-4 flex flex-col items-center gap-2 border-2 transition-all relative overflow-hidden
                    ${pack.popular ? 'border-yellow-500/60' : 'border-white/10'}
                    ${buyingId && !isLoading ? 'opacity-50' : 'hover:scale-105 active:scale-95'}
                  `}
                >
                  {pack.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-yellow-400 text-gray-900 font-russo text-[10px] py-0.5 text-center">{t('tag_hit')}</div>
                  )}
                  <div className={`flex items-center justify-center ${pack.popular ? 'mt-3' : ''}`} style={{ height: '2.25rem' }}>
                    {isLoading ? <span className="text-3xl">⏳</span> : <GemIcon size={36} />}
                  </div>
                  <div className="font-russo text-white text-xl">{pack.gems}</div>
                  {pack.bonus && (
                    <div className="text-green-400 text-xs font-bold font-nunito">{pack.bonus}</div>
                  )}
                  <div className={`font-russo text-sm py-1.5 px-3 w-full text-center rounded-xl flex items-center justify-center gap-1
                    ${isLoading ? 'bg-white/20 text-white/60' : 'bg-yellow-400 text-gray-900'}
                  `}>
                    {isLoading ? t('paying') : (
                      <>
                        {pack.currencyImg && <img src={pack.currencyImg} alt="" className="w-4 h-4 object-contain" />}
                        {pack.price}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/20 text-xs font-nunito">{t('or')}</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <button
            onClick={handleRestore}
            disabled={restoring || !!buyingId}
            className="w-full card-game py-3 flex items-center justify-center gap-2 border border-white/10 hover:border-yellow-400/30 transition-all disabled:opacity-40"
          >
            <span className="text-lg">{restoring ? '⏳' : '♻️'}</span>
            <span className="font-russo text-white/60 text-sm">
              {restoring ? t('restoring') : t('restore_btn')}
            </span>
          </button>
          <p className="text-white/20 text-xs text-center font-nunito">{t('payment_safe')}</p>
        </div>
      )}
    </div>
  );
}

export default ShopScreen;