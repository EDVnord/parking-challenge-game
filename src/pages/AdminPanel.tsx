import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';

const ADMIN_URL = import.meta.env.VITE_SERVER_URL
  ? `${import.meta.env.VITE_SERVER_URL}/admin`
  : 'https://ednord.ru/api/admin';

interface Player {
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

interface Stats {
  totalPlayers: number;
  yaPlayers: number;
  activeDay: number;
  activeWeek: number;
  totalCoins: number;
  totalGems: number;
  maxXp: number;
  maxWins: number;
}

async function adminApi(secret: string, action: string, payload: Record<string, unknown> = {}) {
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

export default function AdminPanel() {
  const [secret, setSecret] = useState(() => localStorage.getItem('admin_secret') || '');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string | number>>({});
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);
  const [msg, setMsg] = useState('');

  const [giftOpen, setGiftOpen] = useState(false);
  const [giftCoins, setGiftCoins] = useState('0');
  const [giftGems, setGiftGems] = useState('0');
  const [giftTarget, setGiftTarget] = useState('all');
  const [giftMsg, setGiftMsg] = useState('');

  const loadData = useCallback(async (s: string, searchVal = search, pageVal = page) => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        adminApi(s, 'stats'),
        adminApi(s, 'list', { search: searchVal, limit: PER_PAGE, offset: pageVal * PER_PAGE }),
      ]);
      setStats(statsRes.stats);
      setPlayers(listRes.players);
      setTotal(listRes.total);
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message.includes('403') || err.message.toLowerCase().includes('пароль')) {
        setAuthed(false);
        setAuthError('Неверный пароль');
      }
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  const handleLogin = async () => {
    setAuthError('');
    setLoading(true);
    try {
      await adminApi(secret, 'stats');
      localStorage.setItem('admin_secret', secret);
      setAuthed(true);
      loadData(secret, '', 0);
    } catch {
      setAuthError('Неверный пароль');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) loadData(secret, search, page);
  }, [page]);

  const handleSearch = () => {
    setPage(0);
    loadData(secret, search, 0);
  };

  const openEdit = (p: Player) => {
    setEditPlayer(p);
    setEditFields({ coins: p.coins, gems: p.gems, xp: p.xp, wins: p.wins, name: p.name, emoji: p.emoji });
    setEditError('');
    setEditSuccess('');
  };

  const handleSave = async () => {
    if (!editPlayer) return;
    setEditError('');
    setLoading(true);
    try {
      await adminApi(secret, 'update', {
        playerId: editPlayer.id,
        fields: {
          coins: Number(editFields.coins),
          gems: Number(editFields.gems),
          xp: Number(editFields.xp),
          wins: Number(editFields.wins),
          name: editFields.name,
          emoji: editFields.emoji,
        },
      });
      setEditSuccess('Сохранено!');
      loadData(secret, search, page);
    } catch (e: unknown) {
      setEditError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGift = async () => {
    setGiftMsg('');
    setLoading(true);
    try {
      const res = await adminApi(secret, 'gift', {
        coins: Number(giftCoins),
        gems: Number(giftGems),
        target: giftTarget,
      });
      setGiftMsg(`✅ Подарок отправлен ${res.affected} игрокам!`);
      loadData(secret, search, page);
    } catch (e: unknown) {
      setGiftMsg(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (p: Player) => {
    setLoading(true);
    try {
      await adminApi(secret, 'delete', { playerId: p.id });
      setConfirmDelete(null);
      setMsg(`Игрок ${p.name} удалён`);
      loadData(secret, search, page);
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-gray-800">
          <h1 className="text-white text-2xl font-bold mb-2 text-center">Админ-панель</h1>
          <p className="text-gray-400 text-sm text-center mb-6">Король парковки</p>
          <input
            type="password"
            placeholder="Пароль администратора"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 mb-3 border border-gray-700 outline-none focus:border-blue-500"
          />
          {authError && <p className="text-red-400 text-sm mb-3">{authError}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 font-semibold transition"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Админ-панель · Король парковки</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setGiftOpen(true); setGiftMsg(''); }}
            className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm px-4 py-2 rounded-xl flex items-center gap-2 transition font-semibold"
          >
            <Icon name="Gift" size={16} /> Подарок игрокам
          </button>
          <button
            onClick={() => { setAuthed(false); localStorage.removeItem('admin_secret'); }}
            className="text-gray-400 hover:text-white text-sm flex items-center gap-2"
          >
            <Icon name="LogOut" size={16} /> Выйти
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Игроков всего', value: stats.totalPlayers, icon: 'Users', color: 'text-blue-400' },
              { label: 'Яндекс игроки', value: stats.yaPlayers, icon: 'Gamepad2', color: 'text-yellow-400' },
              { label: 'Активны сегодня', value: stats.activeDay, icon: 'Activity', color: 'text-green-400' },
              { label: 'Активны за неделю', value: stats.activeWeek, icon: 'TrendingUp', color: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className={`flex items-center gap-2 mb-1 ${s.color}`}>
                  <Icon name={s.icon as 'Users'} size={16} />
                  <span className="text-xs text-gray-400">{s.label}</span>
                </div>
                <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Поиск по нику, Яндекс ID, коду друга..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-500 px-5 rounded-xl font-semibold transition flex items-center gap-2"
          >
            <Icon name="Search" size={16} /> Найти
          </button>
          <button
            onClick={() => loadData(secret, search, page)}
            className="bg-gray-800 hover:bg-gray-700 px-4 rounded-xl transition"
          >
            <Icon name="RefreshCw" size={16} />
          </button>
        </div>

        {msg && (
          <div className="bg-green-900/40 border border-green-700 text-green-300 rounded-xl px-4 py-3 flex items-center justify-between">
            {msg}
            <button onClick={() => setMsg('')}><Icon name="X" size={16} /></button>
          </div>
        )}

        {/* Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Игрок</th>
                  <th className="px-4 py-3 font-medium">💰 Монеты</th>
                  <th className="px-4 py-3 font-medium">💎 Гемы</th>
                  <th className="px-4 py-3 font-medium">⭐ XP</th>
                  <th className="px-4 py-3 font-medium">🏆 Победы</th>
                  <th className="px-4 py-3 font-medium">Игр</th>
                  <th className="px-4 py-3 font-medium">Тип</th>
                  <th className="px-4 py-3 font-medium">Код друга</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading && players.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-500">Загрузка...</td></tr>
                )}
                {!loading && players.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-500">Игроки не найдены</td></tr>
                )}
                {players.map(p => (
                  <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{p.emoji}</span>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-gray-500 text-xs">#{p.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-yellow-400 font-mono">{p.coins.toLocaleString()}</td>
                    <td className="px-4 py-3 text-blue-400 font-mono">{p.gems.toLocaleString()}</td>
                    <td className="px-4 py-3 text-purple-400 font-mono">{p.xp.toLocaleString()}</td>
                    <td className="px-4 py-3 text-green-400 font-mono">{p.wins}</td>
                    <td className="px-4 py-3 text-gray-400">{p.gamesPlayed}</td>
                    <td className="px-4 py-3">
                      {p.yaId
                        ? <span className="bg-yellow-900/40 text-yellow-400 text-xs px-2 py-0.5 rounded-full">Яндекс</span>
                        : p.anonId
                        ? <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">Аноним</span>
                        : <span className="bg-blue-900/40 text-blue-400 text-xs px-2 py-0.5 rounded-full">Аккаунт</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.friendCode || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-blue-400 hover:text-blue-300 transition"
                          title="Редактировать"
                        >
                          <Icon name="Pencil" size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(p)}
                          className="text-red-500 hover:text-red-400 transition"
                          title="Удалить"
                        >
                          <Icon name="Trash2" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
            <span>Показано {players.length} из {total}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-40 transition"
              >
                ← Назад
              </button>
              <span className="px-3 py-1">стр. {page + 1}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * PER_PAGE >= total}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-40 transition"
              >
                Вперёд →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">
                Редактировать: {editPlayer.emoji} {editPlayer.name}
              </h2>
              <button onClick={() => setEditPlayer(null)} className="text-gray-400 hover:text-white">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { key: 'name', label: 'Ник', type: 'text' },
                { key: 'emoji', label: 'Эмодзи', type: 'text' },
                { key: 'coins', label: '💰 Монеты', type: 'number' },
                { key: 'gems', label: '💎 Гемы', type: 'number' },
                { key: 'xp', label: '⭐ XP', type: 'number' },
                { key: 'wins', label: '🏆 Победы', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                  <input
                    type={f.type}
                    value={editFields[f.key] ?? ''}
                    onChange={e => setEditFields(prev => ({
                      ...prev,
                      [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                    }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>

            {editError && <p className="text-red-400 text-sm mt-3">{editError}</p>}
            {editSuccess && <p className="text-green-400 text-sm mt-3">{editSuccess}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditPlayer(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl py-2.5 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 rounded-xl py-2.5 font-semibold transition"
              >
                {loading ? 'Сохраняю...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700">
            <h2 className="text-lg font-bold mb-2">Удалить игрока?</h2>
            <p className="text-gray-400 text-sm mb-5">
              {confirmDelete.emoji} <b>{confirmDelete.name}</b> будет удалён навсегда. Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl py-2.5 transition"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-500 rounded-xl py-2.5 font-semibold transition"
              >
                {loading ? '...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Gift Modal */}
      {giftOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Icon name="Gift" size={20} className="text-yellow-400" /> Подарок игрокам
              </h2>
              <button onClick={() => setGiftOpen(false)} className="text-gray-400 hover:text-white">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Кому отправить</label>
                <select
                  value={giftTarget}
                  onChange={e => setGiftTarget(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-yellow-500"
                >
                  <option value="all">Всем игрокам</option>
                  <option value="ya">Только Яндекс игрокам</option>
                  <option value="active_week">Активным за неделю</option>
                  <option value="active_day">Активным сегодня</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">💰 Монеты</label>
                  <input
                    type="number"
                    min="0"
                    value={giftCoins}
                    onChange={e => setGiftCoins(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">💎 Гемы</label>
                  <input
                    type="number"
                    min="0"
                    value={giftGems}
                    onChange={e => setGiftGems(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-yellow-500"
                  />
                </div>
              </div>
            </div>

            {giftMsg && (
              <p className={`text-sm mt-4 ${giftMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {giftMsg}
              </p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setGiftOpen(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl py-2.5 transition"
              >
                Закрыть
              </button>
              <button
                onClick={handleGift}
                disabled={loading}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 rounded-xl py-2.5 font-semibold transition"
              >
                {loading ? 'Отправляю...' : 'Отправить подарок'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}