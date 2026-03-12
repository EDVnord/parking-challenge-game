import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { adminApi, GiftLog, TARGET_LABELS } from './adminApi';

interface Props {
  secret: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  onClose: () => void;
  onGiftSent: () => void;
  showLog: boolean;
}

export function AdminGiftModal({ secret, loading, setLoading, onClose, onGiftSent }: Omit<Props, 'showLog'>) {
  const [giftCoins, setGiftCoins] = useState('0');
  const [giftGems, setGiftGems] = useState('0');
  const [giftTarget, setGiftTarget] = useState('all');
  const [giftComment, setGiftComment] = useState('');
  const [giftMsg, setGiftMsg] = useState('');

  const handleGift = async () => {
    setGiftMsg('');
    setLoading(true);
    try {
      const res = await adminApi(secret, 'gift', {
        coins: Number(giftCoins),
        gems: Number(giftGems),
        target: giftTarget,
        comment: giftComment,
      });
      setGiftMsg(`✅ Подарок отправлен ${res.affected} игрокам!`);
      setGiftComment('');
      onGiftSent();
    } catch (e: unknown) {
      setGiftMsg(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Icon name="Gift" size={20} className="text-yellow-400" /> Подарок игрокам
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
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
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Комментарий (необязательно)</label>
            <input
              type="text"
              placeholder="Например: За обновление 1.5"
              value={giftComment}
              onChange={e => setGiftComment(e.target.value)}
              maxLength={120}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-yellow-500"
            />
          </div>
        </div>

        {giftMsg && (
          <p className={`text-sm mt-4 ${giftMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
            {giftMsg}
          </p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
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
  );
}

interface GiftsLogTabProps {
  secret: string;
  active: boolean;
}

export function GiftsLogTab({ secret, active }: GiftsLogTabProps) {
  const [giftsLog, setGiftsLog] = useState<GiftLog[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(false);

  const loadGiftsLog = useCallback(async () => {
    setGiftsLoading(true);
    try {
      const res = await adminApi(secret, 'gifts_log', { limit: 50 });
      setGiftsLog(res.log);
    } catch { /* ignore */ } finally {
      setGiftsLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    if (active) loadGiftsLog();
  }, [active, loadGiftsLog]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <span className="font-medium text-sm">История начислений</span>
        <button onClick={loadGiftsLog} className="text-gray-400 hover:text-white transition">
          <Icon name="RefreshCw" size={15} />
        </button>
      </div>
      {giftsLoading ? (
        <div className="text-center py-8 text-gray-500">Загрузка...</div>
      ) : giftsLog.length === 0 ? (
        <div className="text-center py-8 text-gray-500">История пуста</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Кому</th>
              <th className="px-4 py-3 font-medium">💰 Монеты</th>
              <th className="px-4 py-3 font-medium">💎 Гемы</th>
              <th className="px-4 py-3 font-medium">Игроков</th>
              <th className="px-4 py-3 font-medium">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {giftsLog.map(g => (
              <tr key={g.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {g.createdAt ? new Date(g.createdAt).toLocaleString('ru') : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                    {TARGET_LABELS[g.target] || g.target}
                  </span>
                </td>
                <td className="px-4 py-3 text-yellow-400 font-mono">+{g.coins.toLocaleString()}</td>
                <td className="px-4 py-3 text-blue-400 font-mono">+{g.gems.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-300">{g.affected}</td>
                <td className="px-4 py-3 text-gray-400">{g.comment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
