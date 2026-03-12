import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { adminApi, Player } from './adminApi';

interface Props {
  player: Player;
  secret: string;
  onClose: () => void;
  onDone: () => void;
}

const DURATIONS = [
  { label: '1 час', value: 1 },
  { label: '6 часов', value: 6 },
  { label: '12 часов', value: 12 },
  { label: '24 часа', value: 24 },
  { label: '3 дня', value: 72 },
  { label: '7 дней', value: 168 },
  { label: '30 дней', value: 720 },
];

function isBanned(p: Player) {
  if (!p.bannedUntil) return false;
  return new Date(p.bannedUntil) > new Date();
}

export default function AdminBanModal({ player, secret, onClose, onDone }: Props) {
  const [duration, setDuration] = useState(24);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const banned = isBanned(player);

  const handleBan = async () => {
    setLoading(true);
    setMsg('');
    try {
      await adminApi(secret, 'ban', { playerId: player.id, duration });
      const label = DURATIONS.find(d => d.value === duration)?.label || `${duration}ч`;
      setMsg(`✅ Игрок забанен на ${label}`);
      setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch (e: unknown) {
      setMsg(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async () => {
    setLoading(true);
    setMsg('');
    try {
      await adminApi(secret, 'unban', { playerId: player.id });
      setMsg('✅ Бан снят');
      setTimeout(() => { onDone(); onClose(); }, 1000);
    } catch (e: unknown) {
      setMsg(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Icon name="Ban" size={20} className="text-red-400" /> Бан игрока
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5 bg-gray-800 rounded-xl p-3">
          <span className="text-2xl">{player.emoji}</span>
          <div>
            <div className="font-semibold">{player.name}</div>
            <div className="text-xs text-gray-400">
              {banned
                ? <span className="text-red-400">Забанен до {new Date(player.bannedUntil!).toLocaleString('ru')}</span>
                : <span className="text-green-400">Не забанен</span>
              }
            </div>
          </div>
        </div>

        {!banned && (
          <>
            <label className="text-xs text-gray-400 mb-2 block">Длительность бана</label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`py-2 rounded-xl text-sm font-medium transition border ${
                    duration === d.value
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </>
        )}

        {msg && (
          <p className={`text-sm mb-4 ${msg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
            {msg}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl py-2.5 transition"
          >
            Отмена
          </button>
          {banned ? (
            <button
              onClick={handleUnban}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-500 rounded-xl py-2.5 font-semibold transition"
            >
              {loading ? '...' : 'Снять бан'}
            </button>
          ) : (
            <button
              onClick={handleBan}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-500 rounded-xl py-2.5 font-semibold transition"
            >
              {loading ? '...' : 'Забанить'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
