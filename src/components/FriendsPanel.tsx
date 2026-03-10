import { useState, useEffect, useCallback } from 'react';
import { FRIENDS_URL, getOrCreateAnonId } from '@/pages/parkingTypes';
import { t } from '@/i18n';

const FRIEND_BONUS_COINS = 0.1;
const FRIEND_BONUS_XP = 0.15;

const FRIENDS_CACHE_KEY = 'parking_friends_cache_v2';

export interface Friend {
  id?: number;
  code: string;
  name: string;
  emoji: string;
  xp?: number;
  wins?: number;
  gamesTogether?: number;
}

export function getFriends(): Friend[] {
  try { return JSON.parse(localStorage.getItem(FRIENDS_CACHE_KEY) ?? '[]'); } catch { return []; }
}

export function getMyFriendCode(): string {
  return localStorage.getItem('parking_my_friend_code') ?? '...';
}

export function hasFriendInRoom(roomPlayerIds: string[], myFriends: Friend[]): boolean {
  const codes = myFriends.map(f => f.code.toUpperCase());
  return roomPlayerIds.some(id => codes.some(code => id.toUpperCase().includes(code)));
}

export const FRIEND_BONUS = { coins: FRIEND_BONUS_COINS, xp: FRIEND_BONUS_XP };

function buildIds(localPlayerId: string): { yaId?: string; playerId?: string } {
  if (localPlayerId.startsWith('ya_')) return { yaId: localPlayerId };
  return { playerId: localPlayerId || getOrCreateAnonId() };
}

async function friendsApiWith(localPlayerId: string, action: string, payload: Record<string, unknown>) {
  const ids = buildIds(localPlayerId);
  const res = await fetch(FRIENDS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...ids, ...payload }),
  });
  if (!res.ok) throw new Error(`server_error_${res.status}`);
  return res.json();
}

interface FriendsPanelProps {
  playerName: string;
  playerEmoji: string;
  localPlayerId: string;
  notify: (msg: string) => void;
}

export default function FriendsPanel({ playerName, playerEmoji, localPlayerId, notify }: FriendsPanelProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myCode, setMyCode] = useState<string>(() => localStorage.getItem('parking_my_friend_code') ?? '...');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const loadFriends = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await friendsApiWith(localPlayerId, 'list', {});
      if (data.friends) {
        setFriends(data.friends);
        localStorage.setItem(FRIENDS_CACHE_KEY, JSON.stringify(data.friends));
      }
      if (data.myCode) {
        setMyCode(data.myCode);
        localStorage.setItem('parking_my_friend_code', data.myCode);
      }
    } catch { /* ignore */ }
    setListLoading(false);
  }, [localPlayerId]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const handleAdd = async () => {
    const code = inputCode.trim().toUpperCase();
    if (code.length < 6) { notify(t('friends_err_short')); return; }
    if (code === myCode) { notify(t('friends_err_self')); return; }
    if (friends.some(f => f.code.toUpperCase() === code)) { notify(t('friends_err_already')); return; }
    if (friends.length >= 20) { notify(t('friends_err_max')); return; }

    setLoading(true);
    try {
      const data = await friendsApiWith(localPlayerId, 'add', { code });
      if (data.error) {
        notify(`❌ ${data.error}`);
      } else {
        const f = data.friend;
        setFriends(prev => [...prev, { code: f.code, name: f.name, emoji: f.emoji }]);
        setInputCode('');
        notify(`✅ ${f.name} ${t('friends_added')}`);
      }
    } catch {
      notify(t('friends_err_conn'));
    }
    setLoading(false);
  };

  const handleRemove = async (code: string) => {
    const prev = friends;
    setFriends(f => f.filter(x => x.code !== code));
    try {
      await friendsApiWith(localPlayerId, 'remove', { code });
    } catch {
      setFriends(prev);
    }
  };

  const copyCode = () => {
    const text = myCode;
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
      {/* Мой код */}
      <div className="card-game-solid p-4 flex flex-col gap-3">
        <div className="font-russo text-white/50 text-xs uppercase tracking-wider">{t('friends_my_code')}</div>
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

      {/* Добавить друга */}
      <div className="card-game p-4 flex flex-col gap-3">
        <div className="font-russo text-white/50 text-xs uppercase tracking-wider">➕ {t('friends_add_title')}</div>
        <div className="flex flex-col gap-2">
          <input
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-russo text-white text-sm outline-none focus:border-yellow-500/50 placeholder:text-white/20 uppercase tracking-wider"
            placeholder={t('friends_code_hint')}
            value={inputCode}
            maxLength={16}
            onChange={e => setInputCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            className="btn-yellow w-full py-2 font-russo text-sm disabled:opacity-50"
            onClick={handleAdd}
            disabled={loading}
          >
            {loading ? '...' : t('friends_add')}
          </button>
        </div>
        <p className="text-white/20 text-xs font-nunito">
          Друг сразу увидит тебя в своём списке — добавление взаимное
        </p>
      </div>

      {/* Список друзей */}
      {listLoading ? (
        <div className="text-center text-white/20 font-nunito text-sm py-4">Загрузка...</div>
      ) : friends.length > 0 ? (
        <div className="card-game p-4 flex flex-col gap-2">
          <div className="font-russo text-white/50 text-xs uppercase tracking-wider mb-1">
            Мои друзья ({friends.length}/20)
          </div>
          {friends.map(f => (
            <div key={f.code} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
              <span className="text-lg">{f.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-russo text-white text-sm truncate">{f.name}</div>
                <div className="font-nunito text-white/30 text-xs tracking-wider">{f.code}</div>
              </div>
              {f.wins !== undefined && (
                <div className="text-right shrink-0">
                  <div className="font-russo text-yellow-400 text-xs">{f.wins} {t('friends_wins')}</div>
                  <div className="font-nunito text-white/20 text-xs">{(f.xp ?? 0).toLocaleString()} XP</div>
                </div>
              )}
              <button
                className="text-white/20 hover:text-red-400 transition-colors text-xs font-russo ml-1 shrink-0"
                onClick={() => handleRemove(f.code)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-white/20 font-nunito text-sm py-4">
          {t('friends_empty')}
        </div>
      )}
    </div>
  );
}