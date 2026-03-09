import React from 'react';
import { PlayerData, Screen, xpForLevel, getGemPurchaseLog, GemPurchaseEntry } from './parkingTypes';
import { ProfileCard } from './LoginScreen';
import FriendsPanel from '@/components/FriendsPanel';
import { t } from '@/i18n';
import { CoinIcon, GemIcon } from '@/components/ui/CoinIcon';

interface ProfileScreenProps {
  player: PlayerData;
  setScreen: (s: Screen) => void;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
  notify: (msg: string) => void;
  localPlayerId?: string;
}

const CLAIMABLE_ACH_KEY = 'parking_ach_claimed_v2';
function getClaimedAchs(): string[] {
  try { return JSON.parse(localStorage.getItem(CLAIMABLE_ACH_KEY) ?? '[]'); } catch { return []; }
}

export interface AchDef {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  category: string;
  reward: { coins?: number; gems?: number };
  check: (p: PlayerData) => boolean;
}

const ACH_STATIC: Omit<AchDef, 'title' | 'desc' | 'category'>[] = [
  { id: 'play_1',    emoji: '🎮', reward: { coins: 100 },           check: p => p.gamesPlayed >= 1 },
  { id: 'play_10',   emoji: '🕹️', reward: { coins: 300 },           check: p => p.gamesPlayed >= 10 },
  { id: 'play_50',   emoji: '🏁', reward: { coins: 800, gems: 3 },  check: p => p.gamesPlayed >= 50 },
  { id: 'play_100',  emoji: '💯', reward: { coins: 1500, gems: 5 }, check: p => p.gamesPlayed >= 100 },
  { id: 'play_250',  emoji: '🌟', reward: { coins: 3000, gems: 10}, check: p => p.gamesPlayed >= 250 },
  { id: 'win_1',     emoji: '🥇', reward: { coins: 200 },           check: p => p.wins >= 1 },
  { id: 'win_5',     emoji: '🏆', reward: { coins: 500, gems: 2 },  check: p => p.wins >= 5 },
  { id: 'win_20',    emoji: '👑', reward: { coins: 1200, gems: 5 }, check: p => p.wins >= 20 },
  { id: 'win_50',    emoji: '🌠', reward: { coins: 3000, gems: 15}, check: p => p.wins >= 50 },
  { id: 'top3',      emoji: '🥉', reward: { coins: 150 },           check: p => p.bestPosition !== 99 && p.bestPosition <= 3 },
  { id: 'best_pos2', emoji: '🥈', reward: { coins: 250 },           check: p => p.bestPosition !== 99 && p.bestPosition <= 2 },
  { id: 'coins_1k',  emoji: '💵', reward: { coins: 100 },           check: p => p.coins >= 1000 },
  { id: 'coins_5k',  emoji: '💰', reward: { coins: 300, gems: 1 },  check: p => p.coins >= 5000 },
  { id: 'coins_20k', emoji: '🤑', reward: { coins: 500, gems: 3 },  check: p => p.coins >= 20000 },
  { id: 'gems_10',   emoji: '💎', reward: { coins: 200 },           check: p => p.gems >= 10 },
  { id: 'gems_50',   emoji: '💠', reward: { coins: 500, gems: 5 },  check: p => p.gems >= 50 },
  { id: 'cars_2',    emoji: '🚙', reward: { coins: 200 },           check: p => p.cars.filter(c => c.owned).length >= 2 },
  { id: 'cars_3',    emoji: '🚗', reward: { coins: 400, gems: 1 },  check: p => p.cars.filter(c => c.owned).length >= 3 },
  { id: 'cars_5',    emoji: '🏎️', reward: { coins: 800, gems: 3 },  check: p => p.cars.filter(c => c.owned).length >= 5 },
  { id: 'cars_all',  emoji: '🚀', reward: { coins: 2000, gems: 10}, check: p => p.cars.every(c => c.owned) },
  { id: 'legendary', emoji: '⭐', reward: { coins: 500, gems: 2 },  check: p => p.cars.some(c => c.owned && c.rarity === 'legendary') },
  { id: 'lvl_5',     emoji: '📈', reward: { coins: 300 },           check: p => p.level >= 5 },
  { id: 'lvl_10',    emoji: '🔟', reward: { coins: 600, gems: 2 },  check: p => p.level >= 10 },
  { id: 'lvl_20',    emoji: '🚀', reward: { coins: 1500, gems: 5 }, check: p => p.level >= 20 },
  { id: 'streak_3',  emoji: '🔥', reward: { coins: 150 },           check: p => (p.loginStreak ?? 0) >= 3 },
  { id: 'streak_7',  emoji: '📅', reward: { coins: 400, gems: 2 },  check: p => (p.loginStreak ?? 0) >= 7 },
  { id: 'streak_14', emoji: '🗓️', reward: { coins: 800, gems: 5 },  check: p => (p.loginStreak ?? 0) >= 14 },
  { id: 'streak_30', emoji: '👑', reward: { coins: 1500, gems: 20}, check: p => (p.loginStreak ?? 0) >= 30 },
];

