const _BASE = (import.meta.env['VITE_API_URL'] || 'https://ednord.ru/api').replace(/\/$/, '');
export const ADMIN_URL = `${_BASE}/admin`;

export interface Player {
  id: number;
  name: string;
  emoji: string;
  coins: number;
  gems: number;
  xp: number;
  wins: number;
  gamesPlayed: number;
  yaId?: string;
  anonId?: string;
  friendCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Stats {
  totalPlayers: number;
  yaPlayers: number;
  activeDay: number;
  activeWeek: number;
  totalCoins: number;
  totalGems: number;
  maxXp: number;
  maxWins: number;
}

export interface GiftLog {
  id: number;
  coins: number;
  gems: number;
  target: string;
  affected: number;
  comment: string;
  createdAt: string;
}

export const TARGET_LABELS: Record<string, string> = {
  all: 'Все игроки',
  ya: 'Яндекс игроки',
  active_week: 'Активные за неделю',
  active_day: 'Активные сегодня',
};

export async function adminApi(secret: string, action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(ADMIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, action, ...payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ошибка сети' }));
    throw new Error(err.detail || 'Ошибка');
  }
  return res.json();
}
