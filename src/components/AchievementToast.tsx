import { useEffect, useState, useRef } from 'react';
import { PlayerData } from '@/pages/parkingTypes';
import { ALL_ACHIEVEMENTS } from '@/pages/ProfileScreen';

const SEEN_KEY = 'parking_ach_seen_v2';

function getSeenAchs(): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'); } catch { return []; }
}
function markSeen(id: string) {
  const seen = getSeenAchs();
  if (!seen.includes(id)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id]));
}

interface Props {
  player: PlayerData;
}

interface ToastItem {
  id: string;
  emoji: string;
  title: string;
  rewardStr: string;
  key: number;
}

export default function AchievementToast({ player }: Props) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [visible, setVisible] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    const seen = getSeenAchs();
    const newlyDone = ALL_ACHIEVEMENTS.filter(a => a.check(player) && !seen.includes(a.id));
    if (newlyDone.length === 0) return;
    newlyDone.forEach(a => markSeen(a.id));
    const toasts: ToastItem[] = newlyDone.map(a => ({
      id: a.id,
      emoji: a.emoji,
      title: a.title,
      rewardStr: [a.reward.coins ? `+${a.reward.coins}🪙` : '', a.reward.gems ? `+${a.reward.gems}💎` : ''].filter(Boolean).join(' '),
      key: ++keyRef.current,
    }));
    setQueue(prev => [...prev, ...toasts]);
  }, [player.gamesPlayed, player.wins, player.level, player.coins, player.gems, player.loginStreak]);

  useEffect(() => {
    if (visible || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setVisible(next);
    timerRef.current = setTimeout(() => setVisible(null), 3500);
  }, [queue, visible]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!visible) return null;

  return (
    <div
      key={visible.key}
      className="fixed top-16 left-0 right-0 flex justify-center z-50 pointer-events-none animate-achievement-pop"
    >
      <div className="flex items-center gap-3 bg-gray-900/95 border-2 border-yellow-500/60 rounded-2xl px-5 py-3 shadow-2xl"
        style={{ boxShadow: '0 0 24px rgba(255,214,0,0.3)' }}>
        <div className="text-3xl">{visible.emoji}</div>
        <div>
          <div className="text-yellow-300 font-russo text-xs uppercase tracking-wider">🏅 Достижение!</div>
          <div className="text-white font-russo text-sm">{visible.title}</div>
          {visible.rewardStr && <div className="text-yellow-400/80 text-xs font-nunito">{visible.rewardStr} — забери в профиле</div>}
        </div>
      </div>
    </div>
  );
}