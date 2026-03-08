import React from 'react';
import { PlayerData, Screen, xpForLevel, getGemPurchaseLog, GemPurchaseEntry } from './parkingTypes';
import { ProfileCard } from './LoginScreen';
import FriendsPanel from '@/components/FriendsPanel';

interface ProfileScreenProps {
  player: PlayerData;
  setScreen: (s: Screen) => void;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
  notify: (msg: string) => void;
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

export const ALL_ACHIEVEMENTS: AchDef[] = [
  { id: 'play_1',    emoji: '🎮', title: 'Первый старт',      desc: 'Сыграй 1 игру',         category: 'Игры',    reward: { coins: 100 },          check: p => p.gamesPlayed >= 1 },
  { id: 'play_10',   emoji: '🕹️', title: 'Втянулся',          desc: 'Сыграй 10 игр',         category: 'Игры',    reward: { coins: 300 },          check: p => p.gamesPlayed >= 10 },
  { id: 'play_50',   emoji: '🏁', title: 'Ветеран парковки',  desc: 'Сыграй 50 игр',         category: 'Игры',    reward: { coins: 800, gems: 3 }, check: p => p.gamesPlayed >= 50 },
  { id: 'play_100',  emoji: '💯', title: 'Сотня!',            desc: 'Сыграй 100 игр',        category: 'Игры',    reward: { coins: 1500, gems: 5 },check: p => p.gamesPlayed >= 100 },
  { id: 'play_250',  emoji: '🌟', title: 'Легенда дороги',   desc: 'Сыграй 250 игр',        category: 'Игры',    reward: { coins: 3000, gems: 10},check: p => p.gamesPlayed >= 250 },
  { id: 'win_1',     emoji: '🥇', title: 'Первая победа',     desc: 'Выиграй 1 раз',         category: 'Победы',  reward: { coins: 200 },          check: p => p.wins >= 1 },
  { id: 'win_5',     emoji: '🏆', title: 'Чемпион',           desc: 'Выиграй 5 раз',         category: 'Победы',  reward: { coins: 500, gems: 2 }, check: p => p.wins >= 5 },
  { id: 'win_20',    emoji: '👑', title: 'Король парковки',   desc: 'Выиграй 20 раз',        category: 'Победы',  reward: { coins: 1200, gems: 5 },check: p => p.wins >= 20 },
  { id: 'win_50',    emoji: '🌠', title: 'Непобедимый',       desc: 'Выиграй 50 раз',        category: 'Победы',  reward: { coins: 3000, gems: 15},check: p => p.wins >= 50 },
  { id: 'top3',      emoji: '🥉', title: 'Призёр',            desc: 'Финишируй в топ-3',     category: 'Скиллы',  reward: { coins: 150 },          check: p => p.bestPosition !== 99 && p.bestPosition <= 3 },
  { id: 'best_pos2', emoji: '🥈', title: 'Почти чемпион',     desc: 'Финишируй вторым',      category: 'Скиллы',  reward: { coins: 250 },          check: p => p.bestPosition !== 99 && p.bestPosition <= 2 },
  { id: 'coins_1k',  emoji: '💵', title: 'Первая тысяча',     desc: 'Накопи 1 000 монет',    category: 'Богатство',reward: { coins: 100 },          check: p => p.coins >= 1000 },
  { id: 'coins_5k',  emoji: '💰', title: 'Богач',             desc: 'Накопи 5 000 монет',    category: 'Богатство',reward: { coins: 300, gems: 1 }, check: p => p.coins >= 5000 },
  { id: 'coins_20k', emoji: '🤑', title: 'Миллионщик',        desc: 'Накопи 20 000 монет',   category: 'Богатство',reward: { coins: 500, gems: 3 }, check: p => p.coins >= 20000 },
  { id: 'gems_10',   emoji: '💎', title: 'Самоцветы',         desc: 'Накопи 10 кристаллов',  category: 'Богатство',reward: { coins: 200 },          check: p => p.gems >= 10 },
  { id: 'gems_50',   emoji: '💠', title: 'Алмазный игрок',   desc: 'Накопи 50 кристаллов',  category: 'Богатство',reward: { coins: 500, gems: 5 }, check: p => p.gems >= 50 },
  { id: 'cars_2',    emoji: '🚙', title: 'Второй ключ',       desc: 'Купи 2 машины',         category: 'Гараж',   reward: { coins: 200 },          check: p => p.cars.filter(c => c.owned).length >= 2 },
  { id: 'cars_3',    emoji: '🚗', title: 'Коллекционер',      desc: 'Купи 3 машины',         category: 'Гараж',   reward: { coins: 400, gems: 1 }, check: p => p.cars.filter(c => c.owned).length >= 3 },
  { id: 'cars_5',    emoji: '🏎️', title: 'Автопарк',         desc: 'Купи 5 машин',          category: 'Гараж',   reward: { coins: 800, gems: 3 }, check: p => p.cars.filter(c => c.owned).length >= 5 },
  { id: 'cars_all',  emoji: '🚀', title: 'Всё своё!',         desc: 'Купи все машины',       category: 'Гараж',   reward: { coins: 2000, gems: 10},check: p => p.cars.every(c => c.owned) },
  { id: 'legendary', emoji: '⭐', title: 'Легендарная сила',  desc: 'Купи легендарную машину',category: 'Гараж',  reward: { coins: 500, gems: 2 }, check: p => p.cars.some(c => c.owned && c.rarity === 'legendary') },
  { id: 'lvl_5',     emoji: '📈', title: 'Набираю обороты',   desc: 'Достигни 5 уровня',     category: 'Уровни',  reward: { coins: 300 },          check: p => p.level >= 5 },
  { id: 'lvl_10',    emoji: '🔟', title: 'Десятка',           desc: 'Достигни 10 уровня',    category: 'Уровни',  reward: { coins: 600, gems: 2 }, check: p => p.level >= 10 },
  { id: 'lvl_20',    emoji: '🚀', title: 'Элита',             desc: 'Достигни 20 уровня',    category: 'Уровни',  reward: { coins: 1500, gems: 5 },check: p => p.level >= 20 },
  { id: 'streak_3',  emoji: '🔥', title: 'Три огня',          desc: 'Зайди 3 дня подряд',    category: 'Серия',   reward: { coins: 150 },          check: p => (p.loginStreak ?? 0) >= 3 },
  { id: 'streak_7',  emoji: '📅', title: 'Неделя',            desc: 'Зайди 7 дней подряд',   category: 'Серия',   reward: { coins: 400, gems: 2 }, check: p => (p.loginStreak ?? 0) >= 7 },
  { id: 'streak_14', emoji: '🗓️', title: 'Две недели',        desc: 'Зайди 14 дней подряд', category: 'Серия',   reward: { coins: 800, gems: 5 }, check: p => (p.loginStreak ?? 0) >= 14 },
  { id: 'streak_30', emoji: '👑', title: 'Целый месяц!',      desc: 'Зайди 30 дней подряд',  category: 'Серия',   reward: { coins: 1500, gems: 20},check: p => (p.loginStreak ?? 0) >= 30 },
];

const GEM_PACK_LABELS: Record<string, string> = {
  gems_100: '100 💎',
  gems_300: '350 💎',
  gems_700: '850 💎',
  gems_1500: '2000 💎',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export function ProfileScreen({ player, setScreen, setPlayer, notify }: ProfileScreenProps) {
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
        <h2 className="font-russo text-xl text-yellow-400 truncate">👤 Профиль</h2>
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

      <button
        className="card-game p-4 flex items-center gap-3 hover:border-yellow-400/30 transition-all w-full"
        onClick={() => setScreen('achievements')}
      >
        <div className="text-3xl">🏅</div>
        <div className="flex-1 text-left">
          <div className="font-russo text-white text-sm">Достижения</div>
          <div className="font-nunito text-white/30 text-xs">{totalDone} из {ALL_ACHIEVEMENTS.length} выполнено</div>
        </div>
        {hasClaimable && <span className="text-xs font-nunito text-yellow-300 animate-pulse mr-1">● Награды!</span>}
        <div className="text-white/30 text-sm">→</div>
      </button>

      {gemLog.length > 0 && (
        <>
          <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">💎 История покупок</h3>
          <div className="flex flex-col gap-2">
            {gemLog.slice(0, 10).map((entry, i) => (
              <div key={i} className="card-game px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">💎</span>
                  <div>
                    <div className="font-russo text-white text-sm">{GEM_PACK_LABELS[entry.productId] ?? `${entry.gems} 💎`}</div>
                    <div className="text-white/30 text-xs font-nunito">{formatDate(entry.date)}</div>
                  </div>
                </div>
                <span className="text-green-400 font-russo text-sm">+{entry.gems}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">👥 Друзья</h3>
      <FriendsPanel playerName={player.name} playerEmoji={player.emoji} notify={notify} />
    </div>
  );
}

export default ProfileScreen;