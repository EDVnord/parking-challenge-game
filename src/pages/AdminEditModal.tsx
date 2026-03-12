import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { adminApi, Player } from './adminApi';

interface Props {
  player: Player;
  secret: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
}

export default function AdminEditModal({ player, secret, loading, setLoading, onClose, onSaved }: Props) {
  const [editFields, setEditFields] = useState<Record<string, string | number>>({
    coins: player.coins,
    gems: player.gems,
    xp: player.xp,
    wins: player.wins,
    name: player.name,
    emoji: player.emoji,
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [linkYaId, setLinkYaId] = useState('');

  const handleLinkYa = async () => {
    if (!linkYaId.trim()) return;
    setEditError('');
    setLoading(true);
    try {
      const res = await adminApi(secret, 'link_ya', { playerId: player.id, yaId: linkYaId.trim() });
      setEditSuccess(res.merged
        ? `✅ Яндекс ID привязан, профиль «${res.mergedName}» слит`
        : '✅ Яндекс ID привязан');
      setLinkYaId('');
      onSaved();
    } catch (e: unknown) {
      setEditError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setEditError('');
    setLoading(true);
    try {
      await adminApi(secret, 'update', {
        playerId: player.id,
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
      onSaved();
    } catch (e: unknown) {
      setEditError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">
            Редактировать: {player.emoji} {player.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
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

        {/* Яндекс ID */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">
            Яндекс ID сейчас: <span className="text-yellow-400 font-mono">{player.yaId || 'не привязан'}</span>
          </div>
          <label className="text-xs text-gray-400 mb-1 block">Привязать / сменить Яндекс ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ya_1234567890"
              value={linkYaId}
              onChange={e => setLinkYaId(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-yellow-500"
            />
            <button
              onClick={handleLinkYa}
              disabled={loading || !linkYaId.trim()}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white rounded-xl px-3 py-2 text-sm font-semibold transition"
            >
              Привязать
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Яндекс ID можно найти в консоли браузера при входе через Яндекс Игры (вида ya_123…)</p>
        </div>

        {editError && <p className="text-red-400 text-sm mt-3">{editError}</p>}
        {editSuccess && <p className="text-green-400 text-sm mt-3">{editSuccess}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
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
  );
}
