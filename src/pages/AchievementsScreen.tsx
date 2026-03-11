import React, { useState } from 'react';
import { PlayerData, Screen, xpForLevel, LEVEL_REWARDS } from './parkingTypes';
import { ALL_ACHIEVEMENTS, AchDef } from './ProfileScreen';
import { t } from '@/i18n';
import { CoinIcon, GemIcon } from '@/components/ui/CoinIcon';

interface AchievementsScreenProps {
  player: PlayerData;
  setScreen: (s: Screen) => void;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
  notify: (msg: string) => void;
}

const CLAIMABLE_ACH_KEY = 'parking_ach_claimed_v2';
function getClaimedAchs(): string[] {
  try { return JSON.parse(localStorage.getItem(CLAIMABLE_ACH_KEY) ?? '[]'); } catch { return []; }
}
function claimAch(id: string) {
  const claimed = getClaimedAchs();
  if (!claimed.includes(id)) localStorage.setItem(CLAIMABLE_ACH_KEY, JSON.stringify([...claimed, id]));
}

// Используем ключи переводов — не зависят от языка
const CATEGORY_KEYS = ['cat_wins', 'cat_games', 'cat_skills', 'cat_wealth', 'cat_garage', 'cat_levels', 'cat_streak'];

export default function AchievementsScreen({ player, setScreen, setPlayer, notify }: AchievementsScreenProps) {
  const [tab, setTab] = useState<'achievements' | 'levels'>('achievements');
  const [achCatKey, setAchCatKey] = useState('cat_wins');
  const claimedAchs = getClaimedAchs();

  const xpInLevel = (() => {
    let rem = player.xp;
    let l = 1;
    while (rem >= xpForLevel(l)) { rem -= xpForLevel(l); l++; }
    return { current: rem, needed: xpForLevel(l) };
  })();

  // Группируем по catKey — category геттер возвращает t(catKey), сравниваем с текущим переводом
  const grouped = CATEGORY_KEYS.map(catKey => ({
    catKey,
    items: ALL_ACHIEVEMENTS.filter((a: AchDef) => a.category === t(catKey)),
  }));

  const totalDone = ALL_ACHIEVEMENTS.filter((a: AchDef) => a.check(player)).length;
  const hasClaimable = ALL_ACHIEVEMENTS.some((a: AchDef) => a.check(player) && !claimedAchs.includes(a.id));
  const currentItems = grouped.find(g => g.catKey === achCatKey)?.items ?? [];

  const handleClaimAch = (ach: AchDef) => {
    claimAch(ach.id);
    setPlayer(prev => ({
      ...prev,
      coins: prev.coins + (ach.reward.coins ?? 0),
      gems: prev.gems + (ach.reward.gems ?? 0),
    }));
    notify(`${t('ach_toast_title')} «${ach.title}»! +${ach.reward.coins ?? 0}🪙${ach.reward.gems ? ` +${ach.reward.gems}💎` : ''}`);
  };

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 min-w-0">
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4 shrink-0" onClick={() => setScreen('profile')}>←</button>
        <h2 className="font-russo text-xl text-yellow-400 truncate">{t('ach_title')}</h2>
        <span className="ml-auto font-russo text-xs text-yellow-400/60 shrink-0">{totalDone}/{ALL_ACHIEVEMENTS.length}</span>
        {hasClaimable && <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />}
      </div>

      {/* XP progress */}
      <div className="card-game p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-russo text-white text-sm">Lv.{player.level}</span>
          <span className="font-nunito text-white/40 text-xs">{xpInLevel.current} / {xpInLevel.needed} XP</span>
          <span className="font-russo text-yellow-400 text-sm">Lv.{player.level + 1}</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full transition-all"
            style={{ width: `${Math.min(100, (xpInLevel.current / xpInLevel.needed) * 100)}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('achievements')}
          className={`flex-1 py-2 rounded-xl font-russo text-sm transition-all ${tab === 'achievements' ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 'bg-white/5 text-white/40 hover:text-white/60'}`}
        >
          {t('ach_tab')}
        </button>
        <button
          onClick={() => setTab('levels')}
          className={`flex-1 py-2 rounded-xl font-russo text-sm transition-all ${tab === 'levels' ? 'bg-purple-400/20 text-purple-300 border border-purple-400/30' : 'bg-white/5 text-white/40 hover:text-white/60'}`}
        >
          {t('level_rewards')}
        </button>
      </div>

      {tab === 'achievements' && (
        <>
          {/* Category tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {grouped.map(g => {
              const doneCnt = g.items.filter((a: AchDef) => a.check(player)).length;
              const claimCnt = g.items.filter((a: AchDef) => a.check(player) && !claimedAchs.includes(a.id)).length;
              return (
                <button
                  key={g.catKey}
                  onClick={() => setAchCatKey(g.catKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-russo transition-all relative ${achCatKey === g.catKey ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 'bg-white/5 text-white/30 hover:text-white/50'}`}
                >
                  {t(g.catKey)} {doneCnt}/{g.items.length}
                  {claimCnt > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full" />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            {currentItems.map((ach: AchDef) => {
              const done = ach.check(player);
              const claimed = claimedAchs.includes(ach.id);
              const canClaim = done && !claimed;
              return (
                <div
                  key={ach.id}
                  className={`flex items-center gap-3 rounded-2xl p-3 transition-all ${claimed ? 'bg-green-500/10 border border-green-500/20 opacity-70' : canClaim ? 'bg-yellow-400/10 border border-yellow-400/30' : done ? 'bg-white/5 border border-white/10' : 'bg-white/3 opacity-50'}`}
                >
                  <div className="text-3xl">{ach.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-russo text-sm ${claimed ? 'text-green-400' : canClaim ? 'text-yellow-300' : done ? 'text-white' : 'text-white/40'}`}>
                      {ach.title}
                    </div>
                    <div className="font-nunito text-white/40 text-xs">{ach.desc}</div>
                    <div className="font-nunito text-white/30 text-xs mt-0.5 flex items-center gap-0.5">
                      +{ach.reward.coins}<CoinIcon size={11} />{ach.reward.gems ? <>{' '}+{ach.reward.gems}<GemIcon size={11} /></> : null}
                    </div>
                  </div>
                  {claimed ? (
                    <div className="text-green-400 text-lg shrink-0">✅</div>
                  ) : canClaim ? (
                    <button
                      className="shrink-0 bg-yellow-400 text-gray-900 font-russo text-xs px-3 py-1.5 rounded-xl hover:bg-yellow-300 transition-all"
                      onClick={() => handleClaimAch(ach)}
                    >
                      {t('claim')}
                    </button>
                  ) : (
                    <div className="text-white/20 text-lg shrink-0">🔒</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'levels' && (
        <div className="flex flex-col gap-2">
          <p className="font-nunito text-white/30 text-xs text-center">{t('level_rewards_note')}</p>
          {LEVEL_REWARDS.map(r => {
            const reached = player.level >= r.level;
            return (
              <div
                key={r.level}
                className={`flex items-center gap-3 rounded-2xl p-3 ${reached ? 'bg-yellow-400/10 border border-yellow-400/20' : 'bg-white/5 border border-white/5 opacity-60'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-russo text-sm shrink-0 ${reached ? 'bg-yellow-400/30 text-yellow-300' : 'bg-white/10 text-white/30'}`}>
                  {r.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-nunito text-yellow-400 text-sm flex items-center gap-0.5">+{r.coins.toLocaleString()} <CoinIcon size={13} /></span>
                    {r.gems && <span className="font-nunito text-blue-300 text-sm flex items-center gap-0.5">+{r.gems} <GemIcon size={13} /></span>}
                  </div>
                  {r.bonusKey && <div className="font-nunito text-white/50 text-xs mt-0.5">{t(r.bonusKey)}</div>}
                  <div className="font-nunito text-white/20 text-xs mt-0.5">
                    {t('xp_for_level')}: {Array.from({ length: r.level - 1 }, (_, i) => xpForLevel(i + 1)).reduce((a, b) => a + b, 0).toLocaleString()}
                  </div>
                </div>
                <div className="shrink-0 text-lg">
                  {reached ? '✅' : '🔒'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}