// Маппинг id → ключи переводов и категории
const ACH_KEYS: Record<string, { titleKey: string; descKey: string; catKey: string }> = {
  play_1:    { titleKey: 'ach_play_1_title',    descKey: 'ach_play_1_desc',    catKey: 'cat_games' },
  play_10:   { titleKey: 'ach_play_10_title',   descKey: 'ach_play_10_desc',   catKey: 'cat_games' },
  play_50:   { titleKey: 'ach_play_50_title',   descKey: 'ach_play_50_desc',   catKey: 'cat_games' },
  play_100:  { titleKey: 'ach_play_100_title',  descKey: 'ach_play_100_desc',  catKey: 'cat_games' },
  play_250:  { titleKey: 'ach_play_500_title',  descKey: 'ach_play_500_desc',  catKey: 'cat_games' },
  win_1:     { titleKey: 'ach_win_1_title',     descKey: 'ach_win_1_desc',     catKey: 'cat_wins' },
  win_5:     { titleKey: 'ach_win_10_title',    descKey: 'ach_win_10_desc',    catKey: 'cat_wins' },
  win_20:    { titleKey: 'ach_win_10_title',    descKey: 'ach_win_10_desc',    catKey: 'cat_wins' },
  win_50:    { titleKey: 'ach_win_50_title',    descKey: 'ach_win_50_desc',    catKey: 'cat_wins' },
  top3:      { titleKey: 'ach_top3_title',      descKey: 'ach_top3_desc',      catKey: 'cat_skills' },
  best_pos2: { titleKey: 'ach_top3_5_title',    descKey: 'ach_top3_5_desc',    catKey: 'cat_skills' },
  coins_1k:  { titleKey: 'ach_coins_1k_title',  descKey: 'ach_coins_1k_desc',  catKey: 'cat_wealth' },
  coins_5k:  { titleKey: 'ach_coins_10k_title', descKey: 'ach_coins_10k_desc', catKey: 'cat_wealth' },
  coins_20k: { titleKey: 'ach_coins_10k_title', descKey: 'ach_coins_10k_desc', catKey: 'cat_wealth' },
  gems_10:   { titleKey: 'ach_coins_1k_title',  descKey: 'ach_coins_1k_desc',  catKey: 'cat_wealth' },
  gems_50:   { titleKey: 'ach_coins_10k_title', descKey: 'ach_coins_10k_desc', catKey: 'cat_wealth' },
  cars_2:    { titleKey: 'ach_car2_title',      descKey: 'ach_car2_desc',      catKey: 'cat_garage' },
  cars_3:    { titleKey: 'ach_car2_title',      descKey: 'ach_car2_desc',      catKey: 'cat_garage' },
  cars_5:    { titleKey: 'ach_car5_title',      descKey: 'ach_car5_desc',      catKey: 'cat_garage' },
  cars_all:  { titleKey: 'ach_car5_title',      descKey: 'ach_car5_desc',      catKey: 'cat_garage' },
  legendary: { titleKey: 'ach_car5_title',      descKey: 'ach_car5_desc',      catKey: 'cat_garage' },
  lvl_5:     { titleKey: 'ach_level5_title',    descKey: 'ach_level5_desc',    catKey: 'cat_levels' },
  lvl_10:    { titleKey: 'ach_level10_title',   descKey: 'ach_level10_desc',   catKey: 'cat_levels' },
  lvl_20:    { titleKey: 'ach_level20_title',   descKey: 'ach_level20_desc',   catKey: 'cat_levels' },
  streak_3:  { titleKey: 'ach_streak3_title',   descKey: 'ach_streak3_desc',   catKey: 'cat_streak' },
  streak_7:  { titleKey: 'ach_streak7_title',   descKey: 'ach_streak7_desc',   catKey: 'cat_streak' },
  streak_14: { titleKey: 'ach_streak7_title',   descKey: 'ach_streak7_desc',   catKey: 'cat_streak' },
  streak_30: { titleKey: 'ach_streak7_title',   descKey: 'ach_streak7_desc',   catKey: 'cat_streak' },
};

export function getAchievements(): AchDef[] {
  return ACH_STATIC.map(a => {
    const keys = ACH_KEYS[a.id];
    return {
      ...a,
      title: keys ? t(keys.titleKey) : a.id,
      desc: keys ? t(keys.descKey) : '',
      category: keys ? t(keys.catKey) : '',
    };
  });
}

