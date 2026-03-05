import { useState, useEffect } from 'react';
import { getOrCreateAnonId } from '@/pages/parkingTypes';

const FRIENDS_KEY = 'parking_friends_v1';
const FRIEND_BONUS_COINS = 0.1; // +10%
const FRIEND_BONUS_XP = 0.15;   // +15%

export interface Friend {
  code: string;
  name: string;
  emoji: string;
  addedAt: number;
}

export function getFriends(): Friend[] {
  try { return JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? '[]'); } catch { return []; }
}

function saveFriends(friends: Friend[]) {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

export function getMyFriendCode(): string {
  return getOrCreateAnonId().slice(0, 10).toUpperCase();
}

export function hasFriendInRoom(roomPlayerIds: string[], myFriends: Friend[]): boolean {
  const myCodes = myFriends.map(f => f.code);
  return roomPlayerIds.some(id => myCodes.some(code => id.toUpperCase().includes(code)));
}

export const FRIEND_BONUS = { coins: FRIEND_BONUS_COINS, xp: FRIEND_BONUS_XP };

interface FriendsPanelProps {
  playerName: string;
  playerEmoji: string;
  notify: (msg: string) => void;
}

export default function FriendsPanel({ playerName, playerEmoji, notify }: FriendsPanelProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inputCode, setInputCode] = useState('');
  const [inputName, setInputName] = useState('');
  const [copied, setCopied] = useState(false);
  const myCode = getMyFriendCode();

  useEffect(() => { setFriends(getFriends()); }, []);

  const handleAdd = () => {
    const code = inputCode.trim().toUpperCase();
    const name = inputName.trim();
    if (code.length < 8) { notify('❌ Код слишком короткий (минимум 8 символов)'); return; }
    if (!name || name.length < 2) { notify('❌ Введи имя друга'); return; }
    if (code === myCode) { notify('❌ Нельзя добавить себя'); return; }
    if (friends.some(f => f.code === code)) { notify('⚠️ Этот друг уже добавлен'); return; }
    if (friends.length >= 10) { notify('❌ Максимум 10 друзей'); return; }

    const newFriend: Friend = { code, name, emoji: '👤', addedAt: Date.now() };
    const updated = [...friends, newFriend];
    setFriends(updated);
    saveFriends(updated);
    setInputCode('');
    setInputName('');
    notify(`✅ ${name} добавлен в друзья! Бонус +10% монет при совместной игре`);
  };

  const handleRemove = (code: string) => {
    const updated = friends.filter(f => f.code !== code);
    setFriends(updated);
    saveFriends(updated);
  };

  const copyCode = () => {
    const text = `${myCode} — мой код в Короле парковки! Добавь меня и получим бонус +10% монет!`;
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card-game-solid p-4 flex flex-col gap-3">
        <div className="font-russo text-white/50 text-xs uppercase tracking-wider">👥 Мой код</div>
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5">
          <span className="text-xl">{playerEmoji}</span>
          <div className="flex-1">
            <div className="font-russo text-yellow-400 text-sm tracking-widest">{myCode}</div>
            <div className="font-nunito text-white/30 text-xs">{playerName}</div>
          </div>
          <button
            className={`text-xs font-russo px-3 py-1.5 rounded-lg transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
            onClick={copyCode}
          >
            {copied ? '✓ Скопировано' : 'Копировать'}
          </button>
        </div>
        <p className="text-white/20 text-xs font-nunito">
          Отправь код другу — когда играете вместе, оба получают <span className="text-yellow-400 font-bold">+10% монет</span> и <span className="text-green-400 font-bold">+15% опыта</span>
        </p>
      </div>

      <div className="card-game p-4 flex flex-col gap-3">
        <div className="font-russo text-white/50 text-xs uppercase tracking-wider">➕ Добавить друга</div>
        <input
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-russo text-white text-sm outline-none focus:border-yellow-500/50 placeholder:text-white/20 uppercase tracking-wider"
          placeholder="КОД ДРУГА"
          value={inputCode}
          maxLength={16}
          onChange={e => setInputCode(e.target.value.toUpperCase())}
        />
        <input
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-nunito text-white text-sm outline-none focus:border-yellow-500/50 placeholder:text-white/20"
          placeholder="Имя друга"
          value={inputName}
          maxLength={20}
          onChange={e => setInputName(e.target.value)}
        />
        <button
          className="btn-yellow py-2 font-russo text-sm"
          onClick={handleAdd}
        >
          Добавить
        </button>
      </div>

      {friends.length > 0 && (
        <div className="card-game p-4 flex flex-col gap-2">
          <div className="font-russo text-white/50 text-xs uppercase tracking-wider mb-1">
            Мои друзья ({friends.length}/10)
          </div>
          {friends.map(f => (
            <div key={f.code} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
              <span className="text-lg">{f.emoji}</span>
              <div className="flex-1">
                <div className="font-russo text-white text-sm">{f.name}</div>
                <div className="font-nunito text-white/30 text-xs tracking-wider">{f.code}</div>
              </div>
              <button
                className="text-white/20 hover:text-red-400 transition-colors text-xs font-russo"
                onClick={() => handleRemove(f.code)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {friends.length === 0 && (
        <div className="text-center text-white/20 font-nunito text-sm py-4">
          Пока нет друзей — поделись своим кодом!
        </div>
      )}
    </div>
  );
}
