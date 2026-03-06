import React from 'react';
import { PlayerData, Screen, xpForLevel } from './parkingTypes';
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
function claimAch(id: string) {
  const claimed = getClaimedAchs();
  if (!claimed.includes(id)) localStorage.setItem(CLAIMABLE_ACH_KEY, JSON.stringify([...claimed, id]));
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
  // 🎮 Игровой опыт
  { id: 'play_1',    emoji: '🎮', title: 'Первый старт',      desc: 'Сыграй 1 игру',         category: 'Игры',    reward: { coins: 100 },          check: p => p.gamesPlayed >= 1 },
  { id: 'play_10',   emoji: '🕹️', title: 'Втянулся',          desc: 'Сыграй 10 игр',         category: 'Игры',    reward: { coins: 300 },          check: p => p.gamesPlayed >= 10 },
  { id: 'play_50',   emoji: '🏁', title: 'Ветеран парковки',  desc: 'Сыграй 50 игр',         category: 'Игры',    reward: { coins: 800, gems: 3 }, check: p => p.gamesPlayed >= 50 },
  { id: 'play_100',  emoji: '💯', title: 'Сотня!',            desc: 'Сыграй 100 игр',        category: 'Игры',    reward: { coins: 1500, gems: 5 },check: p => p.gamesPlayed >= 100 },
  { id: 'play_250',  emoji: '🌟', title: 'Легенда дороги',   desc: 'Сыграй 250 игр',        category: 'Игры',    reward: { coins: 3000, gems: 10},check: p => p.gamesPlayed >= 250 },
  // 🏆 Победы
  { id: 'win_1',     emoji: '🥇', title: 'Первая победа',     desc: 'Выиграй 1 раз',         category: 'Победы',  reward: { coins: 200 },          check: p => p.wins >= 1 },
  { id: 'win_5',     emoji: '🏆', title: 'Чемпион',           desc: 'Выиграй 5 раз',         category: 'Победы',  reward: { coins: 500, gems: 2 }, check: p => p.wins >= 5 },
  { id: 'win_20',    emoji: '👑', title: 'Король парковки',   desc: 'Выиграй 20 раз',        category: 'Победы',  reward: { coins: 1200, gems: 5 },check: p => p.wins >= 20 },
  { id: 'win_50',    emoji: '🌠', title: 'Непобедимый',       desc: 'Выиграй 50 раз',        category: 'Победы',  reward: { coins: 3000, gems: 15},check: p => p.wins >= 50 },
  // ⚡ Скиллы
  { id: 'top3',      emoji: '🥉', title: 'Призёр',            desc: 'Финишируй в топ-3',     category: 'Скиллы',  reward: { coins: 150 },          check: p => p.bestPosition !== 99 && p.bestPosition <= 3 },
  { id: 'best_pos2', emoji: '🥈', title: 'Почти чемпион',     desc: 'Финишируй вторым',      category: 'Скиллы',  reward: { coins: 250 },          check: p => p.bestPosition !== 99 && p.bestPosition <= 2 },
  // 💰 Богатство
  { id: 'coins_1k',  emoji: '💵', title: 'Первая тысяча',     desc: 'Накопи 1 000 монет',    category: 'Богатство',reward: { coins: 100 },          check: p => p.coins >= 1000 },
  { id: 'coins_5k',  emoji: '💰', title: 'Богач',             desc: 'Накопи 5 000 монет',    category: 'Богатство',reward: { coins: 300, gems: 1 }, check: p => p.coins >= 5000 },
  { id: 'coins_20k', emoji: '🤑', title: 'Миллионщик',        desc: 'Накопи 20 000 монет',   category: 'Богатство',reward: { coins: 500, gems: 3 }, check: p => p.coins >= 20000 },
  { id: 'gems_10',   emoji: '💎', title: 'Самоцветы',         desc: 'Накопи 10 кристаллов',  category: 'Богатство',reward: { coins: 200 },          check: p => p.gems >= 10 },
  { id: 'gems_50',   emoji: '💠', title: 'Алмазный игрок',   desc: 'Накопи 50 кристаллов',  category: 'Богатство',reward: { coins: 500, gems: 5 }, check: p => p.gems >= 50 },
  // 🚗 Коллекция
  { id: 'cars_2',    emoji: '🚙', title: 'Второй ключ',       desc: 'Купи 2 машины',         category: 'Гараж',   reward: { coins: 200 },          check: p => p.cars.filter(c => c.owned).length >= 2 },
  { id: 'cars_3',    emoji: '🚗', title: 'Коллекционер',      desc: 'Купи 3 машины',         category: 'Гараж',   reward: { coins: 400, gems: 1 }, check: p => p.cars.filter(c => c.owned).length >= 3 },
  { id: 'cars_5',    emoji: '🏎️', title: 'Автопарк',         desc: 'Купи 5 машин',          category: 'Гараж',   reward: { coins: 800, gems: 3 }, check: p => p.cars.filter(c => c.owned).length >= 5 },
  { id: 'cars_all',  emoji: '🚀', title: 'Всё своё!',         desc: 'Купи все машины',       category: 'Гараж',   reward: { coins: 2000, gems: 10},check: p => p.cars.every(c => c.owned) },
  { id: 'legendary', emoji: '⭐', title: 'Легендарная сила',  desc: 'Купи легендарную машину',category: 'Гараж',  reward: { coins: 500, gems: 2 }, check: p => p.cars.some(c => c.owned && c.rarity === 'legendary') },
  // 📈 Уровни
  { id: 'lvl_5',     emoji: '📈', title: 'Набираю обороты',   desc: 'Достигни 5 уровня',     category: 'Уровни',  reward: { coins: 300 },          check: p => p.level >= 5 },
  { id: 'lvl_10',    emoji: '🔟', title: 'Десятка',           desc: 'Достигни 10 уровня',    category: 'Уровни',  reward: { coins: 600, gems: 2 }, check: p => p.level >= 10 },
  { id: 'lvl_20',    emoji: '🚀', title: 'Элита',             desc: 'Достигни 20 уровня',    category: 'Уровни',  reward: { coins: 1500, gems: 5 },check: p => p.level >= 20 },
  // 🔥 Серия входов
  { id: 'streak_3',  emoji: '🔥', title: 'Три огня',          desc: 'Зайди 3 дня подряд',    category: 'Серия',   reward: { coins: 150 },          check: p => (p.loginStreak ?? 0) >= 3 },
  { id: 'streak_7',  emoji: '📅', title: 'Неделя',            desc: 'Зайди 7 дней подряд',   category: 'Серия',   reward: { coins: 400, gems: 2 }, check: p => (p.loginStreak ?? 0) >= 7 },
  { id: 'streak_14', emoji: '🗓️', title: 'Две недели',        desc: 'Зайди 14 дней подряд', category: 'Серия',   reward: { coins: 800, gems: 5 }, check: p => (p.loginStreak ?? 0) >= 14 },
  { id: 'streak_30', emoji: '👑', title: 'Целый месяц!',      desc: 'Зайди 30 дней подряд',  category: 'Серия',   reward: { coins: 1500, gems: 20},check: p => (p.loginStreak ?? 0) >= 30 },
];