export const ALL_ACHIEVEMENTS: AchDef[] = ACH_STATIC.map(a => ({
  ...a,
  get title() { return ACH_KEYS[a.id] ? t(ACH_KEYS[a.id].titleKey) : a.id; },
  get desc()  { return ACH_KEYS[a.id] ? t(ACH_KEYS[a.id].descKey)  : ''; },
  get category() { return ACH_KEYS[a.id] ? t(ACH_KEYS[a.id].catKey) : ''; },
}));

const GEM_PACK_LABELS: Record<string, string> = {
  gems_100: '100',
  gems_300: '350',
  gems_700: '850',
  gems_1500: '2000',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export function ProfileScreen({ player, setScreen, setPlayer, notify, localPlayerId = '' }: ProfileScreenProps) {
  const xpInLevel = player.xp % xpForLevel(player.level);
  const xpNeeded = xpForLevel(player.level);
  const claimedAchs = getClaimedAchs();
  const totalDone = ALL_ACHIEVEMENTS.filter(a => a.check(player)).length;
  const hasClaimable = ALL_ACHIEVEMENTS.some(a => a.check(player) && !claimedAchs.includes(a.id));
  const gemLog: GemPurchaseEntry[] = getGemPurchaseLog();

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto w-full overflow-x-hidden">
      <div className="flex items-center gap-2 min-w-0">
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-3 shrink-0" onClick={() => setScreen('menu')}>←</button>
        <h2 className="font-russo text-xl text-yellow-400 truncate">{t('profile_title')}</h2>
        <button
          className="ml-auto btn-game bg-yellow-400/10 text-yellow-300 border-yellow-400/30 py-2 px-3 text-sm relative shrink-0 whitespace-nowrap"
          onClick={() => setScreen('achievements')}
        >
          🏅
          {hasClaimable && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse" />}
        </button>
      </div>

      <ProfileCard
        player={player}
        xpInLevel={xpInLevel}
        xpNeeded={xpNeeded}
        onEmojiChange={em => setPlayer(prev => ({ ...prev, emoji: em }))}
        onNameChange={name => { setPlayer(prev => ({ ...prev, name, nicknameChanges: (prev.nicknameChanges ?? 0) + 1 })); notify(t('notify_name_changed')); }}
      />

      <div className="grid grid-cols-2 gap-3">
        {([
          { icon: <span className="text-2xl">🎮</span>, val: player.gamesPlayed, label: t('profile_games') },
          { icon: <span className="text-2xl">🏆</span>, val: player.wins, label: t('profile_wins') },
          { icon: <span className="text-2xl">🥇</span>, val: player.bestPosition === 99 ? '—' : `#${player.bestPosition}`, label: t('profile_best') },
          { icon: <CoinIcon size={28} />, val: player.coins.toLocaleString(), label: t('profile_coins') },
        ] as { icon: React.ReactNode; val: React.ReactNode; label: string }[]).map(s => (
          <div key={s.label} className="card-game p-4 flex flex-col gap-1">
            <div className="flex items-center" style={{ height: '2rem' }}>{s.icon}</div>
            <div className="font-russo text-white text-lg">{s.val}</div>
            <div className="text-white/30 text-xs font-nunito">{s.label}</div>
          </div>
        ))}
      </div>

      <button
        className="card-game p-4 flex items-center gap-3 hover:border-yellow-400/30 transition-all w-full"
        onClick={() => setScreen('achievements')}
      >
        <div className="text-3xl">🏅</div>
        <div className="flex-1 text-left">
          <div className="font-russo text-white text-sm">{t('achievements_btn')}</div>
          <div className="font-nunito text-white/30 text-xs">{totalDone} {t('profile_ach_progress')} {ALL_ACHIEVEMENTS.length} {t('profile_ach_done')}</div>
        </div>
        {hasClaimable && <span className="text-xs font-nunito text-yellow-300 animate-pulse mr-1">{t('profile_rewards')}</span>}
        <div className="text-white/30 text-sm">→</div>
      </button>

      {gemLog.length > 0 && (
        <>
          <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">{t('gem_history')}</h3>
          <div className="flex flex-col gap-2">
            {gemLog.slice(0, 10).map((entry, i) => (
              <div key={i} className="card-game px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GemIcon size={20} />
                  <div>
                    <div className="font-russo text-white text-sm flex items-center gap-1">{GEM_PACK_LABELS[entry.productId] ?? entry.gems} <GemIcon size={14} /></div>
                    <div className="text-white/30 text-xs font-nunito">{formatDate(entry.date)}</div>
                  </div>
                </div>
                <span className="text-green-400 font-russo text-sm">+{entry.gems}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">{t('friends_section')}</h3>
      <FriendsPanel playerName={player.name} playerEmoji={player.emoji} localPlayerId={localPlayerId} notify={notify} />
    </div>
  );
}

export default ProfileScreen;