const CATEGORY_ORDER = ['Победы', 'Игры', 'Скиллы', 'Богатство', 'Гараж', 'Уровни', 'Серия'];

export function ProfileScreen({ player, setScreen, setPlayer, notify }: ProfileScreenProps) {
  const [achTab, setAchTab] = React.useState<string>('Победы');
  const xpInLevel = player.xp % xpForLevel(player.level);
  const xpNeeded = xpForLevel(player.level);
  const claimedAchs = getClaimedAchs();

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    items: ALL_ACHIEVEMENTS.filter(a => a.category === cat),
  }));

  const totalDone = ALL_ACHIEVEMENTS.filter(a => a.check(player)).length;
  const hasClaimable = ALL_ACHIEVEMENTS.some(a => a.check(player) && !claimedAchs.includes(a.id));

  const currentItems = grouped.find(g => g.cat === achTab)?.items ?? [];

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

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">🏅 Достижения</h3>
          <span className="font-russo text-xs text-yellow-400">{totalDone}/{ALL_ACHIEVEMENTS.length}</span>
          {hasClaimable && <span className="ml-auto text-xs font-nunito text-yellow-300 animate-pulse">● Есть награды!</span>}
        </div>

        <div className="flex gap-1.5 flex-wrap mb-3">
          {grouped.map(g => {
            const doneCnt = g.items.filter(a => a.check(player)).length;
            const claimCnt = g.items.filter(a => a.check(player) && !claimedAchs.includes(a.id)).length;
            return (
              <button
                key={g.cat}
                onClick={() => setAchTab(g.cat)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-russo transition-all ${achTab === g.cat ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 'text-white/40 hover:text-white/60 bg-white/5'}`}
              >
                {g.cat}
                <span className={`text-[10px] ${doneCnt === g.items.length ? 'text-green-400' : 'text-white/30'}`}>{doneCnt}/{g.items.length}</span>
                {claimCnt > 0 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {currentItems.map(ach => {
            const done = ach.check(player);
            const claimed = claimedAchs.includes(ach.id);
            const canClaim = done && !claimed;
            const rewardStr = [ach.reward.coins ? `+${ach.reward.coins}🪙` : '', ach.reward.gems ? `+${ach.reward.gems}💎` : ''].filter(Boolean).join(' ');
            return (
              <div key={ach.id} className={`card-game p-3 flex items-center gap-3 transition-all ${!done ? 'opacity-35' : canClaim ? 'border-yellow-400/40 bg-yellow-400/5' : ''}`}>
                <div className={`text-2xl ${!done ? 'grayscale' : ''}`}>{ach.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className={`font-russo text-sm ${done ? 'text-yellow-400' : 'text-white/50'}`}>{ach.title}</div>
                  <div className="text-white/30 text-xs font-nunito">{ach.desc}</div>
                  {!claimed && <div className="text-yellow-400/50 text-[10px] font-nunito mt-0.5">{rewardStr}</div>}
                </div>
                {claimed && <div className="text-green-400 text-sm shrink-0">✅</div>}
                {canClaim && (
                  <button
                    className="shrink-0 bg-yellow-400/20 border border-yellow-400/40 hover:bg-yellow-400/30 rounded-xl px-3 py-1.5 font-russo text-yellow-300 text-xs transition-all whitespace-nowrap"
                    onClick={() => {
                      claimAch(ach.id);
                      setPlayer(prev => ({
                        ...prev,
                        coins: prev.coins + (ach.reward.coins ?? 0),
                        gems: prev.gems + (ach.reward.gems ?? 0),
                      }));
                      notify(`🏅 "${ach.title}" ${rewardStr}`);
                    }}
                  >
                    Забрать!
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <h3 className="font-russo text-white/40 text-xs uppercase tracking-wider">👥 Друзья</h3>
      <FriendsPanel playerName={player.name} playerEmoji={player.emoji} notify={notify} />
    </div>
  );
}

export default ProfileScreen;